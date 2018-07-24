/* global describe it after */

"use strict";

const fileURL = require("file-url");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const { expect } = require("chai");
const conversion = require("../build/dist/lib/salve/conversion");
const { BasicParser, dependsOnExternalFile } =
      require("../build/dist/lib/salve/conversion/parser");
const simplifier =
      require("../build/dist/lib/salve/conversion/simplifier");
const { SaxesParser } = require("saxes");

const dataDir = path.join(__dirname, "rng_simplification_data");

describe("rng simplification", () => {
  const tmppath = path.join(__dirname, ".rng-simplification-test-input.xml");
  const outpath = path.join(__dirname, ".rng-simplification-test.xml");
  function transformXSLStep(number, inpath) {
    const stepPath =
          `lib/salve/rng-simplification/rng-simplification_step${number}.xsl`;

    const originalDir = fileURL(path.resolve(path.dirname(inpath)));
    let child;
    // Only step 1 requires XSLT 2.
    if (number === 1) {
      child = spawn(
        "java",
        ["-jar", "/usr/share/java/Saxon-HE.jar", `-xsl:${stepPath}`,
         `-s:${inpath}`, `-o:${outpath}`, `originalDir=${originalDir}`],
        { stdio: "inherit" });
    }
    else {
      child = spawn(
        "xsltproc",
        ["-o", outpath, "--stringparam", "originalDir", originalDir,
         stepPath, inpath],
        { stdio: "inherit" });
    }

    return new Promise((resolve, reject) => {
      child.on("exit", (status) => {
        if (status) {
          reject(new Error(`xsltproc terminated with status: ${status}`));
        }

        if (!fs.existsSync(outpath)) {
          reject(new Error("failed to create output"));
        }

        resolve(fs.readFileSync(outpath).toString());
      });
    }).then((out) => {
      let result = out
      // We drop the encoding because we don't need it for these tests.
          .replace(/ encoding=".*?"/, "")
      // Add a newline after the processing instruction.
          .replace(/\?>(?!\n)/, "?>\n");

      // Slap a newline at the end, if missing.
      if (result[result.length - 1] !== "\n") {
        result += "\n";
      }

      if (number !== 1) {
        return result;
      }

      const found = dependsOnExternalFile(result);
      if (found) {
        fs.writeFileSync(tmppath, result);
        return transformXSLStep(1, tmppath);
      }

      return result;
    });
  }

  function reparse(result) {
    const parser = new BasicParser(new SaxesParser({
      xmlns: true,
      position: false,
    }));
    parser.saxesParser.write(result).close();
    return conversion.serialize(parser.root);
  }

  function transformXSL(numbers, inpath) {
    if (!(numbers instanceof Array)) {
      numbers = [numbers];
    }
    return transformXSLStep(numbers[0], inpath)
      .then((result) => {
        if (numbers.length === 1) {
          // Reparsing the result allows us to normalize our output.
          return reparse(result);
        }

        fs.writeFileSync(tmppath, result);
        return transformXSL(numbers.slice(1), tmppath);
      });
  }

  function parseJS(inpath) {
    const parser = new BasicParser(new SaxesParser({
      xmlns: true,
      position: false,
    }));
    if (inpath instanceof URL) {
      inpath = inpath.toString().replace(/^file:\/\//, "");
    }
    const source = fs.readFileSync(inpath).toString();
    parser.saxesParser.write(source).close();
    return parser.root;
  }

  function transformJS(stepName, inpath) {
    const tree = parseJS(inpath);
    const step = simplifier[stepName];
    return Promise.resolve()
      .then(() => (stepName === "step1" ?
                   step(new URL(fileURL(path.resolve(inpath))), tree, parseJS) :
                   step(tree)))
      .then(root => conversion.serialize(root));
  }

  // Unfortunately the XSLT code has some bugs that are not worth fixing. So we
  // are going to skip the tests that fail due to issues with the code.
  const skip = {
    "step 1": {
      xslt: {
        "resolve_include_with_start.rng": true,
        "resolve_include_with_define.rng": true,
        "spaces.rng": true,
      },
    },
  };

  function makeStepTest(number, xslNumbers) { // eslint-disable-line
    const name = `step ${number}`;
    const shortName = name.replace(/\s/g, "");

    if (!xslNumbers) {
      xslNumbers = number;
    }

    describe(name, () => {
      const stepDir = path.join(dataDir, shortName);
      const files = fs.readdirSync(stepDir);
      files.forEach((file) => {
        if (file.match(/_out(?:_xsl)?\.rng$/) || !file.match(/\.rng$/)) {
          return;
        }

        const base = path.basename(file, path.extname(file));
        const testName = base.replace(/_/g, " ");
        const inpath = path.join(stepDir, file);
        const commonExpectedPath = path.join(stepDir, `${base}_out.rng`);
        // Some tests need to have a specific file different from the one
        // used for the TS code.
        const xslSpecificExpectedPath =
              path.join(stepDir, `${base}_out_xsl.rng`);
        const xslExpectedPath = fs.existsSync(xslSpecificExpectedPath) ?
              xslSpecificExpectedPath : commonExpectedPath;

        if (!skip[name] || !skip[name].xslt[file]) {
          it(`${testName} (xslt)`,
             () => transformXSL(xslNumbers, inpath).then((output) => {
               let expected = fs.readFileSync(xslExpectedPath);
               expected = expected.toString().replace(/@CURDIR@/g, dataDir);
               expect(output).to.equal(expected);
             }))
          // XSLT transforms can be super slow.
            .timeout(10000);
        }

        it(`${testName} (TS)`, () =>
          transformJS(shortName, inpath).then((actual) => {
            let expected = fs.readFileSync(commonExpectedPath);
            expected = expected.toString().replace(/@CURDIR@/g, dataDir);
            if (number === 1) {
              // We do this so that we can use the same files for the XSL test
              // and the TypeScript test. In the later pipeline, step1 removes
              // all xml:base elements from the resulting XML (whereas the XSL
              // pipeline preserves them.
              expected = expected.replace(/\s+xml:base=".*?"/g, "");
            }
            expect(actual).to.equal(expected);
          }));
      });

      after(() => {
        // Yes, we know about the race condition issue of checking for existence
        // first and then deleting. No, we don't care.
        if (fs.existsSync(tmppath)) {
          fs.unlinkSync(tmppath);
        }

        if (fs.existsSync(outpath)) {
          fs.unlinkSync(outpath);
        }
      });
    });
  }

  // We don't include 2 and 3 in step 1 when testing XSL so that we can
  // have isolated testing of step 1.
  makeStepTest(1);
  makeStepTest(4, [4, 5]);
  makeStepTest(6, [6, 7, 8]);
  makeStepTest(9);
  makeStepTest(10, [10, 11, 12, 13]);
  makeStepTest(14);
  makeStepTest(15);
  makeStepTest(16);
  makeStepTest(17);
  makeStepTest(18);
});
