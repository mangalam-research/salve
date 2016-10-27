/**
 * @desc This module contains utilities used for converting Relax NG files to
 * the format required by salve.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 *
 */
"use strict";

var parser = require("./conversion/parser");
var walker = require("./conversion/walker");

/**
 * @see module:conversion/parser.Element
 * @static
 */
exports.Element = parser.Element;

/**
 * @see module:conversion/parser.ConversionParser
 * @static
 */
exports.ConversionParser = parser.ConversionParser;

/**
 * @see module:conversion/walker.DefaultConversionWalker
 * @static
 */
exports.DefaultConversionWalker = walker.DefaultConversionWalker;

/**
 * @see module:conversion/walker.NameGatherer
 * @static
 */
exports.NameGatherer = walker.NameGatherer;

/**
 * @see module:conversion/walker.Renamer
 * @static
 */
exports.Renamer = walker.Renamer;

/**
 * @see module:conversion/walker.DatatypeProcessor
 * @static
 */
exports.DatatypeProcessor = walker.DatatypeProcessor;
