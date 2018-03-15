/**
 * Definition of the types that form a type library.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 * @private
 */

import { NameResolver } from "../name_resolver";
import { ValueError } from "./errors";

/**
 * A "raw" parameter taken straight from the Relax NG.
 */
export type RawParameter = {
  /**
   * The parameter's name.
   */
  name: string;
  /**
   * It's value.
   */
  value: string;
};

/**
 * A context as defined by the Relax NG specification, minus the base URI.  (Why
 * no base URI? Because none of the types implemented by salve require it. So
 * there is no point in keeping track of it.
 */
export interface Context {
  /**
   * A name resolver that can resolve namespace prefixes to namespace URI.
   */
  resolver: NameResolver;
}

/**
 * A schema data type.
 */
export interface Datatype {
  /**
   * The name of this type.
   */
  readonly name: string;

  /**
   * ``true`` if this builtin type needs a context, ``false`` if not.
   */
  readonly needsContext: boolean;

  /**
   * A JavaScript regular expression which can be used to partially validate a
   * value. This regular expression is such that if it does *not* match a value,
   * then the value is invalid. If it does match the value, then [[disallows]]
   * must be called to determine whether the value is actually allowed or not.
   */
  readonly regexp: RegExp;

  /**
   * Parses the parameters. It can be called without any parameters for the
   * purpose of computing the default parameters of a datatype.
   *
   * @param location A string indicating the location of the ``<data>``
   * element for which we are parsing parameters.
   *
   * @param params The parameters.
   *
   * @returns The parsed parameters, to be used with the other methods on this
   * class. Data types are free to change the format of this object at any time.
   *
   * @throws {"datatypes".ParameterParsingError} If the parameters are
   * erroneous.
   */
  parseParams(location: string, params?: RawParameter[]): any;

  /**
   * Parses a value. Checks that the value is allowed by the type and converts
   * it to an internal representation.
   *
   * @param location: A string indicating the location of the ``<value>``
   * element for which we are parsing a value.
   *
   * @param value The value to parse.
   *
   * @param context The context of the value.
   *
   * @returns The parsed value, to be used with the other methods on this
   * class. Data types are free to change the format of this object at any time.
   *
   * @throws {"datatypes".ValueValidationError} If the value is
   * erroneous.
   */
  parseValue(location: string, value: string, context?: Context): any;

  /**
   * Checks whether two strings are equal according to the type.
   *
   * @param value The string from the XML document to be validated.
   *
   * @param schemaValue The **parsed** value from the schema.
   *
   * @param context The context in the document, if needed.
   *
   * @returns ``true`` if equal, ``false`` if not.
   */
  equal(value: string, schemaValue: any, context?: Context): boolean;

  /**
   * Checks whether the type disallows a certain string.
   *
   * @param value The string from the XML document to be validated.
   *
   * @param params The type parameters. These must be **parsed** already.
   *
   * @param context The context in the document, if needed.
   *
   * @returns ``false`` if not disallowed. Otherwise, the errors caused by the
   * value.
   */
  disallows(value: string, params?: any,
            context?: Context): ValueError[] | false;
}

export interface TypeLibrary {
  /**
   * The URI associated with this library.
   */
  readonly uri: string;

  /**
   * A mapping of name to type covering all the types in this library.
   */
  readonly types: { [name: string]: Datatype };
}

//  LocalWords:  MPL NG
