/* eslint-env node */

"use strict";

// eslint-disable-next-line import/no-unresolved, prefer-destructuring
const parse = require("../lib/salve/parse").parse;
const fs = require("fs");
const path = require("path");
const nodeFetch = require("node-fetch");

global.fetch = nodeFetch;

process.on("uncaughtException", (ex) => {
  if (ex instanceof Error) {
    process.stderr.write(ex.stack);
  }
  process.exit(2);
});


function fileAsString(p) {
  return fs.readFileSync(path.resolve(p), "utf8").toString();
}

const source = fileAsString(process.argv[2]);
const xmlSource = fileAsString(process.argv[3]);

parse(source, xmlSource).then((error) => {
  process.exit(error ? 1 : 0);
});

// LocalWords:  namespace xmlns attributeName attributeValue endTag
// LocalWords:  leaveStartTag enterStartTag amd utf fs LocalWords
