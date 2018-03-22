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

export { ConversionWalker } from "./conversion/conversion-walker";
export { ConversionResult, convertRNGToPattern } from "./conversion/convert";
export { BasicParser, ConversionParser, Element, Found,
         IncludeParser, Node, Text } from "./conversion/parser";
export { makeResourceLoader } from "./conversion/resource-loader";
export { serialize } from "./conversion/serializer";
export { getAvailableSimplifiers,
         makeSimplifier,
         SimplificationResult } from "./conversion/schema-simplification";
export { getAvailableValidators, makeValidator, SchemaValidationError,
         SchemaValidationResult } from "./conversion/schema-validation";

//  LocalWords:  NG MPL
