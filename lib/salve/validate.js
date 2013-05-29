/**
 * @module validate
 * @desc RNG-based validator.
 * @author Louis-Dominique Dubeau
 */

define(/** @lends <global> */ function (require, exports, module) {
'use strict';

exports.version = "0.9.5-pre2";

// XML validation against a schema could work without any lookahead if
// it were not for namespaces. However, namespace support means that
// the interpretation of a tag or of an attribute may depend on
// information which appears *later* than the earliest time at which a
// validation decision might be called for:
//
// Consider:
//    <elephant a="a" b="b"... xmlns="elephant_uri"/>
//
// It is not until xmlns is encountered that the validator will know
// that elephant belongs to the elephant_uri namespace. This is not
// too troubling for a validator that can access the whole document
// but for validators used in a line-by-line process (which is the
// case if the validator is driven by a CodeMirror or Ace tokenizer,
// and anything based on them), this can be problematic because the
// attributes could appear on lines other than the line on which the
// start of the tag appears:
// 
// <elephant
//  a="a"
//  b="b"
//  xmlns="elephant_uri"/>
//
// The validator encounters the start of the tag and the attributes,
// without knowing that eventually this elephant tag belongs to the
// elephant_uri namespace. This discovery might result in things that
// were seen previously and deemed valid become invalid. Or things
// that were invalid, become valid.
// 
// Handling namespaces will require lookahead. Although the validator
// would still expect all events that have tag and attribute names to
// have the a proper namespace uri, upon enterStartTag the parsing
// code which feeds events to the validator would look ahead for these
// cases:
//
// * There is a valid > character ending the start tag. Scan the start tag
//   for all namespace declarations.
//
// * The tag ends at EOF. Scan from beginning of tag to EOF for
//   namespace declarations.
//
// * The tag is terminated by an invalid token. Scan from beginning of
//   tag to error.
//
// Then issue the enterStartTag and attributeName events on the basis
// of what was found in scanning.
//
// When the parsing code discovers a change in namespace declarations,
// for instance because the user typed xmlns="..." or removed a
// declaration, the parsing code must *restart* validation *from* the
// location of the original enterStartTag event.

var util = require("./util");
var hashstructs = require("./hashstructs");
var oop = require("./oop");
var Set = require("./set").Set;
var inherit = oop.inherit;
var implement = oop.implement;
var HashSet = hashstructs.HashSet;
var HashMap = hashstructs.HashMap;

//
// Debugging utilities
//

var DEBUG=false;

function trace(msg) {
    console.log(msg);
}

function stackTrace() {
    trace(new Error().stack);
}

var possible_tracer;
var fireEvent_tracer;
var plain_tracer;

(function () {
    var buf = "";
    var step = " ";

    var name_or_path = function(el) {
        return (el !== undefined) ? 
            ((el.name !== undefined) ? 
             (" named " + el.name.toString()) 
             : (" with path " + el.xml_path)) : "";
    };

    var call_dump = function (msg, name, me) {
        trace(buf + msg + name + " on class " + me.constructor.name + " id " + me.id + ((me.el !== undefined)?name_or_path(me.el):name_or_path(me)));
    };

    possible_tracer = function (old_method, name, args) {
        buf += step;
        call_dump("calling ", name, this);
        var ret = old_method.apply(this, args);
        call_dump("called ", name, this);
        trace(buf + "return from the call: " + util.inspect(ret));
        buf = buf.slice(step.length);
        return ret;
    };

    fireEvent_tracer = function (old_method, name, args) {
        buf += step;
        call_dump("calling ", name, this);
        trace(buf + util.inspect(args[0]));
        
        var ret = old_method.apply(this, args);
        call_dump("called ", name, this);
        if (ret !== true)
            trace(buf + "return from the call: " + util.inspect(ret));
        buf = buf.slice(step.length);
        return ret;
    };

    plain_tracer = function (old_method, name, args) {
        buf += step;
        call_dump("calling ", name, this);
        
        var ret = old_method.apply(this, args);
        call_dump("called ", name, this);
        //if (ret !== true)
        //    trace(buf + "return from the call: " + util.inspect(ret));
        buf = buf.slice(step.length);
        return ret;
    };

})();

function wrap(me, name, f) {
    var mangled_name = "___" + name;
    me[mangled_name] = me[name];
    me[name] = function () {
        return f.call(this, me[mangled_name], name, arguments);
    };
}

/**
 * Sets up a newWalker method in a prototype.
 *
 * @private
 * @param {Function} el_cls The class that will get the new method.
 * @param {Function} walker_cls The Walker class to instanciate.
 */
function addWalker(el_cls, walker_cls)
{
    el_cls.prototype.newWalker = function () {
        /* jshint newcap: false */
        return new walker_cls(this);
    };
}

/**
 * Factory method to create constructors that create singleton
 * objects. Upon first call, the constructor will return a new
 * object. Subsequent calls to the constructor return the same object.
 *
 * @private
 *
 * @param {Function} base The base class from which this constructor
 * should inherit. Note, that inherit() should still be called outside
 * makeSingletonConstructor to setup inheritance.
 */

function makeSingletonConstructor(base) {
    function f() {
        if (f.prototype.__singleton_instance !== undefined)
            return f.prototype.__singleton_instance;
    
        /* jshint validthis: true */
        base.apply(this, arguments);

        f.prototype.__singleton_instance = this;
        return this;
    }

    return f;
}

// function EventSet() {
//     var args = Array.prototype.slice.call(arguments);
//     args.unshift(function (x) { return x.hash() });
//     HashSet.apply(this, args);
// }
// inherit(EventSet, HashSet);

// The naive Set implementation turns out to be faster than the
// HashSet implementation for how we are using it.

var EventSet = Set;

/** Immutable objects modeling XML Expanded Names.
 * @constructor
 *
 * @param {String} ns The namespace URI.
 * @param {String} name The local name of the entity.
 */
function EName(ns, name) {
    this.ns = ns;
    this.name = name;
}
(function () {
    /** 
     * @method
     * @name EName#toString
     * 
     * @returns {String} A string representing the object.
     */
    this.toString = function () {
        return "{" + this.ns + "}" + this.name;
    };

    /**
     * @method
     * @name EName#equal
     * 
     * @param {EName} other The other object to compare this object
     * with.
     * 
     * @returns {Boolean} True if this object equals the other.
     */
    this.equal = function (other) {
        return this.ns === other.ns && this.name === other.name;
    };
}).call(EName.prototype);

function hashHelper(o) { return o.hash(); }

/**
 * 
 * This is the base class for all patterns created from the file
 * passed to contrsuctTree. These patterns form a JS representation of
 * the simplified RNG tree. The base class implements a leaf in the
 * RNG tree. In other words, it does not itself refer to children
 * Patterns. (To put it in other words, it has no subpaterns.)
 * @constructor
 *
 * @param {String} xml_path This is a string which uniquely identifies
 * the element from the simplified RNG tree. Used in debugging.
 */
function Pattern(xml_path) { 
    this.id = this.__newID();
    this.xml_path = xml_path;
}

inherit(Pattern, Object);
(function () {
    var id=0;

    this.__newID = function () {
        return id++;
    };

    this.hash = function () { return this.id; };

    /**
     * Resolve references to definitions.
     *
     * @method
     * @name Pattern#_resolve
     * @private
     *
     * @param {Array} definitions The definitions that exist in this
     * grammar.
     * 
     * @returns {Set} The set of references that cannot be
     * resolved. This should be empty if everything has been
     * resolved. The caller is free to modify the value returned as
     * needed.
     */
    this._resolve = function (definitions) {
        return new Set();
    };

    /**
     * <p>This method must be called after resolution has been
     * performed.  _prepare recursively calls children but does not
     * traverse ref-define boundaries to avoid infinite regress...</p>
     *
     * <p>This function now performs two tasks: a) it prepares the
     * attributes (Definition and Element object maintain a patter
     * which contains only attribute patterns, and nothing else), b)
     * it gathers all the namespaces seen in the schema.</p>
     *
     * @method
     * @private
     * @name Pattern#_prepare
     * @param {Object} namespaces An object whose keys are the 
     * namespaces seen in the schema. This method populates the object.
     *
     */
    this._prepare = function(namespaces)  {
        // nothing here
    };


    /**
     * Creates a new walker to walk this pattern.
     * 
     *
     * @method
     * @name Pattern#newWalker
     * @returns {Walker} A walker.
     */
    this.newWalker = function () {
        throw new Error("must define newWalker method");
    };

    /**
     * Make a deep copy of this pattern.
     * 
     * @method
     * @name Pattern#clone
     *
     * @returns {Pattern} A new copy.
     */
    this.clone = function () {
        return this._clone(new HashMap(hashHelper));
    };

    /**
     * Helper function for clone. Code that is not part of the
     * Pattern family would call clone() whereas Pattern and
     * its derived classes call _clone() with the appropriate memo.
     *
     * @param {HashMap} memo A mapping of old object to copy
     * object. As a tree of patterns is being cloned, this memo is
     * populated. So if A is cloned to B then a mapping from A to B is
     * stored in the memo. If A is seen again in the same cloning
     * operation, then it will be substituted with B instead of
     * creating a new object.
     *
     * @method
     * @name Pattern#_clone
     * @private
     *
     */
    this._clone = function (memo) {
        var other = memo.has(this);
        if (other !== undefined)
            return other;
        other = new this.constructor();
        memo.add(this, other);
        this._copyInto(other, memo);
        return other;
    };

    /**
     * Helper method for clone() and _clone(). All classes deriving
     * from Pattern must implement their own version of this
     * function so that they copy and clone their fields as needed.
     *
     * @method
     * @name Pattern#_copyInto
     * @private
     * 
     * @param {Pattern} obj Object into which we must copy the
     * fields of this object.
     *
     * @param {HashMap} memo The memo that contains the copy
     * mappings. See _clone above().
     */
    this._copyInto = function (obj, memo) {
        obj.xml_path = this.xml_path;
    };


    /**
     * Helper method for _prepare(). This method will remove all
     * non-attribute children among the patterns of this object,
     * recursively. So after returning, this object contains only
     * attributes and the Patterns necessary to contain them.
     *
     * This is a destructive operation: it modifies the object on
     * which it is called. Expected to be called on patterns that have
     * been cloned from the original tree.
     *
     * This method crosses the ref-define boundaries.
     *
     * @method
     * @name Pattern#_keepAttrs
     * @private
     *
     * @returns {Pattern} The pattern itself if after transformation
     * it has attributes among its patterns. Undefined if the pattern
     * needs to be tossed because it does not contain any attributes.
     */
    
    this._keepAttrs = function () {
        // No children, toss.
        return undefined;
    };
    
    /**
     * Helper method for _prepare(). This method goes through the
     * children of this object to clean out Patterns that are no
     * longer needed once non-attribute Patterns have been
     * removed. For instance, a group which used to contain an element
     * and an attribute will contain only an attribute once the
     * element has been removed. This group has effectively become
     * meaningless so _cleanAttrs would modify the tree replace the
     * group with its child. Supposing that a and c are attributes, b
     * is an element:
     * 
     * Group(Group(a, b), c) -> Group(a, c)
     * 
     * This is a destructive operation: it modifies the object on
     * which it is called. Expected to be called on patterns that have
     * been cloned from the original tree.
     * 
     * @method
     * @name Pattern#_cleanAttrs
     * @private
     *
     * @returns {Array} A report of the form [el, flag]. The el
     * element is the pattern which replaces the pattern on which the
     * method was called. The flag element tells whether there has
     * been a modification inside el. The return value is undefined
     * when the pattern needs to be tossed.
     */
    this._cleanAttrs = function () {
        return undefined;
    };

    /**
     * @method
     * @name Pattern#_elementDefinitions
     * @private
     * 
     * @param {object} memo The memo in which to store the frequency
     * of each element encountered.
     */
    this._elementDefinitions = function (memo) {
        return; // By default we have no children.
    };

}).call(Pattern.prototype);

/**
 * Pattern objects of this class have exactly one child pattern.
 *
 * @constructor
 * @private
 * @extends Pattern
 */
function PatternOnePattern(xml_path) { 
    Pattern.call(this, xml_path);
    this.pat = undefined;
}
inherit(PatternOnePattern, Pattern);
(function () {
    this._resolve = function (definitions) {
        return new Set(this.pat._resolve(definitions));
    };

    this._copyInto = function (obj, memo) {
        Pattern.prototype._copyInto.call(this, obj, memo);
        obj.pat = this.pat._clone(memo);
    };
    
    this._prepare = function(namespaces)  {
        this.pat._prepare(namespaces);
    };

    this._keepAttrs = function () {
        var pats = [];
        var atts = this.pat._keepAttrs();
        if (atts !== undefined) {
            this.pat = atts;
            return this;
        }
    
        // No children, toss.
        return undefined;
    };

    this._cleanAttrs = function () {
        var modified = false;

        var atts = this.pat._cleanAttrs();

        if (atts !== undefined) {
            if (atts[0] instanceof Empty)
                return undefined;

            this.pat = atts[0];
            modified = atts[1];
            return [this, modified];
        }

        return undefined;
    };

    this._elementDefinitions = function (memo) {
        this.pat._elementDefinitions(memo);
    };

}).call(PatternOnePattern.prototype);


/**
 * Pattern objects of this class have exactly two child patterns.
 *
 * @constructor
 * @private
 * @extends Pattern
 */
function PatternTwoPatterns(xml_path) { 
    Pattern.call(this, xml_path);
    this.pat_a = undefined;
    this.pat_b = undefined;
}
inherit(PatternTwoPatterns, Pattern);
(function () {
    this._resolve = function (definitions) {
        var set = this.pat_a._resolve(definitions);
        set.union(this.pat_b._resolve(definitions));
        return set;
    };

    this._copyInto = function (obj, memo) {
        Pattern.prototype._copyInto.call(this, obj, memo);
        obj.pat_a = this.pat_a._clone(memo);
        obj.pat_b = this.pat_b._clone(memo);
    };
    
    this._prepare = function(namespaces)  {
        this.pat_a._prepare(namespaces);
        this.pat_b._prepare(namespaces);
    };

    this._keepAttrs = function () {
        var pats = [];
        var atts = this.pat_a._keepAttrs();
        if (atts !== undefined)
            pats.push(atts);

        atts = this.pat_b._keepAttrs();
        if (atts !== undefined)
            pats.push(atts);

        if (pats.length > 0)
        {
            this.pats = pats;
            return this;
        }
    
        // No children, toss.
        return undefined;
    };

    this._cleanAttrsFromPat = function () {
        var modified = false;
        var pats = [];
        var atts = this.pat_a._cleanAttrs();
        if (atts !== undefined) {
            pats.push(atts[0]);
            modified = atts[1];
        }
        atts = this.pat_b._cleanAttrs();
        if (atts !== undefined) {
            pats.push(atts[0]);
            modified = modified || atts[1];
        }

        if (pats.length === 0)
            return undefined;

        return [pats, modified];
    };

    this._cleanAttrs = function () {
        var cleaned = this._cleanAttrsFromPat();
        if (cleaned === undefined)
            return undefined;
        var pats = cleaned[0];

        // After modifications we don't allow anything...
        if ((pats.length == 1) && (pats[0] instanceof Empty))
            return undefined;

        this.pat_a = pats[0];
        this.pat_b = pats[1];
        
        return [this, cleaned[1]];
    };

    this._elementDefinitions = function (memo) {
        this.pat_a._elementDefinitions(memo);
        this.pat_b._elementDefinitions(memo);
    };

}).call(PatternTwoPatterns.prototype);

/**
 * The fireEvent methods return an array of objects of this class to
 * notify the caller of errors in the file being validated.
 * 
 * @constructor
 * 
 * @param {String} msg The error message.
 * 
 */
function ValidationError(msg) {
    this.msg = msg;
    // May be useful for debugging: 
    // this.stack_trace = new Error().stack;
}

(function () {
    /**
     * @method
     * @name ValidationError#toString
     * @returns {String} The text representation of the error.
     */
    this.toString = function() { return this.msg; };

    /**
     * This method provides the caller with the list of all names that
     * are used in the error message. 
     * 
     * @method 
     * @name ValidationError#getNames
     * 
     * @returns {Array.<EName>} The list of names used in the error
     * message.
     */
    this.getNames = function () {
        return [];
    };

    /**
     * <p>This method transform the ValidationError object to a string
     * but uses the names in the parameter passed to it to format the
     * string.</p>
     *
     * <p>Since salve does not support namespaces, someone using salve
     * would typically use this method so as to replace the Expanded
     * Names passed in error messages with qualified names.</p>
     * 
     * @method 
     * @name ValidationError#toStringWithNames
     * 
     * @param {Array.<String>} names The array of names to use. This
     * should be an array of the same length as that returned by
     * getNames, with each named replaced with a corresponding string.
     * 
     * @returns {String} The object formated as a string.
     */
    this.toStringWithNames = function (names) {
        // We do not have names in ValidationError
        return this.msg;
    };

}).call(ValidationError.prototype);

/**
 * This class serves as a base for all those errors that have only one
 * name involved.
 * 
 * @constructor
 * 
 * @param {String} msg The error message.
 * @param {EName} name The name of the XML entity at stake.
 * 
 */
function SingleNameError(msg, name) {
    ValidationError.call(this, msg);
    this.name = name;
}
inherit(SingleNameError, ValidationError);
(function () {
    this.toString = function() { 
        return this.toStringWithNames([this.name]);
    };

    this.getNames = function () {
        return [this.name];
    };

    this.toStringWithNames = function (names) {
        return this.msg + ": " + names[0];
    };
}).call(SingleNameError.prototype);

/**
 * Error returned when an attribute name is invalid.
 * 
 * @constructor
 * 
 * @param {String} msg The error message.
 * @param {EName} name The name of the attribute at stake.
 * 
 */
function AttributeNameError() {
    SingleNameError.apply(this, arguments);
}
inherit(AttributeNameError, SingleNameError);

/**
 * Error returned when an attribute value is invalid.
 * 
 * @constructor
 * 
 * @param {String} msg The error message.
 * @param {EName} name The name of the attribute at stake.
 * 
 */
function AttributeValueError() {
    SingleNameError.apply(this, arguments);
}
inherit(AttributeValueError, SingleNameError);

/**
 * Error returned when an element is invalid.
 * 
 * @constructor
 * 
 * @param {String} msg The error message.
 * @param {EName} name The name of the element at stake.
 * 
 */
function ElementNameError() {
    SingleNameError.apply(this, arguments);
}
inherit(ElementNameError, SingleNameError);

/**
 * Error returned when choice was not satisfied.
 * 
 * @constructor
 * 
 * @param {EName} namea The name of the first XML entity at stake.
 * @param {EName} nameb The name of the second XML entity at stake.
 * 
 */
function ChoiceError(namea, nameb) {
    ValidationError.call(this, "");
    this.namea = namea;
    this.nameb = nameb;
}
inherit(ChoiceError, ValidationError);
(function () {
    this.toString = function() { 
        return this.toStringWithNames([this.namea, this.nameb]);
    };

    this.getNames = function () {
        return [this.namea, this.nameb];
    };

    this.toStringWithNames = function (names) {
        return "must choose one of these: " + names[0] + ", " + names[1];
    };
}).call(ChoiceError.prototype);


/**
 * <p>This class modelizes events occuring during parsing. Upon
 * encountering the start of a start tag, an "enterStartTag" event is
 * generated, etc. Event objects are held to be immutable. No
 * precautions have been made to enforce this. Users of these objects
 * simply must not modify them. Moreover, there is one and only one of
 * each event created.</p>
 * 
 * <p>An event is made of a list of event parameters, with the first
 * one being the type of the event and the rest of the list varying
 * depending on this type.</p>
 *
 * @constructor
 * 
 * @param args... The event parameters may be passed directly in the
 * call (new Event(a, b, ...)) or the first call parameter may be a
 * list containing all the event parameters (new Event([a, b, ]). All
 * of the event parameters must be strings.
 */
function Event() {
    var params = (arguments[0] instanceof Array) ?
        arguments[0] :
        Array.prototype.slice.call(arguments);

    var key = params.join();

    // Ensure we have only one of each event created.
    var cached = Event.__cache[key];
    if (cached !== undefined)
        return cached;

    this.id = this.__newID();
    this.params = params;
    this.key = key;

    Event.__cache[key] = this;
}
(function () {
    Event.__cache = {};

    var id=0;

    this.__newID = function () {
        return id++;
    };

    /**
     *
     * This method is mainly used to be able to use Event objects in a
     * HashSet or a HashMap.
     *
     * @method
     * @name Event#hash
     * @return A number unique to this object.
     */
    this.hash = function () { return this.id; };

    /**
     * We have a very primitive form of pattern matching. Right now
     * the only special case is a form of attributeValue events
     * expecting anything. This form has "*" as the second parameter
     * that forms the event. So the event Event("attribueValue",
     * "blah") would also match Event("attributeValue", "*") and
     * calling this method on Event("attributeValue", "blah") would
     * return the two events.
     * 
     * @method
     * @name Event#matchingEvents
     * @return {Array} The events that would match this event.
     * 
     */
    this.matchingEvents = function () {
        if (this.params[0] === "attributeValue")
            return [this, new Event("attributeValue", "*")];
        return [this];
    };

    /**
     * Is this Event an attribute event?
     *
     * @method
     * @name Event#isAttributeEvent
     *
     * @returns {Boolean} True if the event is an attribute event,
     * false otherwise.
     */
    this.isAttributeEvent = function () {
        return  (this.params[0] == "attributeName" || 
                 this.params[0] == "attributeValue");
    };

    /**
     * @method
     * @name Event#toString
     *
     * @returns {String} A string representation of the event.
     */
    this.toString = function () {
        return "Event: " + this.params.join(", ");
    };
}).call(Event.prototype);

/**
 * Utility function used mainly in testing to transform a Set of
 * events into a string containing a tree structure. The principle is
 * to combine events of a same type together and among events of a
 * same type combine those which are in the same namespace. So for
 * instance if there is a set of events that are all attributeName
 * events plus one leaveStartTag event, the output could be:
 * 
 * <pre><code>
 * attributeName:
 * ..uri A:
 * ....name 1
 * ....name 2
 * ..uri B:
 * ....name 3
 * ....name 4
 * leaveStartTag
 * </code></pre>
 *
 * The dots above are to represent more visually the
 * indentation. Actuall output does not contain leading dots.  In this
 * list there are two attributeName events in the "uri A" namespace
 * and two in the "uri B" namespace.
 * 
 * @memberof module:validate
 * @param {Set} evs Events to turn into a string.
 * @returns {String} A string which contains the tree described above.
 */
function eventsToTreeString(evs) {
    var hash_f = function (x) { return x; };
    var hash = new HashMap(hash_f);
    evs.forEach(function (ev) {
        var params = ev;
        if (ev instanceof Event)
            params = ev.params;

        var node = hash;
        for(var i = 0; i < params.length; ++i) {
            if (i == params.length - 1)
                // Our HashSet/Map cannot deal with undefined values.
                // So we mark leaf elements with the value false.
                node.add(params[i], false);
            else {
                var next_node = node.has(params[i]);
                if (next_node === undefined) {
                    next_node = new HashMap(hash_f);
                    node.add(params[i], next_node);
                }
                node = next_node;
            }
            
        }
    });
    
    var dumpTree = (function () {
        var dump_tree_buf = "";
        var dump_tree_indent = "    ";
        return function (hash, indent) {
            var ret = "";
            var keys = hash.keys();
            keys.sort();
            keys.forEach(function (key) {
                var sub = hash.has(key);
                if (sub !== false) {
                    ret += dump_tree_buf + key + ":\n"; 
                    dump_tree_buf += dump_tree_indent;
                    ret += dumpTree(hash.has(key));
                    dump_tree_buf = dump_tree_buf.slice(dump_tree_indent.length);
                }
                else
                    ret += dump_tree_buf + key + "\n"; 
            });
            return ret;
        };
    })();
    
    return dumpTree(hash);
}

/**
 * Roughly speaking each Pattern object has a corresponding Walker
 * class that modelizes an object which is able to walk the pattern to
 * which it belongs. So an Element has an ElementWalker and an
 * Attribute has an AttributeWalker. A Walker object responds to
 * parsing events and reports whether the structure represented by
 * these events is valid.
 * 
 * <p>Note that users of this API do not instanciate Walker objects
 * themselves.
 * 
 * @constructor
 */
function Walker() {
    this.id = this.__newID();
    this.possible_cached = undefined;
    this.suppressed_attributes = false;
    // if (DEBUG) {
    //  wrap(this, "_possible", possible_tracer);
    //  wrap(this, "fireEvent", fireEvent_tracer);
    //  //wrap(this, "end", plain_tracer);
    //  //wrap(this, "_suppressAttributes", plain_tracer);
    //  //wrap(this, "_clone", plain_tracer);
    // }
}

(function () {
    var id=0;

    this.__newID = function () {
        return id++;
    };

    this.hash = function () { return this.id; };

    /**
     * Fetch the set of possible events at the current stage of parsing.
     * 
     * @method
     * @public
     * @name Walker#possible
     * @returns {Set} The set of events that can be fired without
     * resulting in an error.
     */
    this.possible = function () {
        return new EventSet(this._possible());
    };

    /**
     * Helper method for possible(). The possible() method is designed
     * to be safe, in that the value it returns is not shared, so the
     * caller may change it without breaking anything. However, this
     * method return a value that may not be modified by the
     * caller. It is used internally among the classes of this file to
     * save copying time.
     * 
     * @method
     * @private
     * @name Walker#_possible
     * @returns {Set} The set of events that can be fired without
     * resulting in an error.
     */
    this._possible = function () {
        throw new Error("must be implemented by derived classes");
    };

    // These functions return true if there is no problem, or a list of
    // ValidationError objects otherwise.

    /**
     * Passes an event to the walker for handling. The Walker will
     * determine whether it or one of its children can handle the
     * event.
     * 
     * @method 
     * @name Walker#fireEvent
     * @param ev The event to handle.
     * @return The value is true if there was no error. The value is
     * undefined if no walker matches the pattern. Otherwise, the
     * value is an array of ValidationError objects.
     */
    this.fireEvent = function (ev) {
        throw new Error("must be implemented by derived classes");
    };

    /**
     * Can this Walker validly end after the previous event fired?
     * 
     * @name Walker#canEnd
     * @method 
     * @return {Boolean} True if the walker can validly end
     * here. False otherwise.
     */
    this.canEnd = function () {
        return true;
    };

    /**
     * This method ends the Walker processing. It should not see any
     * further events after end is called.
     * 
     * @name Walker#end
     * @method 
     * @returns {Boolean} True if the walker can validly end
     * here. Otherwise, a list of ValidationError object.
     */
    this.end = function () {
        return true;
    };

    /**
     * Deep copy the Walker.
     * 
     * @name Walker#clone
     * @method 
     * @returns {Walker} A deep copy of the Walker.
     */
    this.clone = function () {
        return this._clone(new HashMap(hashHelper));
    };

    /**
     * Helper function for <code>copy()</code>
     *
     * @method
     * @private
     * @name Walker#_clone
     */
    this._clone = function (memo) {
        var other = memo.has(this);
        if (other !== undefined)
            return other;
        other = new this.constructor();
        memo.add(this, other);
        this._copyInto(other, memo);
        return other;
    };

    this._copyInto = function (obj, memo) {
        // We can share the same Set because once created the Set
        // in this.possible_cached is not altered.
        obj.possible_cached = this.possible_cached;
        obj.suppressed_attributes = this.suppressed_attributes;

    };
    
    /**
     * Helper function used to prevent Walker objects from reporting
     * attribute events as possible. In RelaxNG it is normal to mix
     * attribues and elements in patterns. However, XML validation
     * segregates attributes and elements. Once a start tag has been
     * processed, attributes are not possible until a new start tag
     * beings. For instance, if a Walker is processing &lt;foo a="1">,
     * as soon as the greater than symbol is encountered, attribute
     * events are no longer possible. This function informs the Walker
     * of this fact.
     * 
     * @private
     */
    this._suppressAttributes = function () {
        throw new Error("must be implemented by derived classes");
    };

}).call(Walker.prototype);

/**
 * Mixin designed to be used for Walkers that can only have one
 * subwalker.
 *
 * @constructor
 * @private
 */
function SingleSubwalker ()
{
    throw new Error("not meant to be called");
}

(function () {
    this._possible = function (ev) {
        return this.subwalker.possible();
    };

    this.fireEvent = function (ev) {
        return this.subwalker.fireEvent(ev);
    };

    this._suppressAttributes = function () {
        if (!this.suppressed_attributes) {
            this.suppressed_attributes = true;
            this.subwalker._suppressAttributes();
        }
    };

    this.canEnd = function () {
        return this.subwalker.canEnd();
    };

    this.end = function () {
        return this.subwalker.end();
    };
}).call(SingleSubwalker.prototype);


/**
 * Mixin designed to be used for Walkers that cannot have any
 * subwalkers.
 * 
 * @constructor
 * @private
 */
function NoSubwalker ()
{
    throw new Error("not meant to be called");
}

(function () {
    this._suppressAttributes = function () {
        this.suppressed_attributes = true;
    };

    this.canEnd = function () {
        return true;
    };

    this.end = function () {
        return true;
    };
}).call(NoSubwalker.prototype);

/**
 * Pattern for &lt;empty/>.
 *
 * @constructor 
 * @private
 * @extends Pattern
 */
var Empty = makeSingletonConstructor(Pattern);

inherit(Empty, Pattern);
(function () {
    // No need for _copyInto

    this._keepAttrs = function () {
        return this;
    };

    this._cleanAttrs = function () {
        return [this, false];
    };
}).call(Empty.prototype);
addWalker(Empty, EmptyWalker);


/**
 * Walker for Empty.
 *
 * @constructor
 * @private
 * @extends Walker
 */
function EmptyWalker (el) {
    Walker.call(this);
    this.possible_cached = new EventSet();
}
inherit(EmptyWalker, Walker);
implement(EmptyWalker, NoSubwalker);
(function () {
    this.possible = function () {
        // Save some time by avoiding calling _possible
        return new EventSet();
    };

    this._possible = function () {
        return this.possible_cached;
    };

    this.fireEvent = function () {
        // Never matches anything.
        return undefined;
    };
}).call(EmptyWalker.prototype);

var Data = makeSingletonConstructor(Pattern);
inherit(Data, Pattern);
addWalker(Data, TextWalker); // Cheat until we have a real Data library.

var List = makeSingletonConstructor(Pattern);
inherit(List, Pattern);
addWalker(List, TextWalker); // Cheat until we have a real Data library.

var Param = makeSingletonConstructor(Pattern);
inherit(Param, Pattern);
addWalker(Param, TextWalker); // Cheat until we have a real Data library.

var Value = makeSingletonConstructor(Pattern);
inherit(Value, Pattern);
addWalker(Value, TextWalker); // Cheat until we have a real Data library.

/**
 * Pattern for &lt;notAllowed/>.
 *
 * @constructor 
 * @private
 * @extends Pattern
 */
var NotAllowed = makeSingletonConstructor(Pattern);
inherit(NotAllowed, Pattern);
// NotAllowed has no walker.

/**
 * Pattern for &lt;text/>.
 *
 * @constructor 
 * @private
 * @extends Pattern
 */
var Text = makeSingletonConstructor(Pattern);
inherit(Text, Pattern);
(function () {
    // We do not need a _copyInto
}).call(Text.prototype);
addWalker(Text, TextWalker);

function TextWalker (el) {
    Walker.call(this);
    this.possible_cached = new EventSet(TextWalker._text_event);
}
inherit(TextWalker, Walker);
implement(TextWalker, NoSubwalker);
(function () {

    // Events are constant so create the one we need just once.
    TextWalker._text_event = new Event("text");

    this._possible = function () {
        return this.possible_cached;
    };

    this.fireEvent = function (ev) {
        return  (ev.params.length === 1 && ev.params[0] == "text") ?
            true : undefined;
    };
}).call(TextWalker.prototype);



function Ref(xml_path, name) { 
    Pattern.call(this, xml_path);
    this.name = name; 
    this.resolves_to = undefined;
}

inherit(Ref, Pattern);
(function () {
    this._prepare = function () {
        // We do not cross ref/define boundaries to avoid infinite
        // loops.
        return; 
    };
}).call(Ref.prototype);
//addWalker(Ref, RefWalker); No, see below
(function () {
    this._copyInto = function (obj, memo) {
        Pattern.prototype._copyInto.call(this, obj, memo);
        obj.name = this.name;
        obj.resolves_to = this.resolves_to;
    };

    this._resolve = function (definitions) {
        this.resolves_to = definitions[this.name];
        if (this.resolves_to === undefined)
            return new Set(this);
        return new Set();
    };

    // This completely skips the creation of RefWalker and
    // DefineWalker. This returns the walker for whatever it is that
    // the Define element this refers to ultimately contains.
    this.newWalker = function () {
        return this.resolves_to.pat.newWalker();
    };
        
}).call(Ref.prototype);

function RefWalker(el) {
    Walker.call(this);
    this.el = el;
    this.subwalker = (el !== undefined) ? el.resolves_to.newWalker(): undefined;
}
inherit(RefWalker, Walker);
implement(RefWalker, SingleSubwalker);
(function () {
    this._copyInto = function (obj, memo) {
        Walker.prototype._copyInto.call(this, obj, memo);
        obj.el = this.el;
        obj.subwalker = this.subwalker._clone(memo);
    };
}).call(RefWalker.prototype);

function OneOrMore(xml_path, pats) { 
    PatternOnePattern.call(this, xml_path);
    if (pats !== undefined) {
        if (pats.length !== 1)
            throw new Error("OneOrMore needs exactly one pattern.");
        this.pat = pats[0];
    }
}

inherit(OneOrMore, PatternOnePattern);
addWalker(OneOrMore, OneOrMoreWalker);
(function () {
    this._cleanAttrs = function () {
        return [this.pat, true];
    };

}).call(OneOrMore.prototype);

function OneOrMoreWalker(el)
{
    Walker.call(this);
    this.seen_once = false;
    this.el = el;
    this.current_iteration = undefined;
    this.next_iteration = undefined;
}
inherit(OneOrMoreWalker, Walker);
(function () {
    this._copyInto = function (obj, memo) {
        Walker.prototype._copyInto.call(this, obj, memo);
        obj.seen_once = this.seen_once;
        obj.el = this.el;
        obj.current_iteration = (this.current_iteration !== undefined) ?
            this.current_iteration._clone(memo) : undefined;
        obj.next_iteration = (this.next_iteration !== undefined) ?
            this.next_iteration._clone(memo) : undefined;
    };

    this._possible = function() {
        if (this.possible_cached !== undefined)
            return this.possible_cached;

        if (this.current_iteration === undefined) {
            this.current_iteration = this.el.pat.newWalker();
        }

        this.possible_cached = this.current_iteration._possible();

        if (this.current_iteration.canEnd()) {
            this.possible_cached = new EventSet(this.possible_cached);
            if (this.next_iteration === undefined) {
                this.next_iteration = this.el.pat.newWalker();
            }

            var next_possible = this.next_iteration._possible();
        
            this.possible_cached.union(next_possible);
        }

        return this.possible_cached;
    };

    this.fireEvent = function(ev) {
        this.possible_cached = undefined;

        if (this.current_iteration === undefined) {
            this.current_iteration = this.el.pat.newWalker();
        }

        var ret = this.current_iteration.fireEvent(ev);
        if (ret !== undefined) {
            this.seen_once = true;
            return ret;
        }

        if (this.seen_once && this.current_iteration.canEnd()) {
            ret = this.current_iteration.end();
            if (ret !== true)
                return ret;

            if (this.next_iteration === undefined) {
                this.next_iteration = this.el.pat.newWalker();
            }

            var next_ret = this.next_iteration.fireEvent(ev);
            if (next_ret === true) {
                this.current_iteration.end();
                this.current_iteration = this.next_iteration;
                this.next_iteration = undefined;
            }
            return next_ret;
        }
        return undefined;
    };

    this._suppressAttributes = function () {
        // A oneOrMore element cannot have an attribute as a child.
    };

    this.canEnd = function () { 
        return this.seen_once && this.current_iteration.canEnd(); 
    };

    this.end = function () {
        // Release next_iteration, which we won't need anymore.
        this.next_iteration = undefined;
        return this.current_iteration.end();
    };

}).call(OneOrMoreWalker.prototype);

function Choice(xml_path, pats) { 
    PatternTwoPatterns.call(this, xml_path);
    if (pats !== undefined) {
        if (pats.length != 2)
            throw new Error("ChoiceWalker does not work with Choices that have not exactly 2 elements");
        this.pat_a = pats[0];
        this.pat_b = pats[1];
    }
}

inherit(Choice, PatternTwoPatterns);
addWalker(Choice, ChoiceWalker);
(function () {
    this._cleanAttrs = function () {
        var cleaned = this._cleanAttrsFromPat();
        if (cleaned === undefined)
            return undefined;
        var pats = cleaned[0];

        if (pats.length === 1) {
            // After modifications we don't allow anything...
            if (pats[0] instanceof Empty)
                return undefined;

            // The remaining element had a partner that disappeared.
            return [new Choice(this.xml_path + " %CLEAN ATTRS%", [pats[0], new Empty()]), true];
        }
            
        this.pat_a = pats[0];
        this.pat_b = pats[1];
        
        return [this, cleaned[1]];
    };
}).call(Choice.prototype);

function ChoiceWalker(el) { 
    Walker.call(this);
    this.el = el;
    this.chosen = false;

    this.walker_a = this.walker_b = undefined;
    this.instanciated_walkers = false;
    this.done = false;

}

inherit(ChoiceWalker, Walker);

(function () {
    this._copyInto = function (obj, memo) {
        Walker.prototype._copyInto.call(this, obj, memo);
        obj.el = this.el;
        obj.chosen = this.chosen;
        obj.walker_a = (this.walker_a !== undefined) ? 
            this.walker_a._clone(memo):undefined;
        obj.walker_b = (this.walker_b !== undefined) ?
            this.walker_b._clone(memo): undefined;
        obj.instanciated_walkers = this.instanciated_walkers;
        obj.done = this.done;
    };

    this._instanciateWalkers = function () {
        if (!this.instanciated_walkers) {
            this.instanciated_walkers = true;

            this.walker_a = this.el.pat_a.newWalker();
            this.walker_b = this.el.pat_b.newWalker();
        }
    };


    this._possible = function () {
        this._instanciateWalkers();
        if (this.possible_cached !== undefined)
            return this.possible_cached;

        this.possible_cached = (this.walker_a !== undefined) ?
            this.walker_a._possible() : undefined;

        if (this.walker_b !== undefined) {
            this.possible_cached = new EventSet(this.possible_cached);
            var possible_b = this.walker_b._possible();
            this.possible_cached.union(possible_b);
        }
        else if (this.possible_cached === undefined)
            this.possible_cached = new EventSet();

        return this.possible_cached;
    };

    this.fireEvent = function(ev) {
        if (this.done) 
            return undefined;

        this._instanciateWalkers();

        this.possible_cached = undefined;
        var ret_a = (this.walker_a !== undefined) ? 
            this.walker_a.fireEvent(ev): undefined;
        var ret_b = (this.walker_b !== undefined) ?
            this.walker_b.fireEvent(ev): undefined;

        if (ret_a !== undefined) {
            this.chosen = true;
            if (ret_b === undefined) {
                this.walker_b = undefined;
                return ret_a;
            }
            return ret_a;
        }
        
        if (ret_b !== undefined) {
            this.chosen = true;
            // We do not need to test if red_a is undefined because we 
            // would not get here if it were.
            this.walker_a = undefined;
            return ret_b;
        }

        return undefined;
    };

    this._suppressAttributes = function () {
        this._instanciateWalkers();
        if (!this.suppressed_attributes) {
            this.possible_cached = undefined; // no longer valid
            this.suppressed_attributes = true;

            if (this.walker_a !== undefined)
                this.walker_a._suppressAttributes();
            if (this.walker_b !== undefined)
                this.walker_b._suppressAttributes();
        }
    };

    this.canEnd = function () {
        this._instanciateWalkers();

        // Before any choice has been made, a ChoiceWalker can end if
        // any subwalker can end. Once a choice has been made, the
        // ChoiceWalker can end only if the chosen walker can end.
        if (!this.chosen)
            return this.walker_a.canEnd() || this.walker_b.canEnd();
        
        return (this.walker_a !== undefined)? this.walker_a.canEnd() :
            this.walker_b.canEnd();
    };

    this.end = function () {
        this.done = true;
            
        this._instanciateWalkers();

        if (this.canEnd()) return true;

        var walker_a_ret = (this.walker_a !== undefined) ?
            this.walker_a.end() : undefined;
        
        var walker_b_ret = (this.walker_b !== undefined) ?
            this.walker_b.end() : undefined;
        
        if (walker_a_ret || walker_b_ret) 
            return true;

        return new ChoiceError.bind.apply(ChoiceError, 
                                         [walker_a_ret,
                                         walker_b_ret]);
    };

}).call(ChoiceWalker.prototype);

function Group(xml_path, pats) { 
    PatternTwoPatterns.call(this, xml_path);
    if (pats !== undefined) {
        if (pats.length != 2) 
            throw new Error("GroupWalker walk only groups of two elements!");
        this.pat_a = pats[0];
        this.pat_b = pats[1];
    }
}

inherit(Group, PatternTwoPatterns);
addWalker(Group, GroupWalker);

(function () {
    this._cleanAttrs = function () {
        var cleaned = this._cleanAttrsFromPat();  
        if (cleaned === undefined)
            return undefined;
        var pats = cleaned[0];

        if (pats.length === 1) {
            if (pats[0] instanceof Empty)
                return undefined;

            return [pats[0], true];
        }
            
        this.pat_a = pats[0];
        this.pat_b = pats[1];
        
        return [this, cleaned[1]];
    };
}).call(Group.prototype);

function GroupWalker(el) {
    Walker.call(this);
    this.el = el;

    this.hit_a = false;
    this.ended_a = false;
    this.hit_b = false;
    this.walker_a = this.walker_b = undefined;
}
inherit(GroupWalker, Walker);

(function () {
    this._copyInto = function (obj, memo) {
        Walker.prototype._copyInto.call(this, obj, memo);
        obj.el = this.el;
        obj.hit_a = this.hit_a;
        obj.ended_a = this.ended_a;
        obj.hit_b = this.hit_b;
        obj.walker_a = (this.walker_a !== undefined) ?
            this.walker_a._clone(memo) : undefined;
        obj.walker_b = (this.walker_b !== undefined) ?
            this.walker_b._clone(memo) : undefined;
    };

    this._instanciateWalkers = function () {
        if (this.walker_a === undefined) {
            this.walker_a = this.el.pat_a.newWalker();
            this.walker_b = this.el.pat_b.newWalker();
        }
    };

    this._possible = function () {
        this._instanciateWalkers();
        if (this.possible_cached !== undefined)
            return this.possible_cached;

        this.possible_cached = (!this.ended_a) ?
            this.walker_a._possible() : undefined;

        // If we are in the midst of processing walker a and it cannot
        // end yet, then we do not want to see anything from b.
        if (!this.hit_a || this.ended_a || this.walker_a.canEnd()) {
            this.possible_cached = new EventSet(this.possible_cached);
            var possible_b = this.walker_b._possible();

            if ((!this.ended_a || this.hit_b) && !this.walker_a.canEnd()) {
                possible_b = new EventSet(possible_b);
                // Narrow it down to attribute events...
                possible_b = possible_b.filter(function (x) {
                    return x.isAttributeEvent();
                });
            }
            this.possible_cached.union(possible_b);
        }
        
        return this.possible_cached;
    };
    
    this.fireEvent = function(ev) {
        this._instanciateWalkers();

        this.possible_cached = undefined;
        if (!this.ended_a) {
            var ret_a = this.walker_a.fireEvent(ev);
            if (ret_a !== undefined) {
                this.hit_a = true;
                return ret_a;
            }
        }
        
        var ret_b = this.walker_b.fireEvent(ev);
        if (ret_b !== undefined)
            this.hit_b = true;
        
        // Non-attribute event, we must end walker_a
        if (!ev.isAttributeEvent()) {
            var end_ret = this.walker_a.end();
            this.ended_a = true;
            if (ret_b !== true && ret_b !== undefined)
                ret_b.concat(end_ret);
        }
        return ret_b;
    };

    this._suppressAttributes = function () {
        this._instanciateWalkers();
        if (!this.suppressed_attributes) {
            this.possible_cached = undefined; // no longer valid
            this.suppressed_attributes = true;

            this.walker_a._suppressAttributes();
            this.walker_b._suppressAttributes();
        }
    };

    this.canEnd = function () {
        this._instanciateWalkers();
        return this.walker_a.canEnd() && this.walker_b.canEnd();
    };

    this.end = function () {
        this._instanciateWalkers();
        var ret = this.walker_a.end();
        if (ret !== true)
            return ret;

        ret = this.walker_b.end();
        if (ret !== true)
            return ret;
        
        return true;
    };
}).call(GroupWalker.prototype);

function Attribute(xml_path, name, pats) { 
    PatternOnePattern.call(this, xml_path);
    this.name = name;
    if (pats !== undefined) {
        if (pats.length !== 1)
            throw new Error("Attribute needs exactly one pattern.");
        this.pat = pats[0];
    }
}

inherit(Attribute, PatternOnePattern);
addWalker(Attribute, AttributeWalker);
(function () {
    this._copyInto = function (obj, memo) {
        Pattern.prototype._copyInto.call(this, obj, memo);
        obj.name = this.name;
    };
    
    this._prepare = function (namespaces) {
        // A lack of namespace on an attribute should not be recorded.
        if (this.name.ns !== "")
            namespaces[this.name.ns] = 1;
    };

    this._keepAttrs = function () {
        return this;
    };
    
    this._cleanAttrs = function () {
        return [this, false];
    };
}).call(Attribute.prototype);


function AttributeWalker(el) {
    Walker.call(this);
    this.el = el;
    this.seen_name = false;
    this.seen_value = false;

    if (el !== undefined) {
        this.attr_name_event = new Event("attributeName", el.name.ns, el.name.name);
        this.attr_value_event = new Event("attributeValue", "*");
    }
    else
        this.attr_name_event = this.attr_value_event = undefined;
}
inherit(AttributeWalker, Walker);
(function () {
    this._copyInto = function (obj, memo) {
        Walker.prototype._copyInto.call(this, obj, memo);
        obj.el = this.el;
        obj.seen_name = this.seen_name;
        obj.seen_value = this.seen_value;

        // No need to clone; values are immutable.
        obj.attr_name_event = this.attr_name_event;
        obj.attr_value_event = this.attr_value_event;
    };

    this._possible = function () {
        // We've been suppressed!
        if (this.suppressed_attributes) return new EventSet();

        if (!this.seen_name) 
            return new EventSet(this.attr_name_event);
        else if (!this.seen_value)
            return new EventSet(this.attr_value_event);
        else 
            return new EventSet();
    };

    // _possible always return new sets.
    this.possible = this._possible;

    this.fireEvent = function (ev) {
        if (this.suppressed_attributes)
            return undefined;

        if (!this.seen_name && ev.params[0] == "attributeName" && 
            ev.params[1] == this.el.name.ns && 
            ev.params[2] == this.el.name.name) {
            this.seen_name = true;
            return true;
        }
        
        if (this.seen_name && !this.seen_value) {
            if (ev.params[0] == "attributeValue")
            {
                this.seen_value = true;
                return true;
            }
            return [new ValidationError("XXX")];
        }

        return undefined;
    };

    this._suppressAttributes = function () {
        this.suppressed_attributes = true;
    };

    this.canEnd = function () {
        return this.suppressed_attributes || this.seen_value;
    };

    this.end = function () {
        if (this.suppressed_attributes)
            return true;

        if (!this.seen_name)
            return [new AttributeNameError("attribute missing", this.el.name)];
        else if (!this.seen_value)
            return [new AttributeValueError("attribute value missing", this.el.name)];
        else
            return true;
    };

}).call(AttributeWalker.prototype);

function Element(xml_path, name, pats) { 
    PatternOnePattern.call(this, xml_path);
    this.name = name; 
    if (pats !== undefined) {
        if (pats.length !== 1) 
            throw new Error("Element requires exactly one pattern.");
        this.pat = pats[0];
    }
    // Initialized to undefined. Once set to something else, it
    // remains immutable.
    this.attr_pat = undefined;
    this.attr_pat_valid = false;
}

inherit(Element, PatternOnePattern);
// addWalker(Element, ElementWalker); Nope... see below..
(function () {
    this._copyInto = function (obj, memo) {
        PatternOnePattern.prototype._copyInto.call(this, obj, memo);
        obj.name = this.name;
        obj.attr_pat = this.attr_pat;
        obj.attr_pat_valid = this.attr_pat_valid;
    };

    this._prepare = function (namespaces) {
        namespaces[this.name.ns] = 1;
        // Do it only if we've not done it.
        if (!this.attr_pat_valid) {
            // We must clone our pats into attr_pats
            this.pat._prepare(namespaces);
            var attrs = this.pat.clone()._keepAttrs();
            if (attrs !== undefined) {
                var me = this;
                // We must clean as long as the tree is modified...
                var cleaned = [undefined, true];
                while (cleaned && cleaned[1])
                {
                    cleaned = attrs._cleanAttrs();
                    attrs = cleaned && cleaned[0];
                }
                me.attr_pat = attrs;
            }
            this.attr_pat_valid = true;
        }
    };

    this.newWalker = function () {
        if (this.pat instanceof NotAllowed)
            return new DisallowedElementWalker(this);

        return new ElementWalker(this);
    };

    this._keepAttrs = function () {
        return undefined;
    };

    this._elementDefinitions = function (memo) {
        var key = this.name.toString();
        if (memo[key] === undefined)
            memo[key] = [this];
        else
            memo[key].push(this);
    };

}).call(Element.prototype);

function ElementWalker(el) { 
    Walker.call(this);
    this.el = el; 
    this.seen_name = false;
    this.ended_start_tag = false;
    this.closed = false;
    this.walker = undefined;
    this.captured_attr_events = [];
    if (el !== undefined) {
        this.start_tag_event = new Event("enterStartTag", el.name.ns, el.name.name);
        this.end_tag_event = new Event("endTag", this.el.name.ns, this.el.name.name);
    }
    else
        this.start_tag_event = this.end_tag_event = undefined;
}
inherit(ElementWalker, Walker);
(function () {

    // Reuse the same event object, since they are immutable
    ElementWalker._leaveStartTag_event = new Event("leaveStartTag");

    this._copyInto = function (obj, memo) {
        Walker.prototype._copyInto.call(this, obj, memo);
        obj.el = this.el;
        obj.seen_name = this.seen_name;
        obj.ended_start_tag = this.ended_start_tag;
        obj.closed = this.closed;
        obj.walker = (this.walker !== undefined) ? this.walker._clone(memo) : undefined;
        obj.captured_attr_events = this.captured_attr_events.concat([]);

        // No cloning needed since these are immutable.
        obj.start_tag_event = this.start_tag_event;
        obj.end_tag_event = this.end_tag_event;
    };

    this._possible = function () {
        if (!this.seen_name) {
            return new EventSet(this.start_tag_event);
        }
        else if (!this.ended_start_tag) {
            // If we can have attributes, then...
            if (this.el.attr_pat !== undefined) {
                var all = this.walker._possible();
                var ret = new EventSet();
                all.forEach(function (poss) {
                    if (poss.isAttributeEvent())
                        ret.add(poss);
                });
                
                if (this.walker.canEnd())
                    ret.add(ElementWalker._leaveStartTag_event);

                return ret;
            }
            // No attributes possible.
            return new EventSet(ElementWalker._leaveStartTag_event);
        }
        else if (!this.closed)
        {
            var posses = new EventSet(this.walker._possible());
            if (this.walker.canEnd())
                posses.add(this.end_tag_event);
            return posses;
        }
        else
        {
            return new EventSet();
        }
    };
    
    // _possible always return new sets
    this.possible = this._possible;
    
    this.fireEvent = function (ev) {
        var ret;
        if (!this.ended_start_tag) {
            if (!this.seen_name && ev.params[0] == "enterStartTag" && 
                ev.params[1] == this.el.name.ns && 
                ev.params[2] == this.el.name.name) {
                if (this.el.attr_pat !== undefined)
                    this.walker = this.el.attr_pat.newWalker();
                this.seen_name = true;
                return true;
            }
            else if (!this.ended_start_tag && ev.params[0] == "leaveStartTag") {
                this.ended_start_tag = true;

                if (this.walker !== undefined)
                    ret = this.walker.end();

                // We've left the start tag, create a new walker and hit it
                // with the attributes we've seen.
                this.walker = this.el.pat.newWalker();
                var me = this;
                this.captured_attr_events.forEach(function (ev) {
                    me.walker.fireEvent(ev);
                });
                // And suppress the attributes.
                this.walker._suppressAttributes();

                // We do not return undefined here
                if (ret !== undefined)
                    return ret;
                
                return true;
            }

            if (ev.isAttributeEvent())
                this.captured_attr_events.push(ev);

            return (this.walker !== undefined) ? 
                this.walker.fireEvent(ev): undefined;
        }
        else if (!this.closed) {
            ret = this.walker.fireEvent(ev);
            // We are closing only if our subwalker did not handle the 
            // event!
            if (ret === undefined && 
                ev.params[0] == "endTag" && 
                ev.params[1] == this.el.name.ns && 
                ev.params[2] == this.el.name.name) {
                this.closed = true;
                return this.walker.end();
            }
            return ret;
        }
        return undefined;
    };

    this._suppressAttributes = function () {
        // _suppressAttributes does not cross element boundary
        return;
    };
    
    this.canEnd = function () {
        return this.closed;
    };

    this.end = function (ev) {
        var ret = [];
        if (!this.seen_name)
            ret.push(new ElementNameError("tag required", this.el.name));
        else if (!this.ended_start_tag || !this.closed) {
            if (this.walker !== undefined) {
                var errs = this.walker.end();
                if (errs !== true)
                    ret = errs;
            }
            ret.push(this.ended_start_tag ? 
                     new ElementNameError("tag not closed", this.el.name) :
                     new ElementNameError("start tag not terminated", this.el.name));
        }

        if (ret.length > 0)
            return ret;

        return true;
    };
    
}).call(ElementWalker.prototype);

function DisallowedElementWalker(el) { 
    Walker.call(this);
    this.el = el; 
    this.possible_cached = new EventSet();
}
inherit(DisallowedElementWalker, Walker);
(function () {
    this._copyInto = function (obj, memo) {
        Walker.prototype._copyInto.call(this, obj, memo);
        obj.el = this.el;
        // possible_cached taken care of by Walker
    };

    this._possible = function () {
        return this.possible_cached;
    };
    
    this.fireEvent = function (ev) {
        return undefined; // we never match!
    };   
}).call(DisallowedElementWalker.prototype);


function Define(xml_path, name, pats) { 
    PatternOnePattern.call(this, xml_path);
    this.name = name;
    if (pats !== undefined) {
        if (pats.length !== 1) 
            throw new Error("Define needs exactly one pattern.");
        this.pat = pats[0];
    }
    this.attr_pat = undefined;
    this.attr_pat_valid = false;
}
inherit(Define, PatternOnePattern);
addWalker(Define, DefineWalker);
(function () {
    this._copyInto = function (obj, memo) {
        PatternOnePattern.prototype._copyInto.call(this, obj, memo);
        obj.name = this.name;
        obj.attr_pat = this.attr_pat;
        obj.attr_pat_valid = this.attr_pat_valid;
    };

    this._prepare = function (namespaces) {
        // Do it only if we've not done it.
        if (!this.attr_pat_valid) {
            // We must clone our pats into attr_pats
            this.pat._prepare(namespaces);
            var attrs = this.pat.clone()._keepAttrs();
            this.attr_pat = attrs;
            this.attr_pat_valid = true;
        }
    };
}).call(Define.prototype);

function DefineWalker(el) {
    Walker.call(this);
    this.el = el;
    this.subwalker = (el !== undefined) ? el.pat.newWalker() : undefined;
}
inherit(DefineWalker, Walker);
implement(DefineWalker, SingleSubwalker);

(function () {
    this._copyInto = function (obj, memo) {
        Walker.prototype._copyInto.call(this, obj, memo);
        obj.el = this.el;
        obj.subwalker = this.subwalker._clone(memo);
    };
}).call(DefineWalker.prototype);

/**
 * <p>This is an exception raised to indicate references to undefined
 * entities in a schema. If for instance element A has element B as
 * its children but B is not defined, then this exception would be
 * raised.</p>
 * 
 * <p>This exception is indicative of an internal error because by the
 * time this module loads a schema, the schema should have been
 * simplified already and simplification should have failed due to the
 * unresolvable reference.</p>
 * 
 * @constructor 
 * 
 * @param {Set} references The set of references that could not be
 * resolved.
 */
function ReferenceError(references) {
    this.references = references;
}
inherit(ReferenceError, Error);
(function () {
    this.toString = function () {
        return "Cannot resolve the following references: " + 
            this.references.toString();
    };
}).call(ReferenceError.prototype);

/**
 * Create a Grammar object. Users of this library normally do not
 * create objects of this class themselves but rely on
 * constructTree().
 * 
 * @constructor
 * @private
 * @param {String} xml_path This is a string which uniquely identifies
 * the element from the simplified RNG tree. Used in debugging.
 * @param {Pattern} start The start pattern of this grammar.
 * @param {Array} definitions An array of Pattern objects which
 * contain all definitions specified in this grammar.
 *
 * @throws {ReferenceError} When any definition in the original schema
 * refers to a schema entity which is not defined in the schema.
 */
function Grammar(xml_path, start, definitions) {
    this.xml_path = xml_path;
    this.start = start;
    this.definitions = [];
    this.element_definitions = {};
    this._namespaces = Object.create(null);
    var me = this;
    definitions.forEach(function (x) {
        me.add(x);
    });
    this._resolve();
    this._prepare(this._namespaces);
}
(function () {
    this.definitions = undefined;
    this.start = undefined;

    this._resolve = function () {
        var ret = new Set();
        for (var d in this.definitions)
            ret.union(this.definitions[d]._resolve(this.definitions));
        ret.union(this.start._resolve(this.definitions));
        if (ret.size() > 0)
            throw new ReferenceError(ret);
    };

    this.add = function (d) {
        this.definitions[d.name] = d;
        if (d.name == "start")
            this.start = d;
    };

    this._prepare = function (namespaces) {
        this.start._prepare(namespaces);
        for (var d in this.definitions) {
            this.definitions[d]._prepare(namespaces);
        }
    };

    this._elementDefinitions = function (memo) {
        for (var d in this.definitions)
            this.definitions[d]._elementDefinitions(memo);
    };

    /**
     * @method
     * @name Grammar#whollyContextIndependent
     * 
     * @returns {Boolean} True if the schema is wholly context
     * independent. This means that each element in the schema can be
     * validated purely on the basis of knowing its expanded
     * name. False otherwise.
     */
    this.whollyContextIndependent = function () {
        var memo = this.element_definitions;
        this._elementDefinitions(memo);
        for (var v in memo)
            if (memo[v].length > 1)
                return false;

        return true;
    };

    /**
     * @method
     * @name Grammar#getNamespaces
     *
     * @returns {Array.<String>} An array of all namespaces used in
     * the schema.
     */
    this.getNamespaces = function () {
        return Object.keys(this._namespaces);
    };

}).call(Grammar.prototype);
addWalker(Grammar, GrammarWalker);

function GrammarWalker(el) {
    Walker.call(this);
    this.el = el;
    this.subwalker = (el !== undefined) ? el.start.newWalker() : undefined;
}
inherit(GrammarWalker, Walker);
implement(GrammarWalker, SingleSubwalker);
(function () {
    this.subwalker = undefined;
    this._copyInto = function (obj, memo) {
        Walker.prototype._copyInto.call(this, obj, memo);
        obj.el = this.el;
        obj.subwalker = this.subwalker._clone(memo);
    };

    /**
     * On a GrammarWalker this method must not return undefined. An
     * undefined value would mean nothing matched, which is an error
     * at this stage.
     * @method
     * @name GrammarWalker#fireEvent
     * @param {Event} Event to fire.
     */
    this.fireEvent = function (ev) {
        var ret = this.subwalker.fireEvent(ev);
        if (ret === undefined) {
            switch(ev.params[0]) {
            case "enterStartTag":
                ret = [new ElementNameError(
                    "tag not allowed here", 
                    new EName(ev.params[1], ev.params[2]))];
                break;
            case "attributeName":
                ret = [new AttributeNameError(
                    "attribute not allowed here",
                    new EName(ev.params[1], ev.params[2]))];
                break;
            default:
                throw new Error("unexpected event type in GrammarWalker's fireEvent: " + ev.params[0]);
            }
        }
        return ret;
    };

    this._suppressAttributes = function () { throw new Error("_suppressAttributes cannot be called on a GrammarWalker"); };

}).call(GrammarWalker.prototype);


var name_to_constructor = {
    "Empty": Empty,
    "Data": Data,
    "List": List,
    "Param": Param,
    "Value": Value,
    "NotAllowed": NotAllowed,
    "Text": Text,
    "Ref": Ref,
    "OneOrMore": OneOrMore,
    "Choice": Choice,
    "Group": Group,
    "Attribute": Attribute,
    "Element": Element,
    "Define": Define,
    "Grammar": Grammar,
    "EName": EName
};

function resolveArray(arr) {
    for (var el_ix = 0, el; (el = arr[el_ix]) !== undefined; el_ix++) {
        if (el instanceof Array) 
            resolveArray(el);
        else if (typeof el === "object")
            arr[el_ix] = constructObject(el);
        // else leave as is
    }
}

function applyConstructor(ctor, args) {
    var new_obj = Object.create(ctor.prototype);
    var ctor_ret = ctor.apply(new_obj, args);

    // Some constructors return a value; make sure to use it!
    return ctor_ret !== undefined ? ctor_ret: new_obj;
}

function constructObject(obj) {
    var type = obj.type;
    if (type === undefined)
        throw new Error("object without type: " + obj);

    var ctor = name_to_constructor[type];
    if (ctor === undefined)
        throw new Error("undefined type: " + type);

    // It is possible to have objects without argument list.
    var args = obj.args;
    if (args !== undefined)
        resolveArray(args);

    return applyConstructor(ctor, args);
}

function constructTree(code) {
    return constructObject(JSON.parse(code));
}

exports.constructTree = constructTree;
exports.Event = Event;
exports.eventsToTreeString = eventsToTreeString;
exports.EName = EName;
exports.ReferenceError = ReferenceError;
exports.ValidationError = ValidationError;
exports.AttributeNameError = AttributeNameError;
exports.AttributeValueError = AttributeValueError;
exports.ElementNameError = ElementNameError;
exports.ChoiceError = ChoiceError;

var tret = {};

tret.GrammarWalker = GrammarWalker;
tret.Walker = Walker;
tret.Text = Text;

exports.__test = function () { return tret; };

});
