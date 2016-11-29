/**
 * This is a module that converts XMLSchema regular expressions to
 * plain JavaScript regular expressions.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

// In theory the return value when it is a RegExp may not actually be a native
// JavaScript regexp but an XRegExp object. However, in the context of salve's
// code, this is an academic distinction.

/**
 * @param value The value to parse.
 *
 * @param outputType The type of return value we want.
 *
 * @return The parsed string, in the type requested. A [[RegExp]] if
 * ``outputType`` was ``"re"`` or a ``string`` if the output type was
 * ``"string"``.
 */
export declare function parse(value: string): RegExp;
export declare function parse(value: string, outputType: "re"): RegExp;
export declare function parse(value: string, outputType: "string"): string;

/**
 * Reports an error in parsing.
 */
export declare class SalveParsingError extends Error {}
