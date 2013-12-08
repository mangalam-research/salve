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

function Registry() {
    this.libraries = Object.create(null);
}

Registry.prototype.add = function (uri, library) {
    if (uri in this.libraries)
        throw new Error("URI clash: " + uri);
    this.libraries[uri] = library;
};

Registry.prototype.find = function (uri) {
    return this.libraries[uri];
};

Registry.prototype.get = function (uri) {
    var ret = this.find(uri);
    if (!ret)
        throw new Error("can't get library with URI: " + uri);
    return ret;
};

var registry = new Registry();
registry.add("", builtin);

exports.registry = registry;
exports.MATCH = match.MATCH;
exports.INCOMPLETE = match.INCOMPLETE;

});
