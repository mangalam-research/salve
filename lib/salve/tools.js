/**
 * @desc Common tools for salve.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
"use strict";

function copy(target, source) {
  for (var i in source) { // eslint-disable-line guard-for-in
    target[i] = source[i];
  }
}

/**
 * Modify ``target`` by copying the sources into it. This function is designed
 * to fit the internal needs of salve and is not meant as a general purpose
 * "extend" function like provided by jQuery or Lodash (for instance).
 *
 * @param {Object} target The target to copy into.
 *
 * @param {Object} sources... The sources from which to copy. These sources are
 * processed in order.
 *
 * @returns {Object} The target.
 */
function extend() {
  var target = arguments[0];
  var limit = arguments.length;
  for (var ix = 1; ix < limit; ++ix) {
    copy(target, arguments[ix]);
  }

  return target;
}

exports.extend = extend;
