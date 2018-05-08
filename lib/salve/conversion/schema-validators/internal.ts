/**
 * A schema validator that uses salve to validate the schema.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { InternalSimplifier } from "../schema-simplifiers/internal";
import { registerValidator, SchemaValidationResult, SchemaValidator,
         SimplifyingSchemaValidatorOptions } from "../schema-validation";

export class InternalValidator implements SchemaValidator {
  constructor(readonly options: SimplifyingSchemaValidatorOptions) {}

  async validate(schemaPath: URL): Promise<SchemaValidationResult> {
    const simplifier = new InternalSimplifier({
      ...this.options,
      validate: true,
    });

    return simplifier.simplify(schemaPath);
  }
}

registerValidator("internal", InternalValidator);
