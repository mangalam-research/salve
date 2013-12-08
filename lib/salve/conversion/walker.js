/**
 * @module conversion/walker
 * @desc This module contains classes for walking a parsed tree.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013 Mangalam Research Center for Buddhist Languages
 */
define(/** @lends module:conversion/walker */
    function (require, exports, module) {
'use strict';

var oop = require("../oop");
var parser = require("./parser");
var formats = require("../formats");
var Element = parser.Element;

var name_to_constructor = formats.__protected.name_to_constructor;
var constructors = [];
var i = 0;
while(name_to_constructor[i]) {
    constructors[i] = name_to_constructor[i];
    i++;
}

var constructor_name_to_index = {};
for(var name in name_to_constructor) {
    if (!(name in constructors)) {
        // Not a number
        constructor_name_to_index[name] =
            constructors.indexOf(name_to_constructor[name]);
    }
}


/**
 * @classdesc Base class for walkers.
 * @class
 *
 * @property {Array.<string>} output The output of the conversion as
 * an array of strings to be concatenated.
 */
function ConversionWalker() {
    this.construct_state = [{open: "", close: "", first: true}];
    this.output = [];
}

/**
 * Opens a construct in the output.
 *
 * @param {string} open The opening string
 * @param {string} close The closing string. This will be used to
 * check that the construct is closed properly.
 */
ConversionWalker.prototype.openConstruct = function (open, close) {
    this.construct_state.unshift({open: open, close: close, first: true});
    this.output.push(open);
};

/**
 * Closes a construct in the output.
 *
 * @param {string} close The closing string. This will be used to
 * check that the construct is closed properly.
 * @throws {Error} If the ``close`` parameter does not match what was
 * passed to {@link
 * module:conversion/walker~ConversionWalker#openConstruct
 * openConstruct}.
 */
ConversionWalker.prototype.closeConstruct = function (close) {
    var top = this.construct_state.shift();
    if (close !== top.close)
        throw new Error('construct mismatch: ' + top.close + ' vs' + close);
    this.output.push(close);
};

/**
 * Indicates that a new item is about to start in the current
 * construct. Outputs a separator (",") if this is not the first item
 * in the construct.
 */
ConversionWalker.prototype.newItem = function() {
    if (!this.construct_state[0].first)
        this.output.push(",");
    this.construct_state[0].first = false;
};

/**
 * Outputs an item in the current construct. Outputs a separator (",")
 * if this is not the first item in the construct.
 *
 * @param {string} item The item to output.
 */
ConversionWalker.prototype.outputItem = function(item) {
    this.newItem();
    this.output.push(item);
};


/**
 * Outputs an string in the current construct. Outputs a separator
 * (",") if this is not the first item in the construct. The
 * double-quotes in the string will be escaped and the string will be
 * surrounded by double quotes in the output.
 *
 * @param {string} string The string to output.
 */
ConversionWalker.prototype.outputString = function(string) {
    this.newItem();

    var to_output = JSON.stringify(string);
    this.output.push(to_output);
};

/**
 * Walks a element's children.
 *
 * @param {module:conversion/parser~Element} el The element whose
 * children must be walked.
 * @param {integer} start_at Index at which to start walking.
 */
ConversionWalker.prototype.walkChildren = function (el, start_at) {
    if (!start_at)
        start_at = 0;
    var children = el.children;
    var limit = children.length;
    for(var i = start_at; i < limit; ++i) {
        var child = children[i];
        if (child instanceof Element)
            this.walk(child);
    }
};

/**
 * Walk an element.
 *
 * @param {module:conversion/parser~Element} el The element whose
 * children must be walked.
 */
ConversionWalker.prototype.walk = function (el) {
    throw new Error("derived classes must implement this");
};


function ConversionWalker1(include_paths, verbose_format) {
    ConversionWalker.call(this);
    this.include_paths = include_paths;
    this.verbose_format = verbose_format;
    this.ename_start = this.verbose_format ? '"EName"' :
        constructor_name_to_index.EName;
    if (!this.ename_start)
        throw new Error("can't find constructor for EName");
    this.array_start = this.verbose_format ? '"Array"' : 0;
}

oop.inherit(ConversionWalker1, ConversionWalker);

ConversionWalker1.prototype.openArray = function () {
    this.openConstruct("[", "]");
    this.outputItem(this.array_start);
};

ConversionWalker1.prototype.walk = function (el) {
    el.makePath();

    var name, constructor;  // Damn hoisting.

    var node = el.node;
    switch(node.local) {
    case "start":
        this.walkChildren(el);
        break;
    case "name":
        this.newItem();
        this.openConstruct("[", "]");
        this.outputItem(this.ename_start);
        this.outputString(node.attributes.ns.value);
        this.outputString(el.children.join(""));
        this.closeConstruct("]");
        break;
    case "grammar":
        this.openConstruct("{", "}");
        this.outputItem('"v":1,"o":' + (this.include_paths ? 0 : 1) +
                        ',"d":');
        constructor = constructor_name_to_index.Grammar;
        if (!constructor)
            throw new Error("can't find constructor for " + capitalized);
        this.openConstruct("[", "]");
        if (this.verbose_format)
            this.outputString("Grammar");
        else
            this.outputItem(constructor);
        if (this.include_paths)
            this.outputString(el.path);
        this.walk(el.children[0]);
        this.newItem();
        this.openArray();
        this.walkChildren(el, 1);
        this.closeConstruct("]");
        this.closeConstruct(']');
        this.closeConstruct("}");
        break;
    default:
        this.newItem();
        var capitalized =
                node.local.charAt(0).toUpperCase() + node.local.slice(1);
        constructor = constructor_name_to_index[capitalized];
        if (!constructor)
            throw new Error("can't find constructor for " + capitalized);
        this.openConstruct("[", "]");
        if (this.verbose_format)
            this.outputString(capitalized);
        else
            this.outputItem(constructor);
        if (this.include_paths)
            this.outputString(el.path);
        switch(node.local) {
        case "ref":
            name = node.attributes.name.value;
            if (typeof name === "number")
                this.outputItem(name);
            else
                this.outputString(name);
            break;
        case "define":
            name = node.attributes.name.value;
            if (typeof name === "number")
                this.outputItem(name);
            else
                this.outputString(name);
            this.newItem();
            this.openArray();
            this.walkChildren(el);
            this.closeConstruct("]");
            break;
        case "value":
            // Output a variable number of items.
            // Suppose item 0 is called it0 and so forth. Then:
            //
            // value  type    datatypeLibrary  ns
            // it0    "token" ""               ""
            // it0     it1    ""               ""
            // it0     it1    it2              ""
            // it0     it1    it2              it3
            //
            this.outputString(el.children.join(""));
            if (node.attributes.type.value !== "token" ||
                node.attributes.datatypeLibrary.value !== "" ||
                node.attributes.ns.value !== "") {
                this.outputString(node.attributes.type.value);
                if (node.attributes.datatypeLibrary.value !== "" ||
                    node.attributes.ns.value !== "") {
                    this.outputString(node.attributes.datatypeLibrary.value);
                    // No value === empty string.
                    if (node.attributes.ns.value !== "")
                        this.outputString(node.attributes.ns.value);
                }
            }
            break;
        case "group":
        case "choice":
        case "oneOrMore":
            this.newItem();
            this.openArray();
            this.walkChildren(el);
            this.closeConstruct("]");
            break;
        case "element":
        case "attribute":
            this.walk(el.children[0]);
            this.newItem();
            this.openArray();
            this.walkChildren(el, 1);
            this.closeConstruct("]");
            break;
        default:
            this.walkChildren(el);
        }
        this.closeConstruct(']');
        break;
    }
};

function NameGatherer() {
    ConversionWalker.call(this);
    this.names = {};
}

oop.inherit(NameGatherer, ConversionWalker);

NameGatherer.prototype.walk = function(el) {
    this.walkChildren(el);
    if (el.node.local === "define" || el.node.local === "ref") {
        var name = el.node.attributes.name.value;
        if (!(name in this.names))
            this.names[name] = 0;

        this.names[name]++;

    }
};

function Renamer(names) {
    ConversionWalker.call(this);
    this.names = names;
}
oop.inherit(Renamer, ConversionWalker);

Renamer.prototype.walk = function(el) {
    if (el.node.local === "define" || el.node.local === "ref") {
        el.node.attributes.name.value =
            this.names[el.node.attributes.name.value];
    }
    this.walkChildren(el);
};

exports.ConversionWalker1 = ConversionWalker1;
exports.NameGatherer = NameGatherer;
exports.Renamer = Renamer;

});
