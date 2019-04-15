/**
 * A schema validator that spawns jing to validate the schema.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { spawn } from "child_process";

import { registerValidator, SchemaValidationError, SchemaValidationResult,
         SchemaValidator, SchemaValidatorOptions } from "../schema-validation";

export class JingValidator implements SchemaValidator {
  constructor(readonly options: SchemaValidatorOptions) {}

  async validate(schemaURL: URL): Promise<SchemaValidationResult> {
    let schemaPath = schemaURL.toString();
    if (schemaURL.protocol === "file:") {
      schemaPath = schemaPath.replace(/^file:\/\//, "");
    }
    else {
      throw new Error("URLs must use the file: protocol");
    }

    let err = await new Promise<string>(resolve => {
      // This is a bit of a hack. We want to make sure that the schema is a
      // valid RNG schema as per RNG specs. Running validation on our schema
      // with a schema that defines a valid schema structure does not trap
      // import errors or errors that are not expressible in a schema
      // language. So we run jing with our schema as the schema to use for
      // validation and /dev/null as the document to validate. This does catch
      // errors but there is no clean way to get jing to output only schema
      // errors, hence what we have here.
      const child = spawn("jing", [schemaPath, "/dev/null"],
                          { stdio: ["ignore", "pipe", "ignore"] });

      let buffer = "";
      child.stdout.on("data", data => {
        buffer += data;
      });

      child.on("close", () => {
        resolve(buffer);
      });
    });

    // Remove everything that has to do with /dev/null to avoid confusing the
    // user.
    err = err.replace(/\/dev\/null(.|[\r\n])*/, "");
    // Earlier versions would output this error instead of the above.
    err = err.replace(/fatal: Premature end of file\.\s*/, "");
    if (this.options.verbose) {
      process.stderr.write(err);
    }

    // Search for an actual schema error.
    if (err.length !== 0) {
      let msg = "error in schema";
      if (!this.options.verbose) {
        msg += "; run with --verbose to see what the problem was";
      }

      throw new SchemaValidationError(msg);
    }

    return {};
  }
}

registerValidator("jing", JingValidator);
