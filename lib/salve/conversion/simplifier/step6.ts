/**
 * Simplification step 6.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element, Text } from "../parser";
import { SchemaValidationError } from "../schema-validation";

function walk(el: Element, parentNs: string | null): void {
  const local = el.local;

  let currentNs = el.getAttribute("ns");
  let keepNs: boolean = false;
  // True if the namespace on the current element being processed was created
  // from resolving a namespace prefix.
  let resolvedNs: boolean = false;
  switch (local) {
    case "element":
    case "attribute":
      const name = el.getAttribute("name");
      if (name !== undefined) {
        el.removeAttribute("name");

        const nameEl = Element.makeElement("name");

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
          }
        }

        nameEl.append(new Text(name));
        el.prepend(nameEl);
      }
      break;
    case "name":
      if (el.children.length !== 1) {
        throw new Error("name element does not contain a single child");
      }

      const child = el.children[0];
      if (!(child instanceof Text)) {
        throw new Error("a name element must contain only text");
      }

      const parts = child.text.split(":");
      switch (parts.length) {
        case 1:
          break;
        case 2: {
          const ns = el.resolve(parts[0]);
          if (ns === undefined) {
            throw new SchemaValidationError(
              `cannot resolve name ${child.text}`);
          }
          el.setAttribute("ns", ns);
          resolvedNs = true;
          el.replaceChildAt(0, new Text(parts[1]));
          break;
        }
        default:
          throw new Error(`${child} is not a valid QName`);
      }
      // Yes, we fall through.
    case "nsName":
    case "value":
      keepNs = true;
      if (!resolvedNs && currentNs === undefined) {
        el.setAttribute("ns", parentNs === null ? "" : parentNs);
      }
      break;
    default:
  }

  // If the ns value was created from resolving a prefix, then it does not
  // participate in the propagation of @ns. (Whatever previous @ns value may
  // have been there *does* participate in the propagation.) This is why we test
  // !resolvedNs.
  if (!resolvedNs && el.getAttribute("ns") !== undefined) {
    currentNs = el.mustGetAttribute("ns");
    if (!keepNs) {
      el.removeAttribute("ns");
    }
  }

  for (const child of el.elements) {
    walk(child, currentNs !== undefined ? currentNs : parentNs);
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
