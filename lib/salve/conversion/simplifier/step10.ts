/**
 * Simplification step 10.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element } from "../parser";

interface State {
  root: Element;
}

// tslint:disable-next-line:max-func-body-length
function walk(state: State, el: Element): Element | null {
  const local = el.local;

  switch (local) {
    case "define":
    case "oneOrMore":
    case "zeroOrMore":
    case "optional":
    case "list":
    case "mixed":
      let toAppend = [];
      if (el.children.length > 1) {
        const group = Element.makeElement("group");
        group.append(el.children.slice());
        toAppend.push(group);
      }

      switch (local) {
        case "mixed":
          el.name = el.local = "interleave";
          toAppend.push(Element.makeElement("text", true));
          break;
        case "optional":
          el.name = el.local = "choice";
          toAppend.push(Element.makeElement("empty", true));
          break;
        case "zeroOrMore":
          el.name = el.local = "choice";
          const oneOrMore = Element.makeElement("oneOrMore");
          oneOrMore.append(toAppend.length === 0 ? el.children.slice() :
                           toAppend);
          toAppend = [oneOrMore, Element.makeElement("empty", true)];
          break;
        default:
      }

      el.append(toAppend);
      break;
    case "element":
      if (el.children.length > 2) {
        const group = Element.makeElement("group");
        group.append(el.children.slice(1));
        el.append(group);
      }
      break;
    case "except":
      if (el.children.length > 1) {
        const choice = Element.makeElement("choice");
        choice.append(el.children.slice());
        el.append(choice);
      }
      break;
    case "attribute":
      if (el.children.length === 1) {
        el.append(Element.makeElement("text", true));
      }
      break;
    case "choice":
    case "group":
    case "interleave":
      if (el.children.length === 1) {
        const replaceWith = el.children[0] as Element;
        replaceWith.remove();
        if (el.parent !== undefined) {
          el.replaceWith(replaceWith);
        }
        else {
          // By this stage in the process, this is the only attribute that need
          // be carried over.
          const xmlns = el.getAttribute("xmlns");
          if (xmlns !== undefined) {
            replaceWith.setXMLNS(xmlns);
          }
          state.root = replaceWith;
        }

        return replaceWith;
      }
      else {
        while (el.children.length > 2) {
          const wrap = Element.makeElement(local);
          wrap.append(el.children.slice(0, 2));
          el.prepend(wrap);
        }
      }
      break;
    default:
  }

  // tslint:disable-next-line:prefer-for-of
  for (let ix = 0; ix < el.children.length; ++ix) {
    const child = el.children[ix];
    if (!(child instanceof Element)) {
      continue;
    }

    let replaced = walk(state, child);
    while (replaced !== null) {
      replaced = walk(state, replaced);
    }
  }

  return null;
}

/**
 * Implements steps 10 to 13 of the XSL pipeline. Namely:
 *
 * - ``define``, ``oneOrMore``, ``zeroOrMore``, ``optional``, ``list`` and
 *   ``mixed`` elements with more than one child have their children wrapped in
 *   a ``group`` element.
 *
 * - ``element`` elements with more than two children have their children
 *   wrapped in a ``group`` element. (This means more than one child in addition
 *   to the name class which is the 1sts element of ``element`` at this point.)
 *
 * - ``except`` elements with more than one child have their children wrapped in
 *   a ``group`` element.
 *
 * - ``attribute`` elements with only one child (only a ``name`` element) get a
 *   ``<text/>`` child.
 *
 * - ``choice``, ``group`` and ``interleave`` elements with only one child are
 *   replaced by their single child.
 *
 * - ``choice``, ``group`` and ``interleave`` elements with more than 2 children
 *   have their first 2 children wrapped in an element of the same name, and
 *   this is repeated until the top level element contains only two
 *   children. (This transformation applies to elements that were part of the
 *   input and those elements created by the transformations above.)
 *
 * - ``mixed`` elements are converted to ``interleave`` elements containing the
 *    single child of ``mixed``, and ``<text/>``.
 *
 * - ``optional`` elements are converted to ``choice`` elements containing the
 *   single child of ``optional``, and ``<empty/>``.
 *
 * - ``zeroOrMore`` elements are converted to ``choice`` elements. The single
 *   child of the original ``zeroOrMore`` element is wrapped in a ``oneOrMore``
 *   element, and ``<empty/>`` is added to the ``choice`` element.
 *
 * @param el The tree to process. It is modified in-place.
 *
 * @returns The new root of the tree.
 */
export function step10(el: Element): Element {
  const state: State = {
    root: el,
  };

  let replaced = walk(state, el);
  while (replaced !== null) {
    replaced = walk(state, replaced);
  }

  return state.root;
}
