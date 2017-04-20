/**
 * A parser used for testing.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
"use strict";
import * as sax from "sax";
import * as salve from "./validate";

// tslint:disable no-console

declare module "sax" {
  export interface SAXParser {
    ENTITIES: {[key: string]: string};
  }
}

const parser: sax.SAXParser = sax.parser(true, { xmlns: true });

type TagInfo = {
  uri: string,
  local: string,
  hasContext: boolean,
};

// tslint:disable-next-line: max-func-body-length
function parse(rngSource: string, xmlSource: string, mute: boolean): boolean {
  mute = !!mute;

  const tree: salve.Grammar = salve.constructTree(rngSource);

  const walker: salve.Walker<salve.BasePattern> = tree.newWalker();

  let error: boolean = false;

  function fireEvent(...args: any[]): void {
    const ev: salve.Event = new salve.Event(args);
    const ret: salve.FireEventResult = walker.fireEvent(ev);
    if (ret instanceof Array) {
      error = true;
      if (!mute) {
        ret.forEach((x: salve.ValidationError) => {
          console.log("on event " + ev.toString());
          console.log(x.toString());
        });
      }
    }
  }

  const tagStack: TagInfo[] = [];
  let textBuf: string = "";

  function flushTextBuf(): void {
    fireEvent("text", textBuf);
    textBuf = "";
  }

  parser.onopentag = (node: sax.QualifiedTag) => {
    flushTextBuf();
    const names: string[] = Object.keys(node.attributes);
    const nsDefinitions: string[][] = [];
    names.sort();
    names.forEach((name: string) => {
      const attr: sax.QualifiedAttribute = node.attributes[name];
      if (attr.local === "" && name === "xmlns") { // xmlns="..."
        nsDefinitions.push(["", attr.value]);
      }
      else if (attr.prefix === "xmlns") { // xmlns:...=...
        nsDefinitions.push([attr.local, attr.value]);
      }
    });
    if (nsDefinitions.length !== 0) {
      fireEvent("enterContext");
      nsDefinitions.forEach((x: string[]) => {
        fireEvent("definePrefix", x[0], x[1]);
      });
    }
    fireEvent("enterStartTag", node.uri, node.local);
    names.forEach((name: string) => {
      const attr: sax.QualifiedAttribute = node.attributes[name];
      // The parser handles all namespace issues
      if ((attr.local === "" && name === "xmlns") || // xmlns="..."
          (attr.prefix === "xmlns")) { // xmlns:...=...
        return;
      }
      fireEvent("attributeName", attr.uri, attr.local);
      fireEvent("attributeValue", attr.value);
    });
    fireEvent("leaveStartTag");
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
    const tagInfo: TagInfo | undefined = tagStack.shift();
    if (tagInfo === undefined) {
      throw new Error("stack underflow");
    }
    fireEvent("endTag", tagInfo.uri, tagInfo.local);
    if (tagInfo.hasContext) {
      fireEvent("leaveContext");
    }
  };

  const entityRe: RegExp = /^<!ENTITY\s+([^\s]+)\s+(['"])(.*?)\2\s*>\s*/;

  parser.ondoctype = (doctype: string) => {
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

    while (doctype.length !== 0) {
      const match: RegExpMatchArray | null = entityRe.exec(doctype);
      if (match !== null) {
        const name: string = match[1];
        const value: string = match[3];
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
