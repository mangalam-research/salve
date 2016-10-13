/**
 * @desc {@link module:hashstructs~HashSet HashSet} and {@link
 * module:hashstructs~HashMap HashMap} implementations.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
define(/** @lends module:hashstructs */ function hashstructs(require, exports,
                                                             _module) {
  "use strict";

  var inherit = require("./oop").inherit;

  /**
   * @classdesc The HashBase class provides a base class for the {@link
   * module:hashstructs~HashSet HashSet} and {@link
   * module:hashstructs~HashMap HashMap} classes.
   *
   * @param {Function} hashF A function which returns a uniquely identifying
   * hash when called with an object that a <code>HashBase</code> instance
   * uses. Note that it is a valid implementation strategy for the hash
   * function to know how to handle only a certain type of object, and not
   * everything under the sun. This entails that a <code>HashBase</code>
   * object using this hash function can only contain objects of the type
   * that the hash function knows how to handle.
   *
   * @param {Object} [initial] An initial value for the object being
   * constructed.
   *
   * @constructor
   */
  function HashBase(hashF, initial) {
    this.hashF = hashF;
    this.backing = Object.create(null);
    this._size = 0;

    if (initial !== undefined) {
      if (initial instanceof HashBase) {
        var backing = this.backing;
        var initialBacking = initial.backing;
        var keys = Object.keys(initialBacking);
        for (var keysIx = 0; keysIx < keys.length; ++keysIx) {
          var key = keys[keysIx];
          backing[key] = initialBacking[key];
        }
        this._size = keys.length;
      }
      else if (initial instanceof Array) {
        for (var i = 0; i < initial.length; ++i) {
          this.add(initial[i]);
        }
      }
      else {
        this.add(initial);
      }
    }
  }

  HashBase.prototype.hashF = undefined;
  HashBase.prototype.backing = undefined;
  HashBase.prototype._size = 0;

  /**
   * Record a hash and value pair into the backing store. Effectively
   * associates the hash with the value. This method assumes but does not
   * verify that the mapping from hash to value is unique. This method cannot
   * be used to <strong>change</strong> such mapping.
   *
   * @private
   * @param hash Hash to which to associate the value. Can be any type that
   * can be used as an array index.
   * @param val The value to associate with the hash.
   * @throws {Error} If the hash is undefined or null.
   */
  HashBase.prototype._store = function _store(hash, val) {
    if (hash === undefined || hash === null) {
      throw new Error("undefined or null hash");
    }
    if (this.backing[hash] === undefined) {
      this.backing[hash] = val;
      this._size++;
    }
    // else noop
  };

  /**
   * Unites this object with another object. This method modifies the object
   * upon which it is called so as to make it a mathematical union of the two
   * objects.
   *
   * @param s The object to unite with this one. Must be of the same class as
   * this object.
   * @throws {Error} If <code>s</code> is not of the same type as this
   * object.
   */
  HashBase.prototype.union = function union(s) {
    if (s === null || s === undefined) {
      return;
    }

    if (!(s instanceof this.constructor)) {
      throw new Error("union invalid class object; my class " +
                      this.constructor.name +
                      " other class " + s.constructor.name);
    }

    var backing = s.backing;
    var keys = Object.keys(backing);
    for (var keysIx = 0; keysIx < keys.length; ++keysIx) {
      var key = keys[keysIx];
      this._store(key, backing[key]);
    }
  };

  /**
   * Applies a function on each value stored in the object.
   *
   * @param {Function} f A function which accepts one parameter. The function
   * will be called on each value.
   */
  HashBase.prototype.forEach = function forEach(f) {
    var backing = this.backing;
    var keys = Object.keys(backing);
    for (var keysIx = 0; keysIx < keys.length; ++keysIx) {
      var key = keys[keysIx];
      f(backing[key]);
    }
  };

  /**
   * @returns {integer} The number of values stored.
   */
  HashBase.prototype.size = function size() {
    return this._size;
  };

  /**
   * Selects a subset of values.
   *
   * @param {Function} f A function that selects values. It is called with
   * each value. If the value happens to be an <code>Array</code> then the
   * function is <emph>applied</emph> to this array. A return value which is
   * truthy includes the value, otherwise the value is excluded.
   * @returns An object of the same class as the object on which the method
   * is called. This object contains only the value selected by the function.
   */
  HashBase.prototype.filter = function filter(f) {
    var ret = new this.constructor();
    if (ret.hashF === undefined) {
      ret.hashF = this.hashF;
    }
    var backing = this.backing;
    var keys = Object.keys(backing);
    for (var keysIx = 0; keysIx < keys.length; ++keysIx) {
      var key = keys[keysIx];
      var data = backing[key];
      var args = data instanceof Array ? data : [data];
      if (f.apply(undefined, args)) {
        ret._store(key, data);
      }
    }
    return ret;
  };

  /**
   * Tests whether a value is contained in the object on which this method is
   * called.
   *
   * @param obj The value for which to test.
   * @returns {boolean} <code>true</code> if the value is present,
   * <code>false</code> if not.
   */
  HashBase.prototype.has = function has(obj) {
    var hash = this.hashF(obj);
    return !!this.backing[hash];
  };

  /**
   * Converts the object on which this method is called to a string.
   *
   * @returns {string} All the values, joined with ", ".
   */
  HashBase.prototype.toString = function toString() {
    return this.toArray().join(", ");
  };

  /**
   * Converts the object on which this method is called to an array.
   *
   * @returns {Array} An array that corresponds to the object.
   *
   */
  HashBase.prototype.toArray = function toArray() {
    var t = [];
    var backing = this.backing;
    var keys = Object.keys(backing);
    for (var keysIx = 0; keysIx < keys.length; ++keysIx) {
      var key = keys[keysIx];
      t.push(backing[key]);
    }
    return t;
  };

  /**
   * @classdesc A set of objects. The objects are distinguished by a hash
   * function.
   *
   * @extends module:hashstructs~HashBase
   *
   * @param {Function} hashF A function which returns a uniquely identifying
   * hash when called with an object that a <code>HashSet</code> instance
   * uses. Note that it is a valid implementation strategy for the hash
   * function to know how to handle only a certain type of object, and not
   * everything under the sun. This entails that a <code>HashSet</code>
   * object using this hash function can only contain objects of the type
   * that the hash function knows how to handle.
   *
   * @param {Object} [initial] An initial value for the object being
   * constructed.
   *
   * @constructor
   */
  function HashSet() {
    HashBase.apply(this, arguments);
  }
  inherit(HashSet, HashBase);

  /**
   * Adds a value to the set.
   *
   * @param x The value to add.
   */
  HashSet.prototype.add = function add(x) {
    this._store(this.hashF(x), x);
  };

  /**
   * @classdesc A map of (key, value) pairs. The keys are distinguished by
   * means of a hash function.
   *
   * @extends module:hashstructs~HashBase
   *
   * @param {Function} hashF A function which returns a uniquely identifying
   * hash when called with an object that a <code>HashMap</code> instance
   * uses. Note that it is a valid implementation strategy for the hash
   * function to know how to handle only a certain type of object, and not
   * everything under the sun. This entails that a <code>HashMap</code>
   * object using this hash function can only contain objects of the type
   * that the hash function knows how to handle.
   *
   * @param {Object} [initial] An initial value for the object being
   * constructed.
   *
   * @constructor
   */
  function HashMap(hashF, initial) {
    if (initial instanceof Array) {
      throw new Error("cannot initialize a map with an array");
    }
    HashBase.apply(this, arguments);
  }
  inherit(HashMap, HashBase);

  // The arrays stored in the backing store are considered immutable.

  /**
   * Adds a (key, value) mapping to the map.
   *
   * @param key
   * @param value
   */
  HashMap.prototype.add = function add(key, value) {
    this._store(this.hashF(key), [key, value]);
  };

  HashMap.prototype.forEach = function forEach(f) {
    var backing = this.backing;
    var keys = Object.keys(backing);
    for (var keysIx = 0; keysIx < keys.length; ++keysIx) {
      var key = keys[keysIx];
      f(backing[key][0], backing[key][1]);
    }
  };

  /**
   * Checks whether an object is a key of the map, and returns its associated
   * value if present.
   *
   * @param obj The object to check.
   *
   * @returns The value associated with the object if present. ``undefined`` if
   * not.
   */
  HashMap.prototype.has = function has(obj) {
    var hash = this.hashF(obj);
    var pair = this.backing[hash];
    if (pair !== undefined) {
      return pair[1];
    }

    return undefined;
  };

  /**
   * Gets the keys present in this mapping.
   *
   * @returns {Array}
   */
  HashMap.prototype.keys = function keys() {
    return Object.keys(this.backing);
  };

  exports.HashSet = HashSet;
  exports.HashMap = HashMap;
});

//  LocalWords:  hashstructs MPL oop HashBase noop HashSet HashMap
//  LocalWords:  Dubeau Mangalam LocalWords truthy
