/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */

'use strict';
import "amd-loader";
import { assert } from "chai";
import { spawn } from "child_process";
import fs from "fs";

describe("salve-convert", function () {
    this.timeout(0);
    const outpath = ".tmp_rng_to_js_test";

    afterEach(() => {
        if (fs.exists(outpath))
            fs.unlinkSync(outpath);
    });

    function salve_convert(inpath, exp, params, done, exp_status) {
        if (exp_status === undefined)
            exp_status = 0;

        const child = spawn("build/dist/bin/salve-convert",
                            params.concat([inpath, outpath]),
                            (!exp_status) ? {stdio: "inherit"} :
                            {stdio: ["ignore", 1, "pipe"]});

        const stderr = [];
        if (exp_status) {
            child.stderr.on('data', data => {
                stderr.push(data);
            });
        }

        child.on('exit', (code, signal) => {
            assert.equal(code, exp_status, "salve-convert exit status");
            if (!exp_status && exp) {
                // The actual output from diff would not be that useful here.
                spawn("diff", [outpath, exp], {stdio: 'ignore'})
                .on('exit', (code, signal) => {
                    assert.equal(code, 0, "there was a difference");
                    done();
                });
            }
            else {
                if (exp_status)
                    assert.equal(stderr.join(""),
                                 fs.readFileSync(exp).toString());
                done();
            }
        });
    }

    const dir = "test/salve-convert/";
    const tests = fs.readdirSync(dir);

    for (let t of tests) {
        if (t.slice(-4) !== ".rng")
            continue;

        if (t.lastIndexOf("fails", 0) === -1) {
            const expected = t.slice(0, -4) + ".js";
            it("convert " + t, (done) => {
                salve_convert(dir + t, dir + expected, [], done);
            });
        }
        else {
            it("convert fails on " + t, (done) => {
                salve_convert(dir + t, dir + t.slice(0, -4) + ".txt",
                              ["--include-paths"], done, 1);
            });
        }
    }

    it("allows not optimizing ids", function (done) {
        const inpath = "test/tei/simplified.rng";
        const expath = "test/tei/simplified-rng-not-optimized.js";

        salve_convert(inpath, expath, ["--simplified-input",
                                       "--allow-incomplete-types=quiet",
                                       "--no-optimize-ids"], done);
    });

    it("optimizes ids", function (done) {
        const inpath = "test/tei/simplified.rng";
        const expath = "test/tei/simplified-rng.js";

        salve_convert(inpath, expath, ["--simplified-input",
                                       "--allow-incomplete-types=quiet",
                                      ], done);
    });

    it("default execution", function (done) {
        const inpath = "test/tei/myTEI.rng";
        const expath = "test/tei/simplified-rng.js";

        salve_convert(inpath, expath, ["--allow-incomplete-types=quiet"], done);
    });

    it("include paths", function (done) {
        const inpath = "test/tei/myTEI.rng";
        const expath = "test/tei/simplified-rng.js";

        // Test created to deal with an internal error, so we don't
        // check the output.
        salve_convert(inpath, null, ["--allow-incomplete-types=quiet",
                                     "--include-paths"], done);
    });
});
