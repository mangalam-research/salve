/**
 * @desc Implementation of the builtin Relax NG datatype library.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
"use strict";

var extend = require("../tools").extend;
var errorsMod = require("./errors");

var ParameterParsingError = errorsMod.ParameterParsingError;
var ParamError = errorsMod.ParamError;
var ValueValidationError = errorsMod.ValueValidationError;

/**
 * Strips leading and trailing space. Normalize all internal spaces to a single
 * space.
 *
 * @private
 *
 * @param {string} value The value whose space we want to normalize.
 *
 * @returns {string} The normalized value.
 */
function normalizeSpace(value) {
  return value.trim().replace(/\s{2,}/g, " ");
}

var base = {
  parseParams: function parseParams(location, params) {
    if (params && params.length > 0) {
      throw new ParameterParsingError(location,
                                      new ParamError("this type does" +
                                                     " not accept parameters"));
    }
  },
  parseValue: function parseValue(value, context) {
    var errors = this.disallows(value, [], context);
    if (errors.length) {
      throw new ValueValidationError(errors);
    }
    return { value: value };
  },
};

var string = extend({}, base, {
  equal: function equal(value, schemaValue, context, _schemaContext) {
    if (schemaValue.value === undefined) {
      throw Error("it looks like you are trying to use an unparsed value");
    }

    return value === schemaValue.value;
  },
  disallows: function disallows(value, params, _context) {
    return false;
  },
  regexp: /.*/,
  needsContext: false,
});

var token = extend({}, base, {
  equal: function equal(value, schemaValue, _context) {
    if (schemaValue.value === undefined) {
      throw Error("it looks like you are trying to use an unparsed value");
    }

    return normalizeSpace(value) === normalizeSpace(schemaValue.value);
  },
  disallows: function disallows(value, params, _context) {
    // Yep, token allows anything, just like string.
    return false;
  },
  regexp: /.*/,
  needsContext: false,
});

/**
 * The builtin datatype library.
 *
 * @type module:datatypes.TypeLibrary
 */
var builtin = {
  uri: "",
  types: {
    string: string,
    token: token,
  },
};

exports.builtin = builtin;
