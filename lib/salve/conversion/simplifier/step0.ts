/**
 * Simplification step 0.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element } from "../parser";
import { RELAXNG_URI } from "./util";

function dropForeign(el: Element): void {
  if (el.uri !== RELAXNG_URI) {
    el.remove();

    return;
  }

  // We move all RNG nodes into the default namespace.
  el.prefix = "";
  el.name = el.local;
  const attrs = el.getRawAttributes();
  for (const name of Object.keys(attrs)) {
    const attr = attrs[name];

    // We don't drop these just yet.
    if (attr.prefix === "xml" || attr.prefix === "xmlns") {
      continue;
    }

    if (attr.uri === RELAXNG_URI) {
      // We move all RNG nodes into the default namespace.
      attr.prefix = "";
      attr.name = attr.local;
    }
    else if (attr.uri !== "") {
      delete attrs[name];
    }
  }

  for (const child of el.elements) {
    dropForeign(child);
  }
}

/**
 * Modify a tree so as to:
 *
 * - Keep only elements that are in the Relax NG namespace, and move them
 *   into the default namespace. (Remove their prefix.)
 *
 * - Keep only attributes that are in: no namespace, the XML or Relax NG
 *   namespaces, or that define namespace prefixes.
 *
 * - Move all attributes in the Relax NG namespace to the default
 *   namespace. (Remove their prefix.)
 *
 * - Set the default namespace on the root node to be the Relax NG namespace.
 *
 * This processing step is applied through step1. The XSLT-based transformations
 * included with salve do not have a corresponding step 0 transformation. We use
 * this transformation in the TypeScript pipeline because performing this
 * transformation early allows greatly simplifying the code of step 1.
 *
 * @param tree The tree to process. It is modified in-place.
 *
 * @returns The new root of the tree.
 */
export function step0(tree: Element): Element {
  dropForeign(tree);

  // At this point all elements that are not in the Relax NG namespace have been
  // removed. All attributes that are not: in no namespace, in the Relax NG or
  // XML namespaces, or set a namespace prefix have been removed.
  //
  // We set a default namespace to the Relax NG URI. It does not matter if the
  // original default namespace was different. We have removed all nodes that
  // may have used it, and the default namespace is not used for resolving
  // QNames later (section 4.10).
  tree.setXMLNS(RELAXNG_URI);

  return tree;
}
