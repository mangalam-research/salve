/**
 * Facilities for simplifying a schema.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Element } from "./parser";
import { ResourceLoader } from "./resource-loader";

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
   * simplifier that does not validate.
   */
  validate: boolean;

  /**
   * Create a manifest while simplifying. It is an error to set this true for a
   * simplifier that does not support manifests.
   */
  createManifest: boolean;

  /**
   * Name of the algorithm to use for creating the hashes in the manifest. The
   * supported names are those of the [``SubtleCrypto.digest()``][1] function.
   *
   * [1]: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
   *
   * Security note: It is up to you to decide what strength hash you need. **The
   * manifest is not designed for the sake of providing security.** So its
   * hashes are not designed to detect willful tampering but rather to quickly
   * determine whether a schema was edited. In the vast majority of real world
   * usage scenarios, using a stronger hash would not provide better security
   * because if an attacker can replace a schema with their own file, they also
   * can access the manifest and replace the hash.
   */
  manifestHashAlgorithm: string;
}

/**
 * An entry in a manifest of files read during simplification.
 */
export interface ManifestEntry {
  /** The path of the file. */
  filePath: string;

  /**
   * The hash of the file. Hashes are stored in the following format:
   *
   * ``<algorithm name>-<hex hash value>``
   *
   * So if you used ``"SHA-1"``, the hash would look like
   * ``"SHA-1-deadbeef[...]"``.
   */
  hash: string;
}

export interface SimplificationResult {
  /** The top-level element of the simplified tree. */
  simplified: Element;

  /** Warnings that may have come up during simplification. */
  warnings: string[];

  /**
   * A manifest of the files read and their associated checksums. Some
   * simplifiers do not support producing manifests and will have an array. O
   * Otherwise, all files are in the array, including the initial schema file.
   */
  manifest: ManifestEntry[];
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
  simplify(schemaPath: URL): Promise<SimplificationResult>;
}

export interface SchemaSimplifierCtor {
  /** True if this simplifier validates the schema as it simplifies. */
  validates: boolean;

  /** True if this simplifier can create a file manifest. */
  createsManifest: boolean;

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
