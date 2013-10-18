'use strict';
require("amd-loader");
var rng_parse = require("./validate");
var fs = require("fs");
var path = require("path");
var sax = require("sax");
var parser = sax.parser(true, {xmlns: true});

/**
 *
 * TBA
 * @param {TBA} p TBA
 * @returns {String} TBA
*/
function fileAsString(p) {
    return fs.readFileSync(path.resolve(p), "utf8").toString();
}

var source = fileAsString(process.argv[2]);
var xml_source = fileAsString(process.argv[3]);

var tree = rng_parse.constructTree(source);

var walker = tree.newWalker();

/**
 *
 * TBA
*/

function fireEvent() {
    var ev = new rng_parse.Event(Array.prototype.slice.call(arguments));
    var ret = walker.fireEvent(ev);
    if (ret) {
        ret.forEach(function (x) {
            console.log("on event " + ev);
            console.log(x.toString());
        });
    }
}


var tag_stack = [];


/**
 *
 * TBA
 * @param {Node} node TBA
*/

parser.onopentag = function (node) {
    fireEvent("enterStartTag", node.uri, node.local);
    var names = Object.keys(node.attributes);
    names.sort();
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
    tag_stack.unshift([node.uri, node.local]);
};

/**
 *
 * TBA
 * @param {TBA} text TBA
 * @returns {TBA} TBA
*/
parser.ontext = function (text) {
    text = text.trim();
    var issue = true;
    if (text === "") {
        var text_possible = walker.possible().filter(function (x) {
            return x[0] === "text";
        });
        issue = text_possible.length > 0;
    }
    if (issue) {
        // This is a hack to simulate cases where "text"
        // events would be issued in sequence. Any ampersand
        // in the source marks a break, and adds an additional
        // "text" event.
        var chunk = text.split(/&/);
        for(var x = 0; x < chunk.length; ++x)
            fireEvent("text");
    }
};

/**
 *
 * TBA
 * @param {Node} node
*/

parser.onclosetag = function (node) {
    var tag_info = tag_stack.shift();
    fireEvent("endTag", tag_info[0], tag_info[1]);
};

parser.write(xml_source).close();

// LocalWords:  namespace xmlns attributeName attributeValue endTag
// LocalWords:  leaveStartTag enterStartTag amd utf fs LocalWords
