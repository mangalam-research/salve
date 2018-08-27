/**
 * Implementation of the XMLSchema datatypes.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { TrivialMap } from "../types";
import { ParamError, ParameterParsingError, ValueError,
         ValueValidationError } from "./errors";
import { Context, Datatype, ParsedParams, ParsedValue, RawParameter,
         TypeLibrary } from "./library";
import * as regexp from "./regexp";
import { xmlNameChar, xmlNameRe, xmlNcname,
         xmlNcnameRe } from "./xmlcharacters";

// tslint:disable: no-reserved-keywords

/**
 * Check whether a parameter is an integer.
 *
 * @param value The parameter value.
 *
 * @param name The name of the parameter.
 *
 * @return ``false`` if there is no error. Otherwise it returns a [[ParamError]]
 * that records the error.
 *
 * @private
 */
function failIfNotInteger(value: string, name: string): ParamError | false {
  if (value.search(/^\d+$/) !== -1) {
    return false;
  }

  return new ParamError(`${name} must have an integer value`);
}

/**
 * Check whether a parameter is a non-negative integer.
 *
 * @param value The parameter value.
 *
 * @param name The name of the parameter.
 *
 * @return ``false`` if there is no error. Otherwise it returns a [[ParamError]]
 * that records the error.
 *
 * @private
 */
function failIfNotNonNegativeInteger(value: string, name: string):
ParamError | false {
  if (!failIfNotInteger(value, name) && Number(value) >= 0) {
    return false;
  }

  return new ParamError(`${name} must have a non-negative integer value`);
}

/**
 * Check whether a parameter is a positive integer.
 *
 * @param value The parameter value.
 *
 * @param name The name of the parameter.
 *
 * @return ``false`` if there is no error. Otherwise it returns a [[ParamError]]
 * that records the error.
 *
 * @private
 */
function failIfNotPositiveInteger(value: string, name: string):
ParamError | false {
  if (!failIfNotInteger(value, name) && Number(value) > 0) {
    return false;
  }

  return new ParamError(`${name} must have a positive value`);
}

/**
 * Convert a number to an internal representation. This takes care of the
 * differences between JavaScript and XML Schema (e.g. "Infinity" vs "INF").
 *
 * @param value The value as expressed in an XML file or schema.
 *
 * @returns The number, in its internal representation.
 */
function convertToInternalNumber(value: string): number {
    if (value === "INF") {
      return Infinity;
    }

    if (value === "-INF") {
      return -Infinity;
    }

    return Number(value);
}

/**
 * Convert an internal representation of a number to a string. This takes care
 * of the differences between JavaScript and XML Schema. For instance, a value
 * of ``Infinity`` will be represented as the string ``"INF"``.
 *
 * @param number The internal representation.
 *
 * @returns The string representation.
 */
function convertInternalNumberToString(value: number): string {
  if (value === Infinity) {
    return "INF";
  }

  if (value === -Infinity) {
    return "-INF";
  }

  return value.toString();
}

//
// The parameters
//

/**
 * A parameter used for XML Schema type processing.
 */
abstract class Parameter {

  /**
   * The name of this parameter.
   */
  abstract readonly name: string;

  /**
   * Whether the parameter can appear more than once on the same type.
   */
  readonly repeatable: boolean = false;

  /**
   * Convert the parameter value from a string to a value to be used internally
   * by this code.
   *
   * @param value The value to convert.
   *
   * @returns The converted value.
   */
  abstract convert(value: string): any;

  /**
   * Checks whether a parameter is invalid.
   *
   * @param value The parameter value to check. This is the raw string from the
   * schema, not a value converted by [[convert]].
   *
   * @param name The name of the parameter. This allows using generic functions
   * to check on values.
   *
   * @param type The type for which this parameter is checked.
   *
   * @returns ``false`` if there is no problem. Otherwise, an error.
   */
  abstract isInvalidParam(value: string, name: string,
                          type: Datatype): ParamError | false;

  /**
   * Checks whether a value that appears in the XML document being validated is
   * invalid according to this parameter.
   *
   * @param value The value from the XML document. This is the parsed
   * value, converted by [["datatypes/library".Datatype.parseValue]].
   *
   * @param param The parameter value. This must be the value obtained from
   * [[convert]].
   *
   * @param type The type for which this parameter is checked.
   *
   * @returns ``false`` if there is no problem. Otherwise, an error.
   */
  abstract isInvalidValue(value: any, param: any,
                          type: Base<{}>): ValueError | false;
}

abstract class NumericParameter extends Parameter {
  convert(value: string): any {
    return convertToInternalNumber(value);
  }
}

abstract class NonNegativeIntegerParameter extends NumericParameter {
  isInvalidParam(value: string, name: string): ParamError | false {
    return failIfNotNonNegativeInteger(value, name);
  }
}

class LengthP extends NonNegativeIntegerParameter {
  readonly name: string = "length";

  isInvalidValue(value: any, param: any, type: Base<{}>): ValueError | false {
    if (type.valueLength(value) === param) {
      return false;
    }

    return new ValueError(`length of value should be ${param}`);
  }
}

const lengthP = new LengthP();

class MinLengthP extends NonNegativeIntegerParameter {
  readonly name: string = "minLength";

  isInvalidValue(value: any, param: any, type: Base<{}>): ValueError | false {
    if (type.valueLength(value) >= param) {
      return false;
    }

    return new ValueError("length of value should be greater than " +
                          `or equal to ${param}`);
  }
}

const minLengthP = new MinLengthP();

class MaxLengthP extends NonNegativeIntegerParameter {
  readonly name: string = "maxLength";

  isInvalidValue(value: any, param: any, type: Base<{}>): ValueError | false {
    if (type.valueLength(value) <= param) {
      return false;
    }

    return new ValueError("length of value should be less than " +
                          `or equal to ${param}`);
  }

}

const maxLengthP = new MaxLengthP();

//
// pattern is special. It converts the param value found in the RNG file into an
// object with two fields: ``rng`` and ``internal``. RNG is the string value
// from the RNG file, and ``internal`` is a representation internal to salve. We
// use ``internal`` for performing the validation but present ``rng`` to the
// user. Note that if pattern appears multiple times as a parameter, the two
// values are the result of the concatenation of all the instance of the pattern
// parameter. (Why this? Because it would be confusing to show the internal
// value in error messages to the user.)
//

/**
 * A mapping of raw schema values to the corresponding ``RegExp`` object.
 */
const reCache: TrivialMap<RegExp> = Object.create(null);

export interface ConvertedPattern {
  rng: string;
  internal: RegExp;
}

class PatternP extends Parameter {
  readonly name: string = "pattern";
  readonly repeatable: boolean = true;

  convert(value: string): ConvertedPattern {
    let internal = reCache[value];
    if (internal === undefined) {
      internal = reCache[value] = regexp.parse(value);
    }

    return {
      rng: value,
      internal,
    };
  }

  isInvalidParam(value: string): ParamError | false {
    try {
      this.convert(value);
    }
    catch (ex) {
      // Convert the error into something that makes sense for salve.
      if (ex instanceof regexp.SalveParsingError) {
        return new ParamError(ex.message);
      }

      // Rethrow
      throw ex;
    }

    return false;
  }

  isInvalidValue(value: any,
                 param: ConvertedPattern | ConvertedPattern[]):
  ValueError | false {
    if (param instanceof Array) {
      let failedOn: any;
      for (const p of param) {
        if (!p.internal.test(value)) {
          failedOn = p;
          break;
        }
      }

      if (failedOn === undefined) {
        return false;
      }

      return new ValueError(`value does not match the pattern ${failedOn.rng}`);
    }

    if (param.internal.test(value)) {
      return false;
    }

    return new ValueError(`value does not match the pattern ${param.rng}`);
  }
}

const patternP = new PatternP();

class TotalDigitsP extends NumericParameter {
  readonly name: string = "totalDigits";

  isInvalidParam(value: string, name: string): ParamError | false {
    return failIfNotPositiveInteger(value, name);
  }

  isInvalidValue(value: any, param: any): ValueError | false {
    const str = String(Number(value)).replace(/[-+.]/g, "");
    if (str.length > param) {
      return new ValueError(`value must have at most ${param} digits`);
    }

    return false;
  }
}

const totalDigitsP = new TotalDigitsP();

class FractionDigitsP extends NonNegativeIntegerParameter {
  readonly name: string = "fractionDigits";

  isInvalidValue(value: any, param: any): ValueError | false {
    const str = String(Number(value)).replace(/^.*\./, "");
    if (str.length > param) {
      return new ValueError(`value must have at most ${param} fraction digits`);
    }

    return false;
  }
}

abstract class NumericTypeDependentParameter extends NumericParameter {
  isInvalidParam(value: any, name: string, type: Base<{}>): ParamError | false {
    const errors = type.disallows(value);
    if (!errors) {
      return false;
    }

    // Support for multiple value errors is mainly so that we can report if a
    // value violates multiple param specifications. When we check a param in
    // isolation, it is unlikely that we'd get multiple errors. If we do, we
    // narrow it to the first error and convert the ValueError to a ParamError.
    return new ParamError(errors[0].message);
  }
}

const fractionDigitsP = new FractionDigitsP();

class MaxInclusiveP extends NumericTypeDependentParameter {
  readonly name: string = "maxInclusive";
  isInvalidValue(value: any, param: any): ValueError | false {
    if ((isNaN(value) !== isNaN(param)) || value > param) {
      const repr = convertInternalNumberToString(param);

      return new ValueError(`value must be less than or equal to ${repr}`);
    }

    return false;
  }
}

const maxInclusiveP = new MaxInclusiveP();

class MaxExclusiveP extends NumericTypeDependentParameter {
  readonly name: string = "maxExclusive";
  isInvalidValue(value: any, param: any): ValueError | false {
    // The negation of a less-than test allows handling a parameter value of NaN
    // automatically.
    if (!(value < param)) {
      const repr = convertInternalNumberToString(param);

      return new ValueError(`value must be less than ${repr}`);
    }

    return false;
  }
}

const maxExclusiveP = new MaxExclusiveP();

class MinInclusiveP extends NumericTypeDependentParameter {
  readonly name: string = "minInclusive";
  isInvalidValue(value: any, param: any): ValueError | false {
    if ((isNaN(value) !== isNaN(param)) || value < param) {
      const repr = convertInternalNumberToString(param);

      return new ValueError(`value must be greater than or equal to ${repr}`);
    }

    return false;
  }
}

const minInclusiveP = new MinInclusiveP();

class MinExclusiveP extends NumericTypeDependentParameter {
  readonly name: string = "minExclusive";
  isInvalidValue(value: any, param: any): ValueError | false {
    // The negation of a greater-than test allows handling a parameter value of
    // NaN automatically.
    if (!(value > param)) {
      const repr = convertInternalNumberToString(param);

      return new ValueError(`value must be greater than ${repr}`);
    }

    return false;
  }
}

const minExclusiveP = new MinExclusiveP();

type WhitespaceHandler = (value: string) => string;

function whitespacePreserve(value: string): string {
  return value;
}

function whitespaceCollapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function whitespaceReplace(value: string): string {
  return value.replace(/\s+/g, " ");
}

/**
 * A mapping of parameter names to parameter objects.
 */
const PARAM_NAME_TO_OBJ: TrivialMap<Parameter> = Object.create(null);

for (const param of [lengthP, minLengthP, maxLengthP, patternP, totalDigitsP,
                     fractionDigitsP, minExclusiveP, minInclusiveP,
                     maxExclusiveP, maxInclusiveP]) {
  PARAM_NAME_TO_OBJ[param.name] = param;
}

/**
 * The structure that all datatype implementations in this module share.
 *
 * @private
 *
 */
abstract class Base<T> implements Datatype<T> {
  protected static throwMissingLocation(errors: ParamError[]): never {
    // The only time location is undefined is if ``parseParams`` was called
    // without arguments. That's an internal error because we should always be
    // able to call ``parseParams`` to "parse" the default parameter values.
    throw new Error("internal error: undefined location");
  }

  abstract readonly name: string;
  abstract readonly needsContext: boolean;
  abstract readonly regexp: RegExp;

  /**
   * The default whitespace processing for this type.
   */
  readonly processWhitespace: WhitespaceHandler = whitespaceCollapse;

  /**
   * The error message to give if a value is disallowed.
   */
  readonly typeErrorMsg: string;

  /**
   * Parameters that are valid for this type.
   */
  readonly validParams: ReadonlyArray<Parameter>;

  protected _defaultParams?: ParsedParams;

  /**
   * The default parameters if none are specified.
   */
  protected get defaultParams(): ParsedParams {
    const defaultParams = this._defaultParams;

    if (defaultParams !== undefined) {
      return defaultParams;
    }

    return this._defaultParams = this.parseParams("**INTERNAL**");
  }

  /**
   * Converts a value. It does the strict minimum to convert the value from a
   * string to an internal representation. It is never interchangeable with
   * [[parseValue]].
   *
   * @param location The location of the value. It must be a string meaningful
   * to the user. (In some scenarios, it is not possible to produce such a
   * string. The code calling then can use a placeholder and strip that
   * placeholder from reports to the user.)
   *
   * @param value The value from the XML document.
   *
   * @param context The context of the value in the XML document.
   *
   * @returns An internal representation.
   */
  protected abstract convertValue(location: string, value: string,
                                  context?: Context): T;

  /**
   * Computes the value's length. This may differ from the value's length, as it
   * appears in the XML document it comes from.
   *
   * @param value The value from the XML document.
   *
   * @returns The length.
   */
  valueLength(value: string): number {
    return value.length;
  }

  parseValue(location: string, value: string,
             context?: Context): ParsedValue<T> {
    const errors = this.disallows(value, undefined, context);
    if (errors) {
      throw new ValueValidationError(location, errors);
    }

    return { value: this.convertValue(location, value, context) };
  }

  // tslint:disable-next-line: max-func-body-length
  parseParams(location: string, params?: RawParameter[]): ParsedParams {
    const ret: TrivialMap<string[]> = Object.create(null);
    if (params === undefined) {
      // Yes, if the list of parameters is empty, we return an empty map because
      // by default there are no default parameters.
      return ret;
    }

    const errors: ParamError[] = [];
    for (const x of params) {
      const { name, value } = x;

      const prop = PARAM_NAME_TO_OBJ[name];

      // Do we know this parameter?
      if (prop === undefined || !this.validParams.includes(prop)) {
        errors.push(new ParamError(`unexpected parameter: ${name}`));

        continue;
      }

      // Is the value valid at all?
      const invalid = prop.isInvalidParam(value, name, this);
      if (invalid) {
        errors.push(invalid);
      }
      else {
        const converted = prop.convert(value);
        const values = ret[name];
        // We gather all the values in a map of name to value.
        if (values === undefined) {
          ret[name] = converted;
        }
        else {
          if (!prop.repeatable) {
            errors.push(new ParamError(`cannot repeat parameter ${name}`));
          }
          if (Array.isArray(values)) {
            values.push(converted);
          }
          else {
            ret[name] = [values, converted];
          }
        }
      }
    }

    if (errors.length !== 0) {
      throw new ParameterParsingError(location, errors);
    }

    // Inter-parameter checks. There's no point in trying to generalize
    // this.

    /* tslint:disable: no-string-literal */
    if (ret["minLength"] > ret["maxLength"]) {
      errors.push(new ParamError(
        "minLength must be less than or equal to maxLength"));
    }

    if (ret["length"] !== undefined) {
      if (ret["minLength"] !== undefined) {
        errors.push(new ParamError(
          "length and minLength cannot appear together"));
      }
      if (ret["maxLength"] !== undefined) {
        errors.push(new ParamError(
          "length and maxLength cannot appear together"));
      }
    }

    if (ret["maxInclusive"] !== undefined) {
      if (ret["maxExclusive"] !== undefined) {
        errors.push(new ParamError(
          "maxInclusive and maxExclusive cannot appear together"));
      }

      // maxInclusive, minExclusive
      if (ret["minExclusive"] >= ret["maxInclusive"]) {
        errors.push(new ParamError(
          "minExclusive must be less than maxInclusive"));
      }
    }

    if (ret["minInclusive"] !== undefined) {
      if (ret["minExclusive"] !== undefined) {
        errors.push(new ParamError(
          "minInclusive and minExclusive cannot appear together"));
      }

      // maxInclusive, minInclusive
      if (ret["minInclusive"] > ret["maxInclusive"]) {
        errors.push(new ParamError(
          "minInclusive must be less than or equal to maxInclusive"));
      }

      // maxExclusive, minInclusive
      if (ret["minInclusive"] >= ret["maxExclusive"]) {
        errors.push(new ParamError(
          "minInclusive must be less than maxExclusive"));
      }
    }

    // maxExclusive, minExclusive
    if (ret["minExclusive"] > ret["maxExclusive"]) {
      errors.push(new ParamError(
        "minExclusive must be less than or equal to maxExclusive"));
    }

    /* tslint:enable: no-string-literal */
    if (errors.length !== 0) {
      throw new ParameterParsingError(location, errors);
    }

    return ret;
  }

  equal(value: string, schemaValue: ParsedValue<T>,
        context?: Context): boolean {
    let converted: T;

    try {
      // We pass an empty string as location because we do not generally keep
      // track of locations in the XML file being validated. The
      // ValueValidationError is caught and turned into a boolean below so the
      // specific location is not important here.
      converted = this.convertValue("", value, context);
    }
    catch (ex) {
      // An invalid value cannot be equal.
      if (ex instanceof ValueValidationError) {
        return false;
      }
      throw ex;
    }

    return converted === schemaValue.value;
  }

  disallows(value: string, params?: ParsedParams,
            context?: Context): ValueError[] | false {
    if (!this.regexp.test(value)) {
      return [new ValueError(this.typeErrorMsg)];
    }

    let converted: any;
    try {
      // We pass an empty string as location because we do not generally keep
      // track of locations in the XML file being validated. The
      // ValueValidationError is caught below and its errors are extracted and
      // returned.
      converted = this.convertValue("", value, context);
    }
    catch (ex) {
      // An invalid value is not allowed.
      if (ex instanceof ValueValidationError) {
        return ex.errors;
      }
      throw ex;
    }

    if (params === undefined || Object.keys(params).length === 0) {
      // If no params were passed, get the default params.
      // tslint:disable-next-line:no-parameter-reassignment
      params = this.defaultParams;
    }

    const paramNames = Object.keys(params);
    if (paramNames.length === 0) {
      return false;
    }

    const errors: ValueError[] = [];
    for (const name of paramNames) {
      const param = PARAM_NAME_TO_OBJ[name];
      const err = param.isInvalidValue(converted, params[name], this);
      if (err) {
        errors.push(err);
      }
    }

    return (errors.length !== 0) ? errors : false;
  }
}

//
// String family
//

abstract class CommonStringBased extends Base<string> {
  protected convertValue(location: string, value: string,
                         context?: Context): string {
    return this.processWhitespace(value);
  }
}

/* tslint:disable:class-name */
class string_ extends CommonStringBased {
  readonly name: string = "string";
  readonly typeErrorMsg: string = "value is not a string";
  readonly processWhitespace: WhitespaceHandler = whitespacePreserve;
  readonly validParams: Parameter[] = [lengthP, minLengthP, maxLengthP,
                                       patternP];
  readonly needsContext: boolean = false;
  // [^] means "any character". The dot would exclude line terminators (\r\n,
  // etc.).
  readonly regexp: RegExp = /^[^]*$/;

  // This is a specialized version of disallows that avoids bothering with tests
  // that don't affect the results. string and some of its immediate derivates
  // are not affected by their regexp, nor do they have default parameters that
  // affect what values are allowed.
  disallows(value: string, params?: ParsedParams,
            context?: Context): ValueError[] | false {
    if (params === undefined || Object.keys(params).length === 0) {
      // The default params don't disallow anything.
      return false;
    }

    const converted = this.convertValue("", value, context);
    const errors: ValueError[] = [];
    // We use Object.keys because we don't know the precise type of params.
    for (const name of Object.keys(params)) {
      const param = PARAM_NAME_TO_OBJ[name];
      const err = param.isInvalidValue(converted, params[name], this);
      if (err) {
        errors.push(err);
      }
    }

    return (errors.length !== 0) ? errors : false;
  }
}

class normalizedString extends string_ {
  readonly name: string = "normalizedString";
  readonly typeErrorMsg: string =
    "string contains a tab, carriage return or newline";
  readonly processWhitespace: WhitespaceHandler = whitespaceReplace;
}

class token extends normalizedString {
  readonly name: string = "token";
  readonly typeErrorMsg: string = "not a valid token";
  readonly processWhitespace: WhitespaceHandler = whitespaceCollapse;
}

class tokenInternal extends token {
  disallows(value: string, params?: ParsedParams,
            context?: Context): ValueError[] | false {
    if (!this.regexp.test(value)) {
      return [new ValueError(this.typeErrorMsg)];
    }

    return super.disallows(value, params, context);
  }
}

class language extends tokenInternal {
  readonly name: string = "language";
  readonly typeErrorMsg: string = "not a valid language identifier";
  readonly regexp: RegExp = /^\s*[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*\s*$/;
}

class Name extends tokenInternal {
  readonly name: string = "Name";
  readonly typeErrorMsg: string = "not a valid Name";
  readonly regexp: RegExp = xmlNameRe;
}

class NCName extends Name {
  readonly name: string = "NCName";
  readonly typeErrorMsg: string = "not a valid NCName";
  readonly regexp: RegExp = xmlNcnameRe;
}

class NMTOKEN extends tokenInternal {
  readonly name: string = "NMTOKEN";
  readonly typeErrorMsg: string = "not a valid NMTOKEN";
  readonly regexp: RegExp = new RegExp(`^\\s*[${xmlNameChar}]+\\s*$`);
}

class NMTOKENS extends NMTOKEN {
  readonly name: string = "NMTOKENS";
  readonly typeErrorMsg: string = "not a valid NMTOKENS";
  readonly regexp: RegExp =
    new RegExp(`^\\s*[${xmlNameChar}]+(?:\\s+[${xmlNameChar}]+)*\\s*$`);
}

class ID extends NCName {
  readonly name: string = "ID";
  readonly typeErrorMsg: string = "not a valid ID";
}

class IDREF extends NCName {
  readonly name: string = "IDREF";
  readonly typeErrorMsg: string = "not a valid IDREF";
}

class IDREFS extends IDREF {
  readonly name: string = "IDREFS";
  readonly typeErrorMsg: string = "not a valid IDREFS";
  readonly regexp: RegExp =
    new RegExp(`^\\s*${xmlNcname}(?:\\s+${xmlNcname})*\\s*$`);
}

class ENTITY extends NCName {
  readonly name: string = "ENTITY";
  readonly typeErrorMsg: string = "not a valid ENTITY";
}

class ENTITIES extends ENTITY {
  readonly name: string = "ENTITIES";
  readonly typeErrorMsg: string = "not a valid ENTITIES";
  readonly regexp: RegExp =
    new RegExp(`^\\s*${xmlNcname}(?:\\s+${xmlNcname})*\\s*$`);
}

//
// Decimal family
//

const decimalPattern: string = "[-+]?(?!$)\\d*(\\.\\d*)?";
class decimal extends Base<number> {
  readonly name: string = "decimal";
  readonly typeErrorMsg: string = "value not a decimal number";
  readonly regexp: RegExp = new RegExp(`^\\s*${decimalPattern}\\s*$`);
  readonly processWhitespace: WhitespaceHandler = whitespaceCollapse;
  readonly needsContext: boolean = false;

  readonly validParams: Parameter[] = [
    totalDigitsP, fractionDigitsP, patternP, minExclusiveP, minInclusiveP,
    maxExclusiveP, maxInclusiveP,
  ];

  convertValue(location: string, value: string): number {
    // We don't need to do white-space processing on the value.
    return Number(value);
  }
}

const integerPattern: string = "[-+]?\\d+";
class integer extends decimal {
  readonly name: string = "integer";
  readonly typeErrorMsg: string = "value is not an integer";
  readonly regexp: RegExp = new RegExp(`^\\s*${integerPattern}\\s*$`);

  readonly highestVal: number | undefined;
  readonly lowestVal: number | undefined;

  readonly validParams: Parameter[] = [
    totalDigitsP, patternP, minExclusiveP, minInclusiveP, maxExclusiveP,
    maxInclusiveP,
  ];

  parseParams(location: string, params?: RawParameter[]): ParsedParams {
    let me: any;
    let mi: any;
    const ret = super.parseParams(location, params);

    function fail(message: string): never {
      throw new ParameterParsingError(location, [new ParamError(message)]);
    }

    const highestVal = this.highestVal;
    if (highestVal !== undefined) {
      /* tslint:disable:no-string-literal */
      if (ret["maxExclusive"] !== undefined) {
        me = ret["maxExclusive"];
        if (me > highestVal) {
          fail(`maxExclusive cannot be greater than ${highestVal}`);
        }
      }
      else if (ret["maxInclusive"] !== undefined) {
        mi = ret["maxInclusive"];
        if (mi > highestVal) {
          fail(`maxInclusive cannot be greater than ${highestVal}`);
        }
      }
      else {
        ret["maxInclusive"] = highestVal;
      }
    }

    const lowestVal = this.lowestVal;
    if (lowestVal !== undefined) {
      if (ret["minExclusive"] !== undefined) {
        me = ret["minExclusive"];
        if (me < lowestVal) {
          fail(`minExclusive cannot be lower than ${this.lowestVal}`);
        }
      }
      else if (ret["minInclusive"] !== undefined) {
        mi = ret["minInclusive"];
        if (mi < lowestVal) {
          fail(`minInclusive cannot be lower than ${this.lowestVal}`);
        }
      }
      else {
        ret["minInclusive"] = lowestVal;
      }
    }
    /* tslint:enable:no-string-literal */

    return ret;
  }
}

class nonPositiveInteger extends integer {
  readonly name: string = "nonPositiveInteger";
  readonly typeErrorMsg: string = "value is not a nonPositiveInteger";
  readonly regexp: RegExp = /^\s*\+?0+|-\d+\s*$/;
  readonly highestVal: number = 0;
  readonly validParams: Parameter[] = [
    totalDigitsP, patternP, minExclusiveP, minInclusiveP, maxExclusiveP,
    maxInclusiveP,
  ];
}

class negativeInteger extends nonPositiveInteger {
  readonly name: string = "negativeInteger";
  readonly typeErrorMsg: string = "value is not a negativeInteger";
  readonly regexp: RegExp = /^\s*-\d+\s*$/;
  readonly highestVal: number = -1;
  readonly validParams: Parameter [] = [
    totalDigitsP, patternP, minExclusiveP, minInclusiveP, maxExclusiveP,
    maxInclusiveP,
  ];
}

class nonNegativeInteger extends integer {
  readonly name: string = "nonNegativeInteger";
  readonly typeErrorMsg: string = "value is not a nonNegativeInteger";
  readonly regexp: RegExp = /^\s*(\+?\d+|-0)\s*$/;
  readonly lowestVal: number = 0;
  readonly validParams: Parameter[] = [
    totalDigitsP, patternP, minExclusiveP, minInclusiveP, maxExclusiveP,
    maxInclusiveP,
  ];
}

class positiveInteger extends nonNegativeInteger {
  readonly name: string = "positiveInteger";
  readonly typeErrorMsg: string = "value is not a positiveInteger";
  readonly regexp: RegExp = /^\s*\+?\d+\s*$/;
  readonly lowestVal: number = 1;
  readonly validParams: Parameter[] = [
    totalDigitsP, patternP, minExclusiveP, minInclusiveP, maxExclusiveP,
    maxInclusiveP,
  ];
}

class long_ extends integer {
  readonly name: string = "long";
  readonly typeErrorMsg: string = "value is not a long";
  readonly highestVal: number = 9223372036854775807;
  readonly lowestVal: number = -9223372036854775808;
  readonly validParams: Parameter[] = [
    totalDigitsP, patternP, minExclusiveP, minInclusiveP, maxExclusiveP,
    maxInclusiveP,
  ];
}

class int_ extends long_ {
  readonly name: string = "int";
  readonly typeErrorMsg: string = "value is not an int";
  readonly highestVal: number = 2147483647;
  readonly lowestVal: number = -2147483648;
}

class short_ extends int_ {
  readonly name: string = "short";
  readonly typeErrorMsg: string = "value is not a short";
  readonly highestVal: number = 32767;
  readonly lowestVal: number = -32768;
}

class byte_ extends short_ {
  readonly name: string = "byte";
  readonly typeErrorMsg: string = "value is not a byte";
  readonly highestVal: number = 127;
  readonly lowestVal: number = -128;
}

class unsignedLong extends nonNegativeInteger {
  readonly name: string = "unsignedLong";
  readonly typeErrorMsg: string = "value is not an unsignedLong";
  readonly highestVal: number = 18446744073709551615;
  readonly validParams: Parameter[] = [
    totalDigitsP, patternP, minExclusiveP, minInclusiveP, maxExclusiveP,
    maxInclusiveP,
  ];
}

class unsignedInt extends unsignedLong {
  readonly name: string = "unsignedInt";
  readonly typeErrorMsg: string = "value is not an unsignedInt";
  readonly highestVal: number = 4294967295;
  readonly validParams: Parameter[] = [
    totalDigitsP, patternP, minExclusiveP, minInclusiveP, maxExclusiveP,
    maxInclusiveP,
  ];
}

class unsignedShort extends unsignedInt {
  readonly name: string = "unsignedShort";
  readonly typeErrorMsg: string = "value is not an unsignedShort";
  readonly highestVal: number = 65535;
  readonly validParams: Parameter[] = [
    totalDigitsP, patternP, minExclusiveP, minInclusiveP, maxExclusiveP,
    maxInclusiveP,
  ];
}

class unsignedByte extends unsignedShort {
  readonly name: string = "unsignedByte";
  readonly typeErrorMsg: string = "value is not an unsignedByte";
  readonly highestVal: number = 255;
  readonly validParams: Parameter[] = [
    totalDigitsP, patternP, minExclusiveP, minInclusiveP, maxExclusiveP,
    maxInclusiveP,
  ];
}

class boolean_ extends Base<boolean> {
  readonly name: string = "boolean";
  readonly typeErrorMsg: string = "not a valid boolean";
  readonly regexp: RegExp = /^\s*(1|0|true|false)\s*$/;
  readonly validParams: Parameter[] = [patternP];
  readonly needsContext: boolean = false;
  convertValue(_location: string, value: string): boolean {
    return (value === "1" || value === "true");
  }
}

const B04: string = "[AQgw]";
const B16: string = "[AEIMQUYcgkosw048]";
const B64: string  = "[A-Za-z0-9+/]";

const B64S: string  = `(?:${B64}\\s*)`;
const B16S: string  = `(?:${B16}\\s*)`;
const B04S: string  = `(?:${B04}\\s*)`;

const base64BinaryRe: RegExp = new RegExp(
  `^\\s*(?:(?:${B64S}{4})*(?:(?:${B64S}{3}${B64})|(?:${B64S}{2}${B16S}=)|(?:` +
    `${B64S}${B04S}= ?=)))?\\s*$`);

class base64Binary extends Base<string> {
  readonly name: string = "base64Binary";
  readonly typeErrorMsg: string = "not a valid base64Binary";
  readonly regexp: RegExp = base64BinaryRe;
  readonly needsContext: boolean = false;
  readonly validParams: Parameter[] =
    [lengthP, minLengthP, maxLengthP, patternP];
  convertValue(_location: string, value: string): string {
    // We don't need to actually decode it.
    return value.replace(/\s/g, "");
  }
  valueLength(value: string): number {
    // Length of the decoded value.
    return Math.floor((value.replace(/[\s=]/g, "").length * 3) / 4);
  }
}

class hexBinary extends Base<string> {
  readonly name: string = "hexBinary";
  readonly typeErrorMsg: string = "not a valid hexBinary";
  readonly regexp: RegExp = /^\s*(?:[0-9a-fA-F]{2})*\s*$/;
  readonly needsContext: boolean = false;
  readonly validParams: Parameter[] =
    [lengthP, minLengthP, maxLengthP, patternP];
  convertValue(_location: string, value: string): string {
    return value;
  }

  valueLength(value: string): number {
    // Length of the byte list.
    return value.length / 2;
  }
}

const doubleRe = new RegExp(
  `^\\s*(?:(?:[-+]?INF)|(?:NaN)|(?:${decimalPattern}\
(?:[Ee]${integerPattern})?))\\s*$`);

class float_ extends Base<number> {
  readonly name: string = "float";
  readonly typeErrorMsg: string = "not a valid float";
  readonly regexp: RegExp = doubleRe;
  readonly needsContext: boolean = false;
  readonly validParams: Parameter[] = [
    patternP, minInclusiveP, minExclusiveP, maxInclusiveP, maxExclusiveP,
  ];

  convertValue(_location: string, value: string, context?: Context): number {
    return convertToInternalNumber(value);
  }

  equal(value: string, schemaValue: ParsedValue<number>,
        context?: Context): boolean {
    let converted: number;

    try {
      // We pass an empty string as location because we do not generally keep
      // track of locations in the XML file being validated. The
      // ValueValidationError is caught and turned into a boolean below so the
      // specific location is not important here.
      converted = this.convertValue("", value, context);
    }
    catch (ex) {
      // An invalid value cannot be equal.
      if (ex instanceof ValueValidationError) {
        return false;
      }
      throw ex;
    }

    // In the IEEE 754-1985 standard, which is what XMLSChema 1.0 follows, NaN
    // is equal to NaN. In JavaScript NaN is equal to nothing, not even itself.
    // So we need to handle this difference.
    if (isNaN(converted)) {
      return isNaN(schemaValue.value);
    }

    return converted === schemaValue.value;
  }
}

class double_ extends float_ {
  readonly name: string = "double";
  readonly typeErrorMsg: string = "not a valid double";
}

class QName extends Base<string> {
  readonly name: string = "QName";
  readonly typeErrorMsg: string = "not a valid QName";
  readonly regexp: RegExp =
    new RegExp(`^\\s*(?:${xmlNcname}:)?${xmlNcname}\\s*$`);
  readonly needsContext: boolean = true;
  readonly validParams: Parameter[] =
    [patternP, lengthP, minLengthP, maxLengthP];
  convertValue(location: string, value: string, context: Context): string {
    const ret = context.resolver.resolveName(this.processWhitespace(value));
    if (ret === undefined) {
      throw new ValueValidationError(location,
        [new ValueError(`cannot resolve the name ${value}`)]);
    }

    return `{${ret.ns}}${ret.name}`;
  }
}

class NOTATION extends Base<string> {
  readonly name: string = "NOTATION";
  readonly typeErrorMsg: string = "not a valid NOTATION";
  readonly regexp: RegExp =
    new RegExp(`^\\s*(?:${xmlNcname}:)?${xmlNcname}\\s*$`);
  readonly needsContext: boolean = true;
  readonly validParams: Parameter[] =
    [patternP, lengthP, minLengthP, maxLengthP];
  convertValue(location: string, value: string, context: Context): string {
    const ret = context.resolver.resolveName(this.processWhitespace(value));
    if (ret === undefined) {
      throw new ValueValidationError(location,
        [new ValueError(`cannot resolve the name ${value}`)]);
    }

    return `{${ret.ns}}${ret.name}`;
  }
}

class duration extends CommonStringBased {
  readonly name: string = "duration";
  readonly typeErrorMsg: string = "not a valid duration";
  readonly regexp: RegExp =
    // tslint:disable-next-line:max-line-length
    /^\s*-?P(?!$)(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?!$)(?:\d+H)?(?:\d+M)?(?:\d+(\.\d+)?S)?)?\s*$/;
  readonly validParams: Parameter[] = [patternP];
  readonly needsContext: boolean = false;
}

const yearPattern: string = "-?(?:[1-9]\\d*)?\\d{4}";
const monthPattern: string  = "[01]\\d";
const domPattern: string  = "[0-3]\\d";
const timePattern: string  = "[012]\\d:[0-5]\\d:[0-5]\\d(?:\\.\\d+)?";
const tzPattern: string  = "(?:[+-][01]\\d:[0-5]\\d|Z)";
const tzRe: RegExp = new RegExp(`${tzPattern}$`);

function isLeapYear(year: number): boolean {
  return ((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0);
}

const dateGroupingRe: RegExp = new RegExp(
  `^\\s*(${yearPattern})-(${monthPattern})-(${domPattern})T(${timePattern})` +
    `(${tzPattern}?)\\s*$`);

const maxDoms: (number|undefined)[] =
  [undefined, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function checkDate(value: string): boolean {
  // The Date.parse method of JavaScript is not reliable.
  const match = value.match(dateGroupingRe);
  if (match === null) {
    return false;
  }

  const year = match[1];
  const leap = isLeapYear(Number(year));
  const month = Number(match[2]);
  if (month === 0 || month > 12) {
    return false;
  }

  const dom = Number(match[3]);
  // We cannot have an undefined value here... so...
  // tslint:disable-next-line:no-non-null-assertion
  let maxDom = maxDoms[month]!;
  if (month === 2 && !leap) {
    maxDom = 28;
  }
  if (dom === 0 || dom > maxDom) {
    return false;
  }

  const timeParts = match[4].split(":");
  const minutes = Number(timeParts[1]);
  if (minutes > 59) {
    return false;
  }

  const seconds = Number(timeParts[2]);
  if (seconds > 59) {
    return false;
  }

  // 24 is valid if minutes and seconds are at 0, otherwise 23 is the
  // limit.
  const hoursLimit = (minutes === 0 && seconds === 0) ? 24 : 23;
  if (Number(timeParts[0]) > hoursLimit) {
    return false;
  }

  if (match[5] !== undefined && match[5] !== "" && match[5] !== "Z") {
    // We have a TZ
    const tzParts = match[5].split(":");
    // Slice: skip the sign.
    const tzHours = Number(tzParts[0].slice(1));
    if (tzHours > 14) {
      return false;
    }

    const tzSeconds = Number(tzParts[1]);
    if (tzSeconds > 59) {
      return false;
    }

    if (tzHours === 14 && tzSeconds !== 0) {
      return false;
    }
  }

  return true;
}

class dateTime extends CommonStringBased {
  readonly name: string = "dateTime";
  readonly typeErrorMsg: string = "not a valid dateTime";
  readonly regexp: RegExp = new RegExp(
    `^\\s*${yearPattern}-${monthPattern}-${domPattern}` +
    `T${timePattern}${tzPattern}?\\s*$`);
  readonly needsContext: boolean = false;
  readonly validParams: Parameter[] = [patternP];
  disallows(value: string, params?: ParsedParams): ValueError[] | false {
    const ret = super.disallows(value, params);
    if (ret instanceof Array) {
      return ret;
    }

    if (!checkDate(value)) {
      return [new ValueError(this.typeErrorMsg)];
    }

    return false;
  }
}

class time extends CommonStringBased {
  readonly name: string = "time";
  readonly typeErrorMsg: string = "not a valid time";
  readonly regexp: RegExp = new RegExp(`^\\s*${timePattern}${tzPattern}?\\s*$`);
  readonly validParams: Parameter[] = [patternP];
  readonly needsContext: boolean = false;
  disallows(value: string, params?: ParsedParams): ValueError[] | false {
    const ret = super.disallows(value, params);
    if (ret) {
      return ret;
    }

    // Date does not validate times, so set the date to something fake.
    if (!checkDate(`1901-01-01T${value}`)) {
      return [new ValueError(this.typeErrorMsg)];
    }

    return false;
  }
}

class date extends CommonStringBased {
  readonly name: string = "date";
  readonly typeErrorMsg: string = "not a valid date";
  readonly regexp: RegExp = new RegExp(
    `^\\s*${yearPattern}-${monthPattern}-${domPattern}${tzPattern}?\\s*$`);
  readonly needsContext: boolean = false;
  readonly validParams: Parameter[] = [patternP];
  disallows(value: string, params?: ParsedParams): ValueError[] | false {
    const ret = super.disallows(value, params);
    if (ret) {
      return ret;
    }

    // We have to add time for Date() to parse it.
    const match = value.match(tzRe);
    const withTime = match !== null ?
      `${value.slice(0, match.index)}T00:00:00${match[0]}` :
      `${value}T00:00:00`;
    if (!checkDate(withTime)) {
      return [new ValueError(this.typeErrorMsg)];
    }

    return false;
  }
}

class gYearMonth extends CommonStringBased {
  readonly name: string = "gYearMonth";
  readonly typeErrorMsg: string = "not a valid gYearMonth";
  readonly regexp: RegExp = new RegExp(
    `^\\s*${yearPattern}-${monthPattern}${tzPattern}?\\s*$`);
  readonly validParams: Parameter[] = [patternP];
  readonly needsContext: boolean = false;
  disallows(value: string, params?: ParsedParams): ValueError[] | false {
    const ret = super.disallows(value, params);
    if (ret) {
      return ret;
    }

    // We have to add a day and time for Date() to parse it.
    const match = value.match(tzRe);
    const withTime = match !== null ?
      `${value.slice(0, match.index)}-01T00:00:00${match[0]}` :
      `${value}-01T00:00:00`;
    if (!checkDate(withTime)) {
      return [new ValueError(this.typeErrorMsg)];
    }

    return false;
  }
}

class gYear extends CommonStringBased {
  readonly name: string = "gYear";
  readonly typeErrorMsg: string = "not a valid gYear";
  readonly regexp: RegExp = new RegExp(`^\\s*${yearPattern}${tzPattern}?\\s*$`);
  readonly needsContext: boolean = false;
  readonly validParams: Parameter[] = [patternP];
  disallows(value: string, params?: ParsedParams): ValueError[] | false {
    const ret = super.disallows(value, params);
    if (ret) {
      return ret;
    }

    // We have to add a month, a day and a time for Date() to parse it.
    const match = value.match(tzRe);
    const withTime = match !== null ?
      `${value.slice(0, match.index)}-01-01T00:00:00${match[0]}` :
      `${value}-01-01T00:00:00`;
    if (!checkDate(withTime)) {
      return [new ValueError(this.typeErrorMsg)];
    }

    return false;
  }
}

class gMonthDay extends CommonStringBased {
  readonly name: string = "gMonthDay";
  readonly typeErrorMsg: string = "not a valid gMonthDay";
  readonly regexp: RegExp = new RegExp(
    `^\\s*${monthPattern}-${domPattern}${tzPattern}?\\s*$`);
  readonly needsContext: boolean = false;
  readonly validParams: Parameter[] = [patternP];
  disallows(value: string, params?: ParsedParams): ValueError[] | false {
    const ret = super.disallows(value, params);
    if (ret) {
      return ret;
    }

    // We have to add a year and a time for Date() to parse it.
    const match = value.match(tzRe);
    const withTime = match !== null ?
      `${value.slice(0, match.index)}T00:00:00${match[0]}` :
      `${value}T00:00:00`;
    // We always add 2000, which is a leap year, so 01-29 won't raise an
    // error.
    if (!checkDate(`2000-${withTime}`)) {
      return [new ValueError(this.typeErrorMsg)];
    }

    return false;
  }
}

class gDay extends CommonStringBased {
  readonly name: string = "gDay";
  readonly typeErrorMsg: string = "not a valid gDay";
  readonly regexp: RegExp = new RegExp(`^\\s*${domPattern}${tzPattern}?\\s*$`);
  readonly needsContext: boolean = false;
  readonly validParams: Parameter[] = [patternP];
  disallows(value: string, params?: ParsedParams): ValueError[] | false {
    const ret = super.disallows(value, params);
    if (ret) {
      return ret;
    }

    // We have to add a year and a time for Date() to parse it.
    const match = value.match(tzRe);
    const withTime = match !== null ?
      `${value.slice(0, match.index)}T00:00:00${match[0]}` :
      `${value}T00:00:00`;
    // We always add 2000, which is a leap year, so 01-29 won't raise an
    // error.
    if (!checkDate(`2000-01-${withTime}`)) {
      return [new ValueError(this.typeErrorMsg)];
    }

    return false;
  }
}

class gMonth extends CommonStringBased {
  readonly name: string = "gMonth";
  readonly typeErrorMsg: string = "not a valid gMonth";
  readonly regexp: RegExp =
    new RegExp(`^\\s*${monthPattern}${tzPattern}?\\s*$`);
  readonly needsContext: boolean = false;
  readonly validParams: Parameter[] = [patternP];
  disallows(value: string, params?: ParsedParams): ValueError[] | false {
    const ret = super.disallows(value, params);
    if (ret) {
      return ret;
    }

    // We have to add a year and a time for Date() to parse it.
    const match = value.match(tzRe);
    const withTime = match !== null ?
      `${value.slice(0, match.index)}-01T00:00:00${match[0]}` :
      `${value}-01T00:00:00`;
    // We always add 2000, which is a leap year, so 01-29 won't raise an
    // error.
    if (!checkDate(`2000-${withTime}`)) {
      return [new ValueError(this.typeErrorMsg)];
    }

    return false;
  }
}

//
// See
// https://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/datatypes.html#anyURI
//
// Though the specification referred above above does not require any syntactic
// checks, in practice Jing reports errors on malformed URIs. We follow Jing's
// lead.
//

// Generated from http://jmrware.com/articles/2009/uri_regexp/URI_regex.html
// tslint:disable-next-line:max-line-length
const reJsRfc3986UriReference = /^\s*(?:[A-Za-z][A-Za-z0-9+\-.]*:(?:\/\/(?:(?:[A-Za-z0-9\-._~!$&'()*+,;=:]|%[0-9A-Fa-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9A-Fa-f]{1,4}:){6}|::(?:[0-9A-Fa-f]{1,4}:){5}|(?:[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){4}|(?:(?:[0-9A-Fa-f]{1,4}:){0,1}[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){3}|(?:(?:[0-9A-Fa-f]{1,4}:){0,2}[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){2}|(?:(?:[0-9A-Fa-f]{1,4}:){0,3}[0-9A-Fa-f]{1,4})?::[0-9A-Fa-f]{1,4}:|(?:(?:[0-9A-Fa-f]{1,4}:){0,4}[0-9A-Fa-f]{1,4})?::)(?:[0-9A-Fa-f]{1,4}:[0-9A-Fa-f]{1,4}|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))|(?:(?:[0-9A-Fa-f]{1,4}:){0,5}[0-9A-Fa-f]{1,4})?::[0-9A-Fa-f]{1,4}|(?:(?:[0-9A-Fa-f]{1,4}:){0,6}[0-9A-Fa-f]{1,4})?::)|[Vv][0-9A-Fa-f]+\.[A-Za-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?:[A-Za-z0-9\-._~!$&'()*+,;=]|%[0-9A-Fa-f]{2})*)(?::[0-9]*)?(?:\/(?:[A-Za-z0-9\-._~!$&'()*+,;=:@]|%[0-9A-Fa-f]{2})*)*|\/(?:(?:[A-Za-z0-9\-._~!$&'()*+,;=:@]|%[0-9A-Fa-f]{2})+(?:\/(?:[A-Za-z0-9\-._~!$&'()*+,;=:@]|%[0-9A-Fa-f]{2})*)*)?|(?:[A-Za-z0-9\-._~!$&'()*+,;=:@]|%[0-9A-Fa-f]{2})+(?:\/(?:[A-Za-z0-9\-._~!$&'()*+,;=:@]|%[0-9A-Fa-f]{2})*)*|)(?:\?(?:[A-Za-z0-9\-._~!$&'()*+,;=:@\/?]|%[0-9A-Fa-f]{2})*)?(?:\#(?:[A-Za-z0-9\-._~!$&'()*+,;=:@\/?]|%[0-9A-Fa-f]{2})*)?|(?:\/\/(?:(?:[A-Za-z0-9\-._~!$&'()*+,;=:]|%[0-9A-Fa-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9A-Fa-f]{1,4}:){6}|::(?:[0-9A-Fa-f]{1,4}:){5}|(?:[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){4}|(?:(?:[0-9A-Fa-f]{1,4}:){0,1}[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){3}|(?:(?:[0-9A-Fa-f]{1,4}:){0,2}[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){2}|(?:(?:[0-9A-Fa-f]{1,4}:){0,3}[0-9A-Fa-f]{1,4})?::[0-9A-Fa-f]{1,4}:|(?:(?:[0-9A-Fa-f]{1,4}:){0,4}[0-9A-Fa-f]{1,4})?::)(?:[0-9A-Fa-f]{1,4}:[0-9A-Fa-f]{1,4}|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))|(?:(?:[0-9A-Fa-f]{1,4}:){0,5}[0-9A-Fa-f]{1,4})?::[0-9A-Fa-f]{1,4}|(?:(?:[0-9A-Fa-f]{1,4}:){0,6}[0-9A-Fa-f]{1,4})?::)|[Vv][0-9A-Fa-f]+\.[A-Za-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?:[A-Za-z0-9\-._~!$&'()*+,;=]|%[0-9A-Fa-f]{2})*)(?::[0-9]*)?(?:\/(?:[A-Za-z0-9\-._~!$&'()*+,;=:@]|%[0-9A-Fa-f]{2})*)*|\/(?:(?:[A-Za-z0-9\-._~!$&'()*+,;=:@]|%[0-9A-Fa-f]{2})+(?:\/(?:[A-Za-z0-9\-._~!$&'()*+,;=:@]|%[0-9A-Fa-f]{2})*)*)?|(?:[A-Za-z0-9\-._~!$&'()*+,;=@]|%[0-9A-Fa-f]{2})+(?:\/(?:[A-Za-z0-9\-._~!$&'()*+,;=:@]|%[0-9A-Fa-f]{2})*)*|)(?:\?(?:[A-Za-z0-9\-._~!$&'()*+,;=:@\/?]|%[0-9A-Fa-f]{2})*)?(?:\#(?:[A-Za-z0-9\-._~!$&'()*+,;=:@\/?]|%[0-9A-Fa-f]{2})*)?)\s*$/;

class anyURI extends CommonStringBased {
  readonly name: string = "anyURI";
  readonly typeErrorMsg: string = "not a valid anyURI";
  readonly regexp: RegExp = reJsRfc3986UriReference;
  readonly needsContext: boolean = false;
  readonly validParams: Parameter[] =
    [patternP, lengthP, minLengthP, maxLengthP];
}

const types: any[] = [
  string_,
  normalizedString,
  token,
  language,
  Name,
  NCName,
  NMTOKEN,
  NMTOKENS,
  ID,
  IDREF,
  IDREFS,
  ENTITY,
  ENTITIES,
  decimal,
  integer,
  nonPositiveInteger,
  negativeInteger,
  nonNegativeInteger,
  positiveInteger,
  long_,
  int_,
  short_,
  byte_,
  unsignedLong,
  unsignedInt,
  unsignedShort,
  unsignedByte,
  boolean_,
  base64Binary,
  hexBinary,
  float_,
  double_,
  QName,
  NOTATION,
  duration,
  dateTime,
  time,
  date,
  gYearMonth,
  gYear,
  gMonthDay,
  gDay,
  gMonth,
  anyURI,
];

const library: TypeLibrary = {
  // tslint:disable-next-line: no-http-string
  uri: "http://www.w3.org/2001/XMLSchema-datatypes",
  types: {},
};

for (const type of types) {
  const instance = new type();
  library.types[instance.name] = instance;
}

/**
 * The XML Schema datatype library.
 */
export const xmlschema: TypeLibrary = library;

//  LocalWords:  XMLSchema datatypes MPL whitespace param minLength maxLength
//  LocalWords:  RNG rng failedOn totalDigits fractionDigits ValueError repr zA
//  LocalWords:  ParamError maxInclusive maxExclusive NaN minInclusive params
//  LocalWords:  minExclusive whitespaces parseParams unparsed XMLSChema NCName
//  LocalWords:  normalizedString xmlNameChar NMTOKEN NMTOKENS IDREF xmlNcname
//  LocalWords:  IDREFS decimalPattern integerPattern highestVal lowestVal AQgw
//  LocalWords:  nonPositiveInteger negativeInteger nonNegativeInteger Za fA Ee
//  LocalWords:  positiveInteger unsignedLong unsignedInt unsignedShort QName
//  LocalWords:  unsignedByte AEIMQUYcgkosw hexBinary tzPattern yearPattern TZ
//  LocalWords:  monthPattern domPattern timePattern dateTime gYearMonth gYear
//  LocalWords:  gMonthDay gDay gMonth anyURI withTime
