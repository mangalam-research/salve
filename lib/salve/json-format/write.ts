/**
 * This module contains classes for writing salve's internal schema format.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { Element, Node } from "../conversion";
import { isElement } from "../conversion/parser";
import { nameToCode, OPTION_NO_PATHS } from "./common";

class RNGToJSONConverter {
  protected readonly arrayStart: string | number;
  protected _output: string = "";

  /**
   * @param version The version of the format to produce.
   *
   * @param nameMap A map for renaming named elements.
   *
   * @param includePaths Whether to include paths in the output.
   *
   * @param verbose Whether to output verbosely.
   *
   * @throws {Error} If the version requested in ``version`` is not supported.
   */
  constructor(version: number,
              readonly nameMap: Map<string, number> | undefined,
              readonly includePaths: boolean,
              readonly verbose: boolean) {
    if (version !== 3) {
      throw new Error("DefaultConversionWalker only supports version 3");
    }
    this.arrayStart = this.verbose ? "\"Array\"" : 0;
  }

  /** The output of the conversion. */
  get output(): string {
    return this._output;
  }

  private _firstItem: boolean = true;

  /**
   * Resets the walker to a blank state. This allows using the same walker for
   * multiple walks.
   */
  reset(): void {
    this._output = "";
    this._firstItem = true;
  }

  /**
   * Opens a construct in the output.
   *
   * @param open The opening string.
   *
   * @param close The closing string. This will be used to check that the
   * construct is closed properly.
   */
  openConstruct(open: string): void {
    this.newItem();
    this._firstItem = true;
    this._output += open;
  }

  /**
   * Indicates that a new item is about to start in the current construct.
   * Outputs a separator (",") if this is not the first item in the construct.
   */
  newItem(): void {
    if (this._firstItem) {
      this._firstItem = false;

      return;
    }
    this._output += ",";
  }

  /**
   * Outputs an item in the current construct. Outputs a separator (",") if this
   * is not the first item in the construct.
   *
   * @param item The item to output.
   */
  outputItem(item: string | number): void {
    this.newItem();
    this._output += (typeof item === "number") ? item.toString() : item;
  }

  /**
   * Outputs a string in the current construct. Outputs a separator (",") if
   * this is not the first item in the construct. The double-quotes in the
   * string will be escaped and the string will be surrounded by double quotes
   * in the output.
   *
   * @param thing The string to output.
   */
  outputAsString(thing: string | Node): void {
    this.newItem();
    const text = (thing instanceof Node ? thing.text : thing)
      .replace(/(["\\])/g, "\\$1");
    this._output += `"${text}"`;
  }

  /**
   * Open an array in the output.
   */
  openArray(): void {
    this.openConstruct("[");
    this.outputItem(this.arrayStart);
  }

  convert(el: Element): void {
    if (el.local !== "grammar") {
      throw new Error("top level element must be grammar");
    }

    this.openConstruct("{");
    this.outputItem(`"v":3,"o":${this.includePaths ? 0 :
OPTION_NO_PATHS},"d":`);
    const code = nameToCode.grammar;
    if (code === undefined) {
      throw new Error("can't find constructor for grammar");
    }
    this._firstItem = true;
    this.openConstruct("[");
    if (this.verbose) {
      this.outputAsString("Grammar");
    }
    else {
      this.outputItem(code);
    }
    if (this.includePaths) {
      this.outputAsString(el.path);
    }
    // el.children[0] is a start element: walk start's children.
    this.walkChildren(el.children[0] as Element);
    this.openArray();
    // Walk the definitions...
    this.walkChildren(el, 1);
    this._output += "]]}";
  }

  // tslint:disable-next-line: max-func-body-length
  walk(el: Element): void {
    const { local } = el;

    const code = nameToCode[local];
    if (code === undefined) {
      throw new Error(`can't find constructor for ${local}`);
    }

    this.openConstruct("[");
    if (this.verbose) {
      this.outputAsString(local[0].toUpperCase() + local.slice(1));
    }
    else {
      this.outputItem(code);
    }
    if (this.includePaths) {
      this.outputAsString(el.path);
    }

    switch (local) {
      case "group":
      case "interleave":
      case "choice":
      case "oneOrMore":
        this.openArray();
        this.walkChildren(el);
        this._output += "]";
        break;
      case "element":
      case "attribute":
        // The first element of `<element>` or `<attribute>` is necessarily a
        // name class. Note that there is no need to worry about recursion since
        // it is not possible to get here recursively from the `this.walk` call
        // that follows. (A name class cannot contain `<element>` or
        // `<attribute>`.
        this.walkNameClass(el.children[0] as Element);
        this.openArray();
        this.walkChildren(el, 1);
        this._output += "]";
        break;
      case "ref": {
        const name = el.mustGetAttribute("name");
        if (this.nameMap !== undefined) {
          // tslint:disable-next-line:no-non-null-assertion
          this.outputItem(this.nameMap.get(name)!);
        }
        else {
          this.outputAsString(name);
        }
        break;
      }
      case "define": {
        const name = el.mustGetAttribute("name");
        if (this.nameMap !== undefined) {
          // tslint:disable-next-line:no-non-null-assertion
          this.outputItem(this.nameMap.get(name)!);
        }
        else {
          this.outputAsString(name);
        }
        this.openArray();
        this.walkChildren(el);
        this._output += "]";
        break;
      }
      case "value": {
        // Output a variable number of items.
        // Suppose item 0 is called it0 and so forth. Then:
        //
        // Number of items  value  type    datatypeLibrary  ns
        // 1                it0    "token" ""               ""
        // 2                it0     it1    ""               ""
        // 3                it0     it1    it2              ""
        // 4                it0     it1    it2              it3
        //
        this.outputAsString(el);
        const typeAttr = el.mustGetAttribute("type");
        const datatypeLibraryAttr = el.mustGetAttribute("datatypeLibrary");
        const nsAttr = el.mustGetAttribute("ns");
        if (typeAttr !== "token" || datatypeLibraryAttr !== "" ||
            nsAttr !== "") {
          this.outputAsString(typeAttr);
          if (datatypeLibraryAttr !== "" || nsAttr !== "") {
            this.outputAsString(datatypeLibraryAttr);
            // No value === empty string.
            if (nsAttr !== "") {
              this.outputAsString(nsAttr);
            }
          }
        }
        break;
      }
      case "data": {
        // Output a variable number of items.
        // Suppose item 0 is called it0 and so forth. Then:
        //
        // Number of items  type    datatypeLibrary params except
        // 0                "token" ""              {}     undefined
        // 1                it0     ""              {}     undefined
        // 2                it0     it1             {}     undefined
        // 3                it0     it1             it2    undefined
        // 4                it0     it1             it2    it3
        //
        // Parameters are necessarily first among the children.
        const { children } = el;
        const { length } = children;
        const hasParams = (length !== 0 &&
                           ((children[0] as Element).local === "param"));
        // Except is necessarily last.
        const hasExcept =
          (length !== 0 &&
           (children[length - 1] as Element).local === "except");

        const typeAttr = el.mustGetAttribute("type");
        const datatypeLibraryAttr = el.mustGetAttribute("datatypeLibrary");
        if (typeAttr !== "token" || datatypeLibraryAttr !== "" || hasParams ||
            hasExcept) {
          this.outputAsString(typeAttr);
          if (datatypeLibraryAttr !== "" || hasParams || hasExcept) {
            this.outputAsString(datatypeLibraryAttr);
            if (hasParams || hasExcept) {
              this.openArray();
              if (hasParams) {
                const limit = hasExcept ? length - 1 : children.length;
                for (let paramIx = 0; paramIx < limit; ++paramIx) {
                  const param = children[paramIx] as Element;
                  this.outputAsString(param.mustGetAttribute("name"));
                  this.outputAsString(param.children[0]);
                }
              }
              this._output += "]";
              if (hasExcept) {
                this.walkChildren(children[length - 1] as Element);
              }
            }
          }
        }
        break;
      }
      case "list":
        this.walkChildren(el);
        break;
      case "notAllowed":
      case "empty":
      case "text":
        // No children to walk!
        break;
      default:
        throw new Error(`did not expect an element with name ${local} here`);
    }
    this._output += "]";
  }

  // tslint:disable-next-line: max-func-body-length
  walkNameClass(el: Element): void {
    let { local } = el;
    if (local === "choice") {
      local = "nameChoice";
    }

    const code = nameToCode[local];
    if (code === undefined) {
      throw new Error(`can't find constructor for ${local}`);
    }

    this.openConstruct("[");
    if (this.verbose) {
      this.outputAsString(local[0].toUpperCase() + local.slice(1));
    }
    else {
      this.outputItem(code);
    }
    if (this.includePaths) {
      this.outputAsString(el.path);
    }

    switch (local) {
      case "name":
        this.outputAsString(el.mustGetAttribute("ns"));
        this.outputAsString(el);
        break;
      case "nameChoice":
        this.openArray();
        for (const child of el.children as Element[]) {
          this.walkNameClass(child);
        }
        this._output += "]";
        break;
      case "nsName":
        this.outputAsString(el.mustGetAttribute("ns"));
        /* fall through */
      case "anyName":
        // There can only be at most one child, and it has to be "except".
        if (el.children.length > 0) {
          const except = el.children[0] as Element;
          // We do not output anything for this element itself but instead go
          // straight to its children.
          for (const child of except.children as Element[]) {
            this.walkNameClass(child);
          }
        }
        break;
      default:
        throw new Error(`did not expect an element with name ${local} here`);
    }
    this._output += "]";
  }

  /**
   * Walks an element's children.
   *
   * @param el The element whose children must be walked.
   *
   * @param startAt Index at which to start walking.
   */
  walkChildren(el: Element, startAt: number = 0): void {
    const children = el.children;
    const limit = children.length;

    if (limit < startAt) {
      throw new Error("invalid parameters passed");
    }

    for (let i = startAt; i < limit; ++i) {
      const child = children[i];
      if (isElement(child)) {
        this.walk(child);
      }
    }
  }
}

function gatherNamed(el: Element, all: Map<string, number>): void {
  for (const child of el.children) {
    if (!isElement(child)) {
      continue;
    }

    if (child.local === "define" || child.local === "ref") {
      const name = child.mustGetAttribute("name");
      let count = all.get(name);
      if (count === undefined) {
        count = 0;
      }
      all.set(name, ++count);
    }

    gatherNamed(child, all);
  }
}

export function writeTreeToJSON(tree: Element, formatVersion: number,
                                includePaths: boolean = false,
                                verbose: boolean = false,
                                rename: boolean = true): string {
  let nameMap: Map<string, number> | undefined;
  if (rename) {
    const names = new Map<string, number>();
    gatherNamed(tree, names);
    // Now assign new names with shorter new names being assigned to those
    // original names that are most frequent.
    const sorted = Array.from(names.entries());
    // Yes, we want to sort in reverse order of frequency, highest first.
    sorted.sort(([_keyA, freqA], [_keyB, freqB]) => freqB - freqA);

    let id = 1;
    nameMap = new Map();
    for (const [key, _] of sorted) {
      nameMap.set(key, id++);
    }
  }

  const walker = new RNGToJSONConverter(formatVersion, nameMap, includePaths,
                                        verbose);

  walker.convert(tree);

  return walker.output;
}
