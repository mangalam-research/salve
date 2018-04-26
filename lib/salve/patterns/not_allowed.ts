/**
 * Pattern and walker for RNG's ``notAllowed`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Event, EventSet, InternalWalker, Pattern } from "./base";

/**
 * Pattern for ``<notAllowed/>``.
 */
export class NotAllowed extends Pattern {
  newWalker(): NotAllowedWalker {
    // tslint:disable-next-line:no-use-before-declare
    return singleton;
  }
}

/**
 * Walker for [[NotAllowed]];
 */
export class NotAllowedWalker extends InternalWalker<NotAllowed> {
  canEnd: boolean;
  canEndAttribute: boolean;

  /**
   * @param el The pattern for which this walker was created.
   */
  protected constructor(el: NotAllowed) {
    super(el);
    this.canEnd = true;
    this.canEndAttribute = true;
  }

  static makeNew(el: NotAllowed): NotAllowedWalker {
    return new NotAllowedWalker(el);
  }

  // Since NotAllowedWalker is a singleton, the cloning operation just
  // returns the original walker.
  clone(): this {
    return this;
  }

  possible(): EventSet {
    return new Set<Event>();
  }

  possibleAttributes(): EventSet {
    return new Set<Event>();
  }

  fireEvent(): undefined {
    return undefined; // we never match!
  }
}

const singleton = NotAllowedWalker.makeNew(new NotAllowed("FAKE ELEMENT"));

//  LocalWords:  RNG's MPL possibleCached
