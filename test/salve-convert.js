/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

/* global it, describe, afterEach */

"use strict";

const { assert, expect } = require("chai");
const { spawn } = require("child_process");
const fs = require("fs");

describe("salve-convert", function convert() {
  this.timeout(0);
  const outpath = ".tmp_rng_to_js_test";

  afterEach(() => {
    if (fs.existsSync(outpath)) {
      fs.unlinkSync(outpath);
    }
  });

  async function runConvert(inpath, params) {
    return new Promise((resolve) => {
      const child = spawn("build/dist/bin/salve-convert",
                          params.concat([inpath, outpath]),
                          { stdio: ["inherit", "inherit", "pipe"] });

      let stderr = "";
      child.stderr.on("data", (data) => {
        stderr += data;
      });

      child.on("exit", (code) => {
        resolve({ code, stderr });
      });
    });
  }

  async function checkConvert(inpath, exp, params, expStatus = 0) {
    const { code, stderr } = await runConvert(inpath, params);
    assert.equal(code, expStatus, "salve-convert exit status");
    if (!expStatus && exp) {
      // The actual output from diff would not be that useful here.
      return new Promise((resolve) => {
        spawn("diff", [outpath, exp], { stdio: "ignore" })
          .on("exit", (diffCode) => {
            assert.equal(diffCode, 0, "there was a difference");
            resolve();
          });
      });
    }

    if (expStatus) {
      assert.equal(stderr, fs.readFileSync(exp).toString());
    }

    return undefined; // Shut up the linter.
  }

  const dir = "test/salve-convert/";
  const tests = fs.readdirSync(dir);

  for (const t of tests) {
    if (t.slice(-4) !== ".rng") {
      continue; // eslint-disable-line no-continue
    }

    if (t.lastIndexOf("fails", 0) === -1) {
      const expected = `${t.slice(0, -4)}.js`;
      it(`convert ${t}`, async () => {
        await checkConvert(dir + t, dir + expected, []);
      });
    }
    else {
      it(`convert fails on ${t}`, async () => {
        await checkConvert(dir + t, `${dir}${t.slice(0, -4)}.txt`,
                           ["--include-paths"], 1);
      });
    }
  }

  it("allows not optimizing ids", async () => {
    const inpath = "test/tei/simplified.rng";
    const expath = "test/tei/simplified-rng-not-optimized.js";

    await checkConvert(inpath, expath, [
      "--simplified-input",
      "--allow-incomplete-types=quiet",
      "--no-optimize-ids",
    ]);
  });

  // The rigmarole with the ids is due to the fact that we cannot have a single
  // file against which we can check the result of id optimization.
  //
  // The optimization algorithm uses hash tables, which do not guarantee
  // iteration order. What we do is replace all ids associated with Ref (code 8)
  // and Define (code 14) with X, and compare the non-optimized and optimized
  // versions.
  function flushIds(orig) {
    return orig
      .replace(/\[8,.*?\]/g, "[8,X]")
      .replace(/\[14,[^,]+/g, "[14,X");
  }

  function checkWithFlushedIds() {
    const output = flushIds(fs.readFileSync(outpath).toString());
    const expected =
          flushIds(fs.readFileSync("test/tei/simplified-rng-not-optimized.js")
                   .toString());
    expect(output).to.equal(expected);
  }

  it("optimizes ids", async () => {
    const inpath = "test/tei/simplified.rng";

    const { code } = await runConvert(inpath,
                                      ["--simplified-input",
                                       "--allow-incomplete-types=quiet"]);
    expect(code).to.equal(0);
    checkWithFlushedIds();
  });

  it("default execution", async () => {
    const inpath = "test/tei/myTEI.rng";
    const { code } = await runConvert(inpath,
                                      ["--allow-incomplete-types=quiet"]);
    expect(code).to.equal(0);
    checkWithFlushedIds();
  });

  it("include paths", async () => {
    const inpath = "test/tei/myTEI.rng";
    // Test created to deal with an internal error, so we don't
    // check the output.
    await checkConvert(inpath, null,
                       ["--allow-incomplete-types=quiet", "--include-paths"]);
  });

  it("propagates attributes of included grammars", async () => {
    const inpath = "test/inclusion/doc-unannotated.rng";
    // Test created to deal with an internal error, so we don't
    // check the output.
    await checkConvert(inpath, null,
                       ["--allow-incomplete-types=quiet", "--include-paths"]);
  });
});
