/**
 * Simplification step 6.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element, isElement, Text } from "../parser";
import { SchemaValidationError } from "../schema-validation";

function walk(el: Element, parentNs: string | null): void {
  const local = el.local;

  let currentNs = el.getAttribute("ns");
  switch (local) {
    case "element":
    case "attribute":
      const name = el.getAttribute("name");
      if (name !== undefined) {
        el.removeAttribute("name");

        const nameEl = Element.makeElement("name", [new Text(name)]);

        if (currentNs === undefined) {
          if (local === "attribute") {
            nameEl.setAttribute("ns", "");
            // We have to set currentNs here. The attribute is effectively in
            // "no namespace", and this fact has to carry over to child elements
            // that may care.
            currentNs = "";
          }
          else if (parentNs !== null) {
            nameEl.setAttribute("ns", parentNs);
            currentNs = parentNs;
          }
        }

        el.prependChild(nameEl);
      }

      if (currentNs !== undefined) {
        el.removeAttribute("ns");
      }
      break;
    case "name":
      const { text } = el.children[0];
      const colon = text.indexOf(":");
      if (colon !== -1) {
        const prefix = text.substr(0, colon);
        const localName = text.substr(colon + 1);
        if (localName.includes(":")) {
          throw new Error(`${text} is not a valid QName`);
        }

        const ns = el.resolve(prefix);
        if (ns === undefined) {
          throw new SchemaValidationError(`cannot resolve name ${text}`);
        }
        el.setAttribute("ns", ns);
        currentNs = ns;
        el.replaceChildAt(0, new Text(localName));
      }
      // Yes, we fall through.
    case "nsName":
    case "value":
      if (currentNs === undefined) {
        currentNs = parentNs === null ? "" : parentNs;
        el.setAttribute("ns", currentNs);
      }
      break;
    default:
      if (currentNs !== undefined) {
        el.removeAttribute("ns");
      }
  }

  const nextNs = currentNs !== undefined ? currentNs : parentNs;
  for (const child of el.children) {
    if (isElement(child)) {
      walk(child, nextNs);
    }
  }
}

/**
 * Implements steps 6, 7 and 8 of the XSL pipeline. Namely:
 *
 * - ``@name`` on ``element`` or ``attribute`` elements is converted to a
 *   ``name`` element.
 *
 * - If a ``name`` element is created for an ``attribute`` element which does
 *   not have an ``@ns``, the ``name`` element has ``@ns=""``.
 *
 * - Any ``name``, ``nsName`` and ``value`` element that does not have an
 *   ``@ns`` gets an ``@ns`` from the closest ancestor with such a value, or the
 *   empty string if there is no such ancestor.
 *
 * - ``@ns`` is removed from all elements except those in the previous point.
 *
 * - When a ``name`` element contains a QName with a prefix, the prefix is
 *   removed from the QName, and a ``@ns`` is added to the ``name`` by resolving
 *   the prefix against the namespaces in effect in the XML file. (We're talking
 *   here about resolving the prefix against the prefixes declared by
 *   ``xmlns:...``. Note that the default namespace set through ``xmlns``
 *   *never* participates in the resolution performed here.)
 *
 * @param el The tree to process. It is modified in-place.
 *
 * @returns The new root of the tree.
 */
export function step6(el: Element): Element {
  walk(el, null);

  return el;
}
