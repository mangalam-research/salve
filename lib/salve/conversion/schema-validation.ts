/**
 * Facilities for validating a schema before conversion.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Element } from "./parser";
import { ResourceLoader } from "./resource-loader";
import { SchemaSimplifierOptions } from "./schema-simplification";

import { fixPrototype } from "../tools";

/** Results of a schema validation. */
export interface SchemaValidationResult {
  /**
   * A simplified version of the schema. Some validators perform simplification
   * *as part* of validating the schema, and may provide the simplified schema
   * as a result of validation.
   */
  simplified?: Element;

  warnings?: string[];
}

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super();

    const err: Error = new Error(message);
    this.name = "SchemaValidationError";
    this.stack = err.stack;
    this.message = err.message;
    fixPrototype(this, SchemaValidationError);
  }
}

export interface SchemaValidatorOptions {
  /** True if the validator should run verbosely. */
  verbose: boolean;

  /** The resource loader to use if resources are needed. */
  resourceLoader: ResourceLoader;
}

export interface SimplifyingSchemaValidatorOptions
extends SchemaValidatorOptions, SchemaSimplifierOptions {}

/** The interface that all validators must follow. */
export interface SchemaValidator {
  /**
   * Validate the schema located at ``path``.
   *
   * @param schemaPath The path of the file to simplify. See [[ResourceLoader]]
   * regarding limitations.
   *
   * @returns The result of validation. The promise resolving at all indicates
   * that the schema is valid. A failure is reported through a rejection.
   */
  validate(schemaPath: URL): Promise<SchemaValidationResult>;
}

export type SchemaValidatorCtor =
  new (options: SimplifyingSchemaValidatorOptions) => SchemaValidator;

const availableValidators: Record<string, SchemaValidatorCtor> =
  Object.create(null);

export function getAvailableValidators(): string [] {
  return Object.keys(availableValidators);
}

export function isValidatorAvailable(name: string): boolean {
  return availableValidators[name] !== undefined;
}

export function registerValidator(name: string,
                                  ctor: SchemaValidatorCtor): void {
  availableValidators[name] = ctor;
}

export function makeValidator(name: string,
                              options: SimplifyingSchemaValidatorOptions):
SchemaValidator {
  const ctor = availableValidators[name];
  if (ctor === undefined) {
    throw new Error(`unknown validator name: ${name}`);
  }

  return new ctor(options);
}
