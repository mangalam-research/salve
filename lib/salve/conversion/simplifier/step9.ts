/**
 * Simplification step 9.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element, isElement } from "../parser";

/**
 * Implements step 9 of the XSL pipeline. Namely:
 *
 * - ``div`` elements are replaced with their children.
 *
 * @param el The tree to process. It is modified in-place.
 *
 * @returns The new root of the tree.
 */
export function step9(el: Element): Element {
  // We walk the children first so that subtrees are modified first.
  for (let ix = 0; ix < el.children.length; ++ix) {
    const child = el.children[ix];
    if (isElement(child)) {
      if (child.local === "div") {
        if (child.children.length > 0) {
          el.insertAt(ix + 1, child.children.slice());
        }

        el.removeChildAt(ix);

        // Go back, and process what is the new child at the location where the
        // div was.
        --ix;
      }
      else {
        step9(child);
      }
    }
  }

  return el;
}
