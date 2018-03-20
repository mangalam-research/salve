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
import { makeResourceLoader } from "./resource-loader";
import { InternalSimplifier } from "./schema-simplifiers/internal";

export interface ConversionResult {
  pattern: Grammar;

  warnings: string[];
}

/**
 * Validate, simplify and convert a schema to a pattern, which can then be used
 * to validate an XML document. This function uses the internal simplification
 * and validation code.
 *
 * @param schemaPath The schema's location. The schema must be in the XML Relax
 * NG format. (Not the compact notation.)
 *
 * @returns The converted pattern.
 */
export async function convertRNGToPattern(schemaPath: URL):
Promise<ConversionResult> {
  const resourceLoader = makeResourceLoader();

  const simplifier = new InternalSimplifier({
    verbose: false,
    timing: false,
    keepTemp: false,
    simplifyTo: Infinity,
    resourceLoader: resourceLoader,
    validate: true,
  });

  const result = await simplifier.simplify(schemaPath);

  return {
    pattern: makePatternFromSimplifiedSchema(result.simplified),
    warnings: result.warnings,
  };
}
