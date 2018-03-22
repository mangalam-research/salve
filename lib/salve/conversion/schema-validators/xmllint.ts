/**
 * A schema validator that spawns xmllint to validate the schema.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { spawn } from "child_process";

import { registerValidator, SchemaValidationError, SchemaValidationResult,
         SchemaValidator, SchemaValidatorOptions } from "../schema-validation";

export class XMLLintValidator implements SchemaValidator {
  constructor(readonly options: SchemaValidatorOptions) {}

  async validate(schemaURL: URL): Promise<SchemaValidationResult> {
    let schemaPath = schemaURL.toString();
    if (schemaURL.protocol === "file:") {
      schemaPath = schemaPath.replace(/^file:\/\//, "");
    }
    else {
      throw new Error("URLs must use the file: protocol");
    }

    const err = await new Promise<string>((resolve) => {
      const child = spawn("xmllint", ["--relaxng", schemaPath, "/dev/null"],
                          { stdio: ["ignore", "ignore", "pipe"] });

      let buffer = "";
      child.stderr.on("data", (data) => {
        buffer += data;
      });

      child.on("close", () => {
        resolve(buffer);
      });
    });

    // Search for an actual schema error.
    if (err.search(/Relax-NG parser error/) !== -1) {
      let msg = "error in schema";
      if (!this.options.verbose) {
        msg += "; run with --verbose to see what the problem was";
      }
      else {
        process.stderr.write(err);
      }

      throw new SchemaValidationError(msg);
    }

    return {};
  }
}

registerValidator("xmllint", XMLLintValidator);
