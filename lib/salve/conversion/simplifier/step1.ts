/**
 * Simplification step 1.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element, Text } from "../parser";
import { SchemaValidationError } from "../schema-validation";
import { findMultiDescendantsByLocalName, getName, groupBy, indexBy,
         RELAXNG_URI } from "./util";

export type Parser = (filePath: URL) => Promise<Element>;

export function resolveURL(base: URL, tail: string): URL {
  return new URL(tail, base.toString());
}

type Handler = (parentBase: URL, seenURLs: string[],
                el: Element) => Promise<Element | null>;

async function loadFromElement(currentBase: URL,
                               seenURLs: string[],
                               el: Element,
                               parse: Parser): Promise<{ tree: Element;
                                                         resolved: URL; }> {
  const resolved = resolveURL(currentBase, el.mustGetAttribute("href"));
  if (seenURLs.includes(resolved.toString())) {
    throw new SchemaValidationError(`detected an import loop: \
${seenURLs.reverse().concat(resolved.toString()).join("\n")}`);
  }

  return { tree: await parse(resolved), resolved };
}

class Step1 {
  constructor(private readonly parser: Parser) {}

  async walk(parentBase: URL, seenURLs: string[], root: Element,
             el: Element): Promise<Element> {
    let currentRoot = root;
    const baseAttr = el.getAttribute("xml:base");
    const currentBase = baseAttr === undefined ? parentBase :
      resolveURL(parentBase, baseAttr);

    // The XML parser we use immediately drops all *elements* which are not in
    // the RELAXNG_URI namespace so we don't have to remove them here.

    // We move all RNG nodes into the default namespace.
    el.prefix = "";

    // At this point it is safe to drop all the attributes in the XML
    // namespace. "xml:base" in particular is no longer of any use. We do keep
    // namespace declarations, as they are used later for resolving QNames.
    const attrs = el.getRawAttributes();
    for (const name of Object.keys(attrs)) {
      const attr = attrs[name];
      const { uri, prefix } = attr;
      if (uri === RELAXNG_URI) {
        // We move all RNG nodes into the default namespace.
        attr.prefix = "";
        attr.name = attr.local;
      }
      else if (name !== "xmlns" && uri !== "" && prefix !== "xmlns") {
        delete attrs[name];
      }
    }

    for (const attrName of ["name", "type", "combine"]) {
      const attr = el.getAttribute(attrName);
      if (attr !== undefined) {
        el.setAttribute(attrName, attr.trim());
      }
    }

    const local = el.local;
    // We don't normalize text nodes in param or value.
    if (!(local === "param" || local === "value")) {
      const children = el.children;
      for (let i = 0; i < children.length; ++i) {
        const child = children[i];
        if (child instanceof Element) {
          continue;
        }

        const clean = child.text.trim();
        if (clean === "") {
          el.removeChildAt(i);
          // Move back so that we don't skip an element...
          i--;
        }
        else if (local === "name") {
          child.replaceWith(new Text(clean));
        }
      }
    }

    for (const child of el.children) {
      if (!(child instanceof Element)) {
        continue;
      }

      await this.walk(currentBase, seenURLs, currentRoot, child);
    }

    const handler = (this as any as Record<string, Handler>)[el.local];

    if (handler !== undefined) {
      const replacement = await handler.call(this, currentBase, seenURLs, el);
      if (replacement !== null) {
        if (el === currentRoot) {
          // We have a new root.
          currentRoot = replacement;
        }

        // We have to walk the replacement too. (And yes, this could change
        // the root.)
        currentRoot = await this.walk(currentBase, seenURLs, currentRoot,
                                      replacement);
      }
    }

    return currentRoot;
  }

  async externalRef(currentBase: URL, seenURLs: string[],
                    el: Element): Promise<Element | null> {
    // tslint:disable-next-line:prefer-const
    let { tree: includedTree, resolved } =
      await loadFromElement(currentBase, seenURLs, el, this.parser);
    includedTree = await this.walk(resolved,
                                   [resolved.toString(), ...seenURLs],
                                   includedTree, includedTree);
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
      // By this point, the tree's default namespace is the Relax NG one. So we
      // can remove it to avoid redeclaring it. We don't want to do this though
      // if we're forming the root of the new tree.
      includedTree.removeAttribute("xmlns");

      el.replaceWith(includedTree);
    }

    return includedTree;
  }

  async include(currentBase: URL, seenURLs: string[],
                el: Element): Promise<Element | null> {
    const { tree: includedTree, resolved } =
      await loadFromElement(currentBase, seenURLs, el, this.parser);
    await this.walk(resolved, [resolved.toString(), ...seenURLs],
                    includedTree, includedTree);

    // By this point, the tree's default namespace is the Relax NG one. So we
    // can remove it to avoid redeclaring it.
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

    for (const key of includeDefsMap.keys()) {
      const defs = grammarDefsMap.get(key);

      if (defs === undefined) {
        throw new SchemaValidationError(
          `include has define with name ${name} which is not present in \
grammar`);
      }

      for (const def of defs) {
        def.remove();
      }
    }
    el.local = "div";
    el.setAttribute("datatypeLibrary", "");
    el.removeAttribute("href");
    includedTree.local = "div";
    // Insert the grammar element (now named "div") into the include element
    // (also now named "div").
    el.prependChild(includedTree);

    return null;
  }
}

/**
 * Modify the tree:
 *
 * - All references to external resources (``externalRef`` and ``include``) are
 *   replaced by the contents of the references. It essentially "flattens" a
 *   schema made of group of documents to a single document.
 *
 * - Remove text nodes that contain only white spaces.  Text nodes in the
 *   elements ``param`` and ``value`` are excluded.
 *
 * - Trim the text node in the elements named ``name``.
 *
 * - Also trim the values of the attributes ``name``, ``type`` and ``combine``.
 *
 * Note that step1 also subsumes what was step2 and step3 in the XSLT-based
 * transforms.
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
  return new Step1(parser).walk(documentBase, [documentBase.toString()], tree,
                                tree);
}
