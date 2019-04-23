/**
 * A simplifier implemented as a series of XSL transformations. It launches
 * external processes to perform the transformation.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

import { dependsOnExternalFile, parseSimplifiedSchema } from "../parser";
import { registerSimplifier, SchemaSimplifierOptions,
         SimplificationResult } from "../schema-simplification";
import { BaseSimplifier } from "./base";

interface Step {
  name: string;
  path: string;
  repeatWhen?: (rng: string) => boolean;
  repeatNo: number;
  saxon: boolean;
}

/**
 * A simplifier implemented as a series of XSL transformations. It launches
 * external processes to perform the transformation.
 *
 * This simiplifier does not produce a manifest, and it does not validate.
 */
export class XSLSimplifier extends BaseSimplifier {
  static validates: false = false;
  static createsManifest: false = false;

  private lastStepStart: number;
  private _steps?: Step[];

  constructor(options: SchemaSimplifierOptions) {
    super(options);
    if (options.timing) {
      options.verbose = true;
    }
  }

  private get steps(): Step[] {
    if (this._steps !== undefined) {
      return this._steps;
    }

    // Grab the xsl files that form the simplification process, and store these
    // paths in ``steps``.
    const libPath = path.resolve(__dirname, path.join("..", "..",
                                                      "rng-simplification"));
    const stepRe = /^rng-simplification_step(\d*?).xsl$/;
    const stepFiles =
      fs.readdirSync(libPath).filter(file => file.match(stepRe));

    // The filter step above ensures the regexp match.
    // tslint:disable-next-line:no-non-null-assertion
    stepFiles.sort((a, b) => parseInt(a.match(stepRe)![1]) -
                   // tslint:disable-next-line:no-non-null-assertion
                   parseInt(b.match(stepRe)![1]));

    return this._steps = stepFiles.map(file => {
      const ret: Step = {
        name: file,
        path: path.join(libPath, file),
        repeatNo: 0,
        saxon: false,
      };
      if (file === "rng-simplification_step1.xsl") {
        ret.saxon = true;
        // We want to check whether we need to run the step again to include
        // more files.
        ret.repeatWhen = dependsOnExternalFile;
      }

      return ret;
    });
  }

  async simplify(schemaURL: URL): Promise<SimplificationResult> {
    let schemaPath = schemaURL.toString();
    if (schemaURL.protocol === "file:") {
      schemaPath = schemaPath.replace(/^file:\/\//, "");
    }
    else {
      throw new Error("URLs must use the file: protocol");
    }

    let startTime: number | undefined;
    if (this.options.verbose) {
      // tslint:disable-next-line:no-console
      console.log("Simplifying...");
      if (this.options.timing) {
        startTime = Date.now();
      }
    }

    const originalInputDir = `${path.dirname(path.resolve(schemaPath))}/`;

    const result =
      await this.executeStep(originalInputDir, 0,
                             fs.readFileSync(schemaPath).toString());

    const simplified = parseSimplifiedSchema(schemaPath, result);
    const warnings: string[] = (this.options.simplifyTo >= 18) ?
      this.processDatatypes(simplified) : [];

    this.stepTiming();
    if (this.options.timing) {
      // tslint:disable-next-line:no-non-null-assertion no-console
      console.log(`Simplification delta: ${Date.now() - startTime!}`);
    }

    return {
      simplified,
      warnings,
      manifest: [],
    };
  }

  stepTiming(): void {
    if (this.lastStepStart !== undefined) {
      // tslint:disable-next-line:no-console
      console.log(`${Date.now() - this.lastStepStart}ms`);
    }
  }

  /**
   * @param originalInputDir The URL to the directory that contained the
   * original file to simplify.
   *
   * @param stepNo The index in ``steps`` of the step we are running.
   *
   * @param input The data to process.
   */
  async executeStep(originalInputDir: string, stepNo: number,
                    input: string): Promise<string> {
    const steps = this.steps;
    if (stepNo >= steps.length || stepNo >= this.options.simplifyTo) {
      return input;
    }

    const step = steps[stepNo];

    if (this.options.verbose) {
      this.stepTiming();
      // tslint:disable-next-line:no-console
      console.log(
        `Simplification step ${stepNo + 1}, repetition ${step.repeatNo}...`);
      if (this.options.timing) {
        this.lastStepStart = Date.now();
      }
    }

    let child;

    const output = await new Promise<string>((resolve, reject) => {
      // Only step 1 requires XSLT 2. Remember that steps are 0-based here.
      if (step.saxon) {
        child = spawn(
          "java",
          ["-jar", "/usr/share/java/Saxon-HE.jar", `-xsl:${step.path}`, "-s:-",
           `originalDir=file://${originalInputDir}`],
          { stdio: ["pipe", "pipe", "inherit"] });
      }
      else {
        child = spawn(
          "xsltproc",
          ["--stringparam", "originalDir", originalInputDir, step.path, "-"],
          {
            stdio: ["pipe", "pipe", "inherit"],
            cwd: originalInputDir,
          });
      }

      child.stdin.end(input);

      let outputBuf = "";
      child.stdout.on("data", data => {
        outputBuf += data.toString();
      });

      child.on("exit", status => {
        if (status !== 0) {
          reject(new Error(`child terminated with status: ${status}`));
        }

        resolve(outputBuf);
      });
    });

    if (this.options.keepTemp) {
      // tslint:disable-next-line:no-non-null-assertion
      const tempDir = this.options.ensureTempDir!();
      const outBase = `out${String((stepNo + 1)) +
(step.repeatWhen !== undefined ? `.${step.repeatNo + 1}` : "")}.rng`;
      const outPath = path.join(tempDir, outBase);
      fs.writeFileSync(outPath, output);
    }

    if (step.repeatWhen !== undefined) {
      if (step.repeatWhen(output)) {
        step.repeatNo++;

        return this.executeStep(originalInputDir, stepNo, output);
      }
    }

    return this.executeStep(originalInputDir, stepNo + 1, output);
  }
}

registerSimplifier("xsl", XSLSimplifier);
