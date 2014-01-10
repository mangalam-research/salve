/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */

'use strict';
require("amd-loader");
var chai = require("chai");
var spawn = require("child_process").spawn;
var fs = require("fs");
var assert = chai.assert;

describe("salve-convert", function () {
    this.timeout(0);
    var outpath = ".tmp_rng_to_js_test";

    afterEach(function () {
        if (fs.exists(outpath))
            fs.unlinkSync(outpath);
    });

    function salve_convert(inpath, exp, params, done, exp_status) {
        if (exp_status === undefined)
            exp_status = 0;

        var child = spawn("build/dist/bin/salve-convert",
                          params.concat([inpath, outpath]),
                          (!exp_status) ? {stdio: "inherit"} :
                          {stdio: ["ignore", 1, "pipe"]});

        var stderr = [];
        if (exp_status) {
            child.stderr.on('data', function (data) {
                stderr.push(data);
            });
        }

        child.on('exit', function (code, signal) {
            assert.equal(code, exp_status, "salve-convert exit status");
            if (!exp_status && exp) {
                // The actual output from diff would not be that useful here.
                spawn("diff", [outpath, exp], {stdio: 'ignore'})
                .on('exit', function (code, signal) {
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

    var dir = "test/salve-convert/";
    var tests = fs.readdirSync(dir);

    tests.forEach(function (t) {
        if (t.slice(-4) !== ".rng")
            return;

        if (t.lastIndexOf("fails", 0) === -1) {
            var expected = t.slice(0, -4) + ".js";
            it("convert " + t, function (done) {
                salve_convert(dir + t, dir + expected, [], done);
            });
        }
        else {
            it("convert fails on " + t, function (done) {
                salve_convert(dir + t, dir + t.slice(0, -4) + ".txt",
                              ["--include-paths"], done, 1);
            });
        }
    });

    it("when producing v1 does not output paths by default", function (done) {
        var inpath = "test/tei/simplified.rng";
        var expath = "test/tei/simplified-rng-v1.js";

        salve_convert(inpath, expath, ["--simplified-input",
                                       "--allow-incomplete-types=quiet",
                                       "--no-optimize-ids"], done);
    });

    it("optimizes ids", function (done) {
        var inpath = "test/tei/simplified.rng";
        var expath = "test/tei/simplified-rng-v1-optimized-ids.js";

        salve_convert(inpath, expath, ["--simplified-input",
                                       "--allow-incomplete-types=quiet",
                                      ], done);
    });

    it("default execution", function (done) {
        var inpath = "test/tei/myTEI.rng";
        var expath = "test/tei/simplified-rng-v1-optimized-ids.js";

        salve_convert(inpath, expath, ["--allow-incomplete-types=quiet"], done);
    });

    it("include paths", function (done) {
        var inpath = "test/tei/myTEI.rng";
        var expath = "test/tei/simplified-rng-v1-optimized-ids.js";

        // Test created to deal with an internal error, so we don't
        // check the output.
        salve_convert(inpath, null, ["--allow-incomplete-types=quiet",
                                     "--include-paths"], done);
    });
});
