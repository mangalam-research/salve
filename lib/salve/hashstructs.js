/**
 * @module hashstructs
 * @desc {@link module:hashstructs~HashSet HashSet} and {@link
 * module:hashstructs~HashMap HashMap} implementations.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013 Mangalam Research Center for Buddhist Languages
 */
define(/** @lends module:hashstructs */ function (require, exports, module) {
'use strict';

var inherit = require("./oop").inherit;

/**
 * @classdesc The HashBase class provides a base class for the {@link
 * module:hashstructs~HashSet HashSet} and {@link
 * module:hashstructs~HashMap HashMap} classes.
 *
 * @param {Function} hash_f A function which returns a uniquely
 * identifying hash when called with an object that a
 * <code>HashBase</code> instance uses. Note that it is a valid
 * implementation strategy for the hash function to know how to handle
 * only a certain type of object, and not everything under the
 * sun. This entails that a <code>HashBase</code> object using this
 * hash function can only contain objects of the type that the hash
 * function knows how to handle.
 *
 * @param {Object} [initial] An initial value for the object being
 * constructed.
 *
 * @constructor
 */
function HashBase(hash_f, initial) {
    this.hash_f = hash_f;
    this.backing = Object.create(null);
    this._size = 0;

    if (initial !== undefined) {
        if (initial instanceof HashBase) {
            var backing = this.backing;
            var initial_backing = initial.backing;
            var keys = Object.keys(initial_backing);
            for(var keys_ix = 0, key; (key = keys[keys_ix++]) !== undefined; )
                backing[key] = initial_backing[key];
            this._size = keys.length;

        }
        else if (initial instanceof Array)
            for (var i = 0; i < initial.length; ++i)
                this.add(initial[i]);
        else
            this.add(initial);
    }
}

HashBase.prototype.hash_f = undefined;
HashBase.prototype.backing = undefined;
HashBase.prototype._size = 0;

HashBase.prototype._store = function (hash, val) {
    if (hash === undefined)
        throw new Error("undefined hash");
    if (this.backing[hash] === undefined) {
        this.backing[hash] = val;
        this._size++;
    }
    // else noop
};

HashBase.prototype.union = function (s) {
    if (s === null || s === undefined)
        return this;
    if (!(s instanceof this.constructor))
        throw new Error("union invalid class object; my class " +
                        this.constructor.name +
                        " other class " + s.constructor.name);
    var backing = s.backing;
    var keys = Object.keys(backing);
    for(var keys_ix = 0, key; (key = keys[keys_ix++]) !== undefined; )
        this._store(key, backing[key]);
};

HashBase.prototype.forEach = function (f) {
    var backing = this.backing;
    var keys = Object.keys(backing);
    for(var keys_ix = 0, key; (key = keys[keys_ix++]) !== undefined; )
        f(backing[key]);
};

HashBase.prototype.size = function () {
    return this._size;
};

HashBase.prototype.filter = function (f) {
    var ret = new this.constructor();
    if (ret.hash_f === undefined)
        ret.hash_f = this.hash_f;
    var backing = this.backing;
    var keys = Object.keys(backing);
    for(var keys_ix = 0, key; (key = keys[keys_ix++]) !== undefined; ) {
        var data = backing[key];
        var args = data instanceof Array?data:[data];
        if (f.apply(undefined, args)) {
            ret._store(key, data);
        }
    }
    return ret;
};

HashBase.prototype.has = function(obj) {
    var hash = this.hash_f(obj);
    return this.backing[hash];
};

HashBase.prototype.toString = function () {
    return this.toArray().join(", ");
};

HashBase.prototype.toArray = function () {
    var t = [];
    var backing = this.backing;
    var keys = Object.keys(backing);
    for(var keys_ix = 0, key; (key = keys[keys_ix++]) !== undefined; ) {
        t.push(backing[key]);
    }
    return t;
};

/**
 * @classdesc A set of objects. The objects are distinguished by a
 * hash function.
 *
 * @extends module:hashstructs~HashBase
 *
 * @param {Function} hash_f A function which returns a uniquely
 * identifying hash when called with an object that a
 * <code>HashSet</code> instance uses. Note that it is a valid
 * implementation strategy for the hash function to know how to handle
 * only a certain type of object, and not everything under the
 * sun. This entails that a <code>HashSet</code> object using this
 * hash function can only contain objects of the type that the hash
 * function knows how to handle.
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

HashSet.prototype.add = function (x) {
    this._store(this.hash_f(x), x);
};

/**
 * @classdesc A map of (key, value) pairs. The keys are distinguished
 * by means of a hash function.
 *
 * @extends module:hashstructs~HashBase
 *
 * @param {Function} hash_f A function which returns a uniquely
 * identifying hash when called with an object that a
 * <code>HashMap</code> instance uses. Note that it is a valid
 * implementation strategy for the hash function to know how to handle
 * only a certain type of object, and not everything under the
 * sun. This entails that a <code>HashMap</code> object using this
 * hash function can only contain objects of the type that the hash
 * function knows how to handle.
 *
 * @param {Object} [initial] An initial value for the object being
 * constructed.
 *
 * @constructor
 */
function HashMap (hash_f, initial) {
    if (initial instanceof Array)
        throw new Error("cannot initialize a map with an array");
    HashBase.apply(this, arguments);
}
inherit(HashMap, HashBase);

// The arrays stored in the backing store are considered
// immutable.
HashMap.prototype.add = function(from, to) {
    this._store(this.hash_f(from), [from, to]);
};

HashMap.prototype.forEach = function (f) {
    var backing = this.backing;
    var keys = Object.keys(backing);
    for(var keys_ix = 0, key; (key = keys[keys_ix++]) !== undefined; )
        f(backing[key][0], backing[key][1]);
};

HashMap.prototype.has = function(obj) {
    var hash = this.hash_f(obj);
    var pair = this.backing[hash];
    if (pair !== undefined)
        return pair[1];
};

HashMap.prototype.keys = function () {
    return Object.keys(this.backing);
};

exports.HashSet = HashSet;
exports.HashMap = HashMap;

});

//  LocalWords:  hashstructs MPL oop HashBase noop HashSet HashMap
