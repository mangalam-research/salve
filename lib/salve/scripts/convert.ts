/**
 * Conversion cli tool.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { ArgumentParser } from "argparse";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as sax from "sax";
import * as temp from "temp";

// We load individual modules rather than the build module because the
// conversion code uses parts of salve that are not public.
import { ConversionParser, DatatypeProcessor, DefaultConversionWalker,
         NameGatherer, Renamer} from "../conversion";
import { ParameterParsingError, ValueValidationError } from "../datatypes";
import { fixPrototype } from "../tools";
import { version } from "../validate";

// tslint:disable:no-console no-non-null-assertion radix

temp.track();

const prog = path.basename(process.argv[1]);
const stdout = process.stdout;
const stderr = process.stderr;

//
// Safety harness
//

class Fatal extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "Fatal";
    this.message = msg;
    fixPrototype(this, Fatal);
 }
}

let args: any;
let terminating = false;
process.on("uncaughtException", (ex: any) => {
  // We don't want to handle exceptions that happen while we're terminating.
  if (terminating) {
    return;
  }

  terminating = true;
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
});

//
//  Misc utilities
//

// Exception used to terminate the sax parser early.
class Found extends Error {
  constructor() {
    super();
    fixPrototype(this, Found);
  }
}

class Parser{
  constructor(public readonly saxParser: sax.SAXParser) {
    for (const name in this) {
      if (name.lastIndexOf("on", 0) === 0) {
        (this.saxParser as any)[name] = (this as any)[name].bind(this);
      }
    }
  }
}

class IncludeParser extends Parser {
  found: boolean;

  constructor(saxParser: sax.SAXParser) {
    super(saxParser);
    this.found = false;
  }

  onopentag(node: sax.QualifiedTag): void {
    // tslint:disable-next-line:no-http-string
    if (node.uri === "http://relaxng.org/ns/structure/1.0" &&
        (node.local === "include" || node.local === "externalRef")) {
      this.found = true;
      throw new Found();  // Stop early.
    }
  }
}

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

let startTime: number;
if (args.simplified_input) {
  convert(fs.readFileSync(args.input_path).toString());
}
else {
  if (args.verbose) {
    console.log("Validating RNG...");
    if (args.timing) {
      startTime = Date.now();
    }
  }

  // This is a bit of a hack. We want to make sure that the schema is a valid
  // RNG schema as per RNG specs. Running validation on our schema with a
  // schema that defines a valid schema structure does not trap import errors
  // or errors that are not expressible in a schema language. So we run jing
  // with our schema as the schema to use for validation and /dev/null as the
  // document to validate. This does catch errors but there is no clean way to
  // get jing to output only schema errors, hence what we have here.

  const child = spawn("jing", [args.input_path, "/dev/null"],
                      { stdio: ["ignore", "pipe", "ignore"] });

  let err = "";
  child.stdout.on("data", (data) => {
    err += data;
  });

  child.on("close", () => {
    // Remove everything that has to do with /dev/null to avoid confusing the
    // user.
    err = err.replace(/\/dev\/null(.|[\r\n])*/, "");
    // Earlier versions would output this error instead of the above.
    err = err.replace(/fatal: Premature end of file\.\s*/, "");
    if (args.verbose) {
      process.stderr.write(err);
    }

    // Search for an actual schema error.
    if (err.length !== 0) {
      let msg = "error in schema";
      if (!args.verbose) {
        msg += "; run with --verbose to see what the problem was";
      }
      throw new Fatal(msg);
    }
    if (args.timing) {
      console.log(`Validation delta: ${Date.now() - startTime}`);
    }
    simplify();
  });
}

interface Step {
  name: string;
  path: string;
  repeatWhen?: Function;
  repeat_no: number;
}

let simplifyingStartTime: number;
function simplify(): void {
  // Grab the xsl files that form the simplification process, and store these
  // paths in ``steps``.
  if (args.verbose) {
    console.log("Simplifying...");
    if (args.timing) {
      simplifyingStartTime = Date.now();
    }
  }

  const libPath = path.resolve(__dirname, path.join("..",
                                                    "rng-simplification"));
  const stepRe = /^rng-simplification_step(\d*?).xsl$/;
  const stepFiles =
    fs.readdirSync(libPath).filter((file) => file.match(stepRe));

  // The filter step above ensures the regexp match.
  stepFiles.sort((a, b) => parseInt(a.match(stepRe)![1]) -
                 parseInt(b.match(stepRe)![1]));

  const steps = stepFiles.map((file) => {
    const ret: Step = {
      name: file,
      path: path.join(libPath, file),
      repeat_no: 0,
    };
    if (file === "rng-simplification_step1.xsl") {
      ret.repeatWhen = (output: string): boolean => {
        // We want to check whether we need to run the
        // step again to include more files.
        const incParser = new IncludeParser(sax.parser(true, { xmlns: true }));
        try {
          incParser.saxParser.write(output).close();
        }
        catch (ex) {
          if (!(ex instanceof Found)) {
            throw ex;
          }
        }

        return incParser.found;
      };
    }

    return ret;
  });

  executeStep(steps, 0, fs.readFileSync(args.input_path).toString(), convert);
}

let stepStart: number;
function stepTiming(): void {
  if (stepStart !== undefined) {
    console.log(`${Date.now() - stepStart}ms`);
  }
}

/**
 * @param steps The simplification steps.
 *
 * @param stepNo The index in ``steps`` of the step we are running.
 *
 * @param input The data to process.
 *
 * @param after Callback to run after all steps.
 */
function executeStep(steps: Step[], stepNo: number, input: string,
                     after: Function): void {
  if (stepNo >= steps.length) {
    after(input);

    return;
  }

  const step = steps[stepNo];

  if (args.verbose) {
    stepTiming();
    stdout.write(
      `Simplification step ${stepNo}, repetition ${step.repeat_no}...`);
    if (args.timing) {
      stepStart = Date.now();
    }
  }

  const originalInputDir = `${path.dirname(path.resolve(args.input_path))}/`;
  const xsltproc = spawn("xsltproc",
                         ["--stringparam", "originalDir", originalInputDir,
                          step.path, "-"],
                         {
                            stdio: ["pipe", "pipe", "inherit"],
                            cwd: originalInputDir,
                         });

  xsltproc.stdin.end(input);

  const outputBuf: string[] = [];
  xsltproc.stdout.on("data", (data) => {
    outputBuf.push(data.toString());
  });

  xsltproc.on("exit", (status) => {
    const output = outputBuf.join("");
    if (status !== 0) {
      throw new Fatal(`xsltproc terminated with status: ${status}`);
    }

    if (args.keep_temp) {
      const tempDir = ensureTempDir();
      const outBase = `out${String((stepNo + 1)) +
(step.repeatWhen !== undefined ? `.${step.repeat_no + 1}` : "")}.rng`;
      const outPath = path.join(tempDir, outBase);
      fs.writeFileSync(outPath, output);
    }

    if (step.repeatWhen !== undefined) {
      if (step.repeatWhen(output)) {
        step.repeat_no = step.repeat_no + 1;
        executeStep(steps, stepNo, output, after);

        return;
      }
    }

    executeStep(steps, stepNo + 1, output, after);
  });
}

/**
 * Meant to be used as the ``after`` call back for ``executeStep``. Performs the
 * conversion from RNG to JS.
 *
 * @param simplified The result of the simplification.
 */
function convert(simplified: string): void {
  if (args.timing) {
    stepTiming();
    console.log(`Simplification delta: ${Date.now() - simplifyingStartTime}`);
  }

  if (args.simplify_only) {
    const xmllint = spawn("xmllint", ["--format", "--output", args.output_path,
                                      "-"],
                          { stdio: ["pipe", "inherit", "inherit"] });
    xmllint.stdin.end(simplified);
    xmllint.on("exit", process.exit.bind(undefined, 0));

    return;
  }

  let convStartTime: number;
  if (args.verbose) {
    console.log("Transforming RNG to JavaScript...");
    if (args.timing) {
      convStartTime = Date.now();
    }
  }

  const convParser = new ConversionParser(sax.parser(true, { xmlns: true }));
  let walker;
  switch (args.format_version) {
  case 3:
    walker = new DefaultConversionWalker(
      args.format_version, args.include_paths, args.verbose_format);
    break;
  default:
    throw new Error(`unknown version: ${args.format_version}`);
  }
  convParser.saxParser.write(simplified).close();

  if (!args.no_optimize_ids) {
    // Gather names
    const g = new NameGatherer();
    g.walk(convParser.root);
    const names = g.names;

    // Now assign new names with shorter new names being assigned to those
    // original names that are most frequent.
    const sorted = Object.keys(names)
      .map((key) => ({ key: key, freq: names[key] }));
    // Yes, we want to sort in reverse order of frequency
    sorted.sort((a, b) => b.freq - a.freq);
    let id = 1;
    const newNames: Record<string, string> = {};
    sorted.forEach((elem) => {
      newNames[elem.key] = String(id++);
    });

    // Perform the renaming.
    const renamer = new Renamer(newNames);
    renamer.walk(convParser.root);
  }

  const typeChecker = new DatatypeProcessor();
  try {
    typeChecker.walk(convParser.root);
  }
  catch (ex) {
    if (ex instanceof ValueValidationError ||
        ex instanceof ParameterParsingError) {
      throw new Fatal(ex.message);
    }

    throw ex;
  }

  if (typeChecker.warnings.length !== 0 &&
      args.allow_incomplete_types !== "quiet") {
    stderr.write(`${prog}: WARNING: the following incomplete types are \
used in the schema: `);
    stderr.write(Object.keys(typeChecker.incompleteTypesUsed).join(", "));
    stderr.write("\n");
    stderr.write(`${prog}: details follow\n`);

    typeChecker.warnings.forEach((x) => {
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

  walker.walk(convParser.root);
  fs.writeFileSync(args.output_path, walker.output);

  if (args.timing) {
    console.log(`Conversion delta: ${Date.now() - convStartTime!}`);
  }

  process.exit(0);
}

//  LocalWords:  cli MPL uncaughtException externalRef RNG storeTrue args jing
//  LocalWords:  tempDir dev startTime xsl rng stepStart stepNo xsltproc JS
//  LocalWords:  stringparam originalDir repeatWhen simplifyingStartTime prog
//  LocalWords:  xmllint convStartTime
