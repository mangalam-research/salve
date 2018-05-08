/**
 * A parser used for testing.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
"use strict";
// tslint:disable-next-line:no-require-imports import-name
import fileURL = require("file-url");
import * as fs from "fs";
import * as path from "path";
import * as sax from "sax";

import { convertRNGToPattern, Grammar, readTreeFromJSON } from "./validate";

// tslint:disable no-console

declare module "sax" {
  export interface SAXParser {
    ENTITIES: {[key: string]: string};
  }
}

const parser = sax.parser(true, { xmlns: true });

type TagInfo = {
  uri: string;
  local: string;
  hasContext: boolean;
};

async function grammarFromSource(rngSource: string | Grammar):
Promise<Grammar> {
  if (rngSource instanceof Grammar) {
    return rngSource;
  }

  const rngSourceContent = fs.readFileSync(path.resolve(rngSource),
                                           "utf8").toString();
  // We try loading the tree as a JSON file. It may not work if the file is not
  // actually JSON.
  let obj: {} | undefined;
  try {
    obj = JSON.parse(rngSourceContent);
  }
  // tslint:disable-next-line:no-empty
  catch {}

  if (obj !== undefined) {
    return readTreeFromJSON(obj);
  }

  // Treat it as a Relax NG schema.
  return (await convertRNGToPattern(new URL(fileURL(rngSource)))).pattern;
}

/**
 * Parse an XML file and validate it against a schema. This function is meant
 * for **illustration purposes** and is used in testing. It does cut
 * corners. You should not use this for production code.
 *
 * @param rngSource It may be a [[Grammar]] object pre-built from the Relax NG
 * schema you want to use. Or it can be a JSON string, which is the contents of
 * a file created with ``salve-convert``. Or it can be a path to a local file.
 *
 * @param xmlSource The XML contents to parse and validate.
 *
 * @param mute If true, don't report errors verbosely.
 *
 * @returns A promise resolving ``true`` if there were errors, ``false``
 * otherwise.
 */
// tslint:disable-next-line: max-func-body-length
export async function parse(rngSource: string | Grammar,
                            xmlSource: string,
                            mute: boolean): Promise<boolean> {
  // tslint:disable-next-line:no-parameter-reassignment
  mute = !!mute;

  const tree = await grammarFromSource(rngSource);

  const walker = tree.newWalker();

  let error = false;

  function fireEvent(name: string, args: any[]): void {
    const ret = walker.fireEvent(name, args);
    if (ret instanceof Array) {
      error = true;
      if (!mute) {
        for (const err of ret) {
          console.log(`on event ${name}, ${args.join(", ")}`);
          console.log(err.toString());
        }
      }
    }
  }

  const tagStack: TagInfo[] = [];
  let textBuf = "";

  function flushTextBuf(): void {
    if (textBuf !== "") {
      fireEvent("text", [textBuf]);
      textBuf = "";
    }
  }

  parser.onopentag = (node: sax.QualifiedTag) => {
    flushTextBuf();
    const names = Object.keys(node.attributes);
    const nsDefinitions = [];
    const attributeEvents = [];
    names.sort();
    for (const name of names) {
      const attr = node.attributes[name];
      if (attr.local === "" && name === "xmlns") { // xmlns="..."
        nsDefinitions.push(["", attr.value]);
      }
      else if (attr.prefix === "xmlns") { // xmlns:...=...
        nsDefinitions.push([attr.local, attr.value]);
      }
      else {
        attributeEvents.push(["attributeName", attr.uri, attr.local],
                             ["attributeValue", attr.value]);
      }
    }
    if (nsDefinitions.length !== 0) {
      walker.enterContext();
      for (const definition of nsDefinitions) {
        walker.definePrefix(definition[0], definition[1]);
      }
    }
    fireEvent("enterStartTag", [node.uri, node.local]);
    for (const event of attributeEvents) {
      fireEvent(event[0], event.slice(1));
    }
    fireEvent("leaveStartTag", []);
    tagStack.unshift({
      uri: node.uri,
      local: node.local,
      hasContext: nsDefinitions.length !== 0,
    });
  };

  parser.ontext = (text: string) => {
    textBuf += text;
  };

  parser.onclosetag = () => {
    flushTextBuf();
    const tagInfo = tagStack.shift();
    if (tagInfo === undefined) {
      throw new Error("stack underflow");
    }
    fireEvent("endTag", [tagInfo.uri, tagInfo.local]);
    if (tagInfo.hasContext) {
      walker.leaveContext();
    }
  };

  const entityRe = /^<!ENTITY\s+([^\s]+)\s+(['"])(.*?)\2\s*>\s*/;

  parser.ondoctype = (doctype: string) => {
    // This is an extremely primitive way to handle ENTITY declarations in a
    // DOCTYPE. It is unlikely to support any kind of complicated construct.
    // If a reminder need be given then: THIS PARSER IS NOT MEANT TO BE A
    // GENERAL SOLUTION TO PARSING XML FILES!!! It supports just enough to
    // perform some testing.
    let cleaned = doctype
      .replace(/^.*?\[/, "")
      .replace(/].*?$/, "")
      .replace(/<!--(?:.|\n|\r)*?-->/g, "")
      .trim();

    while (cleaned.length !== 0) {
      const match = entityRe.exec(cleaned);
      if (match !== null) {
        const name = match[1];
        const value = match[3];
        cleaned = cleaned.slice(match[0].length);
        if (parser.ENTITIES[name] !== undefined) {
          throw new Error(`redefining entity: ${name}`);
        }
        parser.ENTITIES[name] = value;
      }
      else {
        throw new Error(`unexpected construct in DOCTYPE: ${doctype}`);
      }
    }

    console.log(doctype);
  };

  parser.write(xmlSource).close();

  return error;
}

//  LocalWords:  doctype DOCTYPE leaveContext definePrefix enterContext ev MPL
//  LocalWords:  enterStartTag leaveStartTag endTag attributeValue xmlns
//  LocalWords:  attributeName namespace
