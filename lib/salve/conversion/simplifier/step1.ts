/**
 * Simplification step 1.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element, isElement, Text } from "../parser";
import { SchemaValidationError } from "../schema-validation";
import { findMultiDescendantsByLocalName, getName, groupBy,
         indexBy } from "./util";

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

  async walk(parentBase: URL, seenURLs: string[],
             el: Element): Promise<Element> {
    const baseAttr = el.getAttribute("xml:base");

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
      if (name !== "xmlns" && uri !== "" && prefix !== "xmlns") {
        delete attrs[name];
      }
      else if (name === "name" ||
               name === "type" ||
               name === "combine") {
        attr.value = attr.value.trim();
      }
    }

    const currentBase = baseAttr === undefined ? parentBase :
      resolveURL(parentBase, baseAttr);
    const { children, local } = el;
    if (children.length !== 0) {
      // We don't normalize text nodes in param or value.
      if (local === "param" || local === "value") {
        for (const child of children) {
          if (isElement(child)) {
            await this.walk(currentBase, seenURLs, child);
          }
        }
      }
      else {
        const newChildren = [];
        for (const child of children) {
          if (isElement(child)) {
            const replace = await this.walk(currentBase, seenURLs, child);
            newChildren.push(replace === null ? child : replace);
            continue;
          }

          const orig = child.text;
          const clean = orig.trim();
          if (clean !== "") {
            // name gets the trimmed value
            newChildren.push(local === "name" && orig !== clean ?
                             // We're triming text.
                             new Text(clean) :
                             child);
          }
          // else we drop a node consisting entirely of whitespace
        }

        el.replaceContent(newChildren);
      }
    }

    const handler = (this as unknown as Record<string, Handler>)[local];
    if (handler === undefined) {
      return el;
    }

    const replacement = await handler.call(this, currentBase, seenURLs, el);
    return replacement === null ? el : replacement;
  }

  async externalRef(currentBase: URL, seenURLs: string[],
                    el: Element): Promise<Element | null> {
    // tslint:disable-next-line:prefer-const
    let { tree: includedTree, resolved } =
      await loadFromElement(currentBase, seenURLs, el, this.parser);
    includedTree = await this.walk(resolved,
                                   [resolved.toString(), ...seenURLs],
                                   includedTree);
    const ns = el.getAttribute("ns");
    const treeNs = includedTree.getAttribute("ns");
    if (ns !== undefined && treeNs === undefined) {
      includedTree.setAttribute("ns", ns);
    }

    // See the comment in ``include`` below for the rational as to why we are
    // setting the value here.
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

      el.parent!.replaceChildWith(el, includedTree);
    }

    return includedTree;
  }

  async include(currentBase: URL, seenURLs: string[],
                el: Element): Promise<Element | null> {
    const { tree: includedTree, resolved } =
      await loadFromElement(currentBase, seenURLs, el, this.parser);
    await this.walk(resolved, [resolved.toString(), ...seenURLs],
                    includedTree);

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
        start.parent!.removeChild(start);
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
        def.parent!.removeChild(def);
      }
    }
    el.local = "div";
    el.removeAttribute("href");
    includedTree.local = "div";

    //
    // In the RNG specification, the propagation of datatypeLibrary elements is
    // an earlier processing step (4.3) than the resolution of external
    // references (4.5). This means that upon reading an external resource, an
    // algorithm that follows the spec to the letter would have to apply to the
    // resource the steps 4.1 to 4.4 before resolving any external references in
    // the newly loaded resource.
    //
    // Here we follow the order set in the XSL pipeline: we first resolve all
    // external references and then later we will propagate datatypeLibrary.
    //
    // This deivation from the spec requires that if datatypeLibrary is not set
    // on a imported element we MUST set it to the empty string. Otherwise, when
    // we do propagate datatypeLibrary, it would "cross" resource boundaries, so
    // to speak. This would be incorrect.
    //
    if (includedTree.getAttribute("datatypeLibrary") === undefined) {
      includedTree.setAttribute("datatypeLibrary", "");
    }
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
  return new Step1(parser).walk(documentBase, [documentBase.toString()], tree);
}
