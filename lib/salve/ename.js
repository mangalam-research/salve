/**
 * @desc Class for XML Expanded Names.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
"use strict";

/**
 * @classdesc Immutable objects modeling XML Expanded Names.
 * @class
 * @static
 *
 * @param {string} ns The namespace URI.
 *
 * @param {string} name The local name of the entity.
 */
function EName(ns, name) {
  this.ns = ns;
  this.name = name;
}

/**
 * @returns {string} A string representing the expanded name.
 */
EName.prototype.toString = function toString() {
  return "{" + this.ns + "}" + this.name;
};

/**
 * Compares two expanded names.
 *
 * @param {module:ename.EName} other The other object to compare this object
 * with.
 *
 * @returns {boolean} ``true`` if this object equals the other.
 */
EName.prototype.equal = function equal(other) {
  return this.ns === other.ns && this.name === other.name;
};

exports.EName = EName;
