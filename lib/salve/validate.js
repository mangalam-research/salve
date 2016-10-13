/**
 * @desc RNG-based validator.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */

define(/** @lends module:validate */function validate(require, exports,
                                                      _module) {
  "use strict";

  var patterns = require("./patterns");
  var formats = require("./formats");

  exports.version = "2.0.0";

  // eslint-disable-next-line guard-for-in
  for (var prop in patterns) {
    exports[prop] = patterns[prop];
  }

  exports.constructTree = formats.constructTree;
});

//  LocalWords:  validator constructTree RNG MPL Dubeau Mangalam rng
