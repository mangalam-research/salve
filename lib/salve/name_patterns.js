/**
 * @module namePatterns
 * @desc Classes that model RNG patterns that pertain to names.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2015 Mangalam Research Center for Buddhist Languages
 */

define(/** @lends module:namePatterns */
  function namePatterns(require, exports, _module) {
    "use strict";

    var oop = require("./oop");

    /**
     * @classdesc Base class for all name patterns.
     *
     * @constructor
     *
     * @param {string} path The XML path of the element that corresponds to
     * this object in the Relax NG schema from which this object was
     * contructed.
     */
    function Base(path) {
      this.path = path;
    }

    /**
     * Tests whether the pattern matches a name.
     *
     * @param {string} ns The namespace to match.
     * @param {string} name The name to match.
     * @returns {boolean} ``true`` if there is a match.
     */
    Base.prototype.match = function match(ns, _name) {
      throw new Error("subclasses must implement this method.");
    };

    /**
     * Tests whether the pattern matches a name and this match is due only to a
     * wildcard match (``nsName`` or ``anyName``).
     *
     * @param {string} ns The namespace to match.
     * @param {string} name The name to match.
     * @returns {boolean} ``true`` if there is a match **and** the match is due
     * only to a wildcard match. If there is a choice between matching with a
     * wildcard and matching with a regular ``name`` pattern, this will return
     * false because of the ``name`` pattern.
     */
    Base.prototype.wildcardMatch = function wildcardMatch(ns, _name) {
      throw new Error("subclasses must implement this method.");
    };

    /**
     * Determines whether a pattern is simple or not. A pattern is deemed
     * simple if it does not use ``<except>``, ``<anyName>`` or ``<NsName>``.
     * Put in practical terms, non-simple patterns cannot generally be
     * presented as a list of choices to the user. In most cases, the
     * appropriate input from the user should be obtained by presenting an
     * input field in which the user can type the namespace and name of the
     * entity to be named and the GUI reports whether the name is allowed or
     * not by the schema.
     *
     * @returns {boolean} ``true`` if the pattern is simple.
     */
    Base.prototype.simple = function simple() {
      throw new Error("subclasses must implement this method.");
    };

    /**
     * Gets the list of namespaces used in the pattern. An ``::except`` entry
     * indicates that there are exceptions in the pattern. A ``*`` entry
     * indicates that any namespace is allowed.
     *
     * This method should be used by client code to help determine how to
     * prompt the user for a namespace. If the return value is a list without
     * ``::except`` or ``*``, the client code knows there is a finite list of
     * namespaces expected, and what the possible values are. So it could
     * present the user with a choice from the set. If ``::except`` or ``*``
     * appears in the list, then a different strategy must be used.
     *
     * @returns {Array.<string>} The list of namespaces.
     */
    Base.prototype.getNamespaces = function getNamespaces() {
      var namespaces = Object.create(null);
      this._recordNamespaces(namespaces);
      return Object.keys(namespaces);
    };

    Base.prototype._recordNamespaces =
      function _recordNamespaces(_namespaces) {
        throw new Error("subclasses must implement this method.");
      };

    /**
     * Represent the name pattern as a plain object. The object returned
     * contains a ``pattern`` field which has the name of the JavaScript class
     * that was used to create the object. Other fields are present, depending
     * on the actual needs of the class.
     *
     * @returns {Object} The object representing the instance.
     */
    Base.prototype.toObject = function toObject() {
      throw new Error("subclasses must implement this method.");
    };

    /**
     * Alias of {@link module:namePatterns~Base#toObject toObject}.
     *
     * ``toJSON`` is a misnomer, as the data returned is not JSON but a
     * JavaScript object. This method exists so that ``JSON.stringify``
     * can use it.
     */
    Base.prototype.toJSON = function toJSON() {
      return this.toObject();
    };

    /**
     * Returns an array of {@link module:namePatterns~Name Name} objects which
     * is a list of all the possible names that this pattern allows.
     *
     * @returns {Array.<module:namePatterns~Name>|null} An array of names. The
     * value ``null`` is returned if the pattern is not simple.
     */
    Base.prototype.toArray = function toArray() {
      throw new Error("subclasses must implement this method.");
    };

    /**
     * Stringify the pattern to a JSON string.
     *
     * @returns {string} The stringified instance.
     */
    Base.prototype.toString = function toString() {
      return JSON.stringify(this);
    };

    /**
     * @classdesc Models the Relax NG ``<name>`` element.
     *
     * @constructor
     *
     * @extends module:namePatterns~Base
     *
     * @param {string} path See parent class.
     * @param {string} ns The namespace URI for this name. Corresponds to the
     * ``ns`` attribute in the simplified Relax NG syntax.
     * @param {string} name The name. Corresponds to the content of ``<name>``
     * in the simplified Relax NG syntax.
     */
    function Name(path, ns, name) {
      Base.call(this, path);
      this.ns = ns;
      this.name = name;
    }

    oop.inherit(Name, Base);

    Name.prototype.match = function match(ns, name) {
      return this.ns === ns && this.name === name;
    };

    Name.prototype.wildcardMatch = function wildcardMatch(ns, _name) {
      return false; // This is not a wildcard.
    };

    Name.prototype.toObject = function toObject() {
      return {
        ns: this.ns,
        name: this.name
      };
    };

    Name.prototype.simple = function simple() {
      return true;
    };

    Name.prototype.toArray = function toArray() {
      return [this];
    };

    Name.prototype._recordNamespaces = function _recordNamespaces(namespaces) {
      namespaces[this.ns] = 1;
    };

    /**
     * @classdesc Models the Relax NG ``<choice>`` element when it appears
     * in a name class.
     *
     * @constructor
     *
     * @extends module:namePatterns~Base
     *
     * @param {string} path See parent class.
     * @param {Array.<module:namePatterns~Base>} pats An array of length 2
     * which contains the two choices allowed by this object.
     */
    function NameChoice(path, pats) {
      Base.call(this, path);
      this.a = pats[0];
      this.b = pats[1];
    }

    oop.inherit(NameChoice, Base);

    NameChoice.prototype.match = function match(ns, name) {
      return this.a.match(ns, name) || this.b.match(ns, name);
    };

    NameChoice.prototype.wildcardMatch = function wildcardMatch(ns, name) {
      return this.a.wildcardMatch(ns, name) || this.b.wildcardMatch(ns, name);
    };

    NameChoice.prototype.toObject = function toObject() {
      return {
        a: this.a.toObject(),
        b: this.b.toObject()
      };
    };

    NameChoice.prototype.simple = function simple() {
      return this.a.simple() && this.b.simple();
    };

    NameChoice.prototype.toArray = function toArray() {
      var aArr = this.a.toArray();

      if (!aArr) {
        return null;
      }

      var bArr = this.b.toArray();
      if (!bArr) {
        return null;
      }

      return aArr.concat(bArr);
    };

    NameChoice.prototype._recordNamespaces =
      function _recordNamespaces(namespaces) {
        this.a._recordNamespaces(namespaces);
        this.b._recordNamespaces(namespaces);
      };

    /**
     * @classdesc Models the Relax NG ``<nsName>`` element.
     *
     * @constructor
     *
     * @extends module:namePatterns~Base
     *
     * @param {string} path See parent class.
     * @param {string} ns The namespace URI for this name. Corresponds to the
     * ``ns`` attribute in the simplified Relax NG syntax.
     * @param {module:namePatterns~Base} [except] Corresponds to an
     * ``<except>`` element appearing as a child of the ``<nsName>`` element in
     * the Relax NG schema.
     */
    function NsName(path, ns, except) {
      Base.call(this, path);
      this.ns = ns;
      this.except = except;
    }

    oop.inherit(NsName, Base);

    NsName.prototype.match = function match(ns, name) {
      return this.ns === ns &&
        !(this.except && this.except.match(ns, name));
    };

    NsName.prototype.wildcardMatch = function wildcardMatch(ns, name) {
      return this.match(ns, name);
    };

    NsName.prototype.toObject = function toObject() {
      var ret = {
        ns: this.ns
      };
      if (this.except) {
        ret.except = this.except.toObject();
      }
      return ret;
    };

    NsName.prototype.simple = function simple() {
      return false;
    };

    NsName.prototype.toArray = function toArray() {
      return null;
    };

    NsName.prototype._recordNamespaces =
      function _recordNamespaces(namespaces) {
        namespaces[this.ns] = 1;
        if (this.except) {
          namespaces["::except"] = 1;
        }
      };

    /**
     * @classdesc Models the Relax NG ``<anyName>`` element.
     *
     * @constructor
     *
     * @extends module:namePatterns~Base
     *
     * @param {string} path See parent class.
     * @param {module:namePatterns~Base} [except] Corresponds to an
     * ``<except>`` element appearing as a child of the ``<anyName>`` element
     * in the Relax NG schema.
     */
    function AnyName(path, except) {
      Base.call(this, path);
      this.except = except;
    }

    oop.inherit(AnyName, Base);

    AnyName.prototype.match = function match(ns, name) {
      return !this.except || !this.except.match(ns, name);
    };

    AnyName.prototype.wildcardMatch = function wildcardMatch(ns, name) {
      return this.match(ns, name);
    };

    AnyName.prototype.toObject = function toObject() {
      var ret = {
        pattern: "AnyName"
      };
      if (this.except) {
        ret.except = this.except.toObject();
      }
      return ret;
    };

    AnyName.prototype.simple = function simple() {
      return false;
    };

    AnyName.prototype.toArray = function toArray() {
      return null;
    };

    AnyName.prototype._recordNamespaces =
      function _recordNamespaces(namespaces) {
        namespaces["*"] = 1;
        if (this.except) {
          namespaces["::except"] = 1;
        }
      };

    exports.Name = Name;
    exports.NameChoice = NameChoice;
    exports.NsName = NsName;
    exports.AnyName = AnyName;


  });
