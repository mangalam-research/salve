/**
 * This module contains data and utilities to work with the schema format that
 * salve uses natively.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import * as patterns from "./patterns";
import { fixPrototype } from "./tools";

const { Empty, Data, List, Param, Value, NotAllowed, Text, Ref, OneOrMore,
        Choice, Group, Attribute, Element, Define, Grammar, EName, Interleave,
        Name, NameChoice, NsName, AnyName } = patterns.__protected;

export type PatternCtor = { new (...args: any[]): patterns.BasePattern };

//
// MODIFICATIONS TO THIS TABLE MUST BE REFLECTED IN nameToConstructor
//
const codeToConstructor: (PatternCtor | typeof Array)[] = [
  Array,
  Empty,
  Data,
  List,
  Param,
  Value,
  NotAllowed,
  Text,
  Ref,
  OneOrMore,
  Choice,
  Group,
  Attribute,
  Element,
  Define,
  Grammar,
  EName,
  Interleave,
  Name,
  NameChoice,
  NsName,
  AnyName,
];

//
// MODIFICATIONS TO THIS TABLE MUST BE REFLECTED IN codeToConstructor
//
const nameToConstructor: Record<string, PatternCtor | typeof Array> = {
  // Array = 0 is hard-coded elsewhere in the conversion code so don't change
  // it.
  0: Array,
  Empty,
  1: Empty,
  Data,
  2: Data,
  List,
  3: List,
  Param,
  4: Param,
  Value,
  5: Value,
  NotAllowed,
  6: NotAllowed,
  Text,
  7: Text,
  Ref,
  8: Ref,
  OneOrMore,
  9: OneOrMore,
  Choice,
  10: Choice,
  Group,
  11: Group,
  Attribute,
  12: Attribute,
  Element,
  13: Element,
  Define,
  14: Define,
  Grammar,
  15: Grammar,
  EName,
  16: EName,
  Interleave,
  17: Interleave,
  Name,
  18: Name,
  NameChoice,
  19: NameChoice,
  NsName,
  20: NsName,
  AnyName,
  21: AnyName,
};

// This is a bit field
export const OPTION_NO_PATHS = 1;
// var OPTION_WHATEVER = 2;
// var OPTION_WHATEVER_PLUS_1 = 4;
// etc...

class OldFormatError extends Error {
  constructor() {
    super("your schema file must be recreated with a newer " +
          "version of salve-convert");
    fixPrototype(this, OldFormatError);
  }
}

/**
 * A class for walking the JSON object representing a schema.
 */
export class V2JSONWalker {
  private readonly addPath: boolean;
  /**
   *
   * @param options The options object from the file that contains the
   * schema.
   */
  constructor(private options: number) {
    // tslint:disable-next-line:no-bitwise
    this.addPath = (this.options & OPTION_NO_PATHS) !== 0;
  }

  /**
   * Walks a V2 representation of a JavaScript object.
   *
   * @param array The array representing the object.
   *
   * @throws {Error} If the object is malformed.
   *
   * @returns The return value of [[V2JSONWalker._processObject]].
   */
  walkObject(array: any[]): any {
    const kind: number = array[0];
    const ctor = codeToConstructor[kind];
    if (ctor === undefined) {
      if (array.length < 1) {
        throw new Error("array too small to contain object");
      }
      throw new Error(`undefined type: ${kind}`);
    }

    if (ctor === Array) {
      throw new Error("trying to build array with walkObject");
    }

    const args = array.slice(1);
    if (args.length !== 0) {
      this._transformArray(args);
    }
    if (this.addPath && ctor !== EName) {
      args.unshift("");
    }

    // We do not pass Array to this function.
    return this._processObject(kind, ctor as PatternCtor, args);
  }

  /**
   * Processes an object. Derived classes will want to override this method to
   * perform their work.
   *
   * @param kind The object "kind". A numeric code.
   *
   * @param ctor The object's constructor.
   *
   * @param args The arguments that should be passed to the constructor.
   *
   * @returns If the ``V2JSONWalker`` instance is meant to convert the JSON
   * data, then this method should return an Object. If the ``V2JSONWalker``
   * instance is meant to check the JSON data, then it should return
   * ``undefined``.
   */
  _processObject(kind: number, ctor: PatternCtor, args: any[]): any {
    return undefined; // Do nothing
  }

  _transformArray(arr: any[]): void {
    const limit = arr.length;
    for (let elIx = 0; elIx < limit; elIx++) {
      const el: any = arr[elIx];

      if (el instanceof Array) {
        if (el[0] !== 0) {
          arr[elIx] = this.walkObject(el);
        }
        else {
          el.shift(); // Drop the leading 0.
          this._transformArray(el);
        }
      }
    }
  }
}

type ArgFilter = (args: any[]) => any[];

function namedOnePatternFilter(args: any[]): any[] {
  // Same thing as for OneOrMore, but for these elements the array of patterns
  // is at index 2 rather than index 1 because index 1 contains a name.
  if (args[2].length !== 1) {
    throw new Error("PatternOnePattern with an array of patterns that " +
                    "contains other than 1 pattern");
  }

  return [args[0], args[1], args[2][0]];
}

function twoPatternFilter(args: any[]): any[] {
  if (args[1].length !== 2) {
    throw new Error("PatternTwoPatterns with an array of patterns that " +
                    "contains other than 2 pattern");
  }

  return [args[0], args[1][0], args[1][1]];
}

const kindToArgFilter: (ArgFilter | undefined)[] = [
  undefined, // Array
  undefined, // Empty,
  // Data
  (args: any[]) => {
    if (args.length >= 4) {
      // Parameters are represented as an array of strings in the file.
      // Transform this array of strings into an array of objects.
      const params: any[] = args[3];
      if (params.length % 2 !== 0) {
        throw new Error("parameter array length not a multiple of 2");
      }

      // tslint:disable-next-line: prefer-array-literal
      const newParams = new Array(params.length / 2);
      const limit = params.length;
      for (let i = 0; i < limit; i += 2) {
        newParams[i / 2] = { name: params[i], value: params[i + 1] };
      }

      args[3] = newParams;
    }

    return args;
  },
  undefined, // List,
  undefined, // Param,
  undefined, // Value,
  undefined, // NotAllowed,
  undefined, // Text,
  undefined, // Ref,
  // OneOrMore
  (args: any[]) => {
    //
    // In the file we have two arguments: the XML path, an array of length 1
    // that contains the one subpattern.
    //
    // Here we ditch the array and replace it with its lone subpattern.
    //
    if (args[1].length !== 1) {
      throw new Error("OneOrMore with an array of patterns that " +
                      "contains other than 1 pattern");
    }

    return [args[0], args[1][0]];
  },
  twoPatternFilter, // Choice,
  twoPatternFilter, // Group,
  namedOnePatternFilter, // Attribute
  namedOnePatternFilter, // Element,
  namedOnePatternFilter, // Define,
  undefined, // Grammar,
  undefined, // EName,
  twoPatternFilter, // Interleave,
  undefined, // Name,
  undefined, // NameChoice,
  undefined, // NsName,
  undefined, // AnyName,
];

/**
 * A JSON walker that constructs a pattern tree as it walks the JSON object.
 *
 * @private
 */
class V2Constructor extends V2JSONWalker {
  _processObject(kind: number, ctor: PatternCtor, args: any[]): any {
    const filter = kindToArgFilter[kind];
    if (filter !== undefined) {
      args = filter(args);
    }

    return new ctor(...args);
  }
}

/**
 * Constructs a tree of patterns from the data structure produced by running
 * ``salve-convert`` on an RNG file.
 *
 * @param code The JSON representation (a string) or the deserialized JSON. **If
 * you pass an object, it will be mutated while producing the result.** So you
 * cannot pass the same object twice to this function. Note that if you are
 * calling ``constructTree`` on the same input repeatedly, you are probably
 * "doing it wrong". You should be caching the results rather than building
 * multiple identical trees.
 *
 * @throws {Error} When the version of the data is not supported.
 *
 * @returns The tree.
 */
export function constructTree(code: string | {}): patterns.Grammar {
  const parsed = (typeof code === "string" ? JSON.parse(code) : code);
  if (typeof parsed === "object" && parsed.v === undefined) {
    throw new OldFormatError(); // version 0
  }

  const { v: version, o: options, d: data } = parsed;
  if (version === 3) {
    return new V2Constructor(options).walkObject(data);
  }

  throw new Error(`unknown version: ${version}`);
}

//
// Exports which are meant for other modules internal to salve.
//
// DO NOT USE THIS OUTSIDE SALVE! THIS EXPORT MAY CHANGE AT ANY TIME!
// YOU'VE BEEN WARNED!
//
// tslint:disable-next-line:variable-name
export const __protected: any = {
  V2JSONWalker,
  nameToConstructor,
  OPTION_NO_PATHS,
};

//  LocalWords:  deserialized PatternTwoPatterns PatternOnePattern OneOrMore js
//  LocalWords:  codeToConstructor nameToConstructor RNG subpattern JSON xsl
//  LocalWords:  rng MPL
