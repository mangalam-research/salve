import { OneSubpattern } from "./base";
import { Element } from "./element";

/**
 * A pattern for ``<define>``.
 */
export class Define extends OneSubpattern<Element> {
  /**
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param name The name of the definition.
   *
   * @param pat The pattern contained by this one.
   */

  constructor(xmlPath: string, readonly name: string, pat: Element) {
    super(xmlPath, pat);
  }

  protected _computeHasEmptyPattern(): boolean {
    return this.pat.hasEmptyPattern();
  }
}
