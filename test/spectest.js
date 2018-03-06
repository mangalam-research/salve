/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

/* global it, describe, before, after */
/* eslint-env node */

"use strict";

const { assert } = require("chai");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const salveParse = require("../build/dist/lib/salve/parse");

function fileAsString(p) {
  return fs.readFileSync(path.resolve(p), "utf8").toString();
}

const skips = {
  test56: {
    // There is a bug in libxml2 which lets this one pass through.
    incorrect: true,
  },
};

const spectestDir = path.join(__dirname, "spectest");

const testDirs = fs.readdirSync(spectestDir);

function Test(test) {
  this.test = test;
  const p = this.path = path.join(spectestDir, test);
  const incorrect = this.incorrect = [];
  const correct = this.correct = [];
  const valid = this.valid = [];
  const invalid = this.invalid = [];
  this.convert_args = [];

  for (const f of fs.readdirSync(p)) {
    if (f.lastIndexOf("incorrect", 0) === 0) {
      incorrect.push(path.join(p, f));
    }
    if (f.lastIndexOf("correct", 0) === 0) {
      correct.push(path.join(p, f));
    }
    if (f.lastIndexOf("valid", 0) === 0) {
      valid.push(path.join(p, f));
    }
    if (f.lastIndexOf("invalid", 0) === 0) {
      invalid.push(path.join(p, f));
    }
  }

  // More than 1 such case per test does not happen right now, so
  // simplify.
  if (correct.length > 1) {
    throw new Error("we are not set for more than one correct case " +
                    "per test.");
  }

  if (incorrect.length > 1) {
    throw new Error("we are not set for more than one correct case " +
                    "per test.");
  }

  [this.correct] = correct;
  [this.incorrect] = incorrect;
}

const tests = testDirs.filter(
  x => fs.statSync(path.join(spectestDir, x)).isDirectory()).map((x) => {
    const ret = new Test(x);
    // test384 uses double
    if (x === "test384") {
      ret.convert_args = ["--allow-incomplete-types=quiet"];
    }
    return ret;
  });

function salveConvert(args, callback) {
  const child = spawn("build/dist/bin/salve-convert", args);

  child.on("exit", code => callback(code));
}

function parse(rng, xml, mute, callback) {
  callback(salveParse(fileAsString(rng), fileAsString(xml), mute));
}

describe("spectest", function spectest() {
  this.timeout(0);
  const outpath = ".tmp_rng_to_js_test";

  function clean() {
    try {
      fs.unlinkSync(outpath);
    }
    catch (ex) {
      // Ignore if non-existing.
      if (ex.code !== "ENOENT") {
        throw ex;
      }
    }
  }

  for (const t of tests) {
    const skip = skips[t.test] || {};
    if (!skip.incorrect && t.incorrect) {
      it(t.incorrect, (done) => {
        salveConvert(t.convert_args.concat([t.incorrect, outpath]),
                     (code) => {
                       assert.isFalse(code === 0, "salve-convert exit status");
                       clean();
                       done();
                     });
      });
    }

    if (!skip.correct && t.correct) {
      const doValid = !skip.valid && t.valid.length;
      const doInvalid = !skip.invalid && t.invalid.length;

      if (doValid || doInvalid) {
        describe("valid and invalid cases", () => {
          before((done) => {
            salveConvert(t.convert_args.concat([t.correct, outpath]),
                         (code) => {
                           assert.equal(code, 0,
                                        "salve-convert exit status while " +
                                        `converting ${t.correct}`);
                           done();
                         });
          });

          for (const vfile of t.valid) {
            it(vfile, (done) => {
              parse(outpath, vfile, false, (code) => {
                assert.equal(code, 0, "parse exit status");
                done();
              });
            });
          }

          for (const vfile of t.invalid) {
            it(vfile, (done) => {
              parse(outpath, vfile, true, (code) => {
                assert.equal(code, 1, "parse exit status");
                done();
              });
            });
          }

          after(clean);
        });
      }
    }
  }
});
