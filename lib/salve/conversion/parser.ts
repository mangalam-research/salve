/**
 * This module contains classes for a conversion parser.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import * as sax from "sax";

import { ValidationError } from "../errors";
import { XML1_NAMESPACE, XMLNS_NAMESPACE } from "../name_resolver";
import { Event, FireEventResult, Grammar, Walker } from "../patterns";
import { fixPrototype } from "../tools";

/**
 * A base class for classes that perform parsing based on SAX parsers.
 *
 * Derived classes should add methods named ``on<eventname>`` so as to form a
 * full name which matches the ``on<eventname>`` methods supported by SAX
 * parsers. The constructor will attach these methods to the SAX parser passed
 * and bind them so in them ``this`` is the ``Parser`` object. This allows
 * neatly packaged methods and private parameters.
 *
 */
export class Parser {
  /**
   * @param saxParser A parser created by the ``sax-js`` library or something
   * compatible.
   */
  constructor(readonly saxParser: sax.SAXParser) {
    for (const name in this) {
      if (name.lastIndexOf("on", 0) === 0) {
        (this.saxParser as any)[name] = (this as any)[name].bind(this);
      }
    }
  }
}

export interface MakeElementOptions {
  name: string;
  isSelfClosing?: boolean;
}

export type ConcreteNode = Element | Text;

export abstract class Node {
  /** The children of this element. */
  readonly children: ConcreteNode[] = [];

  abstract readonly text: string;

  /**
   * The element children of this element.
   */
  get elements(): IterableIterator<Element>{
    // tslint:disable-next-line:no-var-self no-this-assignment
    const me = this;

    return (function *(): IterableIterator<Element> {
      for (const child of me.children) {
        // tslint:disable-next-line:no-use-before-declare
        if (child instanceof Element) {
          yield child;
        }
      }
    }());
  }

  protected _parent: Element | undefined;

  get parent(): Element | undefined {
    return this.getParent();
  }

  set parent(value: Element | undefined) {
    this.setParent(value);
  }

  protected getParent(): Element | undefined {
    return this._parent;
  }

  protected setParent(value: Element | undefined): void {
    this._parent = value;
  }

  remove(this: ConcreteNode): void {
    const parent = this.parent;
    if (parent !== undefined) {
      parent.removeChild(this);
    }
  }

  replaceWith(this: ConcreteNode, replacement: ConcreteNode): void {
    const parent = this.parent;
    if (parent === undefined) {
      throw new Error("no parent");
    }

    parent.replaceChildWith(this, replacement);
  }

  empty(): void {
    const children = this.children.splice(0, this.children.length);
    for (const child of children) {
      child.parent = undefined;
    }
  }

  protected indexOfChild(this: ConcreteNode, child: ConcreteNode): number {
    const parent = child.parent;
    if (parent === undefined) {
      throw new Error("no parent");
    }

    if (parent !== this) {
      throw new Error("the child is not a child of this");
    }

    const index = parent.children.indexOf(child);
    if (index === -1) {
      throw new Error("child not among children");
    }

    return index;
  }

  contains(other: Node): boolean {
    let current: Node | undefined = other;
    while (current !== undefined) {
      if (current === this) {
        return true;
      }

      current = current.parent;
    }

    return false;
  }
}

/**
 * An Element produced by [[Parser]].
 *
 * This constructor will insert the created object into the parent automatically
 * if the parent is provided.
 */
export class Element extends Node {
  /**
   * The path of the element in its tree.
   */
  private _path: string | undefined;

  name: string;

  prefix: string;

  local: string;

  uri: string;

  ns: Record<string, string>;

  isSelfClosing: boolean;

  attributes: Record<string, sax.QualifiedAttribute>;

  /**
   * @param node The value of the ``node`` created by the SAX parser.
   */
  constructor(node: sax.QualifiedTag | Element) {
    super();
    this.name = node.name;
    this.prefix = node.prefix;
    this.local = node.local;
    this.uri = node.uri;
    this.isSelfClosing = node.isSelfClosing;

    // We create a new object even when using a sax node. Sax uses a prototype
    // trick to flatten the hierarchy of namespace declarations but that screws
    // us over when we mutate the tree. It is simpler to just undo the trick and
    // have a resolve() method that searches up the tree. We don't do that many
    // searches anyway.
    this.ns = Object.assign(Object.create(null), node.ns);

    if (node instanceof Element) {
      const thisAttrs = this.attributes = Object.create(null);
      const nodeAttrs = node.attributes;
      for (const key of Object.keys(nodeAttrs)) {
        thisAttrs[key] = Object.assign(Object.create(null), nodeAttrs[key]);
      }
    }
    else {
      this.attributes = node.attributes;
    }
  }

  static makeElement(options: MakeElementOptions): Element;
  static makeElement(name: string, isSelfClosing?: boolean): Element;
  static makeElement(nameOrOptions: string | MakeElementOptions,
                     isSelfClosing: boolean = false): Element {
    const options = (typeof nameOrOptions === "string") ? {
      name: nameOrOptions,
      isSelfClosing: isSelfClosing,
    } : nameOrOptions;

    return new Element({
      local: options.name,
      name: options.name,
      uri: "",
      prefix: "",
      ns: Object.create(null),
      attributes: Object.create(null),
      isSelfClosing: options.isSelfClosing === true,
    });
  }

  setParent(value: Element | undefined): void {
    // This can save appreciable time.
    if (value === this.parent) {
      return;
    }

    let scan = value;
    while (scan !== undefined) {
      if (scan === this) {
        throw new Error("creating reference loop!");
      }

      scan = scan.parent;
    }

    this._path = undefined; // This becomes void.
    super.setParent(value);
  }

  resolve(name: string): string | undefined {
    if (name === "xml") {
      return XML1_NAMESPACE;
    }

    if (name === "xmlns") {
      return XMLNS_NAMESPACE;
    }

    return this._resolve(name);
  }

  _resolve(name: string): string | undefined {
    const ret = this.ns[name];

    if (ret !== undefined) {
      return ret;
    }

    return (this.parent === undefined) ? undefined : this.parent._resolve(name);
  }

  get text(): string {
    return this.children.map((x) => x.text).join("");
  }

  get path(): string {
    if (this._path === undefined) {
      this._path = this.makePath();
    }

    return this._path;
  }

  private makePath(): string {
    let ret =
      `${(this.parent !== undefined) ? this.parent.path : ""}/${this.local}`;

    const name = this.getAttribute("name");
    if (name !== undefined) {
      // tslint:disable-next-line:no-string-literal
      ret += `[@name='${name}']`;
    }
    else {
      for (const child of this.elements) {
        if (child.local === "name") {
          ret += `[@name='${child.text}']`;
          break;
        }
      }
    }

    return ret;
  }

  removeChild(child: ConcreteNode): void {
    this.removeChildAt(this.indexOfChild(child));
  }

  removeChildAt(i: number): void {
    const children = this.children.splice(i, 1);
    for (const child of children) {
      child.parent = undefined;
    }
  }

  replaceChildWith(child: ConcreteNode, replacement: ConcreteNode): void {
    this.replaceChildAt(this.indexOfChild(child), replacement);
  }

  replaceChildAt(i: number, replacement: ConcreteNode): void {
    const child = this.children[i];

    if (child === replacement) {
      return;
    }

    if (replacement.parent !== undefined) {
      replacement.remove();
    }

    this.children[i] = replacement;
    child.parent = undefined;

    replacement.parent = this;
  }

  append(child: ConcreteNode | ConcreteNode[]): void {
    this.insertAt(this.children.length,
                  child instanceof Array ? child : [child]);
  }

  prepend(child: ConcreteNode): void {
    this.insertAt(0, [child]);
  }

  insertAt(index: number, toInsert: ConcreteNode[]): void {
    this.children.splice(index, 0, ...toInsert);
    for (const el of toInsert) {
      if (el.parent !== undefined) {
        el.remove();
      }
      el.parent = this;
    }
  }

  insertBefore(child: Element, toInsert: ConcreteNode[]): void {
    this.insertAt(this.indexOfChild(child), toInsert);
  }

  /**
   * Set an attribute on an element.
   *
   * @param name The attribute name.
   *
   * @param value The new value of the attribute.
   */
  setAttribute(name: string, value: string): void {
    if (name.indexOf(":") !== -1) {
      throw new Error("we don't support namespaces on this function");
    }

    this.attributes[name] = {
      name: name,
      prefix: "",
      local: name,
      uri: "",
      value: value,
    };
  }

  setXMLNS(value: string): void {
    this.attributes.xmlns = {
      name: "xmlns",
      prefix: "xmlns",
      uri: XMLNS_NAMESPACE,
      value,
      local: "",
    };
  }

  removeAttribute(name: string): void {
    delete this.attributes[name];
  }

  getAttribute(name: string): string | undefined {
    const attr = this.attributes[name];

    return (attr !== undefined) ? attr.value : undefined;
  }

  getAttributes(): Record<string, string> {
    const ret: Record<string, string> = Object.create(null);
    const attributes = this.attributes;
    const keys = Object.keys(attributes);
    for (const key of keys) {
      ret[key] = attributes[key].value;
    }

    return ret;
  }

  getRawAttributes(): Record<string, sax.QualifiedAttribute> {
    return this.attributes;
  }

  mustGetAttribute(name: string): string {
    const attr = this.getAttribute(name);
    if (attr === undefined) {
      throw new Error(`no attribute named ${name}`);
    }

    return attr;
  }
}

export class Text extends Node {
  /**
   * @param parent The parent element, or a undefined if this is the root
   * element.
   *
   * @param text The textual value.
   */
  constructor(readonly text: string) {
    super();
  }
}

interface TagInfo {
  uri: string;
  local: string;
  hasContext: boolean;
}

export class Validator {
  /** Whether we ran into an error. */
  readonly errors: ValidationError[] = [];

  /** The walker used for validating. */
  private readonly walker: Walker<Grammar>;

  /** The tag stack. */
  private readonly tagStack: TagInfo[] = [];

  /** A text buffer... */
  private textBuf: string = "";

  constructor(grammar: Grammar) {
    this.walker = grammar.newWalker();
  }

  protected flushTextBuf(): void {
    this.fireEvent("text", this.textBuf);
    this.textBuf = "";
  }

  protected fireEvent(...args: any[]): void {
    const ev: Event = new Event(args);
    const ret: FireEventResult = this.walker.fireEvent(ev);
    if (ret instanceof Array) {
      this.errors.push(...ret);
    }
  }

  onopentag(node: sax.QualifiedTag): void {
    this.flushTextBuf();
    const nsDefinitions: [string, string][] = [];
    const attributeEvents: string[][] = [];
    for (const name of Object.keys(node.attributes)) {
      const attr: sax.QualifiedAttribute = node.attributes[name];
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
      this.fireEvent("enterContext");
      nsDefinitions.forEach((x: string[]) => {
        this.fireEvent("definePrefix", ...x);
      });
    }
    this.fireEvent("enterStartTag", node.uri, node.local);
    for (const event of attributeEvents) {
      this.fireEvent(...event);
    }
    this.fireEvent("leaveStartTag");
    this.tagStack.unshift({
      uri: node.uri,
      local: node.local,
      hasContext: nsDefinitions.length !== 0,
    });
  }

  onclosetag(name: sax.QualifiedTag): void {
    this.flushTextBuf();
    const tagInfo: TagInfo | undefined = this.tagStack.shift();
    if (tagInfo === undefined) {
      throw new Error("stack underflow");
    }

    this.fireEvent("endTag", tagInfo.uri, tagInfo.local);
    if (tagInfo.hasContext) {
      this.fireEvent("leaveContext");
    }
  }

  ontext(text: string): void {
    this.textBuf += text;
  }
}

/**
 * A simple parser used for loading a XML document into memory.  Parsers of this
 * class use [[Node]] objects to represent the tree of nodes.
 */
export class BasicParser extends Parser {
  /**
   * The stack of elements. At the end of parsing, there should be only one
   * element on the stack, the root. This root is not an element that was in
   * the XML file but a holder for the tree of elements. It has a single child
   * which is the root of the actual file parsed.
   */
  readonly stack: Element[] = [];

  /**
   * The root recorded during parsing. This is ``undefined`` before parsing. We
   * don't allow direct access because getting the root is only meaningful after
   * parsing.
   */
  protected _recordedRoot: Element | undefined;

  constructor(saxParser: sax.SAXParser,
              protected readonly validator?: Validator) {
    super(saxParser);
  }

  /**
   * The root of the parsed XML.
   */
  get root(): Element {
    if (this._recordedRoot === undefined) {
      throw new Error("cannot get root");
    }

    return this._recordedRoot;
  }

  onopentag(node: sax.QualifiedTag): void {
    const parent: Element | undefined = this.stack[0];

    const me = new Element(node);
    if (parent !== undefined) {
      parent.append(me);
    }
    else {
      this._recordedRoot = me;
    }

    this.stack.unshift(me);

    if (this.validator !== undefined) {
      this.validator.onopentag(node);
    }
  }

  onclosetag(name: sax.QualifiedTag): void {
    this.stack.shift();

    if (this.validator !== undefined) {
      this.validator.onclosetag(name);
    }
  }

  ontext(text: string): void {
    const top: Element | undefined = this.stack[0];
    if (top === undefined) {
      return;
    }

    top.append(new Text(text));

    if (this.validator !== undefined) {
      this.validator.ontext(text);
    }
  }
}

/**
 * This parser is specifically dedicated to the task of reading simplified Relax
 * NG schemas. In a Relax NG schema, text nodes that consist entirely of white
 * space are expandable, except in the ``param`` and ``value`` elements, where
 * they do potentially carry significant information.
 *
 * This parser strips nodes that consist entirely of white space because this
 * simplifies code that needs to process the resulting tree, but preserve those
 * nodes that are potentially significant.
 *
 * This parser does not allow elements which are not in the Relax NG namespace.
 */
export class ConversionParser extends BasicParser {
  onopentag(node: sax.QualifiedTag): void {
    // tslint:disable-next-line: no-http-string
    if (node.uri !== "http://relaxng.org/ns/structure/1.0") {
      throw new Error(`node in unexpected namespace: ${node.uri}`);
    }

    super.onopentag(node);
  }

  ontext(text: string): void {
    const top: Element | undefined = this.stack[0];
    if (top === undefined) {
      return;
    }

    const local = top.local;
    // The parser does not allow non-RNG nodes, so we don't need to check the
    // namespace.
    const keepWhitespaceNodes = local === "param" || local === "value";

    if (keepWhitespaceNodes || text.trim() !== "") {
      super.ontext(text);
    }
  }
}

// Exception used to terminate the sax parser early.
export class Found extends Error {
  constructor() {
    super();
    fixPrototype(this, Found);
  }
}

export class IncludeParser extends Parser {
  found: boolean;

  constructor(saxParser: sax.SAXParser) {
    super(saxParser);
    this.found = false;
  }

  onopentag(node: sax.QualifiedTag): void {
    // tslint:disable-next-line:no-http-string
    if (node.uri === "http://relaxng.org/ns/structure/1.0" &&
        (node.local === "include" || node.local === "externalRef")) {
      this.found = true;
      throw new Found();  // Stop early.
    }
  }
}

//  LocalWords:  MPL NG param RNG
