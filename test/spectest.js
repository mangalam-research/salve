/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

/* global it, describe, before */
/* eslint-env node */

"use strict";

const { assert } = require("chai");
const fileURL = require("file-url");
const fs = require("fs");
const path = require("path");
const { parse } = require("../build/dist/lib/salve/parse");
const salve = require("../build/dist");

function fileAsString(p) {
  return fs.readFileSync(path.resolve(p), "utf8").toString();
}

const skips = {
  test56: {
    // There is a bug in libxml2 which lets this one pass through.
    incorrect: true,
  },
};

// Our simplification algorithm removes all dead fragments before doing
// checks on data types. So these tests would fail.
for (const x of ["180", "181", "182", "183", "184", "185"]) {
  skips[`test${x}`] = {
    incorrect: true,
  };
}

function getTestsFrom(dirPath) {
  return fs.readdirSync(dirPath)
    .map(x => path.join(dirPath, x))
    .filter(x => fs.statSync(x).isDirectory());
}

const testDirs = getTestsFrom(path.join(__dirname, "spectest"))
      .concat(getTestsFrom(path.join(__dirname, "additionalSpectest")));

function Test(testPath) {
  this.test = path.basename(testPath);
  const p = this.path = testPath;
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

const tests = testDirs.map(x => new Test(x));

function makeValidityTest(data, vfile, passes) {
  it(vfile,
     () => parse(data.grammar, fileAsString(vfile), !passes).then((error) => {
       assert.equal(!error, passes, "parse result");
     }));
}

function makeTests(test) {
  const skip = skips[test.test] || {};
  if (!skip.incorrect && test.incorrect) {
    it(test.incorrect,
       () => salve.convertRNGToPattern(new URL(fileURL(test.incorrect)))
       .then(() => assert.isFalse(true,
                                  "expected conversion to fail, but it passed"),
             // A failure is what we want.
             () => {}));
  }

  if (!skip.correct && test.correct) {
    const doValid = !skip.valid && test.valid.length;
    const doInvalid = !skip.invalid && test.invalid.length;

    if (doValid || doInvalid) {
      describe(`valid and invalid cases (${test.correct})`, () => {
        const data = {};

        before(() => salve.convertRNGToPattern(new URL(fileURL(test.correct)))
               .then((result) => {
                 data.grammar = result.pattern;
               }));

        for (const vfile of test.valid) {
          makeValidityTest(data, vfile, true);
        }

        for (const vfile of test.invalid) {
          makeValidityTest(data, vfile, false);
        }
      });
    }
  }
}

describe("spectest", () => {
  for (const test of tests) {
    makeTests(test);
  }
});
