/**
 * This module contains classes for a conversion parser.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { SaxesAttribute, SaxesParser, SaxesTag } from "saxes";

import { EName } from "../ename";
import { ValidationError } from "../errors";
import { NameResolver, XML1_NAMESPACE,
         XMLNS_NAMESPACE } from "../name_resolver";
import { Grammar, GrammarWalker } from "../patterns";
import { fixPrototype } from "../tools";
import { RELAXNG_URI } from "./simplifier/util";

export type ConcreteNode = Element | Text;

const emptyNS = Object.create(null);

/**
 * An Element produced by [[BasicParser]].
 *
 * This constructor will insert the created object into the parent automatically
 * if the parent is provided.
 */
export class Element {
  readonly kind: "element" = "element";
  /**
   * The path of the element in its tree.
   */
  private _path: string | undefined;

  private _parent: Element | undefined;

  prefix: string;

  local: string;

  uri: string;

  // ns is meant to be immutable.
  private readonly ns: Record<string, string>;

  attributes: Record<string, SaxesAttribute>;

  /**
   * @param node The value of the ``node`` created by the SAX parser.
   *
   * @param children The children of this element. **These children must not yet
   * be children of any element.**
   */
  constructor(prefix: string,
              local: string,
              uri: string,
              ns: Record<string, string>,
              attributes: Record<string, SaxesAttribute>,
              readonly children: ConcreteNode[]) {
    this.prefix = prefix;
    this.local = local;
    this.uri = uri;
    // Namespace declarations are immutable.
    this.ns = ns;
    this.attributes = attributes;

    for (const child of children) {
      if (child.parent !== undefined) {
        child.parent.removeChild(child);
      }
      child.parent = this;
    }
  }

  static fromSax(node: SaxesTag, children: ConcreteNode[]): Element {
    return new Element(
      node.prefix,
      node.local,
      node.uri,
      node.ns,
      node.attributes as Record<string, SaxesAttribute>,
      children);
  }

  static makeElement(name: string, children: ConcreteNode[]): Element {
    return new Element(
      "",
      name,
      "",
      // We always pass the same object as ns. So we save an unnecessary object
      // creation.
      emptyNS,
      Object.create(null),
      children);
  }

  get parent(): Element | undefined {
    return this._parent;
  }

  set parent(value: Element | undefined) {
    this.setParent(value);
  }

  setParent(value: Element | undefined): void {
    //
    // The cost of looking for cycles is noticeable. So we should use this
    // only when debugging new code.
    //

    // let scan = value;
    // while (scan !== undefined) {
    //   if (scan === this) {
    //     throw new Error("creating reference loop!");
    //   }

    //   scan = scan.parent;
    // }

    this._path = undefined; // This becomes void.
    this._parent = value;
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
    // Testing for this special case does payoff.
    if (this.children.length === 1) {
      return this.children[0].text;
    }

    let ret = "";
    for (const child of this.children) {
      ret += child.text;
    }
    return ret;
  }

  /**
   * A path describing the location of the element in the XML. Note that this is
   * meant to be used **only** after the simplification is complete. The value
   * is computed once and for all as soon as it is accessed.
   */
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
    // Name classes are only valid on elements and attributes. So don't go
    // searching for it on other elements.
    else if (this.local === "element" || this.local === "attribute") {
      // By the time path is used, the name class is the first child.
      const first = this.children[0];
      if (isElement(first) && first.local === "name") {
        ret += `[@name='${first.text}']`;
      }
    }

    return ret;
  }

  removeChild(child: ConcreteNode): void {
    // We purposely don't call removeChildAt, so as to save a call.
    //
    // We don't check whether there's an element at [0]. If not, a hard fail is
    // appropriate. It shouldn't happen.
    this.children.splice(this.indexOfChild(child), 1)[0].parent = undefined;
  }

  removeChildAt(i: number): void {
    // We don't check whether there's an element at [0]. If not, a hard fail is
    // appropriate. It shouldn't happen.
    this.children.splice(i, 1)[0].parent = undefined;
  }

  replaceChildWith(child: ConcreteNode, replacement: ConcreteNode): void {
    this.replaceChildAt(this.indexOfChild(child), replacement);
  }

  replaceChildAt(i: number, replacement: ConcreteNode): void {
    const child = this.children[i];

    // In practice this is not a great optimization.
    //
    // if (child === replacement) {
    //   return;
    // }

    if (replacement.parent !== undefined) {
      replacement.parent.removeChild(replacement);
    }

    this.children[i] = replacement;
    child.parent = undefined;

    replacement.parent = this;
  }

  appendChild(child: ConcreteNode): void {
    // It is faster to use custom code than to rely on insertAt: splice
    // operations are costly.
    if (child.parent !== undefined) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
  }

  appendChildren(children: ConcreteNode[]): void {
    // It is faster to use custom code than to rely on insertAt: splice
    // operations are costly.
    for (const el of children) {
      if (el.parent !== undefined) {
        el.parent.removeChild(el);
      }
      el.parent = this;
    }
    this.children.push(...children);
  }

  prependChild(child: ConcreteNode): void {
    // It is faster to do this than to rely on insertAt: splice operations
    // are costly.
    if (child.parent !== undefined) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.unshift(child);
  }

  insertAt(index: number, toInsert: ConcreteNode[]): void {
    for (const el of toInsert) {
      if (el.parent !== undefined) {
        el.parent.removeChild(el);
      }
      el.parent = this;
    }
    this.children.splice(index, 0, ...toInsert);
  }

  empty(): void {
    const children = this.children.splice(0, this.children.length);
    for (const child of children) {
      child.parent = undefined;
    }
  }

  /**
   * Gets all the children from another element and append them to this
   * element. This is a faster operation than done through other means.
   *
   * @param src The element form which to get the children.
   */
  grabChildren(src: Element): void {
    const children = src.children.splice(0, src.children.length);
    this.children.push(...children);
    for (const child of children) {
      child.parent = this;
    }
  }

  replaceContent(children: ConcreteNode[]): void {
    const prev = this.children.splice(0, this.children.length, ...children);
    for (const child of prev) {
      child.parent = undefined;
    }
    for (const child of children) {
      child.parent = this;
    }
  }

  protected indexOfChild(this: ConcreteNode, child: ConcreteNode): number {
    const parent = child.parent;
    if (parent !== this) {
      throw new Error("the child is not a child of this");
    }

    const index = parent.children.indexOf(child);
    if (index === -1) {
      throw new Error("child not among children");
    }

    return index;
  }

  /**
   * Set an attribute on an element.
   *
   * @param name The attribute name.
   *
   * @param value The new value of the attribute.
   */
  setAttribute(name: string, value: string): void {
    if (name.includes(":")) {
      throw new Error("we don't support namespaces on this function");
    }

    this.attributes[name] = {
      name,
      prefix: "",
      local: name,
      uri: "",
      value,
    };
  }

  setXMLNS(value: string): void {
    this.attributes.xmlns = {
      name: "xmlns",
      prefix: "",
      uri: XMLNS_NAMESPACE,
      value,
      local: "xmlns",
    };
  }

  removeAttribute(name: string): void {
    delete this.attributes[name];
  }

  getAttribute(name: string): string | undefined {
    const attr = this.attributes[name];

    return (attr !== undefined) ? attr.value : undefined;
  }

  getRawAttributes(): Record<string, SaxesAttribute> {
    return this.attributes;
  }

  mustGetAttribute(name: string): string {
    const attr = this.getAttribute(name);
    if (attr === undefined) {
      throw new Error(`no attribute named ${name}`);
    }

    return attr;
  }

  clone(): Element {
    const newAttributes: Record<string, SaxesAttribute> = Object.create(null);
    const { attributes } = this;
    const keys = Object.keys(attributes);
    if (keys.length !== 0) {
      for (const key of keys) {
        // We do not use Object.create(null) here because there's no advantage
        // to it.
        newAttributes[key] = {...attributes[key]};
      }
    }

    // This switch provides a significant improvement.
    let { children } = this;
    switch (children.length) {
      case 0:
        break;
      case 1:
        children = [children[0].clone()];
        break;
      case 2:
        children = [children[0].clone(), children[1].clone()];
        break;
      default:
        // This actually does not happen in the current code.
        children = children.map(child => child.clone());
    }

    return new Element(
      this.prefix,
      this.local,
      this.uri,
      this.ns,
      newAttributes,
      children);
  }
}

export class Text {
  readonly kind: "text" = "text";
  parent: Element | undefined;

  /**
   * @param text The textual value.
   */
  constructor(readonly text: string) {
  }

  clone(): Text {
    return new Text(this.text);
  }
}

export function isElement(node: ConcreteNode): node is Element {
  return node.kind === "element";
}

export function isText(node: ConcreteNode): node is Text {
  return node.kind === "text";
}

export interface ValidatorI {
  onopentag(node: SaxesTag): void;
  onclosetag(node: SaxesTag): void;
  ontext(text: string): void;
}

class SaxesNameResolver implements NameResolver {
  constructor(private readonly saxesParser: SaxesParser) {}

  resolveName(name: string,
              attribute: boolean = false): EName | undefined {
    const colon = name.indexOf(":");

    let prefix: string;
    let local: string;
    if (colon === -1) {
      if (attribute) { // Attribute in undefined namespace
        return new EName("", name);
      }

      // We are searching for the default namespace currently in effect.
      prefix = "";
      local = name;
    }
    else {
      prefix = name.substring(0, colon);
      local = name.substring(colon + 1);
      if (local.includes(":")) {
        throw new Error("invalid name passed to resolveName");
      }
    }

    const uri = this.saxesParser.resolve(prefix);
    if (uri !== undefined) {
      return new EName(uri, local);
    }

    return (prefix === "") ? new EName("", local) : undefined;
  }

  clone(): this {
    throw new Error("cannot clone a SaxesNameResolver");
  }
}

export class Validator implements ValidatorI {
  /** Whether we ran into an error. */
  readonly errors: ValidationError[] = [];

  /** The walker used for validating. */
  private readonly walker: GrammarWalker<SaxesNameResolver>;

  constructor(grammar: Grammar, parser: SaxesParser) {
    this.walker = grammar.newWalker(new SaxesNameResolver(parser));
  }

  protected fireEvent(name: string, args: string[]): void {
    const ret = this.walker.fireEvent(name, args);
    if (ret as boolean) {
      this.errors.push(...ret as ValidationError[]);
    }
  }

  onopentag(node: SaxesTag): void {
    const { attributes } = node;
    const keys = Object.keys(attributes);
    // Pre-allocate an array of the right size, instead of reallocating
    // a bunch of times.
    // tslint:disable-next-line:prefer-array-literal
    const params: string[] = new Array(2 + keys.length);
    params[0] = node.uri;
    params[1] = node.local;
    let ix = 2;
    for (const name of keys) {
      const { uri, local, value } = attributes[name] as SaxesAttribute;
      // Skip XML namespace declarations
      if (uri !== XMLNS_NAMESPACE) {
        params[ix++] = uri;
        params[ix++] = local;
        params[ix++] = value;
      }
    }
    this.fireEvent("startTagAndAttributes", params);
  }

  onclosetag(node: SaxesTag): void {
    this.fireEvent("endTag", [node.uri, node.local]);
  }

  ontext(text: string): void {
    this.fireEvent("text", [text]);
  }
}

// A validator that does not validate.
class NullValidator implements ValidatorI {
  // tslint:disable-next-line:no-empty
  onopentag(): void {}

  // tslint:disable-next-line:no-empty
  onclosetag(): void {}

  // tslint:disable-next-line:no-empty
  ontext(): void {}
}

/**
 * A simple parser used for loading a XML document into memory.  Parsers of this
 * class use [[Node]] objects to represent the tree of nodes.
 */
export class BasicParser {
  /**
   * The stack of elements. At the end of parsing, there should be only one
   * element on the stack, the root. This root is not an element that was in
   * the XML file but a holder for the tree of elements. It has a single child
   * which is the root of the actual file parsed.
   */
  protected readonly stack: { node: SaxesTag; children: ConcreteNode[] }[];

  protected drop: number = 0;

  constructor(readonly saxesParser: SaxesParser,
              protected readonly validator: ValidatorI = new NullValidator()) {
    saxesParser.onopentag = this.onopentag.bind(this);
    saxesParser.onclosetag = this.onclosetag.bind(this);
    saxesParser.ontext = this.ontext.bind(this);
    this.stack = [{
      // We cheat. The node field of the top level stack item won't ever be
      // accessed.
      node: undefined as any,
      children: [],
    }];
  }

  /**
   * The root of the parsed XML.
   */
  get root(): Element {
    return this.stack[0].children.filter(isElement)[0];
  }

  onopentag(node: SaxesTag): void {
    // We have to validate the node even if we are not going to record it,
    // because RelaxNG does not allow foreign nodes everywhere.
    this.validator.onopentag(node);

    // We can skip creating Element objects for foreign nodes and their
    // children.
    if (node.uri !== RELAXNG_URI || this.drop !== 0) {
      this.drop++;

      return;
    }

    this.stack.push({
      node,
      children: [],
    });
  }

  onclosetag(node: SaxesTag): void {
    // We have to validate the node even if we are not going to record it,
    // because RelaxNG does not allow foreign nodes everywhere.
    this.validator.onclosetag(node);

    if (this.drop !== 0) {
      this.drop--;

      return;
    }

    // tslint:disable-next-line:no-non-null-assertion
    const { node: topNode, children } = this.stack.pop()!;
    this.stack[this.stack.length - 1].children
      .push(Element.fromSax(topNode, children));
  }

  ontext(text: string): void {
    this.validator.ontext(text);
    if (this.drop !== 0) {
      return;
    }

    this.stack[this.stack.length - 1].children.push(new Text(text));
  }
}

/**
 * This parser is specifically dedicated to the task of reading simplified Relax
 * NG schemas. In a Relax NG schema, text nodes that consist entirely of white
 * space are expendable, except in the ``param`` and ``value`` elements, where
 * they do potentially carry significant information.
 *
 * This parser strips nodes that consist entirely of white space because this
 * simplifies code that needs to process the resulting tree, but preserve those
 * nodes that are potentially significant.
 *
 * This parser does not allow elements which are not in the Relax NG namespace.
 */
class ConversionParser extends BasicParser {
  onopentag(node: SaxesTag): void {
    // tslint:disable-next-line: no-http-string
    if (node.uri !== "http://relaxng.org/ns/structure/1.0") {
      throw new Error(`node in unexpected namespace: ${node.uri}`);
    }

    super.onopentag(node);
  }

  ontext(text: string): void {
    // We ignore text appearing before or after the top level element.
    if (this.stack.length <= 1 || this.drop !== 0) {
      return;
    }

    const top = this.stack[this.stack.length - 1];
    const local = top.node.local;
    // The parser does not allow non-RNG nodes, so we don't need to check the
    // namespace.
    const keepWhitespaceNodes = local === "param" || local === "value";

    if (keepWhitespaceNodes || text.trim() !== "") {
      super.ontext(text);
    }
  }
}

export function parseSimplifiedSchema(fileName: string,
                                      simplifiedSchema: string): Element {
  const convParser = new ConversionParser(new SaxesParser({ xmlns: true,
                                                            position: false,
                                                            fileName }));
  convParser.saxesParser.write(simplifiedSchema).close();

  return convParser.root;
}

// Exception used to terminate the saxes parser early.
class Found extends Error {
  constructor() {
    super();
    fixPrototype(this, Found);
  }
}

class IncludeParser {
  constructor(readonly saxesParser: SaxesParser) {
    saxesParser.onopentag = this.onopentag.bind(this);
  }

  onopentag(node: SaxesTag): void {
    // tslint:disable-next-line:no-http-string
    if (node.uri === "http://relaxng.org/ns/structure/1.0" &&
        (node.local === "include" || node.local === "externalRef")) {
      throw new Found();  // Stop early.
    }
  }
}

/**
 * Determine whether an RNG file depends on another file either through the use
 * of ``include`` or ``externalRef``.
 *
 * @param rng The RNG file to check.
 *
 * @returns ``true`` if dependent, ``false`` if not.
 */
export function dependsOnExternalFile(rng: string): boolean {
  const parser =
    new IncludeParser(new SaxesParser({ xmlns: true, position: false }));
  let found = false;
  try {
    parser.saxesParser.write(rng).close();
  }
  catch (ex) {
    if (!(ex instanceof Found)) {
      throw ex;
    }

    found = true;
  }

  return found;
}

//  LocalWords:  MPL NG param RNG
