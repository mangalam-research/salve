/**
 * @module datatypes
 * @desc Classes that model datatypes used in RNG schemas.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013 Mangalam Research Center for Buddhist Languages
 */

define(/** @lends module:datatypes */ function (require, exports, module) {
'use strict';

var builtin = require("./datatypes/builtin.js").builtin;
var match = require("./datatypes/match");

/**
 * @classdesc This class does not exist as a JavaScript entity. This
 * is a pseudo-class describing the structure that all builtin types
 * share.
 *
 * @name module:datatypes~BuiltinType
 * @class
 *
 * @property {boolean} needs_context ``true`` if this builtin type
 * needs a context, ``false`` if not.
 */

/**
 * Checks whether two strings are equal according to the type.
 *
 * @method
 * @name module:datatypes~BuiltinType#equal
 * @param {string} value The string from the document to be validated.
 * @param {string} schema_value The string from the schema.
 * @param {Object} context The context in the document.
 * @param {Object} schema_context The context in the schema.
 * @returns {boolean} ``true`` if equal, ``false`` if not.
 */

/**
 * Checks whether the type allows a certain string.
 *
 * @method
 * @name module:datatypes~BuiltinType#allows
 * @param {string} value The string from the document to be validated.
 * @param {Object} params The type parameters.
 * @param {Object} context The context in the document.
 * @returns {boolean} ``true`` if allowed, ``false`` if not.
 */

/**
 * Checks whether there is a match between two strings. This is a
 * more precise check than ``equal``.
 *
 * @method
 * @name module:datatypes~BuiltinType#match
 * @param {string} value The string from the document to be validated.
 * @param {string} schema_value The string from the schema.
 * @param {Object} context The context in the document.
 * @param {Object} schema_context The context in the schema.
 * @returns {module:datatypes~MatchType} The result of the match. See
 * the type definition.
 */

/**
 * @typedef {Object} module:datatypes~TypeLibrary
 *
 * @property {string} uri The uri of the type library.
 * @property {Array.<string, module:datatypes~BuiltinType>} types A
 * map of builtin type names to builtin types.
 */

/**
 * @typedef {Object} module:datatypes~MatchType
 * @property type The type of match.
 * @property {Number|undefined} length The length of the match.
 */

/**
 * @classdesc The registry of types.
 * @class
 */
function Registry() {
    this.libraries = Object.create(null);
}

/**
 * Adds a library to the registry.
 *
 * @param {module:datatypes~TypeLibrary} library The library to add to
 * the registry.
 * @throws {Error} If the URI is already registered.
 */
Registry.prototype.add = function (library) {
    var uri = library.uri;
    if (uri in this.libraries)
        throw new Error("URI clash: " + uri);
    this.libraries[uri] = library;
};

/**
 * Searches for a URI in the library.
 *
 * @param {string} uri The URI to search for.
 * @returns {module:datatypes~TypeLibrary|undefined} The library that
 * corresponds to the URI or undefined if no such library exists.
 */
Registry.prototype.find = function (uri) {
    return this.libraries[uri];
};

/**
 * Gets the library corresponding to a URI.
 *
 * @param {string} uri The URI.
 * @returns {module:datatypes~TypeLibrary} The library that
 * corresponds to the URI.
 * @throws {Error} If the library does not exist.
 */
Registry.prototype.get = function (uri) {
    var ret = this.find(uri);
    if (!ret)
        throw new Error("can't get library with URI: " + uri);
    return ret;
};

var registry = new Registry();
registry.add(builtin);

exports.registry = registry;
exports.MATCH = match.MATCH;
exports.INCOMPLETE = match.INCOMPLETE;

});
