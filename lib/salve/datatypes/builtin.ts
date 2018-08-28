/**
 * Implementation of the builtin Relax NG datatype library.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { ParamError, ParameterParsingError, ValueError } from "./errors";
import { Datatype, ParsedParams, ParsedValue, RawParameter,
         TypeLibrary } from "./library";

/**
 * Strips leading and trailing space. Normalize all internal spaces to a single
 * space.
 *
 * @private
 *
 * @param value The value whose space we want to normalize.
 *
 * @returns The normalized value.
 */
function normalizeSpace(value: string): string {
  // It is generally faster to trim first.
  return value.trim().replace(/\s+/g, " ");
}

//
// TypeScript does not automatically treat unimplemented interface bits as
// abstract. :-(
//
// See https://github.com/Microsoft/TypeScript/issues/4670
//
abstract class Base implements Datatype<string> {
  abstract readonly name: string;
  abstract readonly needsContext: boolean;
  abstract readonly regexp: RegExp;

  parseParams(location: string, params?: RawParameter[]): ParsedParams {
    if (params !== undefined && params.length > 0) {
      throw new ParameterParsingError(
        location,
        [new ParamError("this type does not accept parameters")]);
    }

    return Object.create(null);
  }

  abstract parseValue(location: string, value: string): ParsedValue<string>;

  abstract equal(value: string, schemaValue: ParsedValue<string>): boolean;

  abstract disallows(value: string): ValueError[] | false;
}

class StringT extends Base {
  readonly name: "string";
  readonly regexp: RegExp = /^[^]*$/;
  readonly needsContext: boolean = false;

  parseValue(location: string, value: string): ParsedValue<string> {
    // The builtins do not disallow anything so we don't call disallows to check
    // whether the value is disallowed.
    return { value };
  }

  equal(value: string, schemaValue: ParsedValue<string>): boolean {
    return value === schemaValue.value;
  }

  disallows(value: string): ValueError[] | false {
    return false;
  }
}

const stringT = new StringT();

class Token extends Base {
  readonly name: string = "token";
  readonly needsContext: boolean = false;
  readonly regexp: RegExp = /^[^]*$/;

  parseValue(location: string, value: string): ParsedValue<string> {
    // The builtins do not disallow anything so we don't call disallows to check
    // whether the value is disallowed.
    return { value: normalizeSpace(value) };
  }

  equal(value: string, schemaValue: ParsedValue<string>): boolean {
    return normalizeSpace(value) === schemaValue.value;
  }

  disallows(value: string): ValueError[] | false {
    // Yep, token allows anything, just like string.
    return false;
  }
}

const token = new Token();

/**
 * The builtin datatype library.
 */
export const builtin: TypeLibrary = {
  uri: "",
  types: {
    string: stringT,
    token,
  },
};

//  LocalWords:  NG MPL unparsed
