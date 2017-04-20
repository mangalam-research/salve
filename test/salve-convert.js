/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

/* global it, describe, afterEach */
"use strict";
const assert = require("chai").assert;
const spawn = require("child_process").spawn;
const fs = require("fs");

describe("salve-convert", function convert() {
  this.timeout(0);
  const outpath = ".tmp_rng_to_js_test";

  afterEach(() => {
    if (fs.exists(outpath)) {
      fs.unlinkSync(outpath);
    }
  });

  function salveConvert(inpath, exp, params, done, expStatus) {
    if (expStatus === undefined) {
      expStatus = 0;
    }

    const child = spawn("build/dist/bin/salve-convert",
                        params.concat([inpath, outpath]),
                        (!expStatus) ? { stdio: "inherit" } :
                        { stdio: ["ignore", 1, "pipe"] });

    const stderr = [];
    if (expStatus) {
      child.stderr.on("data", (data) => {
        stderr.push(data);
      });
    }

    child.on("exit", (code) => {
      assert.equal(code, expStatus, "salve-convert exit status");
      if (!expStatus && exp) {
        // The actual output from diff would not be that useful here.
        spawn("diff", [outpath, exp], { stdio: "ignore" })
          .on("exit", (diffCode) => {
            assert.equal(diffCode, 0, "there was a difference");
            done();
          });
      }
      else {
        if (expStatus) {
          assert.equal(stderr.join(""),
                       fs.readFileSync(exp).toString());
        }
        done();
      }
    });
  }

  const dir = "test/salve-convert/";
  const tests = fs.readdirSync(dir);

  for (const t of tests) {
    if (t.slice(-4) !== ".rng") {
      continue; // eslint-disable-line no-continue
    }

    if (t.lastIndexOf("fails", 0) === -1) {
      const expected = `${t.slice(0, -4)}.js`;
      it(`convert ${t}`, (done) => {
        salveConvert(dir + t, dir + expected, [], done);
      });
    }
    else {
      it(`convert fails on ${t}`, (done) => {
        salveConvert(dir + t, `${dir}${t.slice(0, -4)}.txt`,
                      ["--include-paths"], done, 1);
      });
    }
  }

  it("allows not optimizing ids", (done) => {
    const inpath = "test/tei/simplified.rng";
    const expath = "test/tei/simplified-rng-not-optimized.js";

    salveConvert(inpath, expath, [
      "--simplified-input",
      "--allow-incomplete-types=quiet",
      "--no-optimize-ids",
    ], done);
  });

  it("optimizes ids", (done) => {
    const inpath = "test/tei/simplified.rng";
    const expath = "test/tei/simplified-rng.js";

    salveConvert(inpath, expath,
                 ["--simplified-input", "--allow-incomplete-types=quiet"],
                 done);
  });

  it("default execution", (done) => {
    const inpath = "test/tei/myTEI.rng";
    const expath = "test/tei/simplified-rng.js";

    salveConvert(inpath, expath, ["--allow-incomplete-types=quiet"], done);
  });

  it("include paths", (done) => {
    const inpath = "test/tei/myTEI.rng";
    // Test created to deal with an internal error, so we don't
    // check the output.
    salveConvert(inpath, null,
                 ["--allow-incomplete-types=quiet", "--include-paths"],
                 done);
  });

  it("propagates attributes of included grammars", (done) => {
    const inpath = "test/inclusion/doc-unannotated.rng";
    // Test created to deal with an internal error, so we don't
    // check the output.
    salveConvert(inpath, null,
                 ["--allow-incomplete-types=quiet", "--include-paths"],
                 done);
  });
});
