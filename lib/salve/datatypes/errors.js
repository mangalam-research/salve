/**
 * @desc Errors that can be raised during parsing of types.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
define(/** @lends module:datatypes/errors */ function factory(
  require, exports, _module) {
  "use strict";

  var oop = require("../oop");
  var _ = require("lodash");

  /**
   * Records an error due to an incorrect parameter (``<param>``) value. This
   * is an error in the **schema** used to validate a document. Note that
   * these errors are *returned* by salve's internal code. They are not
   * *thrown*.
   *
   * @constructor
   * @param {string} message The actual error description.
   */
  function ParamError(message) {
    this.message = message;
  }

  ParamError.prototype.toString = function toString() {
    return this.message;
  };

  /**
   * Records an error due to an incorrect value (``<value>``).  This is an
   * error in the **schema** used to validate a document. Note that these
   * errors are *returned* by salve's internal code. They are not *thrown*.
   *
   * @constructor
   * @param {string} message The actual error description.
   */
  function ValueError(message) {
    this.message = message;
  }

  ValueError.prototype.toString = function toString() {
    return this.message;
  };

  /**
   * Records the failure of parsing a parameter (``<param>``) value. Whereas
   * {@link module:datatypes/errors~ParamError ParamError} records each
   * individual issue with a parameter's parsing, this object is used to
   * throw a single failure that collects all the individual issues that were
   * encountered.
   *
   * @constructor
   * @param {string} location The location of the ``<param>`` in the schema.
   * @param {Array.<module:datatypes/errors~ParamError>} errors The errors
   *        encountered.
   * @extends Error
   */
  function ParameterParsingError(location, errors) {
    // This is crap to work around the fact that Error is a terribly badly
    // designed class or prototype or whatever. Unfortunately the stack trace
    // is off...
    var msg = location + ": " + _.map(errors, function map(x) {
      return x.toString();
    }).join("\n");
    var err = new Error(msg);
    this.errors = errors;
    this.name = "ParameterParsingError";
    this.stack = err.stack;
    this.message = err.message;
  }

  oop.inherit(ParameterParsingError, Error);

  /**
   * Records the failure of parsing a value (``<value>``). Whereas {@link
   * module:datatypes/errors~ValueError ValueError} records each individual
   * issue with a value's parsing, this object is used to throw a single
   * failure that collects all the individual issues that were encountered.
   *
   * @constructor
   * @param {string} location The location of the ``<value>`` in the schema.
   * @param {Array.<module:datatypes/errors~ValueError>} errors The errors
   * encountered.
   * @extends Error
   */
  function ValueValidationError(errors) {
    // This is crap to work around the fact that Error is a terribly badly
    // designed class or prototype or whatever. Unfortunately the stack trace
    // is off...
    var msg = _.map(errors,
                    function msg(x) {
                      return x.toString();
                    }).join("\n");
    var err = new Error(msg);
    this.errors = errors;
    this.name = "ValueValidationError";
    this.stack = err.stack;
    this.message = err.message;
  }

  oop.inherit(ValueValidationError, Error);

  exports.ParamError = ParamError;
  exports.ValueError = ValueError;
  exports.ParameterParsingError = ParameterParsingError;
  exports.ValueValidationError = ValueValidationError;
});
