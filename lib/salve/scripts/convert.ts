/**
 * Conversion cli tool.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { ArgumentParser } from "argparse";
import { spawn } from "child_process";
import * as fs from "fs";
import * as nodeFetch from "node-fetch";
import * as path from "path";
import requireDir from "require-dir";
import * as sax from "sax";
import * as temp from "temp";
import { URL } from "url";
import * as util from "util";

import fileUrl from "file-url";

(global as any).fetch = nodeFetch;
(global as any).URL = URL;

// We load individual modules rather than the build module because the
// conversion code uses parts of salve that are not public.
import { ConversionParser, Element, getAvailableSimplifiers,
         getAvailableValidators, makeResourceLoader, makeSimplifier,
         makeValidator, SchemaValidationError, serialize,
         SimplificationResult } from "../conversion";
import { ParameterParsingError, ValueValidationError } from "../datatypes";
import { renameRefsDefines, writeTreeToJSON } from "../json-format/write";
import { version } from "../validate";
import { Fatal } from "./convert/fatal";

// tslint:disable:no-console no-non-null-assertion radix

temp.track();

const prog = path.basename(process.argv[1]);
const stderr = process.stderr;

requireDir("../conversion/schema-simplifiers");
requireDir("../conversion/schema-validators");

//
// Safety harness
//

let args: any;
let terminating = false;
function terminate(ex: any): void {
  // We don't want to handle exceptions that happen while we're terminating.
  if (terminating) {
    if (ex) {
      process.stderr.write(`${prog}: got error while terminating\n`);
      process.stderr.write(util.inspect(ex));
    }

    return;
  }

  terminating = true;
  if (ex) {
    if (ex instanceof Fatal) {
      process.stderr.write(`${prog}: ${ex.message}\n`);
      process.exit(1);
    }
    else {
      if (!args || !args.keep_temp) {
        temp.cleanup(); // We need to do this ourselves...
      }
      throw ex;
    }
  }
}
process.on("uncaughtException", terminate);
process.on("unhandledRejection", (ex) => {
  // We convert the rejection into an uncaught exception.
  throw ex;
});

//
// The real logic begins here.
//

const parser = new ArgumentParser({
  addHelp: true,
  description: "Converts a simplified RNG file to a JavaScript file " +
    "that salve can use.",
});

parser.addArgument(["--version"], {
  help: "Show program's version number and exit.",
  action: "version",
  version,
} as any);

const availableSimplifiers = getAvailableSimplifiers();
if (availableSimplifiers.indexOf("internal") === -1) {
  throw new Fatal("internal must be among the available validators");
}

parser.addArgument(["--simplifier"], {
  help: "Select the schema simplifier.",
  choices: availableSimplifiers,
  defaultValue: "internal",
});

const availableValidators = getAvailableValidators();
if (!availableValidators.includes("internal")) {
  throw new Fatal("internal must be among the available validators on Node!");
}
availableValidators.push("none");

parser.addArgument(["--validator"], {
  help: "Select how the schema is going to be validated.",
  choices: availableValidators,
  defaultValue: "internal",
});

parser.addArgument(["--no-optimize-ids"], {
  help: "Do NOT optimize the identifiers used by references and definitions.",
  action: "storeTrue",
});

parser.addArgument(["--include-paths"], {
  help: "Include RNG node path information in the JavaScript file.",
  action: "storeTrue",
});

parser.addArgument(["--format-version"], {
  help: "Version number of the JavaScript format that the tool must produce.",
  type: Number,
  defaultValue: 3,
});

parser.addArgument(["--simplify-only"], {
  help: "Stop converting at the simplification stage.",
  action: "storeTrue",
});

parser.addArgument(["--simplify-to"], {
  help: "Simplify only to a specific stage, inclusively. (Note that pipelines \
may not be able to stop at all stages.) This is mainly useful for debugging. \
Implies ``--simplify-only``.",
  type: Number,
  defaultValue: Infinity,
});

parser.addArgument(["--no-output"], {
  help: "Skip producing any output. This may be useful for debugging.",
  action: "storeTrue",
});

parser.addArgument(["--simplified-input"], {
  help: "The input is as simplified RNG.",
  action: "storeTrue",
});

parser.addArgument(["--keep-temp"], {
  help: "Keep the temporary files around. Useful for diagnosis.",
  action: "storeTrue",
});

parser.addArgument(["-v", "--verbose"], {
  help: "Run verbosely.",
  action: "storeTrue",
});

parser.addArgument(["--timing"], {
  help: "Output timing information. Implies --verbose.",
  action: "storeTrue",
});

parser.addArgument(["--verbose-format"], {
  help: `Outputs a verbose version of the data, with actual class names \
instead of numbers. Implies --no-optimize-ids. This format is cannot \
be read by salve. It is meant for debugging purposes only.`,
  action: "storeTrue",
});

parser.addArgument(["--allow-incomplete-types"], {
  help: `Without this flag, the conversion process will stop upon \
encountering types that are not fully supported. Using this flag will \
allow the conversion to happen. Use --allow-incomplete-types=quiet to \
suppress all warnings about this.`,
});

parser.addArgument(["input_path"]);
parser.addArgument(["output_path"]);

args = parser.parseArgs();

if (args.timing) {
  args.verbose = true;
}

if (args.verbose_format) {
  args.no_optimize_ids = true;
}

if (args.simplify_to !== Infinity) {
  args.simplify_only = true;
}

if (args.format_version < 3) {
  throw new Fatal(`can't produce format version ${args.format_version}`);
}

let _tempDir: string;
function ensureTempDir(): string {
  if (_tempDir === undefined) {
    _tempDir = temp.mkdirSync({ prefix: "salve-convert" });

    if (args.keep_temp) {
      temp.track(false);
      console.log(`Temporary files in: ${_tempDir}`);
    }
  }

  return _tempDir;
}

async function prettyPrint(input: string, outputPath: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const child = spawn("xmllint", ["--format", "--output", outputPath, "-"],
                        { stdio: ["pipe", "inherit", "inherit"] });
    child.stdin.end(input);
    child.on("exit", () => {
      resolve(undefined);
    });
  });
}

/**
 * Meant to be used as the ``after`` call back for ``executeStep``. Performs the
 * conversion from RNG to JS.
 *
 * @param simplified The result of the simplification.
 */
async function convert(result: SimplificationResult): Promise<void> {
  const simplified = result.simplified;
  if (args.simplify_only && !args.no_output) {
    return prettyPrint(serialize(simplified), args.output_path);
  }

  if (result.warnings.length !== 0 &&
      args.allow_incomplete_types !== "quiet") {
    stderr.write(`${prog}: WARNING: incomplete types are used in the schema\n`);

    result.warnings.forEach((x) => {
      stderr.write(`${prog}: ${x}\n`);
    });
    if (!args.allow_incomplete_types) {
      throw new Fatal("use --allow-incomplete-types to convert a file " +
                      "using these types");
    }
    else {
      stderr.write(`${prog}: allowing as requested\n`);
    }
  }

  let convStartTime: number | undefined;
  if (args.verbose) {
    console.log("Transforming RNG to JavaScript...");
    if (args.timing) {
      convStartTime = Date.now();
    }
  }

  if (!args.no_optimize_ids) {
    renameRefsDefines(simplified);
  }

  if (!args.no_output) {
    fs.writeFileSync(args.output_path,
                     writeTreeToJSON(simplified, args.format_version,
                                     args.include_paths, args.verbose_format));
  }

  if (args.timing) {
    console.log(`Conversion delta: ${Date.now() - convStartTime!}`);
  }
}

async function start(): Promise<void> {
  let startTime: number | undefined;
  if (args.simplified_input) {
    const convParser = new ConversionParser(sax.parser(true, { xmlns: true }));
    convParser.saxParser
      .write(fs.readFileSync(args.input_path).toString()).close();

    return convert({
      simplified: convParser.root,
      warnings: [],
    });
  }

  const resourceLoader = makeResourceLoader();

  let simplified: Element | undefined;
  let warnings: string[] | undefined;
  if (args.validator !== "none") {
    if (args.verbose) {
      console.log("Validating RNG...");
      if (args.timing) {
        startTime = Date.now();
      }
    }

    const validator = makeValidator(args.validator, {
      verbose: args.verbose,
      timing: args.timing,
      resourceLoader,
      keepTemp: args.keep_temp,
      simplifyTo: args.simplify_to,
      ensureTempDir,
      validate: true,
    });

    ({ simplified, warnings } =
     await validator.validate(new URL(fileUrl(args.input_path))));

    if (args.timing) {
      console.log(`Validation delta: ${Date.now() - startTime!}`);
    }
  }

  if (simplified !== undefined) {
    return convert({
      simplified,
      warnings: warnings === undefined ? [] : warnings,
    });
  }

  const simplifier = makeSimplifier(args.simplifier, {
    verbose: args.verbose,
    timing: args.timing,
    keepTemp: args.keep_temp,
    simplifyTo: args.simplify_to,
    ensureTempDir,
    resourceLoader,
    validate: false,
  });

  return simplifier.simplify(new URL(fileUrl(args.input_path))).then(convert);
}

// tslint:disable-next-line:no-floating-promises
start().then(() => {
  process.exit(0);
}).catch((e) => {
  if (e instanceof ValueValidationError ||
      e instanceof ParameterParsingError ||
      e instanceof SchemaValidationError) {
    throw new Fatal(e.message);
  }

  throw e;
});

//  LocalWords:  cli MPL uncaughtException externalRef RNG storeTrue args jing
//  LocalWords:  tempDir dev startTime xsl rng stepStart stepNo xsltproc JS
//  LocalWords:  stringparam originalDir repeatWhen simplifyingStartTime prog
//  LocalWords:  xmllint convStartTime
