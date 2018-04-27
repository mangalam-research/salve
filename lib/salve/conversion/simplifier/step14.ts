/**
 * Simplification step 14.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element } from "../parser";
import { SchemaValidationError } from "../schema-validation";
import { findChildrenByLocalName, findDescendantsByLocalName, getName,
         groupBy } from "./util";

function makeName(el: Element): string {
  let ret = el.local;

  if (ret === "def") {
    ret += `@name="${getName(el)}"`;
  }

  return ret;
}

function combine(els: Element[]): void {
  if (els.length < 2) {
    // There's nothing to actually *combine*.

    if (els.length > 0) {
      // Delete the useless combine attribute that may be present.
      els[0].removeAttribute("combine");
    }

    return;
  }

  let undefinedCombine = false;
  let combineAs: string | undefined;

  for (const el of els) {
    const combineAttr = el.getAttribute("combine");

    if (combineAttr === undefined) {
      if (undefinedCombine) {
        throw new SchemaValidationError(
          `more than one ${makeName(el)} without @combine`);
      }
      undefinedCombine = true;
    } else {
      if (combineAs === undefined) {
        combineAs = combineAttr;
      }
      else if (combineAs !== combineAttr) {
        throw new SchemaValidationError(
          `inconsistent values on ${makeName(el)}/@combine`);
      }
    }
  }

  if (combineAs === undefined) {
    throw new Error("no combination value found");
  }

  let wrapper = Element.makeElement(combineAs);
  wrapper.grabChildren(els[0]);
  wrapper.grabChildren(els[1]);
  els[1].remove();

  if (els.length > 2) {
    for (const el of els.slice(2)) {
      const newWrapper = Element.makeElement(combineAs);
      newWrapper.append(wrapper);
      newWrapper.grabChildren(el);
      el.remove();
      wrapper = newWrapper;
    }
  }

  els[0].append(wrapper);
  els[0].removeAttribute("combine");
}

/**
 * Implements step 14 of the XSL pipeline. Namely, in each grammar:
 *
 * - ``start`` elements are combined.
 *
 * - ``define`` elements with the same name are combined.
 *
 * The scope of the transformation performed for a grammar include all ``start``
 * and ``define`` elements, *excluding* those that may be in a descendant
 * ``grammar`` element.
 *
 * @param el The tree to process. It is modified in-place.
 *
 * @returns The new root of the tree.
 */
export function step14(el: Element): Element {
  const grammars = findDescendantsByLocalName(el, "grammar");
  if (el.local === "grammar") {
    grammars.unshift(el);
  }

  for (const grammar of grammars) {
    combine(findChildrenByLocalName(grammar, "start"));
    const defs = findChildrenByLocalName(grammar, "define");
    const grouped = groupBy(defs, getName);

    for (const group of grouped.values()) {
      combine(group);
    }
  }

  return el;
}
