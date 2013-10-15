/**
 * @module name_resolver
 * @desc Implements a name resolver for handling namespace changes in XML.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013 Mangalam Research Center for Buddhist Languages
 */
define(/** @lends module:name_resolver */function (require, exports, module) {
"use strict";

var validate = require("./validate");

var XML1_NAMESPACE = "http://www.w3.org/XML/1998/namespace";


/**
 * TBA
 * @classdesc TBA
 * @constructor
*/
function NameResolver() {
    this._context_stack = [];

    // Create a default context.
    this.enterContext();

    // Mandated by XML 1.x which is the only XML which exists now.
    this.definePrefix("xml", XML1_NAMESPACE);
}

NameResolver.prototype.clone = function() {
    var ret = new NameResolver();
    ret._context_stack = this._context_stack.slice();
    return ret;
};

NameResolver.prototype.definePrefix = function (prefix, uri) {
    this._context_stack[0].forward[prefix] = uri;

    var prefixes = this._context_stack[0].backwards[uri];
    if (prefixes === undefined)
        prefixes = this._context_stack[0].backwards[uri] = [];

    // This ensure that the default namespace is given priority
    // when unresolving names.
    if (prefix === "")
        prefixes.unshift("");
    else
        prefixes.push(prefix);
};

NameResolver.prototype.enterContext = function () {
    this._context_stack.unshift(Object.create(null));
    this._context_stack[0].forward = Object.create(null);
    this._context_stack[0].backwards = Object.create(null);
};

NameResolver.prototype.leaveContext = function () {
    if (this._context_stack.length > 1)
        this._context_stack.shift();
    else
        throw new Error("trying to leave the default context");
};

NameResolver.prototype.resolveName = function (name, attribute) {
    if (attribute === undefined)
        attribute = false;

    var parts = name.split(":");

    if (parts.length == 1) { // If there is no prefix
        if (attribute) // Attribute in undefined namespace
            return new validate.EName("", name);

        // We are searching for the default namespace currently in
        // effect.
        parts = [ "", name ];
    }

    if (parts.length > 2)
        throw new Error("invalid name passed to resolveName");

    // Search through the contexts
    var uri;
    for(var c_ix = 0, ctx;
        (uri === undefined) &&
        (ctx = this._context_stack[c_ix]) !== undefined; ++c_ix)
        uri = ctx.forward[parts[0]];

    if (uri === undefined)
        return (parts[0] === "") ? new validate.EName("", parts[1]): undefined;

    return new validate.EName(uri, parts[1]);
};

NameResolver.prototype.unresolveName = function (uri, name) {
    // Search through the contexts
    var prefixes;
    for(var c_ix = 0, ctx;
        (prefixes === undefined) &&
        (ctx = this._context_stack[c_ix]) !== undefined; ++c_ix)
        prefixes = ctx.backwards[uri];

    if (prefixes === undefined)
        return undefined;

    var pre = prefixes[0];

    return (pre !== "") ? (pre + ":" + name) : name;

};

exports.NameResolver = NameResolver;
exports.XML1_NAMESPACE = XML1_NAMESPACE;

});

// LocalWords:  namespace unresolving
