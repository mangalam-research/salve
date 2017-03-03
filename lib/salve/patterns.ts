/**
 * Classes that model RNG patterns.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { Datatype, RawParameter } from "./datatypes";
import { EName } from "./ename";
import * as namePatterns from "./name_patterns";
import { NameResolver } from "./name_resolver";
import { fixPrototype } from "./tools";
import { TrivialMap } from "./types";

// XML validation against a schema could work without any lookahead if it were
// not for namespaces. However, namespace support means that the interpretation
// of a tag or of an attribute may depend on information which appears *later*
// than the earliest time at which a validation decision might be called for:
//
// Consider:
//    <elephant a="a" b="b"... xmlns="elephant_uri"/>
//
// It is not until xmlns is encountered that the validator will know that
// elephant belongs to the elephant_uri namespace. This is not too troubling for
// a validator that can access the whole document but for validators used in a
// line-by-line process (which is the case if the validator is driven by a
// CodeMirror or Ace tokenizer, and anything based on them), this can be
// problematic because the attributes could appear on lines other than the line
// on which the start of the tag appears:
//
// <elephant
//  a="a"
//  b="b"
//  xmlns="elephant_uri"/>
//
// The validator encounters the start of the tag and the attributes, without
// knowing that eventually this elephant tag belongs to the elephant_uri
// namespace. This discovery might result in things that were seen previously
// and deemed valid becoming invalid. Or things that were invalid becoming
// valid.
//
// Handling namespaces will require lookahead. Although the validator would
// still expect all events that have tag and attribute names to have a proper
// namespace uri, upon ``enterStartTag`` the parsing code which feeds events to
// the validator would look ahead for these cases:
//
// * There is a valid ``>`` character ending the start tag. Scan the start tag
//   for all namespace declarations.
//
// * The tag ends at EOF. Scan from beginning of tag to EOF for namespace
//   declarations.
//
// * The tag is terminated by an invalid token. Scan from beginning of tag to
//   error.
//
// Then issue the enterStartTag and attributeName events on the basis of what
// was found in scanning.
//
// When the parsing code discovers a change in namespace declarations, for
// instance because the user typed xmlns="..." or removed a declaration, the
// parsing code must *restart* validation *from* the location of the original
// enterStartTag event.

import { registry } from "./datatypes";
import { AttributeNameError, AttributeValueError, ChoiceError,
         ElementNameError, ValidationError } from "./errors";
import { HashMap } from "./hashstructs";
import * as util from "./util";

const DEBUG: boolean = false;

// This is here to shut the compiler up about unused variables.
/* tslint:disable: no-empty no-invalid-this */
function noop(..._args: any[]): void {}

if (DEBUG) {
  //
  // Debugging utilities
  //

  const trace: (msg: any) => void = (msg: string) => {
    console.log(msg); // tslint:disable-line:no-console
  };

  const stackTrace: () => void = () => {
    trace(new Error().stack);
  };
  noop(stackTrace);

  let possibleTracer: (oldMethod: Function, name: string, args: any[]) => any;
  let fireEventTracer: (oldMethod: Function, name: string, args: any[]) => any;
  let plainTracer: (oldMethod: Function, name: string, args: any[]) => any;
  let callDump: (msg: string, name: string, me: any) => void;

  // tslint:disable-next-line:only-arrow-functions
  (function buildTracingCode(): void {
    let buf: string = "";
    const step: string = " ";

    const nameOrPath: (walker: any) => string = (walker: any) => {
      const el: any = walker.el as any;

      if (!el) {
        return "";
      }

      if (el.name === undefined) {
        return ` with path ${el.xmlPath}`;
      }

      const named: string = ` named ${el.name.toString()}`;
      if (!walker.boundName) {
        return named;
      }

      return `${named} (bound to ${walker.boundName.toString()})`;
    };

    callDump = (msg: string, name: string, me: any) => {
      trace(`${buf}${msg}${name} on class ${me.constructor.name}` +
            ` id ${me.id}${nameOrPath(me)}`);
    };

    // tslint:disable-next-line:only-arrow-functions
    possibleTracer = function possibleTracer(
      this: any,
      oldMethod: Function, name: string,
      args: any[]): any {
        buf += step;
        callDump("calling ", name, this);
        const ret: any = oldMethod.apply(this, args);
        callDump("called ", name, this);
        trace(`${buf}return from the call: ${util.inspect(ret)}`);
        buf = buf.slice(step.length);
        return ret;
      };

    // tslint:disable-next-line:only-arrow-functions
    fireEventTracer = function fireEventTracer(
      this: any,
      oldMethod: Function,
      name: string,
      args: any[]): any {
        buf += step;
        callDump("calling ", name, this);
        trace(buf + util.inspect(args[0]));

        const ret: any = oldMethod.apply(this, args);
        callDump("called ", name, this);
        if (ret !== false) {
          trace(`${buf}return from the call: ${util.inspect(ret)}`);
        }
        buf = buf.slice(step.length);
        return ret;
      };

    // tslint:disable-next-line:only-arrow-functions
    plainTracer = function plainTracer(
      this: any,
      oldMethod: Function, name: string,
      args: any[]): any {
        buf += step;
        callDump("calling ", name, this);

        const ret: any = oldMethod.apply(this, args);
        callDump("called ", name, this);
        // if (ret !== true) {
        //    trace(buf + "return from the call: " + util.inspect(ret));
        // }
        buf = buf.slice(step.length);
        return ret;
      };
  }());

  /**
   * Utility function for debugging. Wraps ``me[name]`` in a wrapper
   * function. ``me[name]`` must be a function.  ``me`` could be an instance or
   * could be a prototype. This function cannot trivially wrap the same field on
   * the same object twice.
   *
   * @private
   * @param me The object to modify.
   * @param name The field name to modify in the object.
   * @param f The function that should serve as wrapper.
   *
   */
  // tslint:disable-next-line:only-arrow-functions
  const wrap: (me: any, name: string, f: Function) => void =
    (me: any, name: string, f: Function) => {
      const mangledName: string = `___${name}`;
      me[mangledName] = me[name];
      // tslint:disable-next-line:only-arrow-functions
      me[name] = function wrapper(this: any): any {
        return f.call(this, me[mangledName], name, arguments);
      };
    };
  noop(wrap);
  /* tslint:enable */
}

/**
 * Sets up a newWalker method in a prototype.
 *
 * @private
 * @param elCls The class that will get the new method.
 * @param walkerCls The Walker class to instantiate.
 */
/* tslint:disable: no-invalid-this */
function addWalker<T>(elCls: any, walkerCls: any): void {
  // `resolver` is a NameResolver.
  // tslint:disable-next-line:only-arrow-functions
  elCls.prototype.newWalker = function newWalker(this: any, resolver: NameResolver): T {
    // eslint-disable-next-line new-cap
    return new walkerCls(this, resolver) as T;
  };
}
/* tslint:enable */

// function EventSet() {
//     var args = Array.prototype.slice.call(arguments);
//     args.unshift(function (x) { return x.hash() });
//     HashSet.apply(this, args);
// }
// inherit(EventSet, HashSet);

// The naive Set implementation turns out to be faster than the HashSet
// implementation for how we are using it.

import { NaiveSet as EventSet } from "./set";
export { NaiveSet as EventSet } from "./set";

interface Hashable {
  hash(): any;
}

export interface Clonable {
  clone(): this;
}

/**
 * Calls the ``hash()`` method on the object passed to it.
 *
 * @private
 * @param o An object that implements ``hash()``.
 * @returns The return value of ``hash()``.
 */
function hashHelper(o: Hashable): any {
  return o.hash();
}

export type FireEventResult = false | undefined | ValidationError[];
export type EndResult = false | ValidationError[];

/**
 *
 * This is the base class for all patterns created from the file passed to
 * constructTree. These patterns form a JavaScript representation of the
 * simplified RNG tree. The base class implements a leaf in the RNG tree. In
 * other words, it does not itself refer to children Patterns. (To put it in
 * other words, it has no subpatterns.)
 */
export class BasePattern {
  /**
   * The next id to associate to the next Pattern object to be created. This is
   * used so that [[hash]] can return unique values.
   */
  private static __id: number = 0; // tslint:disable-line:variable-name

  readonly id: string;
  readonly xmlPath: string;

  /**
   * @param xmlPath This is a string which uniquely identifies the element from
   * the simplified RNG tree. Used in debugging.
   */
  constructor(xmlPath: string) {
    this.id = `P${this.__newID()}`;
    this.xmlPath = xmlPath;
  }

  /**
   * This method is mainly used to be able to use these objects in a
   * [["hashstructs".HashSet]] or a [["hashstructs".HashMap]].
   *
   * Returns a hash guaranteed to be unique to this object. There are some
   * limitations. First, if this module is instantiated twice, the objects
   * created by the two instances cannot mix without violating the uniqueness
   * guarantee. Second, the hash is a monotonically increasing counter, so when
   * it reaches beyond the maximum integer that the JavaScript vm can handle,
   * things go kaboom. Third, this hash is meant to work within salve only.
   *
   * @returns A hash unique to this object.
   */
  hash(): string {
    return this.id;
  }

  /**
   * Resolve references to definitions.
   *
   * @param definitions The definitions that exist in this grammar.
   *
   * @returns The references that cannot be resolved, or ``undefined`` if no
   * references cannot be resolved. The caller is free to modify the value
   * returned as needed.
   */
  _resolve(definitions: TrivialMap<Define>): Ref[] | undefined {
    return undefined;
  }

  /**
   * This method must be called after resolution has been performed.
   * ``_prepare`` recursively calls children but does not traverse ref-define
   * boundaries to avoid infinite regress...
   *
   * This function now performs two tasks: a) it prepares the attributes
   * (Definition and Element objects maintain a pattern which contains only
   * attribute patterns, and nothing else), b) it gathers all the namespaces seen
   * in the schema.
   *
   * @param namespaces An object whose keys are the namespaces seen in
   * the schema. This method populates the object.
   *
   */
  _prepare(namespaces: TrivialMap<number>): void {
    // nothing here
  }

  /**
   * This method tests whether a pattern is an attribute pattern or contains
   * attribute patterns. This method does not cross element boundaries. That is,
   * if element X cannot have attributes of its own but can contain elements
   * that can have attributes, the return value if this method is called on the
   * pattern contained by element X's pattern will be ``false``.
   *
   * @returns True if the pattern is or has attributes. False if not.
   */
  _hasAttrs(): boolean {
    return false;
  }

  /**
   * Populates a memo with a mapping of (element name, [list of patterns]).  In
   * a Relax NG schema, the same element name may appear in multiple contexts,
   * with multiple contents. For instance an element named "name" could require
   * the sequence of elements "firstName", "lastName" in a certain context and
   * text in a different context. This method allows determining whether this
   * happens or not within a pattern.
   *
   * @param memo The memo in which to store the information.
   */
  _gatherElementDefinitions(memo: TrivialMap<Element[]>): void {
    // By default we have no children.
  }

  /**
   * Gets a new Pattern id.
   *
   * @returns The new id.
   */
  private __newID(): number {
    return Pattern.__id++;
  }
}

/**
 * This is the common class from which patterns are derived. Most patterns
 * create a new walker by passing a name resolver. The one exception is
 * [[Grammar]], which creates the name resolver that are used by other
 * patterns. So when calling it we do not need a ``resolver`` parameter and thus
 * it inherits from [[BasePattern]] rather than [[Pattern]].
 */
export abstract class Pattern extends BasePattern {
  /**
   * Creates a new walker to walk this pattern.
   *
   * @returns A walker.
   */
  newWalker(resolver: NameResolver): Walker<BasePattern> {
    throw new Error("derived classes must override this");
  }
}

/**
 * Pattern objects of this class have exactly one child pattern.
 */
export abstract class OneSubpattern extends Pattern {
  constructor(xmlPath: string, readonly pat: Pattern) {
    super(xmlPath);
  }

  _resolve(definitions: TrivialMap<Define>): Ref[] | undefined {
    return this.pat._resolve(definitions);
  }

  _prepare(namespaces: TrivialMap<number>): void {
    this.pat._prepare(namespaces);
  }

  _hasAttrs(): boolean {
    return this.pat._hasAttrs();
  }

  _gatherElementDefinitions(memo: TrivialMap<Element[]>): void {
    this.pat._gatherElementDefinitions(memo);
  }
}

/**
 * Pattern objects of this class have exactly two child patterns.
 *
 */
export class TwoSubpatterns extends Pattern {
  constructor(xmlPath: string, readonly patA: Pattern, readonly patB: Pattern) {
    super(xmlPath);
  }

  _resolve(definitions: TrivialMap<Define>): Ref[] | undefined {
    const a: Ref[] | undefined = this.patA._resolve(definitions);
    const b: Ref[] | undefined = this.patB._resolve(definitions);
    if (a && b) {
      return a.concat(b);
    }

    if (a) {
      return a;
    }

    return b;
  }

  _prepare(namespaces: TrivialMap<number>): void {
    this.patA._prepare(namespaces);
    this.patB._prepare(namespaces);
  }

  _hasAttrs(): boolean {
    return this.patA._hasAttrs() || this.patB._hasAttrs();
  }

  _gatherElementDefinitions(memo: TrivialMap<Element[]>): void {
    this.patA._gatherElementDefinitions(memo);
    this.patB._gatherElementDefinitions(memo);
  }
}

/**
 * This class modelizes events occurring during parsing. Upon encountering the
 * start of a start tag, an "enterStartTag" event is generated, etc. Event
 * objects are held to be immutable. No precautions have been made to enforce
 * this. Users of these objects simply must not modify them. Moreover, there is
 * one and only one of each event created.
 *
 * An event is made of a list of event parameters, with the first one being the
 * type of the event and the rest of the list varying depending on this type.
 *
 */
export class Event {
  /**
   * The cache of Event objects. So that we create one and only one Event object
   * per run.
   */
  // tslint:disable-next-line:variable-name
  private static __cache: {[key: string]: Event} = Object.create(null);

  /**
   * The next id to associate to the next Event object to be created. This is
   * used so that [[Event.hash]] can return unique values.
   */
  // tslint:disable-next-line:variable-name
  private static __id: number = 0;

  readonly id: string;
  readonly params: (string|namePatterns.Base)[];
  private readonly key: string;

  /**
   * @param args... The event parameters may be passed directly in the call
   * ``(new Event(a, b, ...))`` or the first call parameter may be a list
   * containing all the event parameters ``(new Event([a, b, ])``. All of the
   * event parameters must be strings.
   */
  constructor(...args: any[]) {
    const params: (string|namePatterns.Base)[] =
      (args.length === 1 && args[0] instanceof Array) ? args[0] : args;

    const key: string = params.join();

    // Ensure we have only one of each event created.
    const cached: Event | undefined = Event.__cache[key];
    if (cached !== undefined) {
      return cached;
    }

    this.id = `E${this.__newID()}`;
    this.params = params;
    this.key = key;

    Event.__cache[key] = this;
    return this;
  }

  /**
   * This method is mainly used to be able to use these objects in a
   * [["hashstructs".HashSet]] or a [["hashstructs".HashMap]].
   *
   * Returns a hash guaranteed to be unique to this object. There are some
   * limitations. First, if this module is instantiated twice, the objects
   * created by the two instances cannot mix without violating the uniqueness
   * guarantee. Second, the hash is a monotonically increasing counter, so when
   * it reaches beyond the maximum integer that the JavaScript vm can handle,
   * things go kaboom. Third, this hash is meant to work within salve only.
   *
   * @returns A hash unique to this object.
   */
  hash(): string {
    return this.id;
  }

  /**
   * Is this Event an attribute event?
   *
   * @returns ``true`` if the event is an attribute event, ``false``
   * otherwise.
   */
  isAttributeEvent(): boolean {
    return (this.params[0] === "attributeName" ||
            this.params[0] === "attributeValue");
  }

  /**
   * @returns A string representation of the event.
   */
  toString(): string {
    return `Event: ${this.params.join(", ")}`;
  }

  /**
   * Gets a new Event id.
   *
   * @returns The new id.
   */
  private __newID(): number {
    return Event.__id++;
  }

}

/**
 * Utility function used mainly in testing to transform a [["set".Set]] of
 * events into a string containing a tree structure.  The principle is to
 * combine events of a same type together and among events of a same type
 * combine those which are in the same namespace. So for instance if there is a
 * set of events that are all attributeName events plus one leaveStartTag event,
 * the output could be:
 *
 * <pre>``
 * attributeName:
 * ..uri A:
 * ....name 1
 * ....name 2
 * ..uri B:
 * ....name 3
 * ....name 4
 * leaveStartTag
 * ``</pre>
 *
 * The dots above are to represent more visually the indentation. Actual output
 * does not contain leading dots.  In this list there are two attributeName
 * events in the "uri A" namespace and two in the "uri B" namespace.
 *
 * @param evs Events to turn into a string.
 * @returns A string which contains the tree described above.
 */
export function eventsToTreeString(evs: Event[] | EventSet): string {
  function hashF(x: any): any {
    return x;
  }

  if (evs instanceof EventSet) {
    evs = evs.toArray();
  }

  const hash: HashMap = new HashMap(hashF);
  evs.forEach((ev: Event) => {
    const params: (string|namePatterns.Base)[] = ev.params;

    let node: HashMap = hash;
    for (let i: number = 0; i < params.length; ++i) {
      if (i === params.length - 1) {
        // Our HashSet/Map cannot deal with undefined values. So we mark
        // leaf elements with the value false.
        node.add(params[i], false);
      }
      else {
        let nextNode: HashMap | undefined = node.has(params[i]);
        if (nextNode === undefined) {
          nextNode = new HashMap(hashF);
          node.add(params[i], nextNode);
        }
        node = nextNode;
      }
    }
  });

  // We don't set dumpTree to const because the compiler has a fit when dumpTree
  // is accessed recursively.
  // tslint:disable-next-line:prefer-const
  let dumpTree: (hash: HashMap) => string =
    // tslint:disable-next-line:only-arrow-functions
    (function makeDumpTree(): (hash: HashMap) => string {
      let dumpTreeBuf: string = "";
      const dumpTreeIndent: string = "    ";
      // tslint:disable-next-line:no-shadowed-variable
      return (hash: HashMap): string => {
        let ret: string = "";
        const keys: any[] = hash.keys();
        keys.sort();
        for (const key of keys) {
          const sub: any | undefined = hash.has(key);
          if (sub !== false) {
            ret += `${dumpTreeBuf}${key}:\n`;
            dumpTreeBuf += dumpTreeIndent;
            ret += dumpTree(hash.has(key));
            dumpTreeBuf = dumpTreeBuf.slice(dumpTreeIndent.length);
          }
          else {
            ret += `${dumpTreeBuf}${key}\n`;
          }
        }

        return ret;
      };
    }());

  return dumpTree(hash);
  /* tslint:enable */
}

/**
 * Special event to which only the EmptyWalker responds positively.
 * @private
 */
const emptyEvent: Event = new Event("<empty>");

/**
 * Roughly speaking each [[Pattern]] object has a corresponding ``Walker`` class
 * that modelizes an object which is able to walk the pattern to which it
 * belongs. So an ``Element`` has an ``ElementWalker`` and an ``Attribute`` has
 * an ``AttributeWalker``. A ``Walker`` object responds to parsing events and
 * reports whether the structure represented by these events is valid.
 *
 * This base class records only a minimal number of properties so that child
 * classes can avoid keeping useless properties. A prime example is the walker
 * for ``<empty>`` which is a terminal walker (it has no subwalker) so does not
 * need to record the name resolver.
 *
 * Note that users of this API do not instantiate Walker objects themselves.
 */
export abstract class Walker<T extends BasePattern> {

  /**
   * The next id to associate to the next Walker object to be created. This is
   * used so that [[hash]] can return unique values.
   */
  private static __id: number = 0; // tslint:disable-line:variable-name

  readonly id: string = `W${this.__newID()}`;

  protected readonly el: T;

  protected possibleCached: EventSet | undefined;

  protected suppressedAttributes: boolean = false;

  /**
   * @param el The element to which this walker belongs.
   */
  protected constructor(other: Walker<T>, memo: HashMap);
  protected constructor(el: T);
  protected constructor(elOrWalker: T | Walker<T>) {
    if (elOrWalker instanceof Walker) {
      this.el = elOrWalker.el;
      this.possibleCached = elOrWalker.possibleCached;
      this.suppressedAttributes = elOrWalker.suppressedAttributes;
    }
    else {
      this.el = elOrWalker;
    }
    // if (DEBUG) {
    //     wrap(this, "_possible", possibleTracer);
    //     wrap(this, "fireEvent", fireEventTracer);
    //     wrap(this, "end", plainTracer);
    //     wrap(this, "_suppressAttributes", plainTracer);
    //     wrap(this, "_clone", plainTracer);
    // }
  }

  /**
   * This method is mainly used to be able to use these objects in a
   * [["hashstructs".HashSet]] or a [["hashstructs".HashMap]].
   *
   * Returns a hash guaranteed to be unique to this object. There are some
   * limitations. First, if this module is instantiated twice, the objects
   * created by the two instances cannot mix without violating the uniqueness
   * guarantee. Second, the hash is a monotonically increasing counter, so when
   * it reaches beyond the maximum integer that the JavaScript vm can handle,
   * things go kaboom. Third, this hash is meant to work within salve only.
   *
   * @returns A hash unique to this object.
   */
  hash(): string {
    return this.id;
  }

  /**
   * Fetch the set of possible events at the current stage of parsing.
   *
   * @returns The set of events that can be fired without resulting in an error.
   */
  possible(): EventSet {
    return new EventSet(this._possible());
  }

  /**
   * Helper method for possible(). The possible() method is designed to be safe,
   * in that the value it returns is not shared, so the caller may change it
   * without breaking anything. However, this method returns a value that may not
   * be modified by the caller. It is used internally among the classes of this
   * file to save copying time.
   *
   * @returns The set of events that can be fired without resulting in an error.
   */
  abstract _possible(): EventSet;

  // These functions return true if there is no problem, or a list of
  // ValidationError objects otherwise.

  /**
   * Passes an event to the walker for handling. The Walker will determine whether
   * it or one of its children can handle the event.
   *
   * @param ev The event to handle.
   *
   * @returns The value ``false`` if there was no error. The value ``undefined``
   * if no walker matches the pattern. Otherwise, an array of
   * [[ValidationError]] objects.
   */
  abstract fireEvent(ev: Event): FireEventResult;

  /**
   * Can this Walker validly end after the previous event fired?
   *
   * @param attribute ``true`` if calling this method while processing
   * attributes, ``false`` otherwise.
   *
   * @return ``true`` if the walker can validly end here.  ``false`` otherwise.
   */
  canEnd(attribute: boolean = false): boolean {
    return true;
  }

  /**
   * This method ends the Walker processing. It should not see any further events
   * after end is called.
   *
   * @param attribute ``true`` if calling this method while processing
   * attributes, ``false`` otherwise.
   *
   * @returns ``false`` if the walker ended without error. Otherwise, the errors.
   */
  end(attribute: boolean = false): EndResult {
    return false;
  }

  /**
   * Deep copy the Walker.
   *
   * @returns A deep copy of the Walker.
   */
  clone(): this {
    return this._clone(new HashMap(hashHelper));
  }

 /**
  * Helper function for clone. Code that is not part of the Pattern family would
  * call clone() whereas Pattern and its derived classes call _clone() with the
  * appropriate memo.
  *
  * @param memo A mapping of old object to copy object. As a tree of patterns
  * is being cloned, this memo is populated.  So if A is cloned to B then a
  * mapping from A to B is stored in the memo.  If A is seen again in the same
  * cloning operation, then it will be substituted with B instead of creating a
  * new object.
  *
  * This method is meant only to be used by classes derived from [[Walker]]. It
  * is public due to a limitation of TypeScript. Don't call it from your own
  * code. You've been warned.
  *
  * @protected
  *
  * @returns The clone.
  */
  _clone(memo: HashMap): this {
    return new (this.constructor as any)(this, memo);
  }

  /**
   * Helper function used to prevent Walker objects from reporting attribute
   * events as possible. In RelaxNG it is normal to mix attributes and elements
   * in patterns. However, XML validation segregates attributes and
   * elements. Once a start tag has been processed, attributes are not possible
   * until a new start tag begins. For instance, if a Walker is processing
   * ``<foo a="1">``, as soon as the greater than symbol is encountered,
   * attribute events are no longer possible. This function informs the Walker
   * of this fact.
   *
   */
  _suppressAttributes(): void {
    this.suppressedAttributes = true;
  }

  /**
   * Helper method for cloning. This method should be called to clone objects
   * that do not participate in the ``clone``, protocol. This typically means
   * instance properties that are not ``Walker`` objects and not immutable.
   *
   * This method will call a ``clone`` method on ``obj``, when it determines that
   * cloning must happen.
   *
   * @param obj The object to clone.
   *
   * @param memo A mapping of old object to copy object. As a tree of patterns
   * is being cloned, this memo is populated. So if A is cloned to B then a
   * mapping from A to B is stored in the memo. If A is seen again in the same
   * cloning operation, then it will be substituted with B instead of creating a
   * new object. This should be the same object as the one passed to the
   * constructor.
   *
   * @returns A clone of ``obj``.
   */
  protected _cloneIfNeeded<T extends Clonable>(obj: T, memo: HashMap): T {
    let other: T = memo.has(obj);
    if (other !== undefined) {
      return other;
    }
    other = obj.clone();
    memo.add(obj, other);
    return other;
  }

  /**
   * Gets a new Walker id.
   *
   * @returns The new id.
   */
  private __newID(): number {
    return Walker.__id++;
  }
}

function isHashMap(value: any, msg: string = ""): HashMap {
  if (value instanceof HashMap) {
    return value;
  }

  throw new Error(`did not get a HashMap ${msg}`);
}

function isNameResolver(value: any, msg: string = ""): NameResolver {
  if (value instanceof NameResolver) {
    return value;
  }

  throw new Error(`did not get a HashMap ${msg}`);
}

/**
 * Walkers that have only one subwalker.
 */
export abstract class SingleSubwalker<T extends Pattern> extends Walker<T> {
  protected subwalker: Walker<BasePattern>;

  _possible(): EventSet {
    return this.subwalker.possible();
  }

  fireEvent(ev: Event): FireEventResult {
    return this.subwalker.fireEvent(ev);
  }

  _suppressAttributes(): void {
    if (!this.suppressedAttributes) {
      this.suppressedAttributes = true;
      this.subwalker._suppressAttributes();
    }
  }

  canEnd(attribute: boolean = false): boolean {
    return this.subwalker.canEnd(attribute);
  }

  end(attribute: boolean = false): EndResult {
    return this.subwalker.end(attribute);
  }
}

/**
 * Pattern for ``<empty/>``.
 */
class Empty extends Pattern {}

/**
 * Walker for [[Empty]].
 *
 * @param el The pattern for which this walker was created.
 *
 * @param resolver Ignored by this walker.
 */
class EmptyWalker extends Walker<Empty> {
  protected constructor(other: EmptyWalker, memo: HashMap);
  protected constructor(el: Empty);
  protected constructor(elOrWalker: Empty | EmptyWalker, memo?: HashMap) {
    if (elOrWalker instanceof EmptyWalker) {
      memo = isHashMap(memo);
      super(elOrWalker, memo);
    }
    else {
      super(elOrWalker);
      this.possibleCached = new EventSet();
    }
  }

  possible(): EventSet {
    // Save some time by avoiding calling _possible. We always want to return a
    // new object here.
    return new EventSet();
  }

  _possible(): EventSet {
    return this.possibleCached!;
  }

  fireEvent(ev: Event): false | undefined {
    if ((ev === emptyEvent) ||
        ((ev.params[0] === "text") && ((ev.params[1] as string).trim() === ""))) {
      return false;
    }

    return undefined;
  }
}

addWalker(Empty, EmptyWalker);

/**
 * List pattern.
 */
class List extends OneSubpattern {}

/**
 * Walker for [[List]].
 *
 */
class ListWalker extends SingleSubwalker<List> {
  private seenTokens: boolean;
  private matched: boolean;
  private readonly nameResolver: NameResolver;

  protected constructor(other: ListWalker, memo: HashMap);
  protected constructor(el: List, nameResolver: NameResolver);
  protected constructor(elOrWalker: List | ListWalker, nameResolverOrMemo: NameResolver | HashMap) {
    if (elOrWalker instanceof ListWalker) {
      const walker: ListWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo, "as 2nd argument");
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.subwalker = walker.subwalker._clone(memo);
      this.seenTokens = walker.seenTokens;
      this.matched = walker.matched;
    }
    else {
      const el: List = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo,
                                                        "as 2nd argument");
      super(el);
      this.nameResolver = nameResolver;
      this.subwalker = el.pat.newWalker(this.nameResolver);
      this.seenTokens = false;
      this.matched = false;
    }
  }

  fireEvent(ev: Event): FireEventResult {
    // Only these two types can match.
    if (ev.params[0] !== "text") {
      return undefined;
    }

    const trimmed: string = (ev.params[1] as string).trim();

    // The list walker cannot send empty strings to its children because it
    // validates a list of **tokens**.
    if (trimmed === "") {
      return false;
    }

    this.seenTokens = true;

    const tokens: string[] = trimmed.split(/\s+/);

    for (const token of tokens) {
      const ret: FireEventResult =
        this.subwalker.fireEvent(new Event(ev.params[0], token));
      if (ret !== false) {
        return ret;
      }
    }

    this.matched = true;
    return false;
  }

  _suppressAttributes(): void {
    // Lists cannot contain attributes.
  }

  canEnd(attribute: boolean = false): boolean {
    if (!this.seenTokens) {
      return (this.subwalker.fireEvent(emptyEvent) === false);
    }
    return this.subwalker.canEnd(attribute);
  }

  end(attribute: boolean = false): EndResult {
    const ret: EndResult = this.subwalker.end(attribute);
    if (ret !== false) {
      return ret;
    }

    if (this.canEnd(attribute)) {
      return false;
    }

    return [new ValidationError("unfulfilled list")];
  }
}

addWalker(List, ListWalker);

/**
 * Value pattern.
 */
class Value extends Pattern {
  readonly datatype: Datatype;
  readonly rawValue: string;
  private _value: any | undefined;

  /**
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param value The value expected in the document.
   *
   * @param type The type of value. ``undefined`` means
   * ``"token"``.
   *
   * @param datatypeLibrary The URI of the datatype library to
   * use. ``undefined`` means use the builtin library.
   *
   * @param ns The namespace in which to interpret the value.
   */
  // tslint:disable-next-line: no-reserved-keywords
  constructor(xmlPath: string, value: string, readonly type: string = "token",
              readonly datatypeLibrary: string = "", readonly ns: string = "") {
    super(xmlPath);
    this.datatype = registry.get(this.datatypeLibrary).types[this.type];
    if (!this.datatype) {
      throw new Error(`unkown type: ${type}`);
    }
    this.rawValue = value;
  }

  get value(): any {
    let ret: any = this._value;
    if (ret) {
      return ret;
    }

    // We construct a pseudo-context representing the context in the schema
    // file.
    let context: { resolver: NameResolver } | undefined;
    if (this.datatype.needsContext) {
      const nr: NameResolver = new NameResolver();
      nr.definePrefix("", this.ns);
      context = { resolver: nr };
    }
    ret = this._value = this.datatype.parseValue(this.rawValue, context);

    return ret;
  }
}

/**
 * Walker for [[Value]].
 */
class ValueWalker extends Walker<Value> {
  private matched: boolean;
  private readonly context: { resolver: NameResolver } | undefined;
  private readonly nameResolver: NameResolver;

  protected constructor(other: ValueWalker, memo: HashMap);
  protected constructor(el: Value, nameResolver: NameResolver);
  protected constructor(elOrWalker: Value |  ValueWalker,
                        nameResolverOrMemo: HashMap | NameResolver) {
    if (elOrWalker instanceof ValueWalker) {
      const walker: ValueWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo, "as 2nd argument");
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.context = walker.context && { resolver: this.nameResolver };
      this.matched = walker.matched;
    }
    else {
      const el: Value = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo,
                                                        "as 2nd argument");
      super(el);
      this.nameResolver = nameResolver;
      this.possibleCached = new EventSet(new Event("text", el.rawValue));
      this.context = el.datatype.needsContext ?
        { resolver: this.nameResolver } : undefined;
      this.matched = false;
    }
  }

  _possible(): EventSet {
    return this.possibleCached!;
  }

  fireEvent(ev: Event): false | undefined {
    if (this.matched) {
      return undefined;
    }

    if (ev.params[0] !== "text") {
      return undefined;
    }

    if (!this.el.datatype.equal(ev.params[1] as string, this.el.value,
                                this.context)) {
      return undefined;
    }

    this.matched = true;
    this.possibleCached = new EventSet();
    return false;
  }

  canEnd(attribute: boolean = false): boolean {
    return this.matched || this.el.rawValue === "";
  }

  end(attribute: boolean = false): EndResult {
    if (this.canEnd(attribute)) {
      return false;
    }

    return [new ValidationError(`value required: ${this.el.rawValue}`)];
  }

  _suppressAttributes(): void {
    // No child attributes.
  }
}

addWalker(Value, ValueWalker);

/**
 * Data pattern.
 */
class Data extends Pattern {
  readonly datatype: Datatype;
  readonly rngParams: RawParameter[];
  private _params: any;

  /**
   *
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param type The type of value.
   *
   * @param datatypeLibrary The URI of the datatype library to use.
   *
   * @param params The parameters from the RNG file.
   *
   * @param except The exception pattern.
   */
  // tslint:disable-next-line: no-reserved-keywords
  constructor(xmlPath: string, readonly type: string = "token",
              readonly datatypeLibrary: string = "", params: RawParameter[],
              readonly except: Pattern) {
    super(xmlPath);
    this.datatype = registry.get(this.datatypeLibrary).types[this.type];
    if (!this.datatype) {
      throw new Error(`unkown type: ${type}`);
    }
    this.rngParams = params || [];
  }

  get params(): any {
    let ret: any = this._params;
    if (ret) {
      return ret;
    }

    ret = this._params = this.datatype.parseParams(this.xmlPath, this.rngParams);

    return ret;
  }
}

/**
 * Walker for [[Data]].
 */
class DataWalker extends Walker<Data> {
  private readonly context: { resolver: NameResolver } | undefined;
  private matched: boolean;
  private readonly nameResolver: NameResolver;

  /**
   * @param el The pattern for which this walker was created.
   *
   * @param resolver The name resolver that can be used to convert namespace
   * prefixes to namespaces.
   */
  protected constructor(other: DataWalker, memo: HashMap);
  protected constructor(el: Data, nameResolver: NameResolver);
  protected constructor(elOrWalker: DataWalker | Data, nameResolverOrMemo: NameResolver | HashMap) {
    if (elOrWalker instanceof DataWalker) {
      const walker: DataWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.context = walker.context && { resolver: this.nameResolver };
      this.matched = walker.matched;
    }
    else {
      const el: Data = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo,
                                                        "as 2nd argument");
      super(el);

      this.nameResolver = nameResolver;
      // We completely ignore the possible exception when producing the
      // possibilities. There is no clean way to specify such an exception.
      this.possibleCached = new EventSet(new Event("text",
                                                   this.el.datatype.regexp));
      this.context = el.datatype.needsContext ? { resolver: this.nameResolver } : undefined;
      this.matched = false;
    }
  }

  _possible(): EventSet {
    return this.possibleCached!;
  }

  fireEvent(ev: Event): false | undefined {
    if (this.matched) {
      return undefined;
    }

    if (ev.params[0] !== "text") {
      return undefined;
    }

    if (this.el.datatype.disallows(ev.params[1] as string, this.el.params,
                                   this.context)) {
      return undefined;
    }

    if (this.el.except) {
      const walker: Walker<BasePattern> =
        this.el.except.newWalker(this.nameResolver);
      const exceptRet: FireEventResult = walker.fireEvent(ev);

      // False, so the except does match the text, and so this pattern does
      // not match it.
      if (exceptRet === false) {
        return undefined;
      }

      // Otherwise, it is undefined, in which case it means the except does
      // not match the text, and we are fine. Or it would be possible for the
      // walker to have returned an error but there is nothing we can do with
      // such errors here.
    }

    this.matched = true;
    this.possibleCached = new EventSet();
    return false;
  }

  canEnd(attribute: boolean = false): boolean {
    // If we matched, we are done. salve does not allow text that appears in
    // an XML element to be passed as two "text" events. So there is nothing
    // to come that could falsify the match. (If a client *does* pass
    // multiple text events one after the other, it is using salve
    // incorrectly.)
    if (this.matched) {
      return true;
    }

    // We have not matched anything. Therefore we have to check whether we
    // allow the empty string.
    if (this.el.except) {
      const walker: Walker<BasePattern> =
        this.el.except.newWalker(this.nameResolver);
      if (walker.canEnd()) { // Matches the empty string
        return false;
      }
    }

    return !this.el.datatype.disallows("", this.el.params, this.context);
  }

  end(attribute: boolean = false): EndResult {
    if (this.canEnd(attribute)) {
      return false;
    }

    return [new ValidationError("value required")];
  }

  _suppressAttributes(): void {
    // No child attributes.
  }
}

addWalker(Data, DataWalker);

/**
 * Pattern for ``<notAllowed/>``.
 */
class NotAllowed extends Pattern {}

/**
 * Walker for [[NotAllowed]];
 */
class NotAllowedWalker extends Walker<NotAllowed> {
  /**
   * @param el The pattern for which this walker was created.
   */
  protected constructor(walker: NotAllowedWalker, memo: HashMap);
  protected constructor(el: NotAllowed);
  protected constructor(elOrWalker: NotAllowedWalker | NotAllowed,
                        memo?: HashMap) {
    if (elOrWalker instanceof NotAllowedWalker) {
      const walker: NotAllowedWalker = elOrWalker;
      memo = isHashMap(memo); // Makes sure it is not undefined.
      super(walker, memo);
    }
    else {
      const el: NotAllowed = elOrWalker;
      super(el);
      this.possibleCached = new EventSet();
    }
  }

  possible(): EventSet {
    // Save some time by avoiding calling _possible
    return new EventSet();
  }

  _possible(): EventSet {
    return this.possibleCached!;
  }

  fireEvent(ev: Event): undefined {
    return undefined; // we never match!
  }
}

addWalker(NotAllowed, NotAllowedWalker);

/**
 * Pattern for ``<text/>``.
 */
class Text extends Pattern {}

/**
 *
 * Walker for [[Text]]
 *
 */
class TextWalker extends Walker<Text> {
  private static readonly _textEvent: Event = new Event("text", /^.*$/);

  /**
   * @param el The pattern for which this walker was constructed.
   */
  protected constructor(walker: NotAllowedWalker, memo: HashMap);
  protected constructor(el: Text);
  protected constructor(elOrWalker: NotAllowedWalker | Text, memo?: HashMap) {
    if (elOrWalker instanceof NotAllowedWalker) {
      const walker: NotAllowedWalker = elOrWalker;
      memo = isHashMap(memo);
      super(walker, memo);
    }
    else {
      super(elOrWalker);
      this.possibleCached = new EventSet(TextWalker._textEvent);
    }
  }

  _possible(): EventSet {
    return this.possibleCached!;
  }

  fireEvent(ev: Event): false | undefined {
    return (ev.params[0] === "text") ? false : undefined;
  }
}
addWalker(Text, TextWalker);

// Param is a defunct pattern. During the processing of the RNG file all
// ``param`` elements are converted into parameters to ``Data`` so we never end
// up with a converted file that contains Param.
class Param extends Pattern {
  constructor(xmlPath: string) {
    super(xmlPath);
    throw new Error("this pattern is a placeholder and should never actually " +
                    "be used");
  }
}

/**
 * A pattern for RNG references.
 */
export class Ref extends Pattern {
  private resolvesTo?: Define;
  /**
   *
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param name The reference name.
   */
  constructor(xmlPath: string, readonly name: string) {
    super(xmlPath);
  }

  _prepare(): void {
    // We do not cross ref/define boundaries to avoid infinite loops.
    return;
  }

  _resolve(definitions: TrivialMap<Define>): Ref[] | undefined {
    this.resolvesTo = definitions[this.name];
    if (this.resolvesTo === undefined) {
      return [this];
    }
    return undefined;
  }

  // addWalker(Ref, RefWalker); No, see below
  // This completely skips the creation of RefWalker and DefineWalker. This
  // returns the walker for whatever it is that the Define element this
  // refers to ultimately contains.
  newWalker(resolver: NameResolver): Walker<BasePattern> {
    return this.resolvesTo!.pat.newWalker(resolver);
  }
}

/**
 * A pattern for ``<oneOrMore>``.
 */
class  OneOrMore extends OneSubpattern {}

/**
 * Walker for [[OneOrMore]]
 */
class OneOrMoreWalker extends Walker<OneOrMore> {
  private seenOnce: boolean;
  private currentIteration: Walker<BasePattern> | undefined;
  private nextIteration: Walker<BasePattern> | undefined;
  private readonly nameResolver: NameResolver;

  /**
   * @param el The pattern for which this walker was created.
   *
   * @param resolver The name resolver that can be used to convert namespace
   * prefixes to namespaces.
   */
  protected constructor(walker: OneOrMoreWalker, memo: HashMap);
  protected constructor(el: OneOrMore, nameResolver: NameResolver);
  protected constructor(elOrWalker: OneOrMoreWalker | OneOrMore,
                        nameResolverOrMemo: NameResolver | HashMap) {
    if (elOrWalker instanceof OneOrMoreWalker) {
      const walker: OneOrMoreWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.seenOnce = walker.seenOnce;
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.currentIteration = walker.currentIteration &&
        walker.currentIteration._clone(memo);
      this.nextIteration = walker.nextIteration &&
        walker.nextIteration._clone(memo);
    }
    else {
      const el: OneOrMore = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo);
      super(el);
      this.nameResolver = nameResolver;
      this.seenOnce = false;
    }
  }

  _possible(): EventSet {
    if (this.possibleCached !== undefined) {
      return this.possibleCached;
    }

    this._instantiateCurrentIteration();
    this.possibleCached = this.currentIteration!._possible();

    if (this.currentIteration!.canEnd()) {
      this.possibleCached = new EventSet(this.possibleCached);
      this._instantiateNextIteration();

      const nextPossible: EventSet = this.nextIteration!._possible();

      this.possibleCached.union(nextPossible);
    }

    return this.possibleCached;
  }

  fireEvent(ev: Event): FireEventResult {
    this.possibleCached = undefined;

    this._instantiateCurrentIteration();

    let ret: FireEventResult = this.currentIteration!.fireEvent(ev);
    if (ret === false) {
      this.seenOnce = true;
    }

    if (ret !== undefined) {
      return ret;
    }

    if (this.seenOnce && this.currentIteration!.canEnd()) {
      ret = this.currentIteration!.end();
      if (ret) {
        throw new Error("internal error; canEnd() returns true but end() fails");
      }

      this._instantiateNextIteration();
      const nextRet: FireEventResult = this.nextIteration!.fireEvent(ev);
      if (nextRet === false) {
        this.currentIteration = this.nextIteration;
        this.nextIteration = undefined;
      }
      return nextRet;
    }
    return undefined;
  }

  _suppressAttributes(): void {
    // A oneOrMore element can happen if we have the pattern ``(attribute * {
    // text })+`` for instance. Once converted to the simplified RNG, it
    // becomes:
    //
    // ``<oneOrMore><attribute><anyName/><rng:text/></attribute></oneOrMore>``
    //
    // An attribute in ``oneOrMore`` cannot happen when ``anyName`` is not used
    // because an attribute of any given name cannot be repeated.
    //
    this._instantiateCurrentIteration();
    if (!this.suppressedAttributes) {
      this.suppressedAttributes = true;
      this.possibleCached = undefined; // No longer valid.
      this.currentIteration!._suppressAttributes();

      if (this.nextIteration) {
        this.nextIteration._suppressAttributes();
      }
    }
  }

  canEnd(attribute: boolean = false): boolean {
    if (attribute) {
      if (!this.el.pat._hasAttrs()) {
        return true;
      }

      this._instantiateCurrentIteration();

      return this.currentIteration!.canEnd(true);
    }
    return this.seenOnce && this.currentIteration!.canEnd();
  }

  end(attribute: boolean = false): EndResult {
    if (this.canEnd(attribute)) {
      return false;
    }

    // Undefined currentIteration can happen in rare cases.
    this._instantiateCurrentIteration();

    // Release nextIteration, which we won't need anymore.
    this.nextIteration = undefined;
    return this.currentIteration!.end(attribute);
  }

  private _instantiateCurrentIteration(): void {
    if (this.currentIteration === undefined) {
      this.currentIteration = this.el.pat.newWalker(this.nameResolver);
    }
  }

  private _instantiateNextIteration(): void {
    if (this.nextIteration === undefined) {
      this.nextIteration = this.el.pat.newWalker(this.nameResolver);

      // Whereas _suppressAttributes calls _instantiateCurrentIteration() so
      // that currentIteration is always existing and its _suppressAttributes()
      // method is called before _suppressAttributes() returns, the same is not
      // true of nextIteration. So if we create it **after**
      // _suppressAttributes() was called we need to call _suppressAttributes()
      // on it.
      if (this.suppressedAttributes) {
        this.nextIteration._suppressAttributes();
      }
    }
  }
}

addWalker(OneOrMore, OneOrMoreWalker);

/**
 * A pattern for ``<choice>``.
 */
class Choice extends TwoSubpatterns {}

/**
 * Walker for [[Choice]].
 */
class ChoiceWalker extends Walker<Choice> {
  private chosen: boolean;
  private walkerA: Walker<BasePattern> | undefined;
  private walkerB: Walker<BasePattern> | undefined;
  private instantiatedWalkers: boolean;
  private readonly nameResolver: NameResolver;

  protected constructor(walker: ChoiceWalker, memo: HashMap);
  protected constructor(el: Choice, nameResolver: NameResolver);
  protected constructor(elOrWalker: ChoiceWalker | Choice,
                        nameResolverOrMemo: NameResolver | HashMap)
  {
    if (elOrWalker instanceof ChoiceWalker) {
      const walker: ChoiceWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.chosen = walker.chosen;
      this.walkerA = walker.walkerA && walker.walkerA._clone(memo);
      this.walkerB = walker.walkerB && walker.walkerB._clone(memo);
      this.instantiatedWalkers = walker.instantiatedWalkers;
    }
    else {
      const el: Choice = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo);
      super(el);
      this.nameResolver = nameResolver;
      this.chosen = false;
      this.instantiatedWalkers = false;
    }
  }

  _possible(): EventSet {
    this._instantiateWalkers();
    if (this.possibleCached !== undefined) {
      return this.possibleCached;
    }

    this.possibleCached = this.walkerA && this.walkerA._possible();

    if (this.walkerB !== undefined) {
      this.possibleCached = new EventSet(this.possibleCached);
      const possibleB: EventSet = this.walkerB._possible();
      this.possibleCached.union(possibleB);
    }
    else if (this.possibleCached === undefined) {
      this.possibleCached = new EventSet();
    }

    return this.possibleCached;
  }

  fireEvent(ev: Event): FireEventResult {
    this._instantiateWalkers();

    this.possibleCached = undefined;
    // We purposely do not normalize this.walker_{a,b} to a boolean value because
    // we do want `undefined` to be the result if the walkers are undefined.
    const retA: FireEventResult = this.walkerA && this.walkerA.fireEvent(ev);
    const retB: FireEventResult = this.walkerB && this.walkerB.fireEvent(ev);

    if (retA !== undefined) {
      this.chosen = true;
      if (retB === undefined) {
        this.walkerB = undefined;
        return retA;
      }
      return retA;
    }

    if (retB !== undefined) {
      this.chosen = true;
      // We do not need to test if retA is undefined because we would not get here
      // if it were not.
      this.walkerA = undefined;
      return retB;
    }

    return undefined;
  }

  _suppressAttributes(): void {
    this._instantiateWalkers();
    if (!this.suppressedAttributes) {
      this.possibleCached = undefined; // no longer valid
      this.suppressedAttributes = true;

      if (this.walkerA) {
        this.walkerA._suppressAttributes();
      }
      if (this.walkerB) {
        this.walkerB._suppressAttributes();
      }
    }
  }

  canEnd(attribute: boolean = false): boolean {
    this._instantiateWalkers();

    let retA: boolean = false;
    let retB: boolean  = false;
    if (attribute) {
      retA = !this.el.patA._hasAttrs();
      retB = !this.el.patB._hasAttrs();
    }

    // The `!!` are to normalize to boolean values.
    retA = retA || (!!this.walkerA && this.walkerA.canEnd(attribute));
    retB = retB || (!!this.walkerB && this.walkerB.canEnd(attribute));

    // ChoiceWalker can end if any walker can end. The assignments earlier ensure
    // that the logic works.
    return retA || retB;
  }

  end(attribute: boolean = false): EndResult {
    this._instantiateWalkers();

    if (this.canEnd(attribute)) {
      return false;
    }

    // The `!!` are to normalize to boolean values.
    const retA: EndResult = !!this.walkerA && this.walkerA.end(attribute);
    const retB: EndResult = !!this.walkerB && this.walkerB.end(attribute);

    if (!retA && !retB) {
      return false;
    }

    if (retA && !retB) {
      return retA;
    }

    if (!retA && retB) {
      return retB;
    }

    // If we are here both walkers exist and returned an error.
    const namesA: namePatterns.Base[] = [];
    const namesB: namePatterns.Base[] = [];
    let notAChoiceError: boolean = false;
    this.walkerA!.possible().forEach((ev: Event) => {
      if (ev.params[0] === "enterStartTag") {
        namesA.push(ev.params[1] as namePatterns.Base);
      }
      else {
        notAChoiceError = true;
      }
    });

    if (!notAChoiceError) {
      this.walkerB!.possible().forEach((ev: Event) => {
        if (ev.params[0] === "enterStartTag") {
          namesB.push(ev.params[1] as namePatterns.Base);
        }
        else {
          notAChoiceError = true;
        }
      });

      if (!notAChoiceError) {
        return [new ChoiceError(namesA, namesB)];
      }
    }

    // If we get here, we were not able to raise a ChoiceError, possibly
    // because there was not enough information to decide among the two
    // walkers. Return whatever error comes first.
    return retA || retB;
  }

  /**
   * Creates walkers for the patterns contained by this one. Calling this method
   * multiple times is safe as the walkers are created once and only once.
   */
  private _instantiateWalkers(): void {
    if (!this.instantiatedWalkers) {
      this.instantiatedWalkers = true;

      this.walkerA = this.el.patA.newWalker(this.nameResolver);
      this.walkerB = this.el.patB.newWalker(this.nameResolver);
    }
  }
}

addWalker(Choice, ChoiceWalker);

/**
 * A pattern for ``<group>``.
 */
class Group extends TwoSubpatterns {}

/**
 * Walker for [[Group]].
 */
class GroupWalker extends Walker<Group> {
  private hitA: boolean;
  private endedA: boolean;
  private hitB: boolean;
  private walkerA: Walker<BasePattern> | undefined;
  private walkerB: Walker<BasePattern> | undefined;
  private readonly nameResolver: NameResolver;

  /**
   * @param el The pattern for which this walker was created.
   *
   * @param nameResolver The name resolver that can be used to convert namespace
   * prefixes to namespaces.
   */
  protected constructor(walker: GroupWalker, memo: HashMap);
  protected constructor(el: Group, nameResolver: NameResolver);
  protected constructor(elOrWalker: GroupWalker | Group,
                        nameResolverOrMemo: HashMap | NameResolver) {
    if (elOrWalker instanceof GroupWalker) {
      const walker: GroupWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.hitA = walker.hitA;
      this.endedA = walker.endedA;
      this.hitB = walker.hitB;
      this.walkerA = walker.walkerA && walker.walkerA._clone(memo);
      this.walkerB = walker.walkerB && walker.walkerB._clone(memo);
    }
    else {
      const el: Group = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo);
      super(el);
      this.nameResolver = nameResolver;
      this.hitA = false;
      this.endedA = false;
      this.hitB = false;
    }
  }

  _possible(): EventSet {
    this._instantiateWalkers();
    if (this.possibleCached !== undefined) {
      return this.possibleCached;
    }

    this.possibleCached = (!this.endedA) ? this.walkerA!._possible() : undefined;

    if (this.suppressedAttributes) {
      // If we are in the midst of processing walker a and it cannot end yet,
      // then we do not want to see anything from b.
      if (this.endedA || this.walkerA!.canEnd()) {
        this.possibleCached = new EventSet(this.possibleCached);
        this.possibleCached.union(this.walkerB!._possible());
      }
    }
    else {
      let possibleB: EventSet = this.walkerB!._possible();

      // Attribute events are still possible event if the first walker is not
      // done with.
      if ((!this.endedA || this.hitB) && !this.walkerA!.canEnd()) {
        // Narrow it down to attribute events...
        possibleB = possibleB.filter((x: Event) => x.isAttributeEvent());
      }
      this.possibleCached = new EventSet(this.possibleCached);
      this.possibleCached.union(possibleB);
    }

    return this.possibleCached!;
  }

  fireEvent(ev: Event): FireEventResult {
    this._instantiateWalkers();

    this.possibleCached = undefined;
    if (!this.endedA) {
      const retA: FireEventResult = this.walkerA!.fireEvent(ev);
      if (retA !== undefined) {
        this.hitA = true;
        return retA;
      }

      // We must return right away if walkerA cannot yet end. Only attribute
      // events are allowed to move forward.
      if (!ev.isAttributeEvent() && !this.walkerA!.canEnd()) {
        return undefined;
      }
    }

    let retB: FireEventResult = this.walkerB!.fireEvent(ev);
    if (retB !== undefined) {
      this.hitB = true;
    }

    // Non-attribute event: if walker b matched the event then we must end
    // walkerA, if we've not already done so.
    if (!ev.isAttributeEvent() && retB !== undefined && !this.endedA) {
      const endRet: EndResult = this.walkerA!.end();
      this.endedA = true;

      // Combine the possible errors.
      if (!retB) {
        // retB must be false, because retB === undefined has been
        // eliminated above; toss it.
        retB = endRet;
      }
      else if (endRet) {
        retB = retB.concat(endRet);
      }
    }
    return retB;
  }

  _suppressAttributes(): void {
    this._instantiateWalkers();
    if (!this.suppressedAttributes) {
      this.possibleCached = undefined; // no longer valid
      this.suppressedAttributes = true;

      this.walkerA!._suppressAttributes();
      this.walkerB!._suppressAttributes();
    }
  }

  canEnd(attribute: boolean = false): boolean {
    this._instantiateWalkers();
    if (attribute) {
      const aHas: boolean = this.el.patA._hasAttrs();
      const bHas: boolean = this.el.patB._hasAttrs();
      if (aHas && bHas) {
        return this.walkerA!.canEnd(attribute) &&
          this.walkerB!.canEnd(attribute);
      }
      else if (aHas) {
        return this.walkerA!.canEnd(true);
      }
      else if (bHas) {
        return this.walkerB!.canEnd(true);
      }

      return true;
    }

    return this.walkerA!.canEnd(attribute) && this.walkerB!.canEnd(attribute);
  }

  end(attribute: boolean = false): EndResult {
    if (this.canEnd()) {
      return false;
    }

    let ret: EndResult;

    if (!this.endedA) { // Don't end it more than once.
      ret = this.walkerA!.end(attribute);
      if (ret) {
        return ret;
      }
    }

    ret = this.walkerB!.end(attribute);
    if (ret) {
      return ret;
    }

    return false;
  }

  /**
   * Creates walkers for the patterns contained by this one. Calling this
   * method multiple times is safe as the walkers are created once and only
   * once.
   */
  private _instantiateWalkers(): void {
    if (this.walkerA === undefined) {
      this.walkerA = this.el.patA.newWalker(this.nameResolver);
      this.walkerB = this.el.patB.newWalker(this.nameResolver);
    }
  }
}

addWalker(Group, GroupWalker);

/**
 * A pattern for ``<interleave>``.
 */
class Interleave extends TwoSubpatterns {}

/**
 * Walker for [[Interleave]].
 */
class InterleaveWalker extends Walker<Interleave> {
  private inA: boolean;
  private inB: boolean;
  private walkerA: Walker<BasePattern> | undefined;
  private walkerB: Walker<BasePattern> | undefined;
  private readonly nameResolver: NameResolver;

  /**
   * @param el The pattern for which this walker was
   * created.
   *
   * @param resolver The name resolver that
   * can be used to convert namespace prefixes to namespaces.
   */
  protected constructor(walker: InterleaveWalker, memo: HashMap);
  protected constructor(el: Interleave, nameResolver: NameResolver);
  protected constructor(elOrWalker: InterleaveWalker | Interleave,
                        nameResolverOrMemo: NameResolver | HashMap) {
    if (elOrWalker instanceof InterleaveWalker) {
      const walker: InterleaveWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.inA = walker.inA;
      this.inB = walker.inB;
      this.walkerA = walker.walkerA && walker.walkerA._clone(memo);
      this.walkerB = walker.walkerB && walker.walkerB._clone(memo);
    }
    else {
      const el: Interleave = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo);
      super(el);
      this.nameResolver = nameResolver;
      this.inA = false;
      this.inB = false;
    }
  }

  _possible(): EventSet {
    this._instantiateWalkers();
    if (this.possibleCached !== undefined) {
      return this.possibleCached;
    }

    if (this.inA && this.inB) {
      // It due to the restrictions imposed by Relax NG, it should not be
      // possible to be both inA and inB.
      throw new Error("impossible state");
    }

    if (this.inA && !this.walkerA!.canEnd()) {
      this.possibleCached = this.walkerA!._possible();
    }
    else if (this.inB && !this.walkerB!.canEnd()) {
      this.possibleCached = this.walkerB!._possible();
    }

    if (!this.possibleCached) {
      this.possibleCached = this.walkerA!.possible();
      this.possibleCached.union(this.walkerB!._possible());
    }

    return this.possibleCached;
  }

  fireEvent(ev: Event): FireEventResult {
    this._instantiateWalkers();

    this.possibleCached = undefined;

    if (this.inA && this.inB) {
      // It due to the restrictions imposed by Relax NG, it should not be possible
      // to be both inA and inB.
      throw new Error("impossible state");
    }

    let retA: FireEventResult;
    let retB: FireEventResult;
    if (!this.inA && !this.inB) {
      retA = this.walkerA!.fireEvent(ev);
      if (retA === false) {
        this.inA = true;
        return false;
      }

      // The constraints on interleave do not allow for two child patterns of
      // interleave to match. So if the first walker matched, the second
      // cannot. So we don't have to fireEvent on the second walker if the first
      // matched.
      retB = this.walkerB!.fireEvent(ev);
      if (retB === false) {
        this.inB = true;
        return false;
      }

      if (retB === undefined) {
        return retA;
      }

      if (retA === undefined) {
        return retB;
      }

      return retA.concat(retB);
    }
    else if (this.inA) {
      retA = this.walkerA!.fireEvent(ev);
      if (retA || retA === false) {
        return retA;
      }

      // If we got here, retA === undefined
      retB = this.walkerB!.fireEvent(ev);

      if (retB === false) {
        this.inA = false;
        this.inB = true;
        return false;
      }
    }
    else { // inB
      retB = this.walkerB!.fireEvent(ev);
      if (retB || retB === false) {
        return retB;
      }

      // If we got here, retB === undefined
      retA = this.walkerA!.fireEvent(ev);

      if (retA === false) {
        this.inA = true;
        this.inB = false;
        return false;
      }
    }

    return undefined;
  }

  _suppressAttributes(): void {
    this._instantiateWalkers();
    if (!this.suppressedAttributes) {
      this.possibleCached = undefined; // no longer valid
      this.suppressedAttributes = true;

      this.walkerA!._suppressAttributes();
      this.walkerB!._suppressAttributes();
    }
  }

  canEnd(attribute: boolean = false): boolean {
    this._instantiateWalkers();
    return this.walkerA!.canEnd(attribute) && this.walkerB!.canEnd(attribute);
  }

  end(attribute: boolean = false): EndResult {
    this._instantiateWalkers();
    const retA: EndResult = this.walkerA!.end(attribute);
    const retB: EndResult = this.walkerB!.end(attribute);

    if (retA && !retB) {
      return retA;
    }

    if (retB && !retA) {
      return retB;
    }

    if (retA && retB) {
      return retA.concat(retB);
    }

    return false;
  }

  /**
   * Creates walkers for the patterns contained by this one. Calling this method
   * multiple times is safe as the walkers are created once and only once.
   */
  private _instantiateWalkers(): void {
    if (!this.walkerA) {
      this.walkerA = this.el.patA.newWalker(this.nameResolver);
    }
    if (!this.walkerB) {
      this.walkerB = this.el.patB.newWalker(this.nameResolver);
    }
  }
}

addWalker(Interleave, InterleaveWalker);

/**
 * A pattern for attributes.
 */
class Attribute extends OneSubpattern {
  /**
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param name The qualified name of the attribute.
   *
   * @param pat The pattern contained by this one.
   */

  constructor(xmlPath: string, readonly name: namePatterns.Name,
              pat: Pattern) {
    super(xmlPath, pat);
  }

  _prepare(namespaces: TrivialMap<number>): void {
    const nss: TrivialMap<number> = Object.create(null);
    this.name._recordNamespaces(nss);

    // A lack of namespace on an attribute should not be recorded.
    delete nss[""];

    // Copy the resulting namespaces.
    // tslint:disable-next-line:forin
    for (const key in nss) {
      namespaces[key] = 1;
    }
  }

  _hasAttrs(): boolean {
    return true;
  }
}

/**
 * Walker for [[Attribute]].
 */
class AttributeWalker extends Walker<Attribute> {
  private seenName: boolean;
  private seenValue: boolean;
  private subwalker: Walker<BasePattern> | undefined;
  private readonly attrNameEvent: Event;
  private readonly nameResolver: NameResolver;

  /**
   * @param el The pattern for which this walker was
   * created.
   *
   * @param nameResolver The name resolver that
   * can be used to convert namespace prefixes to namespaces.
   */
  protected constructor(walker: AttributeWalker, memo: HashMap);
  protected constructor(el: Attribute, nameResolver: NameResolver);
  protected constructor(elOrWalker: AttributeWalker | Attribute,
                        nameResolverOrMemo: HashMap | NameResolver) {
    if (elOrWalker instanceof AttributeWalker) {
      const walker: AttributeWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.seenName = walker.seenName;
      this.seenValue = walker.seenValue;
      this.subwalker = walker.subwalker && walker.subwalker._clone(memo);
      // No need to clone; values are immutable.
      this.attrNameEvent = walker.attrNameEvent;
    }
    else {
      const el: Attribute = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo);
      super(el);
      this.nameResolver = nameResolver;
      this.attrNameEvent = new Event("attributeName", el.name);
      this.seenName = false;
      this.seenValue = false;
    }
  }

  _possible(): EventSet {
    // We've been suppressed!
    if (this.suppressedAttributes) {
      return new EventSet();
    }

    if (!this.seenName) {
      return new EventSet(this.attrNameEvent);
    }
    else if (!this.seenValue) {
      if (this.subwalker === undefined) {
        this.subwalker = this.el!.pat.newWalker(this.nameResolver);
      }

      const sub: EventSet = this.subwalker._possible();
      const ret: EventSet = new EventSet();
      // Convert text events to attributeValue events.
      sub.forEach((ev: Event) => {
        if (ev.params[0] !== "text") {
          throw new Error(`unexpected event type: ${ev.params[0]}`);
        }
        ret.add(new Event("attributeValue", ev.params[1]));
      });
      return ret;
    }

    return new EventSet();
  }

  possible(): EventSet {
    // _possible always return new sets.
    return this._possible();
  }

  fireEvent(ev: Event): FireEventResult {
    if (this.suppressedAttributes) {
      return undefined;
    }

    if (this.seenName) {
      if (!this.seenValue && ev.params[0] === "attributeValue") {
        this.seenValue = true;

        if (!this.subwalker) {
          this.subwalker = this.el!.pat.newWalker(this.nameResolver);
        }

        // Convert the attributeValue event to a text event.
        const textEv: Event = new Event("text", ev.params[1]);
        let ret: FireEventResult = this.subwalker.fireEvent(textEv);

        if (ret === undefined) {
          return [new AttributeValueError("invalid attribute value",
                                          this.el.name)];
        }

        // Attributes end immediately.
        if (ret === false) {
          ret = this.subwalker.end();
        }

        return ret;
      }
    }
    else if (ev.params[0] === "attributeName" &&
             this.el.name.match(ev.params[1] as string,
                                ev.params[2] as string)) {
      this.seenName = true;
      return false;
    }

    return undefined;
  }

  _suppressAttributes(): void {
    this.suppressedAttributes = true;
  }

  canEnd(attribute: boolean = false): boolean {
    return this.seenValue;
  }

  end(attribute: boolean = false): EndResult {
    if (!this.seenName) {
      return [new AttributeNameError("attribute missing", this.el.name)];
    }
    else if (!this.seenValue) {
      return [new AttributeValueError("attribute value missing", this.el.name)];
    }
    return false;
  }
}

addWalker(Attribute, AttributeWalker);

/**
 * A pattern for elements.
 */
export class Element extends OneSubpattern {
  /**
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param name The qualified name of the element.
   *
   * @param pat The pattern contained by this one.
   */
  constructor(xmlPath: string, readonly name: namePatterns.Name,
              pat: Pattern) {
    super(xmlPath, pat);
  }

  _prepare(namespaces: TrivialMap<number>): void {
    this.name._recordNamespaces(namespaces);
    this.pat._prepare(namespaces);
  }

  // addWalker(Element, ElementWalker); Nope... see below..
  newWalker(resolver: NameResolver): Walker<BasePattern> {
    if (this.pat instanceof NotAllowed) {
      return this.pat.newWalker(resolver);
    }

    return ElementWalker.makeWalker(this, resolver);
  }

  _hasAttrs(): boolean {
    return false;
  }

  _gatherElementDefinitions(memo: TrivialMap<Element[]>): void {
    const key: string = this.name.toString();
    if (memo[key] === undefined) {
      memo[key] = [this];
    }
    else {
      memo[key].push(this);
    }
  }
}

/**
 *
 * Walker for [[Element]].
 */
class ElementWalker extends Walker<Element> {
  private static _leaveStartTagEvent: Event = new Event("leaveStartTag");

  private seenName: boolean;
  private endedStartTag: boolean;
  private closed: boolean;
  private walker: Walker<BasePattern> | undefined;
  private startTagEvent: Event;
  private endTagEvent: Event | undefined;
  private boundName: namePatterns.Name | undefined;
  private readonly nameResolver: NameResolver;

  /**
   * @param el The pattern for which this walker was
   * created.
   *
   * @param nameResolver The name resolver that
   * can be used to convert namespace prefixes to namespaces.
   */
  protected constructor(walker: ElementWalker, memo: HashMap);
  protected constructor(el: Element, nameResolver: NameResolver);
  protected constructor(elOrWalker: ElementWalker | Element,
                        nameResolverOrMemo: NameResolver | HashMap) {
    if (elOrWalker instanceof ElementWalker) {
      const walker: ElementWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.seenName = walker.seenName;
      this.endedStartTag = walker.endedStartTag;
      this.closed = walker.closed;
      this.walker = walker.walker && walker.walker._clone(memo);

      // No cloning needed since these are immutable.
      this.startTagEvent = walker.startTagEvent;
      this.endTagEvent = walker.endTagEvent;
      this.boundName = walker.boundName;
    }
    else {
      const el: Element = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo);
      super(el);
      this.nameResolver = nameResolver;
      this.seenName = false;
      this.endedStartTag = false;
      this.closed = false;
      this.startTagEvent = new Event("enterStartTag", el.name);
    }
  }

  static makeWalker(el: Element, nameResolver: NameResolver): ElementWalker {
    return new ElementWalker(el, nameResolver);
  }

  _possible(): EventSet {
    if (!this.seenName) {
      return new EventSet(this.startTagEvent);
    }
    else if (!this.endedStartTag) {
      const all: EventSet = this.walker!._possible();
      let ret: EventSet = new EventSet();
      // We use valueEvs to record whether an attributeValue is a
      // possibility. If so, we must only return these possibilities and no
      // other.
      const valueEvs: EventSet = new EventSet();
      all.forEach((poss: Event) => {
        if (poss.params[0] === "attributeValue") {
          valueEvs.add(poss);
        }
        else if (poss.isAttributeEvent()) {
          ret.add(poss);
        }
      });

      if (valueEvs.size()) {
        ret = valueEvs;
      }
      else if (this.walker!.canEnd(true)) {
        ret.add(ElementWalker._leaveStartTagEvent);
      }

      return ret;
    }
    else if (!this.closed) {
      const posses: EventSet = new EventSet(this.walker!._possible());
      if (this.walker!.canEnd()) {
        posses.add(this.endTagEvent);
      }
      return posses;
    }

    return new EventSet();
  }

  // _possible always returns new sets
  possible(): EventSet {
    return this._possible();
  }

  fireEvent(ev: Event): FireEventResult {
    if (!this.endedStartTag) {
      if (!this.seenName) {
        if (ev.params[0] === "enterStartTag" &&
            this.el.name.match(ev.params[1] as string,
                               ev.params[2] as string)) {
          this.walker = this.el!.pat.newWalker(this.nameResolver);
          this.seenName = true;
          this.boundName = new namePatterns.Name("",
                                                 ev.params[1] as string,
                                                 ev.params[2] as string);
          this.endTagEvent = new Event("endTag", this.boundName);
          return false;
        }
      }
      else if (ev.params[0] === "leaveStartTag") {
        this.endedStartTag = true;

        const errs: EndResult = this.walker!.end(true);
        let ret: FireEventResult = [];
        if (errs) {
          for (const err of errs) {
            if (err instanceof AttributeValueError ||
                err instanceof AttributeNameError) {
              ret.push(err);
            }
          }
        }

        if (ret.length === 0) {
          ret = false;
        }

        // And suppress the attributes.
        this.walker!._suppressAttributes();

        // We do not return undefined here
        return ret || false;
      }

      return this.walker && this.walker.fireEvent(ev);
    }
    else if (!this.closed) {
      let ret: FireEventResult = this.walker!.fireEvent(ev);
      if (ret === undefined) {
        // Our subwalker did not handle the event, so we must do it here.
        if (ev.params[0] === "endTag") {
          if (this.boundName!.match(ev.params[1] as string,
                                    ev.params[2] as string)) {
            this.closed = true;

            const errs: EndResult = this.walker!.end();
            ret = [];

            // Strip out the attributes errors as we've already reported
            // them.
            if (errs) {
              for (const err of errs) {
                if (!(err instanceof AttributeValueError ||
                      err instanceof AttributeNameError)) {
                  ret.push(err);
                }
              }
            }

            return ret.length !== 0 && ret;
          }
        }
        else if (ev.params[0] === "leaveStartTag") {
          return [new ValidationError(
            "unexpected leaveStartTag event; it is likely that " +
              "fireEvent is incorrectly called")];
        }
      }
      return ret;
    }
    return undefined;
  }

  _suppressAttributes(): void {
    // _suppressAttributes does not cross element boundary
    return;
  }

  canEnd(attribute: boolean = false): boolean {
    if (attribute) {
      return true;
    }
    return this.closed;
  }

  end(attribute: boolean = false): EndResult {
    if (attribute) {
      return false;
    }

    let ret: ValidationError[] = [];
    if (!this.seenName) {
      ret.push(new ElementNameError("tag required", this.el.name));
    }
    else if (!this.endedStartTag || !this.closed) {
      if (this.walker !== undefined) {
        const errs: EndResult = this.walker.end();
        if (errs) {
          ret = errs;
        }
      }
      ret.push(this.endedStartTag ?
               new ElementNameError("tag not closed", this.el.name) :
               new ElementNameError("start tag not terminated", this.el.name));
    }

    if (ret.length > 0) {
      return ret;
    }

    return false;
  }
}

/**
 * A pattern for ``<define>``.
 */
export class Define extends OneSubpattern {
  /**
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param name The name of the definition.
   *
   * @param pat The pattern contained by this one.
   */

  constructor(xmlPath: string, readonly name: string, pat: Pattern) {
    super(xmlPath, pat);
  }
}

/**
 * Walker for [[Define]].
 */
class DefineWalker extends SingleSubwalker<Define> {
  private readonly nameResolver: NameResolver;
  /**
   * @param el The pattern for which this walker was created.
   *
   * @param nameResolver The name resolver that can be used to convert namespace
   * prefixes to namespaces.
   */
  protected constructor(walker: DefineWalker, memo: HashMap);
  protected constructor(el: Define, nameResolver: NameResolver);
  protected constructor(elOrWalker: DefineWalker | Define,
                        nameResolverOrMemo: NameResolver | HashMap) {
    if (elOrWalker instanceof DefineWalker) {
      const walker: DefineWalker = elOrWalker;
      const memo: HashMap =  isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.subwalker = walker.subwalker._clone(memo);
    }
    else {
      const el: Define = elOrWalker;
      const nameResolver: NameResolver =  isNameResolver(nameResolverOrMemo);
      super(el);
      this.nameResolver = nameResolver;
      this.subwalker = el.pat.newWalker(this.nameResolver);
    }
  }
}

addWalker(Define, DefineWalker);

/**
 * This is an exception raised to indicate references to undefined entities in a
 * schema. If for instance element A has element B as its children but B is not
 * defined, then this exception would be raised.
 *
 * This exception is indicative of an internal error because by the time this
 * module loads a schema, the schema should have been simplified already and
 * simplification should have failed due to the unresolvable reference.
 *
 * This class used to be named ``ReferenceError`` in previous versions of salve
 * but this name clashes with the built-in ``ReferenceError`` that JavaScript
 * engines have built into their runtime. The clash did not make the code fail
 * but it had unfortunate side-effects.
 */
export class RefError extends Error {
  /**
   * @param references The set of references that could not be resolved.
   */
  constructor(readonly references: Ref[]) {
    super();
    fixPrototype(this, RefError);
  }

  /**
   * @returns string representation of the error.
   */
  toString(): string {
    return (
      `Cannot resolve the following references: ${this.references.join(", ")}`);
  }
}

/**
 * Grammar object. Users of this library normally do not create objects
 * of this class themselves but rely on constructTree().
 */
export class Grammar extends BasePattern {
  private definitions: TrivialMap<Define> = Object.create(null);
  private _elementDefinitions: undefined;
  private _namespaces: TrivialMap<number> = Object.create(null);
  /**
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param start The start pattern of this grammar.
   *
   * @param definitions An array which contain all definitions specified in this
   * grammar.
   *
   * @throws {RefError} When any definition in the original
   * schema refers to a schema entity which is not defined in the schema.
   */
  constructor(public xmlPath: string, public start: Pattern,
              definitions?: Define[]) {
    super(xmlPath);
    if (definitions) {
      definitions.forEach((x: Define) => {
        this.add(x);
      });
    }
    const missing: Ref[] | undefined = this._resolve(this.definitions);

    if (missing) {
      throw new RefError(missing);
    }

    this._prepare(this._namespaces);
  }

  /**
   * Adds a definition.
   *
   * @param d The definition to add.
   */
  add(d: Define): void {
    this.definitions[d.name] = d;
    if (d.name === "start") {
      this.start = d;
    }
  }

  /**
   * Populates a memo with a mapping of (element name, [list of patterns]).  In
   * a Relax NG schema, the same element name may appear in multiple contexts,
   * with multiple contents. For instance an element named "name" could require
   * the sequence of elements "firstName", "lastName" in a certain context and
   * text in a different context. This method allows determining whether this
   * happens or not within a pattern.
   *
   * @param memo The memo in which to store the information.
   */
  _gatherElementDefinitions(memo: TrivialMap<Element[]>): void {
    // tslint:disable-next-line:forin
    for (const d in this.definitions) {
      this.definitions[d]._gatherElementDefinitions(memo);
    }
  }

  get elementDefinitions(): TrivialMap<Element[]> {
    const ret: TrivialMap<Element[]> | undefined = this._elementDefinitions;
    if (ret) {
      return ret;
    }

    const newDef: TrivialMap<Element[]> =
      this._elementDefinitions = Object.create(null);
    this._gatherElementDefinitions(newDef);
    return newDef;
  }

  /**
   * @returns ``true`` if the schema is wholly context independent. This means
   * that each element in the schema can be validated purely on the basis of
   * knowing its expanded name. ``false`` otherwise.
   */
  whollyContextIndependent(): boolean {
    const defs: TrivialMap<Pattern[]> = this.elementDefinitions;
    for (const v in defs) {
      if (defs[v].length > 1) {
        return false;
      }
    }

    return true;
  }

  /**
   * @returns An array of all namespaces used in the schema.  The array may
   * contain two special values: ``*`` indicates that there was an ``anyName``
   * element in the schema and thus that it is probably possible to insert more
   * than the namespaces listed in the array, ``::except`` indicates that an
   * ``except`` element is affecting what namespaces are acceptable to the
   * schema.
   */
  getNamespaces(): string[] {
    return Object.keys(this._namespaces);
  }

  /**
   * This method must be called after resolution has been performed.
   *
   * This function now performs two tasks: a) it prepares the attributes
   * (Definition and Element objects maintain a pattern which contains only
   * attribute patterns, and nothing else), b) it gathers all the namespaces seen
   * in the schema.
   *
   * @param namespaces An object whose keys are the namespaces seen in the
   * schema. This method populates the object.
   */
  _prepare(namespaces: TrivialMap<number>): void {
    this.start._prepare(namespaces);
    // tslint:disable-next-line:forin
    for (const d in this.definitions) {
      this.definitions[d]._prepare(namespaces);
    }
  }

  _resolve(definitions: TrivialMap<Define>): Ref[] | undefined {
    let all: Ref[] = [];
    let ret: Ref[] | undefined;

    // tslint:disable-next-line forin
    for (const d in definitions) {
      ret = definitions[d]._resolve(definitions);
      if (ret) {
        all = all.concat(ret);
      }
    }

    ret = this.start._resolve(definitions);
    if (ret) {
      all = all.concat(ret);
    }

    if (all.length) {
      return all;
    }

    return undefined;
  }

  /**
   * Creates a new walker to walk this pattern.
   *
   * @returns A walker.
   */
  newWalker(): Walker<BasePattern> {
    return GrammarWalker.makeWalker(this);
  }
}

/**
 * Walker for [[Grammar]].
 */
export class GrammarWalker extends SingleSubwalker<Grammar> {
  private readonly nameResolver: NameResolver;

  // A stack that keeps state for misplace elements. The elements of this
  // stack are either Array or Walker objects. They are arrays when we are
  // dealing with an element which is unknown to the schema (or which
  // cannot be unambigiously determined. They are Walker objects when we
  // can find a definition in the schema.
  private readonly _misplacedElements: any[];

  private _swallowAttributeValue: boolean;

  private suspendedWs: string | undefined;

  private ignoreNextWs: boolean;

  private _prevEvWasText: boolean;

  /**
   * @param el The grammar for which this walker was
   * created.
   */
  protected constructor(walker: GrammarWalker, memo: HashMap);
  protected constructor(el: Grammar);
  protected constructor(elOrWalker: GrammarWalker | Grammar,
                        memo?: HashMap) {
    if (elOrWalker instanceof GrammarWalker) {
      const walker: GrammarWalker = elOrWalker;
      memo = isHashMap(memo); // Checks for undefined.
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.subwalker = walker.subwalker._clone(memo);
      const misplacedElements: any[] = this._misplacedElements = [];
      for (const mpe of walker._misplacedElements) {
        misplacedElements.push(mpe instanceof Walker ?
                               mpe._clone(memo) :
                               mpe.concat([]));
      }
      this._swallowAttributeValue = walker._swallowAttributeValue;
      this.suspendedWs = walker.suspendedWs;
      this.ignoreNextWs = walker.ignoreNextWs;
      this._prevEvWasText = walker._prevEvWasText;
    }
    else {
      const el: Grammar = elOrWalker;
      super(el);
      this.nameResolver = new NameResolver();
      this._misplacedElements = [];
      this._swallowAttributeValue = false;
      this.ignoreNextWs = false;
      this._prevEvWasText = false;
      this.subwalker = el.start.newWalker(this.nameResolver);
    }
  }

  static makeWalker(el: Grammar): GrammarWalker {
    return new GrammarWalker(el);
  }

  /**
   * Resolves a name using the walker's own name resolver.
   *
   * @param name A qualified name.
   *
   * @param attribute Whether this qualified name refers to an attribute.
   *
   * @returns An expanded name, or undefined if the name cannot be resolved.
   */
  resolveName(name: string, attribute: boolean): EName | undefined {
    return this.nameResolver.resolveName(name, attribute);
  }

  /**
   * See [["name_resolver".NameResolver.unresolveName]].
   *
   * @param uri The URI part of the expanded name.
   *
   * @param name The name part.
   *
   * @returns The qualified name that corresponds to the expanded name, or
   * ``undefined`` if it cannot be resolved.
   */
  unresolveName(uri: string, name: string): string | undefined {
    return this.nameResolver.unresolveName(uri, name);
  }

  /**
   * On a GrammarWalker this method cannot return ``undefined``. An undefined
   * value would mean nothing matched, which is a validation error.
   *
   * @param ev The event to fire.
   *
   * @returns ``false`` if there is no error or an array errors.
   *
   * @throws {Error} When name resolving events (``enterContext``,
   * ``leaveContext``, or ``definePrefix``) are passed while this walker was not
   * instructed to create its own name resolver or when trying to process an
   * event type unknown to salve.
   */
  // tslint:disable-next-line: max-func-body-length
  fireEvent(ev: Event): FireEventResult {
    let wsErr: FireEventResult = false;
    function combineWsErrWith(x: FireEventResult): FireEventResult {
      if (wsErr === undefined) {
        wsErr = [new ValidationError("text not allowed here")];
      }

      if (wsErr === false) {
        return x;
      }

      if (x === false) {
        return wsErr;
      }

      if (x === undefined) {
        throw new Error("undefined x");
      }

      return wsErr.concat(x);
    }

    if (ev.params[0] === "enterContext" ||
        ev.params[0] === "leaveContext" ||
        ev.params[0] === "definePrefix") {
      switch (ev.params[0]) {
      case "enterContext":
        this.nameResolver.enterContext();
        break;
      case "leaveContext":
        this.nameResolver.leaveContext();
        break;
      case "definePrefix":
        this.nameResolver.definePrefix(ev.params[1] as string,
                                       ev.params[2] as string);
        break;
      default:
        throw new Error(`unexpected event: ${ev.params[0]}`);
      }
      return false;
    }

    // Process whitespace nodes
    if (ev.params[0] === "text" && (ev.params[1] as string).trim() === "") {
      if (this.suspendedWs) {
        this.suspendedWs += ev.params[1];
      }
      else {
        this.suspendedWs = ev.params[1] as string;
      }
      return false;
    }

    // This is the walker we must fire all our events on.
    let walker: Walker<BasePattern> =
      (this._misplacedElements.length > 0 &&
       this._misplacedElements[0] instanceof Walker) ?
      // This happens if we ran into a misplaced element that we were
      // able to infer.
      this._misplacedElements[0] : this.subwalker;

    const ignoreNextWsNow: boolean = this.ignoreNextWs;
    this.ignoreNextWs = false;
    switch (ev.params[0]) {
    case "enterStartTag":
      // Absorb the whitespace: poof, gone!
      this.suspendedWs = undefined;
      break;
    case "text":
      if (this._prevEvWasText) {
        throw new Error("fired two text events in a row: this is " +
                        "disallowed by salve");
      }

      if (this.ignoreNextWs) {
        this.suspendedWs = undefined;
        const trimmed: string = (ev.params[1] as string).replace(/^\s+/, "");
        if (trimmed.length !== (ev.params[1] as string).length) {
          ev = new Event("text", trimmed);
        }
      }
      else if (this.suspendedWs) {
        wsErr = walker.fireEvent(new Event("text", this.suspendedWs));
        this.suspendedWs = undefined;
      }
      break;
    case "endTag":
      this.ignoreNextWs = true;
      /* falls through */
    default:
      // Process the whitespace that was suspended.
      if (this.suspendedWs && !ignoreNextWsNow) {
        wsErr = walker.fireEvent(new Event("text", this.suspendedWs));
      }
      this.suspendedWs = undefined;
    }

    // We can update it here because we're done examining the value that was
    // set from the previous call to fireEvent.
    this._prevEvWasText = (ev.params[0] === "text");

    if (this._misplacedElements.length > 0 &&
        this._misplacedElements[0] instanceof Array) {
      // We are in a misplaced element which is foreign to the schema (or
      // which cannot be infered unambiguously.
      const mpe: any = this._misplacedElements[0];
      switch (ev.params[0]) {
      case "enterStartTag":
        mpe.unshift(ev.params.slice(1));
        break;
      case "endTag":
        mpe.shift();
        break;
      default:
        // We don't care
        break;
      }

      // We're done with this context.
      if (!mpe.length) {
        this._misplacedElements.shift();
      }

      return false;
    }

    // This would happen if the user puts an attribute on a tag that does not
    // allow one. Instead of generating errors for both the attribute name
    // and value, we generate an error for the name and ignore the value.
    if (this._swallowAttributeValue) {
      // Swallow only one event.
      this._swallowAttributeValue = false;
      if (ev.params[0] === "attributeValue") {
        return false;
      }

      return [new ValidationError("attribute value required")];
    }

    let ret: FireEventResult = walker.fireEvent(ev);

    if (ret === undefined) {
      switch (ev.params[0]) {
      case "enterStartTag":
        const name: namePatterns.Name = new namePatterns.Name(
          "", ev.params[1] as string, ev.params[2] as string);
        ret = [new ElementNameError("tag not allowed here", name)];

        // Try to infer what element is meant by this errant tag. If we can't find
        // a candidate, then fall back to a dumb mode.
        const candidates: Element[] =
          this.el.elementDefinitions[name.toString()];
        if (candidates && candidates.length === 1) {
          const newWalker: Walker<BasePattern> =
            candidates[0].newWalker(this.nameResolver);
          this._misplacedElements.unshift(newWalker);
          if (newWalker.fireEvent(ev) !== false) {
            throw new Error("internal error: the infered element " +
                            "does not accept its initial event");
          }
        }
        else {
          // Dumb mode...
          this._misplacedElements.unshift([ev.params.slice(1)]);
        }
        break;
      case "endTag":
        ret = [new ElementNameError(
          "unexpected end tag",
          new namePatterns.Name("",
                                ev.params[1] as string,
                                ev.params[2] as string))];
        break;
      case "attributeName":
        ret = [new AttributeNameError(
          "attribute not allowed here",
          new namePatterns.Name("",
                                ev.params[1] as string,
                                ev.params[2] as string))];
        this._swallowAttributeValue = true;
        break;
      case "attributeValue":
        ret = [new ValidationError(
          "unexpected attributeValue event; it is likely " +
            "that fireEvent is incorrectly called")];
        break;
      case "text":
        ret = [new ValidationError("text not allowed here")];
        break;
      case "leaveStartTag":
        // If the _misplacedElements stack did not exist then we would get here
        // if a file being validated contains a tag which is not allowed. An
        // ElementNameError will already have been issued. So rather than violate
        // our contract (which says no undefined value may be returned) or require
        // that callers do something special with 'undefined' as a return value,
        // just treat this event as a non-error.
        //
        // But the stack exists, so we cannot get here. If we do end up here, then
        // there is an internal error somewhere.
        /* falls through */
      default:
        throw new Error("unexpected event type in GrammarWalker's fireEvent: " +
                        ev.params[0]);
      }
    }

    // Check whether the context should end
    if (this._misplacedElements.length > 0 &&
        this._misplacedElements[0] instanceof Walker) {
      walker = this._misplacedElements[0];
      if (walker.canEnd()) {
        this._misplacedElements.shift();
        const endRet: EndResult = walker.end();
        if (endRet) {
          ret = ret ? ret.concat(endRet) : endRet;
        }
      }
    }

    return combineWsErrWith(ret);
  }

  possible(): EventSet {
    if (this._misplacedElements.length) {
      const mpe: any = this._misplacedElements[0];
      // Return an empty set if the tags are unknown to us.
      return mpe instanceof Walker ? mpe.possible() : new EventSet();
    }

    // There's no point in calling this._possible.
    return this.subwalker.possible();
  }

  _suppressAttributes(): void {
    throw new Error("_suppressAttributes cannot be called on a GrammarWalker");
  }
}

// Nope, we're using a custom function.
// addWalker(Grammar, GrammarWalker);

//
// Things used only during testing.
//
const tret = {
  GrammarWalker,
  Text,
};

export function __test(): {[name: string]: any} {
  return tret;
}

// tslint:disable-next-line:variable-name
export const __protected: {[name: string]: any} = {
  Empty,
  Data,
  List,
  Param,
  Value,
  NotAllowed,
  Text,
  Ref,
  OneOrMore,
  Choice,
  Group,
  Attribute,
  Element,
  Define,
  Grammar,
  EName,
  Interleave,
  Name: namePatterns.Name,
  NameChoice: namePatterns.NameChoice,
  NsName: namePatterns.NsName,
  AnyName: namePatterns.AnyName,
};
/*  tslint:enable */

//  LocalWords:  namespaces validator namespace xmlns validators EOF
//  LocalWords:  lookahead enterStartTag attributeName newWalker URI
//  LocalWords:  makeSingletonConstructor HashSet constructTree RNG
//  LocalWords:  subpatterns hashstructs cleanAttrs fireEvent HashMap
//  LocalWords:  EName ValidationError msg modelizes args uri RelaxNG
//  LocalWords:  attributeValue leaveStartTag AttributeWalker API MPL
//  LocalWords:  ElementWalker subwalkers NotAllowed RefWalker Mixin
//  LocalWords:  DefineWalker oneOrMore ChoiceWalker subwalker Dubeau
//  LocalWords:  ChoiceError GroupWalker unresolvable addWalker el lt
//  LocalWords:  useNameResolver GrammarWalker formedness notAllowed
//  LocalWords:  ElementNameError GrammarWalker's Mangalam util oop
//  LocalWords:  CodeMirror tokenizer jshint newcap validthis canEnd
//  LocalWords:  SingleNameError NoSubwalker SingleSubwalker ATTRS ev
//  LocalWords:  endTag TwoSubpatterns GroupWalkers rng attr vm
//  LocalWords:  OneSubpattern enterContext leaveContext NG ret
//  LocalWords:  definePrefix firstName lastName ttt EventSet unshift
//  LocalWords:  suppressAttributes
