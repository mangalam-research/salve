/**
 * Facilities for simplifying a schema.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Element } from "./parser";
import { ResourceLoader } from "./resource-loader";
import { autoload } from "./schema-simplifiers/autoload";

export interface SchemaSimplifierOptions {
  /** True if the simplification should run verbosely. */
  verbose: boolean;

  /** True if timing information should be provided (implies verbose). */
  timing: boolean;

  /** True if temporary files should be preserved. */
  keepTemp: boolean;

  /** The step at which to stop simplification. */
  simplifyTo: number;

  /** The resource loader to use if resources are needed. */
  resourceLoader: ResourceLoader;

  /** A function that creates a temporary directory and returns the path. */
  ensureTempDir?(): string;

  /**
   * Validate while simplifying. It is an error to set this true for a
   * validator that does not validate.
   */
  validate: boolean;
}

/** The interface that all simplifiers must follow. */
export interface SchemaSimplifier {
  /**
   * Simplify the schema at tree.
   *
   * @param schemaPath The path of the file to simplify. See [[ResourceLoader]]
   * regarding limitations.
   *
   * @returns The result of simplification.
   */
  simplify(schemaPath: URL): Promise<Element | string>;
}

export interface SchemaSimplifierCtor {
  /** True if this simplifier validates the schema as it simplifies. */
  validates: boolean;

  new (options: SchemaSimplifierOptions): SchemaSimplifier;
}

const availableSimplifiers: Record<string, SchemaSimplifierCtor> =
  Object.create(null);

export function getAvailableSimplifiers(): string [] {
  return Object.keys(availableSimplifiers);
}

export function isAvailable(name: string): boolean {
  return availableSimplifiers[name] !== undefined;
}

export function registerSimplifier(name: string,
                                   ctor: SchemaSimplifierCtor): void {
  availableSimplifiers[name] = ctor;
}

export function makeSimplifier(name: string,
                               options: SchemaSimplifierOptions):
SchemaSimplifier {
  const ctor = availableSimplifiers[name];
  if (ctor === undefined) {
    throw new Error(`unknown simplifier name: ${name}`);
  }

  return new ctor(options);
}

autoload();
