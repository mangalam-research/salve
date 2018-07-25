/**
 * This module contains classes for writing salve's internal schema format.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { Element } from "../conversion";
import { isElement } from "../conversion/parser";
import { nameToCode, OPTION_NO_PATHS } from "./common";

const NAME_TO_METHOD_NAME: Record<string, string> = {
  __proto__: null,
  group: "_group",
  interleave: "_interleave",
  choice: "_choice",
  oneOrMore: "_oneOrMore",
  element: "_element",
  attribute: "_attribute",
  ref: "_ref",
  define: "_define",
  value: "_value",
  data: "_data",
  list: "_list",
  notAllowed: "_notAllowed",
  empty: "_empty",
  text: "_text",
  name: "_name",
  nameChoice: "_nameChoice",
  nsName: "_nsName",
  anyName: "_anyName",
} as any; // Unfortunately __proto__ requires ``as any``.

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
  private openConstruct(open: string): void {
    this.newItem();
    this._firstItem = true;
    this._output += open;
  }

  /**
   * Indicates that a new item is about to start in the current construct.
   * Outputs a separator (",") if this is not the first item in the construct.
   */
  private newItem(): void {
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
  private outputItem(item: string | number): void {
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
  private outputAsString(thing: string): void {
    this.newItem();
    const text = thing.replace(/(["\\])/g, "\\$1");
    this._output += `"${text}"`;
  }

  /**
   * Open an array in the output.
   */
  private openArray(): void {
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
  private walk(el: Element): void {
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

    const handler = (this as any)[NAME_TO_METHOD_NAME[local]];
    if (handler === undefined) {
        throw new Error(`did not expect an element with name ${local} here`);
    }

    handler.call(this, el);
    this._output += "]";
  }

  // @ts-ignore
  private _group(el: Element): void {
    this.openArray();
    this.walkChildren(el);
    this._output += "]";
  }

  // @ts-ignore
  private _interleave(el: Element): void {
    this.openArray();
    this.walkChildren(el);
    this._output += "]";
  }

  // @ts-ignore
  private _choice(el: Element): void {
    this.openArray();
    this.walkChildren(el);
    this._output += "]";
  }

  // @ts-ignore
  private _oneOrMore(el: Element): void {
    this.openArray();
    this.walkChildren(el);
    this._output += "]";
  }

  // @ts-ignore
  private _element(el: Element): void {
    // The first element of `<element>` is necessarily a name class. Note that
    // there is no need to worry about recursion since it is not possible to get
    // here recursively from the `this.walk` call that follows. (A name class
    // cannot contain `<element>`.)
    this.walkNameClass(el.children[0] as Element);
    this.openArray();
    this.walkChildren(el, 1);
    this._output += "]";
  }

  // @ts-ignore
  private _attribute(el: Element): void {
    // The first element of `<attribute>` is necessarily a name class. Note that
    // there is no need to worry about recursion since it is not possible to get
    // here recursively from the `this.walk` call that follows. (A name class
    // cannot contain `<attribute>`.)
    this.walkNameClass(el.children[0] as Element);
    this.openArray();
    this.walkChildren(el, 1);
    this._output += "]";
  }

  // @ts-ignore
  private _ref(el: Element): void {
    const name = el.mustGetAttribute("name");
    if (this.nameMap !== undefined) {
      // tslint:disable-next-line:no-non-null-assertion
      this.outputItem(this.nameMap.get(name)!);
    }
    else {
      this.outputAsString(name);
    }
  }

  // @ts-ignore
  private _define(el: Element): void {
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
  }

  // @ts-ignore
  private _value(el: Element): void {
    // Output a variable number of items.
    // Suppose item 0 is called it0 and so forth. Then:
    //
    // Number of items  value  type    datatypeLibrary  ns
    // 1                it0    "token" ""               ""
    // 2                it0     it1    ""               ""
    // 3                it0     it1    it2              ""
    // 4                it0     it1    it2              it3
    //
    this.outputAsString(el.text);
    const typeAttr = el.mustGetAttribute("type");
    const datatypeLibraryAttr = el.mustGetAttribute("datatypeLibrary");
    const nsAttr = el.mustGetAttribute("ns");
    if (typeAttr !== "token" || datatypeLibraryAttr !== "" || nsAttr !== "") {
      this.outputAsString(typeAttr);
      if (datatypeLibraryAttr !== "" || nsAttr !== "") {
        this.outputAsString(datatypeLibraryAttr);
        // No value === empty string.
        if (nsAttr !== "") {
          this.outputAsString(nsAttr);
        }
      }
    }
  }

  // @ts-ignore
  private _data(el: Element): void {
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
      (length !== 0 && (children[length - 1] as Element).local === "except");

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
              this.outputAsString(param.children[0].text);
            }
          }
          this._output += "]";
          if (hasExcept) {
            this.walkChildren(children[length - 1] as Element);
          }
        }
      }
    }
  }

  // @ts-ignore
  private _list(el: Element): void {
    this.walkChildren(el);
  }

  // @ts-ignore
  // tslint:disable-next-line:no-empty
  private _notAllowed(el: Element): void {}

  // @ts-ignore
  // tslint:disable-next-line:no-empty
  private _empty(el: Element): void {}

  // @ts-ignore
  // tslint:disable-next-line:no-empty
  private _text(el: Element): void {}

  // tslint:disable-next-line: max-func-body-length
  private walkNameClass(el: Element): void {
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

    const handler = (this as any)[NAME_TO_METHOD_NAME[local]];
    if (handler === undefined) {
      throw new Error(`did not expect an element with name ${local} here`);
    }

    handler.call(this, el);

    this._output += "]";
  }

  // @ts-ignore
  private _name(el: Element): void {
    this.outputAsString(el.mustGetAttribute("ns"));
    this.outputAsString(el.text);
  }

  // @ts-ignore
  private _nameChoice(el: Element): void {
    this.openArray();
    for (const child of el.children as Element[]) {
      this.walkNameClass(child);
    }
    this._output += "]";
  }

  // @ts-ignore
  private _nsName(el: Element): void {
    this.outputAsString(el.mustGetAttribute("ns"));
    this._anyName(el);
  }

  private _anyName(el: Element): void {
    // There can only be at most one child, and it has to be "except".
    if (el.children.length > 0) {
      const except = el.children[0] as Element;
      // We do not output anything for this element itself but instead go
      // straight to its children.
      for (const child of except.children as Element[]) {
        this.walkNameClass(child);
      }
    }
  }

  /**
   * Walks an element's children.
   *
   * @param el The element whose children must be walked.
   *
   * @param startAt Index at which to start walking.
   */
  private walkChildren(el: Element, startAt: number = 0): void {
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
