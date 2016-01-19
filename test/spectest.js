/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */

'use strict';
import "amd-loader";
import { assert } from "chai";
import { spawn } from "child_process";
import salve_parse from "../build/dist/lib/salve/parse";
import fs from "fs";
import path from "path";
import mocha from "mocha";

function fileAsString(p) {
    return fs.readFileSync(path.resolve(p), "utf8").toString();
}

var skips = {
    "test56": {
        // There is a bug in libxml2 which lets this one pass through.
        incorrect: true
    }
};

var spectest_dir = path.join(__dirname, "spectest");

var test_dirs = fs.readdirSync(spectest_dir);

function Test(test) {
    this.test = test;
    const p = this.path = path.join(spectest_dir, test);
    const incorrect = this.incorrect = [];
    const correct = this.correct = [];
    const valid = this.valid = [];
    const invalid = this.invalid = [];
    this.convert_args = [];

    for (let f of fs.readdirSync(p)) {
        if (f.lastIndexOf("incorrect", 0) === 0)
            incorrect.push(path.join(p, f));
        if (f.lastIndexOf("correct", 0) === 0)
            correct.push(path.join(p, f));
        if (f.lastIndexOf("valid", 0) === 0)
            valid.push(path.join(p, f));
        if (f.lastIndexOf("invalid", 0) === 0)
            invalid.push(path.join(p, f));
    }

    // More than 1 such case per test does not happen right now, so
    // simplify.
    if (correct.length > 1)
        throw new Error("we are not set for more than one correct case " +
                        "per test.");

    if (incorrect.length > 1)
        throw new Error("we are not set for more than one correct case " +
                        "per test.");

    this.correct = correct[0];
    this.incorrect = incorrect[0];
}

const tests = test_dirs.filter(
    x => fs.statSync(path.join(spectest_dir, x)).isDirectory())
        .map(x => {
    const ret = new Test(x);
    // test384 uses double
    if (x === "test384")
        ret.convert_args = ["--allow-incomplete-types=quiet"];
    return ret;
});

function salve_convert(args, callback) {
    const child = spawn("build/dist/bin/salve-convert", args);

    child.on('exit', (code, signal) => callback(code));
}

function parse(rng, xml, mute, callback) {
    callback(salve_parse(fileAsString(rng), fileAsString(xml), mute));
}

describe("spectest", function () {
    this.timeout(0);
    const outpath = ".tmp_rng_to_js_test";

    function clean() {
        if (fs.existsSync(outpath))
            fs.unlinkSync(outpath);
    }

    for (let t of tests) {
        const skip = skips[t.test] || {};
        if (!skip.incorrect && t.incorrect) {
            it(t.incorrect, done => {
                salve_convert(t.convert_args.concat([t.incorrect, outpath]),
                              code => {
                    assert.isFalse(code === 0, "salve-convert exit status");
                    clean();
                    done();
                });
            });
        }

        if (!skip.correct && t.correct) {
            const do_valid = !skip.valid && t.valid.length;
            const do_invalid = !skip.invalid && t.invalid.length;

            if (do_valid || do_invalid) {
                describe("valid and invalid cases", () => {
                    before(done => {
                        salve_convert(t.convert_args.concat([t.correct,
                                                             outpath]),
                                      code => {
                            assert.equal(code, 0, "salve-convert exit status");
                            done();
                        });
                    });

                    for (let vfile of t.valid) {
                        it(vfile, done => {
                            parse(outpath, vfile, false, code => {
                                assert.equal(code, 0, "parse exit status");
                                done();
                            });
                        });
                    }

                    for (let vfile of t.invalid) {
                        it(vfile, done => {
                            parse(outpath, vfile, true, code => {
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
