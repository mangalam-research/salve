'use strict';
require("amd-loader");
var rng_parse = require("../lib/salve/validate");
var fs = require("fs");
var path = require("path");
var sax = require("sax");
var parser = sax.parser(true, {xmlns: true});

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

var tree = rng_parse.constructTree(source);

var walker = tree.newWalker();

var error = false;

function fireEvent() {
    var ev = new rng_parse.Event(Array.prototype.slice.call(arguments));
    var ret = walker.fireEvent(ev);
    if (ret) {
        error = true;
        ret.forEach(function (x) {
            console.log("on event " + ev);
            console.log(x.toString());
        });
    }
}


var tag_stack = [];
var text_buf = "";

function flushTextBuf() {
    // This is a hack to simulate cases where "text"
    // events would be issued in sequence. Any ampersand
    // in the source marks a break, and adds an additional
    // "text" event.
    var chunk = text_buf.split(/&/);
    for(var x = 0; x < chunk.length; ++x)
        fireEvent("text", chunk[x]);
    text_buf = "";
}


parser.onopentag = function (node) {
    flushTextBuf();
    var names = Object.keys(node.attributes);
    var ns_definitions = [];
    names.sort();
    names.forEach(function (name) {
        var attr = node.attributes[name];
        if (attr.local === "" && name === "xmlns")// xmlns="..."
            ns_definitions.push(["", attr.value]);
        else if (attr.prefix == "xmlns") // xmlns:...=...
            ns_definitions.push([attr.local, attr.value]);
    });
    if (ns_definitions.length) {
        fireEvent("enterContext");
        ns_definitions.forEach(function (x) {
            fireEvent("definePrefix", x[0], x[1]);
        });
    }
    fireEvent("enterStartTag", node.uri, node.local);
    names.forEach(function (name) {
        var attr = node.attributes[name];
        // The parser handles all namespace issues
        if ((attr.local === "" && name === "xmlns") || // xmlns="..."
            (attr.prefix == "xmlns")) // xmlns:...=...
            return;
        fireEvent("attributeName", attr.uri, attr.local);
        fireEvent("attributeValue", attr.value);
    });
    fireEvent("leaveStartTag");
    tag_stack.unshift([node.uri, node.local, ns_definitions.length]);
};

parser.ontext = function (text) {
    text_buf += text;
};

parser.onclosetag = function (node) {
    flushTextBuf();
    var tag_info = tag_stack.shift();
    fireEvent("endTag", tag_info[0], tag_info[1]);
    if (tag_info[2])
        fireEvent("leaveContext");
};

parser.write(xml_source).close();

process.exit(error ? 1 : 0);

// LocalWords:  namespace xmlns attributeName attributeValue endTag
// LocalWords:  leaveStartTag enterStartTag amd utf fs LocalWords
