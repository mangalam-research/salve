/**
 * @desc OOP utilities
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
"use strict";

/**
 * Makes a class inherit from another. After the call the inheritor has a
 * prototype which is a copy of the prototype of the inherited class.
 *
 * @static
 *
 * @param {Function} inheritor The class that inherits.
 *
 * @param {Function} inherited The class that is inherited.
 */
function inherit(inheritor, inherited) {
  inheritor.prototype = Object.create(inherited.prototype);
  inheritor.prototype.constructor = inheritor;
}

/**
 * Makes a class implement a mixin. This means that the prototype fields of the
 * mixin are copied into the class that implements it.
 *
 * @static
 *
 * @param {Function} mixes The class that implements the mixin.
 *
 * @param {Function} mixin The mixin to implement.
 */
function implement(mixes, mixin) {
  for (var f in mixin.prototype) {
    if ({}.hasOwnProperty.call(mixin.prototype, f)) {
      mixes.prototype[f] = mixin.prototype[f];
    }
  }
}

exports.inherit = inherit;
exports.implement = implement;

// LocalWords:  oop Dubeau MPL Mangalam mixin
