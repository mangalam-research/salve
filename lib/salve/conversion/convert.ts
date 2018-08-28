/**
 * This module contains the logic for programmatically validating and
 * simplifiying a schema.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Grammar } from "../patterns";
import { makePatternFromSimplifiedSchema } from "./convert-simplified";
import { Element } from "./parser";
import { makeResourceLoader, ResourceLoader } from "./resource-loader";
import { HashFunction, ManifestEntry } from "./schema-simplification";
import { InternalSimplifier } from "./schema-simplifiers/internal";

export interface ConversionResult {
  /** The schema converted to a Grammar pattern. */
  pattern: Grammar;

  /** The simplified schema as a tree of XML elements. */
  simplified: Element;

  /** Any warning encountered during conversion. */
  warnings: string[];

  /** The file manifest. Only populated if its creation was requested. */
  manifest: ManifestEntry[];
}

export interface ConversionOptions<
  RL extends (ResourceLoader | undefined) = ResourceLoader> {
  /**
   * Whether to create a manifest. This is optional because not all use-case
   * scenarios require the creation of a manifest, but the price for creating
   * one is non-negligible.
   */
  createManifest: boolean;

  /**
   * Either a hash function or the name of an algorithm to use for hashing the
   * source.
   *
   * If a string, then the string is the name of the algorithm to use for
   * creating the hashes in the manifest. The supported names are those of the
   * [``SubtleCrypto.digest()``][1] function.
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
  manifestHashAlgorithm: string | HashFunction;

  /**
   * The resource loader to use to load resources. This is what the conversion
   * algorithm will use to load the schema and any file the schema includes.
   */
  resourceLoader: RL;
}

const DEFAULT_OPTIONS: ConversionOptions<undefined> = {
  createManifest: false,
  manifestHashAlgorithm: "SHA-1",
  resourceLoader: undefined,
};

/**
 * Validate, simplify and convert a schema to a pattern, which can then be used
 * to validate an XML document. This function uses the internal simplification
 * and validation code.
 *
 * @param schemaPath The schema's location. The schema must be in the XML Relax
 * NG format. (Not the compact notation.)
 *
 * @param options The options driving the conversion.
 *
 * @returns The converted pattern.
 */
export async function convertRNGToPattern<RL extends ResourceLoader>(
  schemaPath: URL,
  options: ConversionOptions<RL | undefined> = DEFAULT_OPTIONS):
Promise<ConversionResult> {
  const resourceLoader = options.resourceLoader !== undefined ?
    options.resourceLoader : makeResourceLoader();

  const simplifier = new InternalSimplifier({
    verbose: false,
    timing: false,
    keepTemp: false,
    simplifyTo: Infinity,
    resourceLoader: resourceLoader,
    validate: true,
    createManifest: options.createManifest,
    manifestHashAlgorithm: options.manifestHashAlgorithm,
  });

  const { simplified, warnings, manifest } =
    await simplifier.simplify(schemaPath);

  return {
    pattern: makePatternFromSimplifiedSchema(simplified),
    simplified,
    warnings,
    manifest,
  };
}
