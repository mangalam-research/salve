'use strict';
require("amd-loader");
var parse = require("../lib/salve/parse");
var fs = require("fs");
var path = require("path");

process.on('uncaughtException', function (ex) {
    if (ex instanceof Error)
        process.stderr.write(ex.stack);
    process.exit(2);
});


function fileAsString(p) {
    return fs.readFileSync(path.resolve(p), "utf8").toString();
}

var source = fileAsString(process.argv[2]);
var xml_source = fileAsString(process.argv[3]);

var error = parse(source, xml_source);

process.exit(error ? 1 : 0);

// LocalWords:  namespace xmlns attributeName attributeValue endTag
// LocalWords:  leaveStartTag enterStartTag amd utf fs LocalWords
