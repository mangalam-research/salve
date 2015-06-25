/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */

'use strict';
require("amd-loader");
var chai = require("chai");
var spawn = require("child_process").spawn;
var salve_parse = require("../build/dist/lib/salve/parse");
var fs = require("fs");
var path = require("path");
var assert = chai.assert;
var mocha = require("mocha");

function fileAsString(p) {
    return fs.readFileSync(path.resolve(p), "utf8").toString();
}

var skips = {
    "test56": {
        // There is a bug in libxml2 which lets this one pass through.
        incorrect: true
    }
};

// No except support yet.
[142, 264, 267].forEach(function (x) {
    skips["test" + x] = {correct : true};
});

var spectest_dir = path.join(__dirname, "spectest");

var test_dirs = fs.readdirSync(spectest_dir);

function Test(test) {
    this.test = test;
    var p = this.path = path.join(spectest_dir, test);
    var incorrect = this.incorrect = [];
    var correct = this.correct = [];
    var valid = this.valid = [];
    var invalid = this.invalid = [];
    this.convert_args = [];

    var files = fs.readdirSync(p);

    files.forEach(function (f) {
        if (f.lastIndexOf("incorrect", 0) === 0)
            incorrect.push(path.join(p, f));
        if (f.lastIndexOf("correct", 0) === 0)
            correct.push(path.join(p, f));
        if (f.lastIndexOf("valid", 0) === 0)
            valid.push(path.join(p, f));
        if (f.lastIndexOf("invalid", 0) === 0)
            invalid.push(path.join(p, f));
    });

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

var tests = test_dirs.filter(function (x) {
    return fs.statSync(path.join(spectest_dir, x)).isDirectory();
}).map(function (x) {
    var ret = new Test(x);
    // test384 uses double
    if (x === "test384")
        ret.convert_args = ["--allow-incomplete-types=quiet"];
    return ret;

});

function salve_convert(args, callback) {
    var child = spawn("build/dist/bin/salve-convert", args);

    child.on('exit', function (code, signal) {
        callback(code);
    });
}

function parse(rng, xml, mute, callback) {
    var code = salve_parse(fileAsString(rng), fileAsString(xml), mute);
    callback(code);
}

describe("spectest", function () {
    this.timeout(0);
    var outpath = ".tmp_rng_to_js_test";

    function clean() {
        if (fs.existsSync(outpath))
            fs.unlinkSync(outpath);
    }

    tests.forEach(function (t) {
        var skip = skips[t.test] || {};
        if (!skip.incorrect && t.incorrect) {
            it(t.incorrect, function (done) {
                salve_convert(t.convert_args.concat([t.incorrect, outpath]),
                              function (code) {
                    assert.isFalse(code === 0, "salve-convert exit status");
                    clean();
                    done();
                });
            });
        }

        if (!skip.correct && t.correct) {
            var do_valid = !skip.valid && t.valid.length;
            var do_invalid = !skip.invalid && t.invalid.length;

            if (do_valid || do_invalid) {
                describe("valid and invalid cases", function () {
                    before(function (done) {
                        salve_convert(t.convert_args.concat([t.correct,
                                                             outpath]),
                                      function (code) {
                            assert.equal(code, 0, "salve-convert exit status");
                            done();
                        });
                    });

                    t.valid.forEach(function (vfile) {
                        it(vfile, function (done) {
                            parse(outpath, vfile, false, function (code) {
                                assert.equal(code, 0, "parse exit status");
                                done();
                            });
                        });
                    });

                    t.invalid.forEach(function (vfile) {
                        it(vfile, function (done) {
                            parse(outpath, vfile, true, function (code) {
                                assert.equal(code, 1, "parse exit status");
                                done();
                            });
                        });
                    });

                    after(clean);
                });
            }
        }
    });
});
