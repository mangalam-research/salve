/**
 * @module datatypes/builtin
 * @desc Implementation of the builtin Relax NG datatype library.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013 Mangalam Research Center for Buddhist Languages
 */
define(/** @lends module:datatypes/builtin */
    function (require, exports, module) {
'use strict';

var oop = require("../oop");
var match = require("./match");

var MATCH = match.MATCH;
var INCOMPLETE = match.INCOMPLETE;

/**
 * Strips leading and trailing space. Normalize all internal spaces to
 * a single space.
 *
 * @private
 *
 * @param {string} value The value whose space we want to normalize.
 * @returns {string} The normalized value.
 */
function normalizeSpace(value) {
    return value.trim().replace(/\s{2,}/g, ' ');
}

/**
 * The ``string`` type in the builtin library.
 * @type module:datatypes~BuiltinType
 */
var string = {
    equal: function (value, schema_value, context, schema_context) {
        return value === schema_value;
    },
    allows: function (value, params, context) {
        return true;
    },
    needs_context: false,
    match: function (value, schema_value, context, schema_context) {
        if (this.equal(value, schema_value))
            return {type: MATCH};

        // If they are unequal and the schema_value is the empty string,
        // then they can't match.
        if (schema_value === '')
            return false;

        if (value.lastIndexOf(schema_value, 0) === 0)
            // Value matches what the schema wants but has trailing data.
            // e.g. schema wants "foobar" but value is "foobar etc"
            return {type: MATCH, length: schema_value.length};

        if (schema_value.lastIndexOf(value, 0) === 0)
            // Value matches partially what the schema wants.
            // e.g. schema wants "foobar" and value is "foo".
            return {type: INCOMPLETE};

        return false;
    }
};

/**
 * The ``token`` type in the builtin library.
 * @type module:datatypes~BuiltinType
 */
var token = {
    equal: function (value, schema_value, context, schema_context) {
        return normalizeSpace(value) === normalizeSpace(schema_value);
    },
    allows: function (value, params, context) {
        return true;
    },
    needs_context: false,
    match: function (value, schema_value, context, schema_context) {
        if (this.equal(value, schema_value))
            return {type: MATCH};

        var value_n = normalizeSpace(value);
        var schema_value_n = normalizeSpace(schema_value);

        // If they are unequal and the schema_value_n is the empty string,
        // then they can't match.
        if (schema_value_n === '')
            return false;

        if (value_n.lastIndexOf(schema_value_n, 0) === 0) {
            // Find the start of value which matches schema_value.
            // We chop off value until the two are equal.
            while (true) {
                value = value.slice(0, -1);
                value_n = normalizeSpace(value);
                if (schema_value_n === value_n)
                    break;
            }

            return {type: MATCH, length: value.length};
        }

        if (schema_value.lastIndexOf(value, 0) === 0)
            return {type: INCOMPLETE};

        return false;
    }
};

/**
 * The builtin library.
 */
var builtin = {
    uri: "",
    types: {
        string: string,
        token: token
    }
};

exports.builtin = builtin;

});
