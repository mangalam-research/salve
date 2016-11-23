/**
 * @desc This module contains classes for a conversion parser.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
"use strict";

var oop = require("../oop");

/**
 * @classdesc A base class for classes that perform parsing based on SAX
 * parsers.
 *
 * Derived classes should add methods named ``on<eventname>`` so as to form a
 * full name which matches the ``on<eventname>`` methods supported by SAX
 * parsers. The constructor will attach these methods to the SAX parser passed
 * and bind them so in them ``this`` is the ``Parser`` object. This allows
 * neatly packaged methods and private parameters.
 *
 * @class
 * @static
 *
 * @param saxParser A parser created by the ``sax-js`` libary or something
 * compatible.
 *
 * @property saxParser The parser passed when constructing the object.  Should
 * not be modified.
 */
function Parser(saxParser) {
  this.saxParser = saxParser;
  for (var name in this) {
    if (name.lastIndexOf("on", 0) === 0) {
      this.saxParser[name] = this[name].bind(this);
    }
  }
}

/**
 * @classdesc An Element produced by {@link module:conversion/parser.Parser
 * Parser}.
 *
 * This constructor will insert the created object into the parent automatically
 * if the parent is provided.
 *
 * @class
 * @static
 *
 * @param {module:conversion/parser.Element} parent The parent element, or a
 * falsy value if this is the root element.
 *
 * @param {Object} node The value of the ``node`` created by the SAX parser.
 *
 * @property {module:conversion/parser.Element} parent The parent.
 *
 * @property {Object} node The node.
 *
 * @property {Array.<module:conversion/parser.Element|string>} children The
 * element's chidren.
 *
 * @property {string} path The path of the element in its tree.
 */
function Element(parent, node) {
  this.parent = parent;
  this.node = node;
  this.children = [];
  this.path = undefined;
  if (parent) {
    parent.children.push(this);
  }
}

Element.prototype.makePath = function makePath() {
  if (this.path) {
    return;
  }

  if (!this.node) {
    this.path = "";
    return;
  }

  var pPath = "";
  if (this.parent) {
    this.parent.makePath();
    pPath = this.parent.path;
  }

  this.path = pPath + "/" + this.node.local;

  if ("name" in this.node.attributes) {
    this.path += "[@name='" + this.node.attributes.name.value + "']";
  }

  for (var i = 0; i < this.children.length; ++i) {
    var child = this.children[i];
    if (child instanceof Element && child.node.local === "name") {
      var val = child.children.join("");
      this.path += "[@name='" + val + "']";
      break;
    }
  }
};

/**
 * @classdesc A simple parser used for loading a XML document into memory.
 * Parsers of this class use {@link module:conversion/parser.Element Element}
 * objects to represent the tree of nodes.
 *
 * @class
 * @static
 * @extends module:conversion/parser.Parser
 *
 * @param saxParser A parser created by the ``sax-js`` libary or something
 * compatible.
 *
 * @property {Array.<module:conversion/parser.Element>} stack The stack of
 * elements. At the end of parsing, there should be only one element on the
 * stack, the root. This root is not an element that was in the XML file but a
 * holder for the tree of elements. It has a single child which is the root of
 * the actual file parsed.
 */
function ConversionParser() {
  Parser.apply(this, arguments);
  this.stack = [new Element()];
}

oop.inherit(ConversionParser, Parser);

ConversionParser.prototype.onopentag = function onopentag(node) {
  if (node.uri !== "http://relaxng.org/ns/structure/1.0") {
    throw new Error("node in unexpected namespace: " + node.uri);
  }

  var parent = this.stack[0];

  var me = new Element(parent, node);

  this.stack.unshift(me);
};

ConversionParser.prototype.onclosetag = function onclosetag(_name) {
  this.stack.shift();
};

ConversionParser.prototype.ontext = function ontext(text) {
  var top = this.stack[0];
  if (!top) {
    return;
  }
  if (text.trim() !== "") {
    top.children.push(text);
  }
};

exports.Element = Element;
exports.ConversionParser = ConversionParser;
