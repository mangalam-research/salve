/**
 * @module datatypes/match
 * @desc Possible return values for the ``match`` method of types.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013 Mangalam Research Center for Buddhist Languages
 */
define(/** @lends module:datatypes/match */
    function (require, exports, module) {
'use strict';

var x = 0;

/**
 * Indicates that the document value matches the schema value. If the
 * entire document value matches, then the return value won't have a
 * ``length`` field. If only a part of the document value matches, a
 * ``length`` field is populated with the length of the document value
 * that matched. For instance, if schema wants "foobar" but the
 * document value is "foobar etc". Then the length will be 6.
 */
exports.MATCH = x++;


/**
 * Indicates that the document value only partially matches the schema
 * value. For instance, if the schema wants "foobar" and the document
 * value is "foo".
 */
exports.INCOMPLETE = x++;

});
