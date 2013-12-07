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


function ConversionWalker1(include_paths) {
    ConversionWalker.call(this);
    this.include_paths = include_paths;
    this.ename_ctor = constructor_name_to_index["EName"];
    if (!this.ename_ctor)
        throw new Error("can't find constructor for EName");
}

oop.inherit(ConversionWalker1, ConversionWalker);

ConversionWalker1.prototype.walk = function (el) {
    el.makePath();

    var node = el.node;
    switch(node.local) {
    case "start":
        this.walkChildren(el);
        break;
    case "name":
        this.newItem();
        this.output.push('[' + this.ename_ctor);
        this.output.push(',"' + node.attributes["ns"].value + '"');
        this.output.push(',"' + el.children.join("") + '"');
        this.output.push(']');
        break;
    case "grammar":
        this.openConstruct("{", "}");
        this.outputItem('"v":1,"o":' + (this.include_paths ? 0 : 1) +
                        ',"d":');
        var constructor = constructor_name_to_index["Grammar"];
        if (!constructor)
            throw new Error("can't find constructor for " + capitalized);
        this.openConstruct("[", "]");
        this.newItem();
        this.output.push(constructor);
        if (this.include_paths)
            this.outputItem('"' + el.path + '"');
        this.walk(el.children[0]);
        this.newItem();
        this.openConstruct("[0,", "]");
        this.walkChildren(el, 1);
        this.closeConstruct("]");
        this.closeConstruct(']');
        this.closeConstruct("}");
        break;
    default:
        this.newItem();
        var capitalized =
                node.local.charAt(0).toUpperCase() + node.local.slice(1);
        var constructor = constructor_name_to_index[capitalized];
        if (!constructor)
            throw new Error("can't find constructor for " + capitalized);
        this.openConstruct("[", "]");
        this.newItem();
        this.output.push(constructor);
        if (this.include_paths)
            this.outputItem('"' + el.path + '"');
        switch(node.local) {
        case "ref":
            var name = node.attributes.name.value;
            if (typeof name === "number")
                this.outputItem(name);
            else
                this.outputItem('"' + name + '"');
            break;
        case "define":
            var name = node.attributes.name.value;
            if (typeof name === "number")
                this.outputItem(name);
            else
                this.outputItem('"' + name + '"');
            this.newItem();
            this.openConstruct("[0,", "]");
            this.walkChildren(el);
            this.closeConstruct("]");
            break;
        case "group":
        case "choice":
        case "oneOrMore":
            this.newItem();
            this.openConstruct("[0,", "]");
            this.walkChildren(el);
            this.closeConstruct("]");
            break;
        case "element":
        case "attribute":
            this.walk(el.children[0]);
            this.newItem();
            this.openConstruct("[0,", "]");
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

function ConversionWalker0(include_paths) {
    ConversionWalker.call(this);
    this.include_paths = include_paths;
    this.output = [];
}

oop.inherit(ConversionWalker0, ConversionWalker);

ConversionWalker0.prototype.walk = function (el) {
    el.makePath();

    var node = el.node;
    switch(node.local) {
    case "start":
        this.walkChildren(el);
        break;
    case "name":
        this.outputItem('{"type":"EName","args":["' +
                        node.attributes["ns"].value + '"' +
                        ',"' + el.children.join("") + '"]}');
        break;
    default:
        this.newItem();
        var capitalized =
                node.local.charAt(0).toUpperCase() + node.local.slice(1);
        this.openConstruct("{", "}");
        this.outputItem('"type":"' + capitalized + '"');
        this.outputItem('"args":');
        this.openConstruct("[", "]");
        this.outputItem('"' + (this.include_paths ? el.path : "") + '"');
        switch(node.local) {
        case "ref":
            this.outputItem('"' + node.attributes.name.value + '"');
            break;
        case "define":
            this.outputItem('"' + node.attributes.name.value + '"');
            this.newItem();
            this.openConstruct("[", "]");
            this.walkChildren(el);
            this.closeConstruct("]");
            break;
        case "group":
        case "choice":
        case "oneOrMore":
            this.newItem();
            this.openConstruct("[", "]");
            this.walkChildren(el);
            this.closeConstruct("]");
            break;
        case "grammar":
        case "element":
        case "attribute":
            this.walk(el.children[0]);
            this.newItem();
            this.openConstruct("[", "]");
            this.walkChildren(el, 1);
            this.closeConstruct("]");
            break;
        default:
            this.walkChildren(el);
        }
        this.closeConstruct("]");
        this.closeConstruct("}");
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

exports.ConversionWalker0 = ConversionWalker0;
exports.ConversionWalker1 = ConversionWalker1;
exports.NameGatherer = NameGatherer;
exports.Renamer = Renamer;

});
