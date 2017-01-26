/**
 * Implementation of the builtin Relax NG datatype library.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { ParamError, ParameterParsingError, ValueError,
         ValueValidationError } from "./errors";
import { Datatype, RawParameter, TypeLibrary } from "./library";

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
  return value.trim().replace(/\s{2,}/g, " ");
}

//
// TypeScript does not automatically treat unimplemented interface bits as
// abstract. :-(
//
// See https://github.com/Microsoft/TypeScript/issues/4670
//
abstract class Base implements Datatype {
  abstract readonly name: string;
  abstract readonly needsContext: boolean;
  abstract readonly regexp: RegExp;

  parseParams(location: string, params: RawParameter[]): void {
    if (params && params.length > 0) {
      throw new ParameterParsingError(location,
                                      [new ParamError("this type does" +
                                                     " not accept parameters")]);
    }
  }

  parseValue(value: string): any {
    const errors: ValueError[] | false = this.disallows(value);
    if (errors instanceof Array && errors.length) {
      throw new ValueValidationError(errors);
    }
    return { value };
  }

  abstract equal(value: string, schemaValue: any): boolean;

  abstract disallows(value: string): ValueError[] | false;
};

class StringT extends Base {
  readonly name: "string";
  readonly regexp: RegExp = /.*/;
  readonly needsContext: boolean = false;

  equal(value: string, schemaValue: any): boolean {
    if (schemaValue.value === undefined) {
      throw Error("it looks like you are trying to use an unparsed value");
    }

    return value === schemaValue.value;
  }

  disallows(value: string): ValueError[] | false {
    return false;
  }
};

const stringT: StringT = new StringT();

class Token extends Base {
  readonly name: string = "token";
  readonly needsContext: boolean = false;
  readonly regexp: RegExp = /.*/;

  equal(value: string, schemaValue: any): boolean {
    if (schemaValue.value === undefined) {
      throw Error("it looks like you are trying to use an unparsed value");
    }

    return normalizeSpace(value) === normalizeSpace(schemaValue.value);
  }

  disallows(value: string): ValueError[] | false {
    // Yep, token allows anything, just like string.
    return false;
  }
};

const token: Token = new Token();

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
