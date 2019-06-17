/**
 * Simplification step 18.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element } from "../parser";

// These are elements that cannot contain empty.
const skip = new Set(["name", "anyName", "nsName", "param", "empty",
                      "text", "value", "notAllowed", "ref"]);

function walk(el: Element): void {
  const { local, children } = el;

  if (children.length === 0 || skip.has(local)) {
    return;
  }

  let [first, second] = children as [Element, Element];
  walk(first);
  if (second !== undefined) {
    walk(second);
  }

  // The children may have changed.
  ([first, second] = children as [Element, Element]);

  const firstEmpty = first.local === "empty";
  const secondEmpty = second !== undefined && second.local === "empty";

  if (!(firstEmpty || secondEmpty)) {
    return;
  }

  switch (local) {
    case "choice":
      if (secondEmpty) {
        if (!firstEmpty) {
          // If a choice has empty in the 2nd position, the children are
          // swapped.
          children[0] = second;
          children[1] = first;
        }
        else {
          // A choice with two empty elements is replaced with empty.
          el.parent!.replaceChildWith(el, Element.makeElement("empty", []));
        }
      }
      break;
    case "group":
    case "interleave":
      if (firstEmpty && secondEmpty) {
        // A group (or interleave) with two empty elements is replaced with
        // empty.
        el.parent!.replaceChildWith(el, Element.makeElement("empty", []));
      }
      else {
        // A group (or interleave) with only one empty element is replaced with
        // the non-empty one.
        el.parent!.replaceChildWith(el, firstEmpty ? second : first);
      }
      break;
    case "oneOrMore":
      // A oneOrMore with an empty element is replaced with empty.
      el.parent!.replaceChildWith(el, Element.makeElement("empty", []));
      break;
    default:
  }
}

/**
 * Implements step 18 of the XSL pipeline. Namely:
 *
 * - All ``group``, ``interleave`` and ``choice`` elements with two ``empty``
 *   children are replaced with ``empty``.
 *
 * - All ``group`` and ``interleave`` elements with one ``empty`` child
 *   are transformed into their other child.
 *
 * - All ``choice`` elements with ``empty`` as the second child have their
 *   children swapped.
 *
 * - All ``oneOrMore`` elements with an ``empty`` child are replaced with
 *   ``empty``.
 *
 * These transformations are repeated until they no longer modify the tree. (The
 * way we apply the transformations obviates the need to repeat them.)
 *
 * Note that none of the transformations above remove ``ref`` elements from the
 * schema. So it is not necessary to check for unreferenced ``define``
 * elements. (To ascertain that this is the case, you need to take into account
 * the previous transformations. For instance, ``oneOrMore`` by this stage has
 * only one possible child so replacing ``oneOrMore`` with ``empty`` if it has
 * an ``empty`` child **cannot** remove a ``ref`` element from the tree. Similar
 * reasoning applies to the other transformations.)
 *
 * @param tree The tree to process. It is modified in-place.
 *
 * @returns The new root of the tree.
 */
export function step18(tree: Element): Element {
  // The top element is necessarily <grammar>, and it has only element children.
  for (const child of tree.children) {
    walk(child as Element);
  }

  return tree;
}

//  LocalWords:  XSL oneOrMore
