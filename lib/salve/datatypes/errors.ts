/**
 * Errors that can be raised during parsing of types.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { fixPrototype } from "../tools";

/**
 * Records an error due to an incorrect parameter (``<param>``) value. This is
 * an error in the **schema** used to validate a document. Note that these
 * errors are *returned* by salve's internal code. They are not *thrown*.
 */
export class ParamError {
  /**
   *
   * @param message The actual error description.
   */
  constructor(readonly message: string) {
  }

  toString(): string {
    return this.message;
  }
}

/**
 * Records an error due to an incorrect value (``<value>``).  This is an error
 * in the **schema** used to validate a document. Note that these errors are
 * *returned* by salve's internal code. They are not *thrown*.
 */
export class ValueError {
  /**
   * @param message The actual error description.
   */
  constructor(readonly message: string) {
  }

  toString(): string {
    return this.message;
  }
}

/**
 * Records the failure of parsing a parameter (``<param>``) value. Whereas
 * [[ParamError]] records each individual issue with a parameter's parsing, this
 * object is used to throw a single failure that collects all the individual
 * issues that were encountered.
 */
export class ParameterParsingError extends Error {
  readonly name: string;
  readonly stack: string | undefined;
  readonly message: string;

  /**
   *
   * @param location The location of the ``<param>`` in the schema.
   *
   * @param errors The errors encountered.
   */
  constructor(location: string, readonly errors: ParamError[]) {
    super();

    // This is crap to work around the fact that Error is a terribly badly
    // designed class or prototype or whatever. Unfortunately the stack trace is
    // off...
    const msg: string =
      `${location}: ${errors.map((x: ParamError) => x.toString()).join("\n")}`;
    const err: Error = new Error(msg);
    this.name = "ParameterParsingError";
    this.stack = err.stack;
    this.message = err.message;
    fixPrototype(this, ParameterParsingError);
  }
}

/**
 * Records the failure of parsing a value (``<value>``). Whereas [[ValueError]]
 * records each individual issue with a value's parsing, this object is used to
 * throw a single failure that collects all the individual issues that were
 * encountered.
 */
export class ValueValidationError extends Error {
  readonly name: string;
  readonly stack: string | undefined;
  readonly message: string;

  /**
   * @param errors The errors encountered.
   */
  constructor(readonly errors: ValueError[]) {
    super();
    // This is crap to work around the fact that Error is a terribly badly
    // designed class or prototype or whatever. Unfortunately the stack trace is
    // off...
    const msg: string = errors.map((x: ValueError) => x.toString()).join("\n");
    const err: Error = new Error(msg);
    this.name = "ValueValidationError";
    this.stack = err.stack;
    this.message = err.message;
    fixPrototype(this, ValueValidationError);
  }
}
