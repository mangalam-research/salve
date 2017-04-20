/**
 * Validation errors.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { Base } from "./name_patterns";

/**
 * The fireEvent methods return an array of objects of this class to
 * notify the caller of errors in the file being validated.
 */
export class ValidationError {
  /**
   *
   * @param msg The error message.
   */
  constructor(readonly msg: string) {
    // May be useful for debugging:
    // this.stack_trace = new Error().stack;
  }

  /**
   * @returns The text representation of the error.
   */
  toString(): string {
    return this.msg;
  }

  /**
   * This method provides the caller with the list of all names that are used in
   * the error message.
   *
   * @returns The list of names used in the error message.
   */
  getNames(): Base[] {
    return [];
  }

  /**
   * This method transforms the ValidationError object to a string but uses the
   * names in the parameter passed to it to format the string.
   *
   * Since salve does not work with namespace prefixes, someone using salve
   * would typically use this method so as to replace the name patterns passed
   * in error messages with qualified names.
   *
   * @param names The array of names to use. This should be an array of the same
   * length as that returned by [[getNames]] . Each element of the array
   * corresponds to each name in [[getNames]] and should be something that can
   * be converted to a meanigful string.
   *
   * @returns The object formatted as a string.
   */
  toStringWithNames(names: any[]): string {
    // We do not have names in ValidationError
    return this.msg;
  }
}

/**
 * This class serves as a base for all those errors that have only
 * one name involved.
 */
export class SingleNameError extends ValidationError {
  /**
   * @param msg The error message.
   *
   * @param name The name of the XML entity at stake.
   */
  constructor(msg: string, readonly name: Base) {
    super(msg);
  }

  toString(): string {
    return this.toStringWithNames([this.name]);
  }

  getNames(): Base[] {
    return [this.name];
  }

  toStringWithNames(names: any[]): string {
    return `${this.msg}: ${names[0]}`;
  }
}

/**
 * Error returned when an attribute name is invalid.
 */
export class AttributeNameError extends SingleNameError {
}

/**
 * Error returned when an attribute value is invalid.
 */
export class AttributeValueError extends SingleNameError {
}

/**
 * Error returned when an element is invalid.
 */
export class ElementNameError extends SingleNameError {
}

/**
 * Error returned when choice was not satisfied.
 */
export class ChoiceError extends ValidationError {
  /**
   * @param namesA The names of the first XML entities at stake.
   *
   * @param namesB The names of the second XML entities at stake.
   */
  constructor(readonly namesA: Base[], readonly namesB: Base[]) {
    super("");
  }

  toString(): string {
    return this.toStringWithNames(this.namesA.concat(this.namesB));
  }

  getNames(): Base[] {
    return this.namesA.concat(this.namesB);
  }

  toStringWithNames(names: any[]): string {
    const first: any[] = names.slice(0, this.namesA.length);
    const second: any[] = names.slice(this.namesA.length);
    return `must choose either ${first.join(", ")} or ${second.join(", ")}`;
  }
}
