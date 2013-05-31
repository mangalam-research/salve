/**
 * @module hashstructs
 * @desc HashSet and HashMap implementations.
 * @author Louis-Dominique Dubeau
 */
define(/** @lends <global> */ function (require, exports, module) {
'use strict';

var inherit = require("./oop").inherit;

/** 
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

(function () {
    this.hash_f = undefined;
    this.backing = undefined;
    this._size = 0;

    this._store = function (hash, val) {
        if (hash === undefined)
            throw new Error("undefined hash");
        if (this.backing[hash] === undefined) {
            this.backing[hash] = val;
            this._size++;
        }
        // else noop
    };

    this.union = function (s) {
        if (s === null || s === undefined)
            return this;
        if (!(s instanceof this.constructor))
            throw new Error("union invalid class object; my class " + this.constructor.name + " other class " + s.constructor.name);
        var backing = s.backing;
        var keys = Object.keys(backing);
        for(var keys_ix = 0, key; (key = keys[keys_ix++]) !== undefined; )
            this._store(key, backing[key]);
    };

    this.forEach = function (f) {
        var backing = this.backing;
        var keys = Object.keys(backing);
        for(var keys_ix = 0, key; (key = keys[keys_ix++]) !== undefined; )
            f(backing[key]);
    };

    this.size = function () {
        return this._size;
    };

    this.filter = function (f) {
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

    this.has = function(obj) {
        var hash = this.hash_f(obj);
        return this.backing[hash];
    };

    this.toString = function () {
        return this.toArray().join(", ");
    };

    this.toArray = function () {
        var t = [];
        var backing = this.backing;
        var keys = Object.keys(backing);
        for(var keys_ix = 0, key; (key = keys[keys_ix++]) !== undefined; ) {
            t.push(backing[key]);
        }
        return t;
    };

}).call(HashBase.prototype);

/** 
 * @constructor
 */
function HashSet() { 
    HashBase.apply(this, arguments);
}
inherit(HashSet, HashBase);

(function () {
    this.add = function (x) {
        this._store(this.hash_f(x), x);
    };

}).call(HashSet.prototype);

/** 
 * @constructor
 */
function HashMap (hash_f, initial) {
    if (initial instanceof Array)
        throw new Error("cannot initialize a map with an array");
    HashBase.apply(this, arguments);
}
inherit(HashMap, HashBase);

(function () {
    // The arrays stored in the backing store are considered
    // immutable.
    this.add = function(from, to) {
        this._store(this.hash_f(from), [from, to]);
    };

    this.forEach = function (f) {
        var backing = this.backing;
        var keys = Object.keys(backing);
        for(var keys_ix = 0, key; (key = keys[keys_ix++]) !== undefined; )
            f(backing[key][0], backing[key][1]);
    };

    this.has = function(obj) {
        var hash = this.hash_f(obj);
        var pair = this.backing[hash];
        if (pair !== undefined)
            return pair[1];
    };

    this.keys = function () {
        return Object.keys(this.backing);
    };

}).call(HashMap.prototype);

exports.HashSet = HashSet;
exports.HashMap = HashMap;

});
