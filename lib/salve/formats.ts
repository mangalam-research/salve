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

const pro: any = patterns.__protected;

//
// MODIFICATIONS TO THIS TABLE MUST BE REFLECTED IN nameToConstructor
//
const codeToConstructor: Function[] = [
  Array,
  pro.Empty,
  pro.Data,
  pro.List,
  pro.Param,
  pro.Value,
  pro.NotAllowed,
  pro.Text,
  pro.Ref,
  pro.OneOrMore,
  pro.Choice,
  pro.Group,
  pro.Attribute,
  pro.Element,
  pro.Define,
  pro.Grammar,
  pro.EName,
  pro.Interleave,
  pro.Name,
  pro.NameChoice,
  pro.NsName,
  pro.AnyName,
];

//
// MODIFICATIONS TO THIS TABLE MUST BE REFLECTED IN codeToConstructor
//
const nameToConstructor: any = {
  // Array = 0 is hard-coded elsewhere in the conversion code so don't change
  // it.
  0: Array,
  Empty: pro.Empty,
  1: pro.Empty,
  Data: pro.Data,
  2: pro.Data,
  List: pro.List,
  3: pro.List,
  Param: pro.Param,
  4: pro.Param,
  Value: pro.Value,
  5: pro.Value,
  NotAllowed: pro.NotAllowed,
  6: pro.NotAllowed,
  Text: pro.Text,
  7: pro.Text,
  Ref: pro.Ref,
  8: pro.Ref,
  OneOrMore: pro.OneOrMore,
  9: pro.OneOrMore,
  Choice: pro.Choice,
  10: pro.Choice,
  Group: pro.Group,
  11: pro.Group,
  Attribute: pro.Attribute,
  12: pro.Attribute,
  Element: pro.Element,
  13: pro.Element,
  Define: pro.Define,
  14: pro.Define,
  Grammar: pro.Grammar,
  15: pro.Grammar,
  EName: pro.EName,
  16: pro.EName,
  Interleave: pro.Interleave,
  17: pro.Interleave,
  Name: pro.Name,
  18: pro.Name,
  NameChoice: pro.NameChoice,
  19: pro.NameChoice,
  NsName: pro.NsName,
  20: pro.NsName,
  AnyName: pro.AnyName,
  21: pro.AnyName,
};

//
// MODIFICATIONS TO THESE VARIABLES MUST BE REFLECTED IN rng-to-js.xsl
//

// This is a bit field
const OPTION_NO_PATHS: number = 1;
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
  /**
   *
   * @param options The options object from the file that contains the
   * schema.
   */
  constructor(private options: number) {
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
    const ctor: Function = codeToConstructor[kind];
    if (ctor === undefined) {
      if (array.length < 1) {
        throw new Error("array too small to contain object");
      }
      throw new Error(`undefined type: ${kind}`);
    }

    if (ctor === Array) {
      throw new Error("trying to build array with _constructObjectV2");
    }

    const addPath: boolean =
      // tslint:disable-next-line:no-bitwise
      ((this.options & OPTION_NO_PATHS) !== 0) && ctor !== pro.EName;

    let args: any[];
    if (array.length > 1) {
      args = array.slice(1);
      if (addPath) {
        args.unshift(0, "");
      }
      else {
        args.unshift(0);
      }
      this._transformArray(args);
    }
    else if (addPath) {
      args = [""];
    }
    else {
      args = [];
    }

    return this._processObject(ctor, args);
  }

  /**
   * Processes an object. Derived classes will want to override this method to
   * perform their work.
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
  _processObject(ctor: Function, args: any[]): any {
    return undefined; // Do nothing
  }

  _transformArray(arr: any[]): void {
    if (arr[0] !== 0) {
      throw new Error(`array type not 0, but ${arr[0]} for array ${arr}`);
    }

    arr.splice(0, 1);
    const limit: number = arr.length;
    for (let elIx: number = 0; elIx < limit; elIx++) {
      const el: any = arr[elIx];

      if (el instanceof Array) {
        if (el[0] !== 0) {
          arr[elIx] = this.walkObject(el);
        }
        else {
          this._transformArray(el);
        }
      }
    }
  }
}

/**
 * A JSON walker that constructs a pattern tree as it walks the JSON object.
 *
 * @private
 */
class V2Constructor extends V2JSONWalker {
  _processObject(ctor: Function, args: any[]): any {
    if (ctor === pro.Data && args.length >= 4) {
      // Parameters are represented as an array of strings in the file.
      // Transform this array of strings into an array of objects.
      const params: any[] = args[3];
      if (params.length % 2 !== 0) {
        throw new Error("parameter array length not a multiple of 2");
      }

      // tslint:disable-next-line: prefer-array-literal
      const newParams: any[] = new Array(params.length / 2);
      const limit: number = params.length;
      for (let i: number = 0; i < limit; i += 2) {
        newParams[i / 2] = { name: params[i], value: params[i + 1] };
      }
      args[3] = newParams;
    }
    else if (ctor === pro.OneOrMore) {
      //
      // In the file we have two arguments:
      //
      // * the XML path.
      // * An array of length 1 that contains the one subpattern.
      //
      // Here we ditch the array and replace it with its lone subpattern.
      //
      if (args[1].length !== 1) {
        throw new Error("OneOrMore with an array of patterns that " +
                        "contains other than 1 pattern");
      }
      args = [args[0], args[1][0]];
    }
    else if (ctor === pro.Attribute ||
             ctor === pro.Element ||
             ctor === pro.Define) {
      // Same thing as above, but for these elements the array of patterns is at
      // index 2 rather than index 1.
      if (args[2].length !== 1) {
        throw new Error("PatternOnePattern with an array of patterns that " +
                        "contains other than 1 pattern");
      }
      args = [args[0], args[1], args[2][0]];
    }
    else if (ctor === pro.Choice ||
             ctor === pro.Group ||
             ctor === pro.Interleave) {
      if (args[1].length !== 2) {
        throw new Error("PatternTwoPatterns with an array of patterns that " +
                        "contains other than 2 pattern");
      }
      args = [args[0], args[1][0], args[1][1]];
    }

    const newObj: any = Object.create(ctor.prototype);
    const ctorRet: any = ctor.apply(newObj, args);

    // Some constructors return a value; make sure to use it!
    return ctorRet !== undefined ? ctorRet : newObj;
  }
}

/**
 * Constructs a tree of patterns from the data structure produced by running
 * ``salve-convert`` on an RNG file.
 *
 * @param code The JSON representation.
 *
 * @throws {Error} When the version of the data is not supported.
 *
 * @returns The tree.
 */
export function constructTree(code: string): patterns.Grammar {
  const parsed: any = JSON.parse(code);
  if (typeof parsed === "object" && !parsed.v) {
    throw new OldFormatError(); // version 0
  }

  const { v: version, o: options, d: data }: { v: number, o: number, d: any }
    = parsed;
  if (version === 3) {
    return new V2Constructor(options as number).walkObject(data);
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

//  LocalWords:  MPL util oop rng js xsl JSON constructObjectV
//  LocalWords:  JSONWalker RNG
