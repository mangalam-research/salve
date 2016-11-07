/**
 * @desc A parser used for testing.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
"use strict";
/* eslint-disable no-console */
var validate = require("./validate");
var sax = require("sax");

var parser = sax.parser(true, { xmlns: true });

function parse(rngSource, xmlSource, mute) {
  mute = !!mute;

  var tree = validate.constructTree(rngSource);

  var walker = tree.newWalker();

  var error = false;

  function fireEvent() {
    var ev = new validate.Event(Array.prototype.slice.call(arguments));
    var ret = walker.fireEvent(ev);
    if (ret) {
      error = true;
      if (!mute) {
        ret.forEach(function forEach(x) {
          console.log("on event " + ev);
          console.log(x.toString());
        });
      }
    }
  }

  var tagStack = [];
  var textBuf = "";

  function flushTextBuf() {
    fireEvent("text", textBuf);
    textBuf = "";
  }


  parser.onopentag = function onopentag(node) {
    flushTextBuf();
    var names = Object.keys(node.attributes);
    var nsDefinitions = [];
    names.sort();
    names.forEach(function forEach(name) {
      var attr = node.attributes[name];
      if (attr.local === "" && name === "xmlns") { // xmlns="..."
        nsDefinitions.push(["", attr.value]);
      }
      else if (attr.prefix === "xmlns") { // xmlns:...=...
        nsDefinitions.push([attr.local, attr.value]);
      }
    });
    if (nsDefinitions.length) {
      fireEvent("enterContext");
      nsDefinitions.forEach(function forEach(x) {
        fireEvent("definePrefix", x[0], x[1]);
      });
    }
    fireEvent("enterStartTag", node.uri, node.local);
    names.forEach(function forEach(name) {
      var attr = node.attributes[name];
      // The parser handles all namespace issues
      if ((attr.local === "" && name === "xmlns") || // xmlns="..."
          (attr.prefix === "xmlns")) { // xmlns:...=...
        return;
      }
      fireEvent("attributeName", attr.uri, attr.local);
      fireEvent("attributeValue", attr.value);
    });
    fireEvent("leaveStartTag");
    tagStack.unshift([node.uri, node.local, nsDefinitions.length]);
  };

  parser.ontext = function ontext(text) {
    textBuf += text;
  };

  parser.onclosetag = function onclosetag(_node) {
    flushTextBuf();
    var tagInfo = tagStack.shift();
    fireEvent("endTag", tagInfo[0], tagInfo[1]);
    if (tagInfo[2]) {
      fireEvent("leaveContext");
    }
  };

  var entityRe = /^<!ENTITY\s+([^\s]+)\s+(['"])(.*?)\2\s*>\s*/;

  parser.ondoctype = function ondoctype(doctype) {
    // This is an extremely primitive way to handle ENTITY declarations in a
    // DOCTYPE. It is unlikely to support any kind of complicated construct.
    // If a reminder need be given then: THIS PARSER IS NOT MEANT TO BE A
    // GENERAL SOLUTION TO PARSING XML FILES!!! It supports just enough to
    // perform some testing.
    doctype = doctype
      .replace(/^.*?\[/, "")
      .replace(/].*?$/, "")
      .replace(/<!--(?:.|\n|\r)*?-->/g, "")
      .trim();

    while (doctype.length) {
      var match = entityRe.exec(doctype);
      if (match) {
        var name = match[1];
        var value = match[3];
        doctype = doctype.slice(match[0].length);
        if (parser.ENTITIES[name] !== undefined) {
          throw new Error("redefining entity: " + name);
        }
        parser.ENTITIES[name] = value;
      }
      else {
        throw new Error("unexpected construct in DOCTYPE: " + doctype);
      }
    }

    console.log(doctype);
  };

  parser.write(xmlSource).close();
  return error;
}

module.exports = parse;

// LocalWords:  namespace xmlns attributeName attributeValue endTag
// LocalWords:  leaveStartTag enterStartTag amd utf fs LocalWords
