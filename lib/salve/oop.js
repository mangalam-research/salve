/**
 * @module oop
 * @desc OOP utilities
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013 Mangalam Research Center for Buddhist Languages
 */
define(/** @lends module:oop */ function (require, exports, module) {
'use strict';

function inherit(inheritor, inherited) {
    inheritor.prototype = Object.create(inherited.prototype);
    inheritor.prototype.constructor = inheritor;
}

function implement(inheritor, inherited) {
    for(var f in inherited.prototype) {
        inheritor.prototype[f] = inherited.prototype[f];
    }
}

exports.inherit = inherit;
exports.implement = implement;
});

// LocalWords:  oop Dubeau MPL Mangalam
