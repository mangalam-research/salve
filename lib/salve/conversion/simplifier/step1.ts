/**
 * Simplification step 1.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element } from "../parser";
import { SchemaValidationError } from "../schema-validation";
import { step0 } from "./step0";
import { findMultiDescendantsByLocalName, getName, groupBy, indexBy,
         RELAXNG_URI } from "./util";

export type Parser = (filePath: URL) => Promise<Element>;

export function resolveURL(base: URL, tail: string): URL {
  return new URL(tail, base.toString());
}

export function findBase(el: Element, documentBase: URL): URL {
  const thisBase = el.getAttribute("xml:base");
  const parent = el.parent;
  if (thisBase !== undefined) {
    return resolveURL(parent !== undefined ?
                      findBase(parent, documentBase) :
                      documentBase, thisBase);
  }

  return parent !== undefined ? findBase(parent, documentBase) : documentBase;
}

/**
 * Recursively drop all attributes which are not either in the namespace "" or
 * in the Relax NG namespace. Any attribute setting a namespace is preserved.
 *
 * @param el The element to process. It is modified in place.
 */
function dropForeignAttrs(el: Element): void {
  const attrs = el.getRawAttributes();
  for (const name of Object.keys(attrs)) {
    const attr = attrs[name];
    if (name !== "xmlns" && attr.uri !== RELAXNG_URI && attr.uri !== "" &&
        attr.prefix !== "xmlns") {
      delete attrs[name];
    }
  }

  for (const child of el.elements) {
    dropForeignAttrs(child);
  }
}

type Handler = (documentBase: URL,
                seenURLs: string[], el: Element) => Promise<Element | null>;

async function loadFromElement(documentBase: URL,
                               seenURLs: string[],
                               el: Element,
                               parse: Parser): Promise<{ tree: Element;
                                                         resolved: URL; }> {
  const resolved = resolveURL(findBase(el, documentBase),
                              el.mustGetAttribute("href"));
  if (seenURLs.includes(resolved.toString())) {
    throw new SchemaValidationError(`detected an import loop: \
${seenURLs.reverse().concat(resolved.toString()).join("\n")}`);
  }

  return { tree: await parse(resolved), resolved };
}

class Step1 {
  constructor(private readonly parser: Parser) {}

  async processFile(documentBase: URL, seenURLs: string[],
                    tree: Element): Promise<Element> {
    step0(tree);
    const currentTree = await this.walk(documentBase, seenURLs, tree, tree);

    // At this point it is safe to drop all the attributes in the XML
    // namespace. "xml:base" in particular is no longer of any use.
    dropForeignAttrs(currentTree);

    return currentTree;
  }

  async walk(documentBase: URL, seenURLs: string[], root: Element,
             el: Element): Promise<Element> {
    let currentRoot = root;
    for (const child of el.elements) {
      await this.walk(documentBase, seenURLs, currentRoot, child);
    }

    const handler = (this as any as Record<string, Handler>)[el.local];

    if (handler !== undefined) {
      const replacement = await handler.call(this, documentBase, seenURLs, el);
      if (replacement !== null) {
        if (el === currentRoot) {
          // We have a new root.
          currentRoot = replacement;
        }

        // We have to walk the replacement too. (And yes, this could change
        // the root.)
        currentRoot = await this.walk(documentBase, seenURLs, currentRoot,
                                      replacement);
      }
    }

    return currentRoot;
  }

  async externalRef(documentBase: URL, seenURLs: string[],
                    el: Element): Promise<Element | null> {
    // tslint:disable-next-line:prefer-const
    let { tree: includedTree, resolved } =
      await loadFromElement(documentBase, seenURLs,
                            el, this.parser);
    includedTree = await this.processFile(resolved,
                                          [resolved.toString(), ...seenURLs],
                                          includedTree);
    const ns = el.getAttribute("ns");
    const treeNs = includedTree.getAttribute("ns");
    if (ns !== undefined && treeNs === undefined) {
      includedTree.setAttribute("ns", ns);
    }
    if (includedTree.getAttribute("datatypeLibrary") === undefined) {
      includedTree.setAttribute("datatypeLibrary", "");
    }

    // If parent is null then we are at the root and we cannot remove the
    // element.
    if (el.parent !== undefined) {
      // Since step1, and consequently step0, have been applied to this tree,
      // its default namespace is the Relax NG one. So we can remove it to avoid
      // redeclaring it. We don't want to do this though if we're forming the
      // root of the new tree.
      includedTree.removeAttribute("xmlns");

      el.replaceWith(includedTree);
    }

    return includedTree;
  }

  async include(documentBase: URL, seenURLs: string[],
                el: Element): Promise<Element | null> {
    const { tree: includedTree, resolved } =
      await loadFromElement(documentBase, seenURLs,
                            el, this.parser);
    await this.processFile(resolved, [resolved.toString(), ...seenURLs],
                           includedTree);

    // Since step1, and consequently step0, have been applied to this tree, its
    // only namespace is the Relax NG one, and it is the default namespace. So
    // we can remove it to avoid redeclaring it.
    includedTree.removeAttribute("xmlns");
    if (includedTree.local !== "grammar") {
      throw new SchemaValidationError("include does not point to a document " +
                                      "that has a grammar element as root");
    }

    const { start: includeStarts, define: includeDefs } =
      findMultiDescendantsByLocalName(el, ["start", "define"]);
    const { start: grammarStarts, define: grammarDefs } =
      findMultiDescendantsByLocalName(includedTree, ["start", "define"]);
    if (includeStarts.length !== 0) {
      if (grammarStarts.length === 0) {
        throw new SchemaValidationError(
          "include contains start element but grammar does not");
      }
      for (const start of grammarStarts) {
        start.remove();
      }
    }

    const includeDefsMap = indexBy(includeDefs, getName);
    const grammarDefsMap = groupBy(grammarDefs, getName);

    for (const key of Object.keys(includeDefsMap)) {
      const defs = grammarDefsMap[key];

      if (defs === undefined) {
        throw new SchemaValidationError(
          `include has define with name ${name} which is not present in \
grammar`);
      }

      for (const def of defs) {
        def.remove();
      }
    }
    el.name = "div";
    el.local = "div";
    el.setAttribute("datatypeLibrary", "");
    el.removeAttribute("href");
    includedTree.name = "div";
    includedTree.local = "div";
    // Insert the grammar element (now named "div") into the include element
    // (also now named "div").
    el.prepend(includedTree);

    return null;
  }
}

/**
 * Modify the tree so that all references to external resources (``externalRef``
 * and ``include``) are replaced by the contents of the references. It
 * essentially "flattens" a schema made of group of documents to a single
 * document.
 *
 * Note that step1 also subsumes what was step2 in the XSLT-based transforms.
 *
 * @param documentBase The base URI of the tree being processed.
 *
 * @param tree The XML tree to process.
 *
 * @param parser A function through which we load and parse XML files.
 *
 * @returns A promise that resolves to the new tree root when processing is
 * done.
 */
export async function step1(documentBase: URL,
                            tree: Element,
                            parser: Parser): Promise<Element> {
  return new Step1(parser).processFile(documentBase, [documentBase.toString()],
                                       tree);
}
