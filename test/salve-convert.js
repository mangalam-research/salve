/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013 Mangalam Research Center for Buddhist Languages
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
        fs.unlinkSync(outpath);
    });

    function salve_convert(inpath, expath, params, done) {
        var child = spawn("bin/salve-convert", params.concat([inpath, outpath]),
                          {stdio: "inherit"});
        child.on('exit', function (code, signal) {
            assert.equal(code, 0, "salve-convert exit status");
            if (expath) {
                // The actual output from diff would not be that useful here.
                spawn("diff", [outpath, expath], {stdio: 'ignore'})
                .on('exit', function (code, signal) {
                    assert.equal(code, 0, "there was a difference");
                    done();
                });
            }
            else
                done();
        });
    }

    var dir = "test/salve-convert/";
    var tests = fs.readdirSync(dir);

    tests.forEach(function (t) {
        if (t.slice(-4) === ".rng") {
            var expected = t.slice(0, -4) + ".js";
            it("convert " + t, function (done) {
                salve_convert(dir + t, dir + expected, [], done);
            });
        }
    });

    it("when producing v1 does not output paths by default", function (done) {
        var inpath = "test/tei/simplified.rng";
        var expath = "test/tei/simplified-rng-v1.js";

        salve_convert(inpath, expath, ["--simplified-input",
                                       "--no-optimize-ids"], done);
    });

    it("optimizes ids", function (done) {
        var inpath = "test/tei/simplified.rng";
        var expath = "test/tei/simplified-rng-v1-optimized-ids.js";

        salve_convert(inpath, expath, ["--simplified-input"], done);
    });

    it("default execution", function (done) {
        var inpath = "test/tei/myTEI.rng";
        var expath = "test/tei/simplified-rng-v1-optimized-ids.js";

        salve_convert(inpath, expath, [], done);
    });

    it("include paths", function (done) {
        var inpath = "test/tei/myTEI.rng";
        var expath = "test/tei/simplified-rng-v1-optimized-ids.js";

        // Test created to deal with an internal error, so we don't
        // check the output.
        salve_convert(inpath, null, ["--include-paths"], done);
    });
});
