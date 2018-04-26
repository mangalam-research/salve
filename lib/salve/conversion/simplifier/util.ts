/**
 * Utilities for simplification support for trees produced by the parser module.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element } from "../parser";

// tslint:disable-next-line:no-http-string
export const RELAXNG_URI = "http://relaxng.org/ns/structure/1.0";

export function findFirstChildByLocalName(el: Element,
                                          name: string): Element | null {
  for (const child of el.children) {
    if (child instanceof Element  && child.local === name) {
      return child;
    }
  }

  return null;
}

export function findChildrenByLocalName(el: Element,
                                        name: string): Element[] {
  return el
    .children
    .filter((child) => (child instanceof Element) &&
            child.local === name) as Element[];
}

export function findDescendantsByLocalName(el: Element,
                                           name: string): Element[] {
  const ret: Element[] = [];
  _findDescendantsByLocalName(el, name, ret);

  return ret;
}

export function _findDescendantsByLocalName(el: Element,
                                            name: string,
                                            ret: Element[]): void {
  for (const child of el.children) {
    if (!(child instanceof Element)) {
      continue;
    }

    if (child.local === name) {
      ret.push(child);
    }

    _findDescendantsByLocalName(child, name, ret);
  }
}

export function findMultiDescendantsByLocalName(el: Element,
                                                names: string[]):
Record<string, Element[]> {
  const ret: Record<string, Element[]> = Object.create(null);
  for (const name of names) {
    ret[name] = [];
  }

  _findMultiDescendantsByLocalName(el, names, ret);

  return ret;
}

function _findMultiDescendantsByLocalName(el: Element,
                                          names: string[],
                                          ret: Record<string, Element[]>):
void {
  for (const child of el.children) {
    if (!(child instanceof Element)) {
      continue;
    }

    const name = child.local;
    if (names.includes(name)) {
      ret[name].push(child);
    }

    _findMultiDescendantsByLocalName(child, names, ret);
  }
}

/**
 * This is a specialized version of [[findMultiDescendantsByLocalName]] that
 * searches through the first child element and its descendants. ``element`` and
 * ``attribute`` elements during simplification get their name class recorded as
 * their first child element.
 *
 * @param el The element in which to search.
 *
 * @param names The name class elements to look for.
 *
 * @returns A map of name to element list.
 */
export function findMultiNames(el: Element,
                               names: string[]): Record<string, Element[]> {
  const nameClass = el.children[0] as Element;
  const descendants = findMultiDescendantsByLocalName(nameClass, names);

  const name = nameClass.local;
  if (names.includes(name)) {
    if (!(name in descendants)) {
      descendants[name] = [];
    }
    descendants[name].unshift(nameClass);
  }

  return descendants;
}

/**
 * Index the elements of ``arr`` by the keys obtained through calling
 * ``makeKey``. If two elements resolve to the same key, the later element
 * overwrites the earlier.
 *
 * @param arr The array to index.
 *
 * @param makeKey A function that takes an array element and makes a key by
 * which this element will be indexed.
 *
 * @return The indexed elements.
 */
export function indexBy<T>(arr: T[],
                           makeKey: (x: T) => string): Record<string, T> {
  const ret = Object.create(null);
  for (const x of arr) {
    ret[makeKey(x)] = x;
  }

  return ret;
}

/**
 * Group the elements of ``arr`` by the keys obtained through calling
 * ``makeKey``. Contrarily to [[indexBy]], this function allows for multiple
 * elements with the same key to coexist in the results because the resulting
 * object maps keys to arrays of elements rather than keys to single elements.
 *
 * @param arr The array to index.
 *
 * @param makeKey A function that takes an array element and makes a key or
 * multiple keys by which this element will be indexed. If the function returns
 * multiple keys then the element is indexed by all the keys produced.
 *
 * @return The grouped elements.
 */
export function groupBy<T>(arr: T[],
                           makeKey: (x: T) => (string | string[])):
Record<string, T[]> {
  const ret: Record<string, T[]> = Object.create(null);
  for (const x of arr) {
    let keys = makeKey(x);

    if (!(keys instanceof Array)) {
      keys = [keys];
    }

    for (const key of keys) {
      let list = ret[key];
      if (list === undefined) {
        list = ret[key] = [];
      }
      list.push(x);
    }
  }

  return ret;
}

/**
 * Get the value of the @name attribute.
 *
 * @param el The element to process.
 */
export function getName(el: Element): string {
  return el.mustGetAttribute("name");
}

export function getAncestorsByLocalNames(el: Element,
                                         names: string[]): Element[] {
  const ancestors = [];
  let parent = el.parent;
  while (parent !== undefined) {
    if (names.includes(parent.local)) {
      ancestors.push(parent);
    }
    parent = parent.parent;
  }

  return ancestors;
}

/**
 * Removes unreferenced ``define`` elements from a grammar.
 *
 * **Important**: this is a very ad-hoc function, not meant for general
 * consumption. For one thing, this function works only if called with ``el``
 * pointing to a top-level ``grammar`` element **after** all ``grammar``
 * elements have been reduced to a single ``grammar``, all ``define`` elements
 * moved to that single ``grammar``, and ``grammar`` contains ``start`` as the
 * first element, and the rest of the children are all ``define`` elements.
 *
 * This function does no check these constraints!!! You must call it from a
 * stage where these constraints hold.
 *
 * This function does not guard against misuse. It must be called from steps
 * that execute after the above assumption holds.
 *
 * @param el The element that contains the ``define`` elements.
 *
 * @param seen A set of ``define`` names. If the name is in the set, then there
 * was a reference to the name, and the ``define`` is kept. Otherwise, the
 * ``define`` is removed.
 */
export function removeUnreferencedDefs(el: Element, seen: Set<string>): void {
  const children = el.children as Element[];
  for (let ix = 1; ix < children.length; ++ix) {
    if (seen.has(children[ix].mustGetAttribute("name"))) {
      continue;
    }

    el.removeChildAt(ix);
    --ix;
  }
}
