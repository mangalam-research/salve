/**
 * This module contains utilities used for converting Relax NG files to the
 * format required by salve.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 *
 */
"use strict";

export { ConversionParser, Element } from "./conversion/parser";
export { DatatypeProcessor, DefaultConversionWalker, NameGatherer, Renamer } from "./conversion/walker";
