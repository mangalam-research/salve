/**
 * Walking parsed trees.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { Element, isElement } from "./parser";

/**
 * Base class for conversion walkers.
 */
export abstract class ConversionWalker {
  /**
   * Walks an element's children.
   *
   * @param el The element whose children must be walked.
   *
   * @param startAt Index at which to start walking.
   *
   * @param endAt Index at which to end walking. If unspecified, go to the end
   * of the children of ``el``.
   */
  walkChildren(el: Element, startAt: number = 0, endAt?: number): void {
    const children = el.children;
    const limit = (endAt === undefined) ? children.length :
      Math.min(endAt, children.length);

    if (limit < startAt) {
      throw new Error("invalid parameters passed");
    }

    for (let i = startAt; i < limit; ++i) {
      const child = children[i];
      if (isElement(child)) {
        this.walk(child);
      }
    }
  }

  /**
   * Walk an element.
   *
   * @param el The element to walk.
   */
  abstract walk(el: Element): void;
}

//  LocalWords:  MPL DefaultConversionWalker param includePaths NameChoice ns
//  LocalWords:  datatypeLibrary params oneOrMore nsName RNG xmlns libname el
//  LocalWords:  QName stringify
