/**
 * This module contains utilities for reading salve's internal schema format.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { Grammar } from "../patterns";
import { fixPrototype } from "../tools";
import { codeToConstructor, OPTION_NO_PATHS, PatternCtor } from "./common";

class OldFormatError extends Error {
  constructor() {
    super("your schema file must be recreated with a newer " +
          "version of salve-convert");
    fixPrototype(this, OldFormatError);
  }
}

type KindAndArgs = [number, ...any[]];

/**
 * A class for walking the JSON object representing a schema.
 */
class V2JSONWalker {
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
  walkObject(array: KindAndArgs): unknown {
    const kind = array[0];
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
    if (this.addPath) {
      args.unshift("");
    }

    // We do not pass Array to this function.
    return this._processObject(kind, ctor as PatternCtor, args as PathAndArgs);
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
  _processObject(kind: number, ctor: PatternCtor, args: PathAndArgs): unknown {
    return undefined; // Do nothing
  }

  _transformArray(arr: unknown[]): void {
    const limit = arr.length;
    for (let elIx = 0; elIx < limit; elIx++) {
      const el = arr[elIx];

      if (el instanceof Array) {
        if (el[0] !== 0) {
          arr[elIx] = this.walkObject(el as KindAndArgs);
        }
        else {
          el.shift(); // Drop the leading 0.
          this._transformArray(el);
        }
      }
    }
  }
}

type PathAndArgs = [string, ...any[]];
type ArgFilter = (args: PathAndArgs) => PathAndArgs;

function namedOnePatternFilter(args: PathAndArgs): PathAndArgs {
  // Same thing as for OneOrMore, but for these elements the array of patterns
  // is at index 2 rather than index 1 because index 1 contains a name.
  if (args[2].length !== 1) {
    throw new Error("PatternOnePattern with an array of patterns that " +
                    "contains other than 1 pattern");
  }

  return [args[0], args[1], args[2][0]];
}

function twoPatternFilter(args: PathAndArgs): PathAndArgs {
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
  (args: PathAndArgs) => {
    if (args.length >= 4) {
      // Parameters are represented as an array of strings in the file.
      // Transform this array of strings into an array of objects.
      const params = args[3];
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
  (args: PathAndArgs) => {
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
  twoPatternFilter, // NameChoice,
  undefined, // NsName,
  undefined, // AnyName,
];

/**
 * A JSON walker that constructs a pattern tree as it walks the JSON object.
 *
 * @private
 */
class V2Constructor extends V2JSONWalker {
  _processObject(kind: number, ctor: PatternCtor, args: PathAndArgs): unknown {
    const filter = kindToArgFilter[kind];

    return new ctor(...(filter === undefined ? args : filter(args)));
  }
}

/**
 * Constructs a tree of patterns from the data structure produced by running
 * ``salve-convert`` on an RNG file.
 *
 * @param code The JSON representation (a string) or the deserialized JSON. **If
 * you pass an object, it will be mutated while producing the result.** So you
 * cannot pass the same object twice to this function. Note that if you are
 * calling this function on the same input repeatedly, you are probably "doing
 * it wrong". You should be caching the results rather than building multiple
 * identical trees.
 *
 * @throws {Error} When the version of the data is not supported.
 *
 * @returns The tree.
 */
export function readTreeFromJSON(code: string | {}): Grammar {
  const parsed = (typeof code === "string" ? JSON.parse(code) : code);
  if (typeof parsed === "object" && parsed.v === undefined) {
    throw new OldFormatError(); // version 0
  }

  const { v: version, o: options, d: data } = parsed;
  if (version === 3) {
    return new V2Constructor(options).walkObject(data) as Grammar;
  }

  throw new Error(`unknown version: ${version}`);
}

export const constructTree = readTreeFromJSON;

//  LocalWords:  deserialized PatternTwoPatterns PatternOnePattern OneOrMore js
//  LocalWords:  codeToConstructor nameToConstructor RNG subpattern JSON xsl
//  LocalWords:  rng MPL
