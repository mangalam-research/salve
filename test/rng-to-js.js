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



describe("rng-to-js.xsl", function () {
    this.timeout(0);
    var outpath = ".tmp_rng_to_js_test";

    afterEach(function () {
        fs.unlinkSync(outpath);
    });

    function transform(inpath, expath, params, done) {
        var output = fs.openSync(outpath, 'w');
        var child = spawn("xsltproc", params.concat(
                          ["lib/salve/rng-to-js.xsl", inpath]),
                          {stdio: ["ignore", output]});
        fs.closeSync(output);
        child.on('exit', function (code, signal) {
            assert.equal(code, 0, "xsltproc exit status");
            // The actual output from diff would not be that useful here.
            spawn("diff", [outpath, expath], {stdio: 'ignore'})
                .on('exit', function (code, signal) {
                    assert.equal(code, 0, "there was a difference");
                    done();
            });
        });
    }

    it("v0 outputs paths with output-paths turned on", function (done) {
        var inpath = "test/tei/simplified.rng";
        var expath = "test/tei/simplified-rng.js";

        transform(inpath, expath, ["--param", "output-version", "0",
                                   "--param", "output-paths", "true()"], done);
    });

    it("v0 does not output paths by default", function (done) {
        var inpath = "test/tei/simplified.rng";
        var expath = "test/tei/simplified-rng-nopaths.js";

        transform(inpath, expath, ["--param", "output-version", "0"], done);
    });

    it("v1 does not output paths by default", function (done) {
        var inpath = "test/tei/simplified.rng";
        var expath = "test/tei/simplified-rng-v1.js";

        transform(inpath, expath, [], done);
    });
});
