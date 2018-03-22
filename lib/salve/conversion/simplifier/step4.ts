/**
 * Simplification step 4.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element } from "../parser";
import { SchemaValidationError } from "../schema-validation";

function walk(el: Element, parentLibrary: string): void {
  const local = el.local;

  const currentLibrary = el.getAttribute("datatypeLibrary");
  if (currentLibrary !== undefined && currentLibrary !== "") {
    let url: URL;
    try {
      // tslint:disable-next-line:no-unused-expression
      url = new URL(currentLibrary);
    }
    catch (e) {
      throw new SchemaValidationError(
        `invalid datatypeLibrary URL: ${currentLibrary}`);
    }

    // We have to test for "#" a the end of href because that's also an
    // error per Relax NG but the hash will still be empty. :-/
    if (url.hash !== "" || url.href.endsWith("#")) {
      throw new SchemaValidationError(
        `datatypeLibrary URL must not have a fragment identifier: \
${currentLibrary}`);
    }
  }
  if (local === "data" || local === "value") {
    // ``value`` elements without a ``@type`` get ``@type`` set to ``"token"``
    // and ``@datatypeLibrary`` set to the empty string.
    if (local === "value" && el.getAttribute("type") === undefined) {
      el.setAttribute("datatypeLibrary", "");
      el.setAttribute("type", "token");
    }
    else if (currentLibrary === undefined) {
      // Inherit from parent.
      el.setAttribute("datatypeLibrary", parentLibrary);
    }
  } else {
    // All other elements lose their ``@datatypeLibrary``.
    el.removeAttribute("datatypeLibrary");
  }

  for (const child of el.elements) {
    walk(child,
         currentLibrary !== undefined ? currentLibrary : parentLibrary);
  }
}

/**
 * Implements steps 4 and 5 of the XSL pipeline. Namely:
 *
 * - ``data`` and ``value`` elements that don't have ``@datatypeLibrary`` get
 *    one from the closest ancestor with such a value.
 *
 * - ``value`` elements without a ``@type`` get ``@type`` set to ``"token"`` and
 *    ``@datatypeLibrary`` set to the empty string. (This is irrespective of the
 *    1st transformation above.)
 *
 * - All elements other than ``data`` and ``value`` lose their
 *   ``@datatypeLibrary`` attribute.
 *
 * Note that this step currently does not perform any URI encoding required by
 * the Relax NG spec. As we speak, salve does not support loading arbitrary type
 * libraries, and the supported URIs do not need special encoding.
 *
 * Even in the general case, it is unclear that we need to perform the encoding
 * transformation *here*. The URIs could be passed as-are to a library that
 * performs the encoding before fetching.
 *
 * @param el The tree to process. It is modified in-place.
 *
 * @returns The new root of the tree.
 */
export function step4(el: Element): Element {
  walk(el, "");

  return el;
}
