/**
 * @module set
 * @desc Naive set implementation.
 * @author Louis-Dominique Dubeau
 */
define(/** @lends <global> */function (require, exports, module) {
'use strict';

/**
 * This is a naive implementation of sets. It stores all elements in
 * an array. All array manipulations are done by searching through the
 * array from start to hit. So when adding a new element to the Set,
 * for instance, the add method will scan the whole array, find the
 * the element is not there and then add the element at the end of the
 * array. As naive as this implementation is, it has been shown to be
 * faster than HashSet when used in the context of this library.
 *
 * Note that Set cannot hold undefined values.
 *
 * @constructor
 *
 * @param {Set|Array} initial The value to initialize the set
 * with. If a Set, then the new Set will be a clone of the
 * parameter. If an Array, then the new Set will be initialized with
 * the Array. If something else, then the new Set will contain
 * whatever value was passed.
 */
function Set(initial) {
    if (initial !== undefined) {
        if (initial instanceof Set)
            this.b = initial.b.concat([]);
        else if (initial instanceof Array) {
            this.b = [];
            for (var i = 0; i < initial.length; ++i)
                this.add(initial[i]);
        }
        else
            this.b = [initial];
    }
    else
        this.b = [];
}

(function () {
    this.b = undefined;

    this.add = function (x) {
        var t = this.b.indexOf(x);
        if (t < 0)
            this.b.push(x);
    };

    /**
     * Destructively adds the elements of another set to this set.
     *
     * @method
     * @name Set#union
     *
     * @param {Set} s The set to add.
     */
    this.union = function (s) {
        if (s === null || s === undefined)
            return;
        if (!(s instanceof Set))
            throw new Error("union with non-Set");
        var len = s.b.length;
        for (var i = 0; i < len; ++i)
            this.add(s.b[i]);
    };

    this.filter = function (f) {
        var ret = new this.constructor();
        // Yep, we cheat
        ret.b = this.b.filter(f);
        return ret;
    };

    /**
     * This method works like Array.map but with a provision for
     * eliminating elements from the resulting Set.
     *
     * @method
     * @name Set#map
     *
     * @param {Function} f This parameter plays the same role as for
     * Array.map. However, when it returns an undefined value, this
     * return value is not added to the Set that will be returned.
     *
     * @returns {Set} The new set
     */

    this.map = function (f) {
        var ret = new this.constructor();
        for (var i = 0; i < this.b.length; ++i) {
            var result = f(this.b[i]);

            // Undefined is not added.
            if (result !== undefined)
                ret.add(result);
        }
        return ret;
    };

    this.forEach = function (f) {
        this.b.forEach(f);
    };

    this.toString = function () {
        return this.b.join(", ");
    };

    this.size = function () {
        return this.b.length;
    };

    /**
     * Whether or not this set has the parameter passed.
     *
     * @method
     * @name Set#has
     *
     * @param obj The object which we want to look for.
     *
     * @returns {Boolean} True if the object is present, false if not.
     */
    this.has = function(obj) {
        return this.b.indexOf(obj) >= 0;
    };

    this.toArray = function () {
        return this.b.concat([]);
    };

}).call(Set.prototype);

// End of Set

exports.Set = Set;
});
