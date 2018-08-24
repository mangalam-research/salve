/**
 * This is a module that converts XMLSchema regular expressions to
 * plain JavaScript regular expressions.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
// tslint:disable-next-line:import-name no-submodule-imports
import base from "xregexp/lib/addons/unicode-base";
// tslint:disable-next-line:import-name no-submodule-imports
import blocks from "xregexp/lib/addons/unicode-blocks";
// tslint:disable-next-line:import-name no-submodule-imports
import categories from "xregexp/lib/addons/unicode-categories";
// tslint:disable-next-line:import-name no-submodule-imports
import XRegExp from "xregexp/lib/xregexp";

import { fixPrototype } from "../tools";
import { xmlLetter, xmlNameChar } from "./xmlcharacters";

base(XRegExp);
blocks(XRegExp);
categories(XRegExp);

//
// Terminology:
//
// - Character class: a square bracket construct in a regexp.
//
// - Positive character class: [...] without a leading caret.
//
// - Negative character class: [^...].
//
// - Positive match: a single character or range that a character must
//   match. (Negative character classes also contain positive
//   matches. In [^abc], "a", "b" and "c" are positive matches. The
//   character classe is negative but the individual characters are
//   positive.) The only thing this excludes are multi-char escapes
//   that match negatively like \S and \D.
//
// - Positive version of a multi-char escape: defined only for
//   multi-char escapes that expand to a negative character class; the
//   same character class but with the negating caret removed. So the
//   positive version of \S is \s, etc.
//
// The main transformation performed by this code is to deal with XML
// Schema regexp's multi character classes that have no class
// equivalent in JavaScript.
//
// Some simple identities:
//
// - [xy]  <-> (?:[x]|[y])
// - [^xy] <-> (?:(?![y])[^x])
// - (?![^x]) <-> (?=[x])
//
// Positive multi-char escape in a positive character class:
//
// - [x\s] -> (?:[x]|[ \t\r\n]) -> [x \t\r\n]
//
// Just expand the character class to its constituents.
//
// Negative multi-char escape in a positive character class:
//
// - [x\S] -> (?:[x]|[^ \t\r\n])
//
// - [x\S\D] -> (?:[x\D]|[^ \t\r\n])
//           -> (?:[x]|[^\p{Nd}]|[^ \t\r\n])
//
// So we output the positive matches in the class in one positive
// character class, and ``or`` it with one negative character class
// per negative multi-char escape.
//
// Positive multi-char escape in negative character class:
//
// - [^x\s] -> (?:(?![ \t\r\n])[^x])
//          -> [^x \t\r\n]
//
// Just expand the multi-char escape to its constituents.
//
// Negative multi-char escape in negative character class:
//
// - [^x\S] -> (?:(?![^ \t\r\n])[^x])
//          -> (?:(?=[ \t\r\n])[^x])
//
// - [^x\S\D] -> (?:(?![\S\D])[^x])
//            -> (?:(?![\S]|[\D])[^x])
//            -> (?:(?=[ \t\r\n\p{Nd}])[^x])
//
// So we output the positive matches in the class in one negative
// character class, and put a positive lookahead in front with a
// positive character class that matches the positive version of the
// negative multi-char escapes.
//
// Subtractions:
//
// -  [abcd-[bc]] -> (?:(?![bc])[abcd])
// -  [ad-[bc]]   -> (?:(?![bc])[ad])
// -  [abcd-[bc-[c]] -> (?:(?![bc-[c]])[abcd])
//                   -> (?:(?!(?![c])[bc])[abcd])
// -  [abcd-[^a]] -> (?:(?![^a])[abcd])

// We use the name ``Salve`` to help avoid potential clashes. ``ParsingError``
// seems too risky.
export class SalveParsingError extends Error {
  constructor(msg: string) {
    super(msg);
    fixPrototype(this, SalveParsingError);
  }
}

interface Construct {
  kind: string;
  output: string;
}

interface Root extends Construct {
  kind: "root";
  output: string;
}

interface Group extends Construct {
  kind: "group";
  output: string;
  negative: boolean;
  // We capture the negative multi-char escapes. Only the negative escapes
  // require special treatment.
  capturedMultiChar: string[];
  subtraction: boolean;
  toSubtract: string;
}

function isGroup(x: Construct): x is Group {
  return x.kind === "group";
}

const multiCharEscapesInGroup: Record<string, string> = {
  s: " \\t\\n\\r",
  S: "^ \\t\\n\\r",
  i: `${xmlLetter}_:`,
  I: `^${xmlLetter}_:`,
  c: xmlNameChar,
  C: `^${xmlNameChar}`,
  d: "\\p{Nd}",
  D: "^\\p{Nd}",
  w: "^\\p{P}\\p{Z}\\p{C}",
  W: "\\p{P}\\p{Z}\\p{C}",
};

const multiCharEscapes: Record<string, string> = Object.create(null);
for (const k of Object.keys(multiCharEscapesInGroup)) {
  multiCharEscapes[k] = `[${multiCharEscapesInGroup[k]}]`;
}

export function parse(input: string, outputType: "string"): string;
export function parse(input: string, outputType?: "re"): RegExp;
export function parse(input: string,
                      outputType: "re" | "string" = "re"): RegExp | string {
  const converted = convertString(input);

  return outputType === "re" ?
    new (/\\p/i.test(converted) ? XRegExp : RegExp)(converted) :
    converted;
}

// tslint:disable-next-line:max-func-body-length
function convertString(input: string): string {
  const root: Root = {
    kind: "root",
    output: "",
  };

  const stack: (Root | Group)[] = [root];
  for (let i = 0; i < input.length; ++i) {
    let top = stack[stack.length - 1];
    const c = input[i];
    switch (c) {
      case "(":
        top.output += "(?:";
        break;
      case "[": {
        const negative = input[i + 1] === "^";
        stack.push({
          kind: "group",
          output: negative ? "[^" : "[",
          negative,
          capturedMultiChar: [],
          subtraction: false,
          toSubtract: "",
        });

        if (negative) {
          i++;
        }
        break;
      }
      case "]": {
        if (isGroup(top)) {
          const group = top;
          stack.pop();
          top = stack[stack.length - 1];
          const { capturedMultiChar, negative } = group;
          const plain = `${group.output}]`;
          const toSubtract = group.toSubtract !== "" ?
            `(?!${group.toSubtract})` : "";
          if (capturedMultiChar.length !== 0) {
            let prefix = "";
            if (negative) {
              prefix = "(?=[";
              for (const multiChar of capturedMultiChar) {
                prefix += multiCharEscapesInGroup[multiChar].slice(1);
              }
              prefix += "])";
            }
            else {
              for (const multiChar of capturedMultiChar) {
                prefix += `[${multiCharEscapesInGroup[multiChar]}]|`;
              }
            }
            const combined = `(?:${toSubtract}${prefix}${plain})`;
            if (isGroup(top) && top.subtraction) {
              top.toSubtract = combined;
            }
            else {
              top.output += combined;
            }
          }
          else {
            const combined = toSubtract !== "" ?
              `(?:${toSubtract}${plain})` : plain;
            if (isGroup(top) && top.subtraction) {
              top.toSubtract = combined;
            }
            else {
              top.output += combined;
            }
          }
        }
        break;
      }
      case "-":
        if (isGroup(top) && input[i + 1] === "[") {
          top.subtraction = true;
        }
        else {
          top.output += c;
        }
        break;
      case "\\": {
        const next = input[i + 1];
        if ("sSiIcCdDwW".includes(next)) {
          i++;
          if (isGroup(top)) {
            const repl = multiCharEscapesInGroup[next];
            if (repl[0] === "^") {
              top.capturedMultiChar.push(next);
            }
            else {
              top.output += repl;
            }
          }
          else {
            top.output += multiCharEscapes[next];
          }
        }
        else {
          top.output += c;
        }
        break;
      }
      default:
        top.output += c;
    }
  }

  return `^${root.output}$`;
}
