/**
 * Simplification step 3.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element, Text } from "../parser";

/**
 * Remove text nodes that contain only white spaces.  Text nodes in the elements
 * ``param`` and ``value`` are excluded.
 *
 * Trim the text node in the elements named ``name``.
 *
 * Also trim the values of the attributes ``name``, ``type`` and ``combine``.
 *
 * @param el The tree to process. It is modified in-place.
 *
 * @returns The new root of the tree.
 */
export function step3(el: Element): Element {
  const { local, children } = el;

  // We don't normalize text nodes in param or value.
  const textNormalization = !(local === "param" || local === "value");

  for (let i = 0; i < children.length; ++i) {
    const child = children[i];
    if (child instanceof Element) {
      step3(child);
      continue;
    }

    if (!textNormalization) {
      continue;
    }

    const clean = child.text.trim();
    if (clean.length === 0) {
      el.removeChildAt(i);
      // Move back so that we don't skip an element...
      i--;
    }
    else if (local === "name") {
      child.replaceWith(new Text(clean));
    }
  }

  for (const attrName of ["name", "type", "combine"]) {
    const attr = el.getAttribute(attrName);
    if (attr !== undefined) {
      el.setAttribute(attrName, attr.trim());
    }
  }

  return el;
}
