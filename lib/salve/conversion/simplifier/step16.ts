/**
 * Simplification step 16.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element, isElement } from "../parser";
import { SchemaValidationError } from "../schema-validation";
import { findDescendantsByLocalName, removeUnreferencedDefs } from "./util";

// Elements that cannot contain references.
const skip = new Set(["name", "anyName", "nsName", "param", "empty",
                      "text", "value", "notAllowed", "ref"]);

interface RemovedDefineState {
  topElement: Element;

  used: boolean;
}

interface State {
  removedDefines: Map<string, RemovedDefineState>;
  seenRefs: Set<string>;
}

function wrapElements(state: State, root: Element): Element[] {
  let elementCount = 0;
  const { seenRefs } = state;
  const toAppend = [];
  for (const el of findDescendantsByLocalName(root, "element")) {
    elementCount++;

    // If an element is not appearing in a define element, then create one for
    // it.
    // tslint:disable-next-line:no-non-null-assertion
    if (el.parent!.local !== "define") {
      // The first child of an ``element`` element is a name class but not
      // necessarily ``name``.
      const first = el.children[0] as Element;
      const elName = first.local === "name" ? first.text : "";
      // Note that elName in the following string is not necessary to guarantee
      // uniqueness. It is a convenience that allows recognizing names more
      // easily. So the value ``""`` used when we don't have a name element does
      // not harm the uniqueness of the name.
      const name = `__${elName}-elt-${elementCount}`;

      const ref = Element.makeElement("ref", []);
      ref.setAttribute("name", name);
      el.parent!.replaceChildWith(el, ref);
      seenRefs.add(name);
      const defEl = Element.makeElement("define", [el]);
      toAppend.push(defEl);
      defEl.setAttribute("name", name);
    }
  }

  return toAppend;
}

function removeDefsWithoutElement(state: State, el: Element): void {
  // A define which does not contain an ``element`` child is going to be
  // removed. Any reference to it will have to be replaced with the content of
  // the ``define``.
  const removedDefines = state.removedDefines;
  const children = el.children;
  // We always keep ``start``.
  const keep = [children[0]];
  // The el parameter is the grammar. By this stage, it has a ``start`` element
  // as its first child, and ``define`` elements for the remainder of its
  // children.
  for (let ix = 1; ix < children.length; ++ix) {
    const child = children[ix] as Element;
    // Define elements by this time have a single child, which is an
    // element (but may not be an ``element`` element).
    const topElement = child.children[0] as Element;
    if (topElement.local === "element") {
      keep.push(child);
      continue;
    }

    child.removeChildAt(0); // Remove topElement from child.
    removedDefines.set(child.mustGetAttribute("name"),
                       { topElement, used: false });
  }

  el.replaceContent(keep);
}

/**
 * Substitute ``ref`` elements that point to ``define`` elements that have been
 * removed due to not containing a top-level ``element`` with the content of the
 * referred define.
 *
 * @param state The transformation state.
 *
 * @param el The element to process.
 *
 * @returns A replacement for the element, which may be equal to ``el`` if there
 * is no replacement.
 */
function substituteRefs(state: State, el: Element,
                        seenNames: Set<string>): Element {
  const local = el.local;

  let ret = el;
  if (local === "ref") {
    // If a reference is to a definition that does not contain an element
    // element as the top element, move the definition in place of the ref.
    const name = el.mustGetAttribute("name");
    if (seenNames.has(name)) {
      throw new SchemaValidationError(
        `circularity on the definition named ${name}`);
    }
    const def = state.removedDefines.get(name);
    if (def === undefined) {
      // We are keeping this reference, so mark it as seen. Otherwise, we're
      // going to remove it, and we don't need to mark it.
      state.seenRefs.add(name);
    }
    else {
      // If the definition was used, clone it to allow for multiple copies of
      // the definition's content to be put into the tree if it is references
      // multiple times.
      if (def.used) {
        ret = def.topElement.clone();
      }
      else {
        // Walk the element we're about to put into the tree. We walk it only
        // once, and record the result of walking it.

        const newNames = new Set(seenNames);
        newNames.add(name);
        def.topElement = ret = substituteRefs(state, def.topElement, newNames);
        def.used = true;
      }
    }
  }
  else if (!skip.has(local)) {
    //
    // By this point, the majority of elements have at most two children.
    // (<grammar> is the exception.)
    //
    // Due to the !skip.has(local) test above, first, and second are Element
    // object, if they exists. So we assert instead of testing.
    //
    const [first, second] = el.children as [Element, Element];
    if (first !== undefined) {
      const sub1 = substituteRefs(state, first, seenNames);
      if (first !== sub1) {
        el.replaceChildAt(0, sub1);
      }

      if (second !== undefined) {
        const sub2 = substituteRefs(state, second, seenNames);
        if (second !== sub2) {
          el.replaceChildAt(1, sub2);
        }
      }
    }
  }

  return ret;
}

/**
 * Implements step 16 of the XSL pipeline. Namely:
 *
 * - All ``element`` elements that are not wrapped in a ``define`` element are
 *   wrapped in new ``define`` elements. And a ``ref`` element takes the
 *   place of the original ``element`` and refers to the new ``define``.
 *
 * - ``ref`` elements that reference a ``define`` which does not contain an
 *   ``element`` element as the top element are replaced by the contents of the
 *   ``define`` element they reference.
 *
 * - Remove ``define`` elements that are not referenced.
 *
 * @param tree The tree to process. It is modified in-place.
 *
 * @returns The new root of the tree.
 */
export function step16(tree: Element): Element {
  const currentTree = tree;
  if (currentTree.local !== "grammar") {
    throw new Error("must be called with a grammar element");
  }

  const state: State = {
     // By this point the top element must be the only grammar in the tree.
    removedDefines: new Map(),
    seenRefs: new Set(),
  };

  // The specification is not super clear about this, but we have to perform the
  // wrapping of ``element`` in ``define`` before starting with ref substitution
  // because ref subsitution is liable to get into an infinite loop where
  // ``define/@name="x"`` contains a ``ref/@name="x"``. By doing the element
  // wrapping first, we eliminate those cases that are valid Relax NG. Any
  // remaining ``define`` which is without a top-level ``element`` and is
  // self-referential is invalid.
  const toAppend = wrapElements(state, currentTree);
  // We wait until appending the new definitions so that the following operation
  // does not have to scan through them needlessly. The new definitions contain
  // ``element`` as their top pattern so they cannot be removed.
  removeDefsWithoutElement(state, currentTree);
  currentTree.appendChildren(toAppend);
  const seenNames = new Set<string>();
  const { children } = currentTree;
  for (let ix = 0; ix < children.length; ++ix) {
    const child = children[ix];
    if (!isElement(child)) {
      continue;
    }

    const substitute = substituteRefs(state, child, seenNames);
    if (child !== substitute) {
      currentTree.replaceChildAt(ix, substitute);
    }
  }

  removeUnreferencedDefs(currentTree, state.seenRefs);

  return currentTree;
}
