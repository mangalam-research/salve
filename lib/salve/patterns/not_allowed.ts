/**
 * Pattern and walker for RNG's ``notAllowed`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { HashMap } from "../hashstructs";
import { addWalker, Event, EventSet, InternalWalker, isHashMap,
         Pattern } from "./base";

/**
 * Pattern for ``<notAllowed/>``.
 */
export class NotAllowed extends Pattern {}

/**
 * Walker for [[NotAllowed]];
 */
export class NotAllowedWalker extends InternalWalker<NotAllowed> {
  /**
   * @param el The pattern for which this walker was created.
   */
  protected constructor(walker: NotAllowedWalker, memo: HashMap);
  protected constructor(el: NotAllowed);
  protected constructor(elOrWalker: NotAllowedWalker | NotAllowed,
                        memo?: HashMap) {
    if (elOrWalker instanceof NotAllowedWalker) {
      super(elOrWalker, isHashMap(memo));
    }
    else {
      super(elOrWalker);
    }
  }

  possible(): EventSet {
    // Save some time by avoiding calling _possible
    return new EventSet();
  }

  _possible(): EventSet {
    if (this.possibleCached === undefined) {
      this.possibleCached = new EventSet();
    }

    return this.possibleCached;
  }

  fireEvent(ev: Event): undefined {
    return undefined; // we never match!
  }

  _suppressAttributes(): void {
    // We don't contain attributes...
  }
}

addWalker(NotAllowed, NotAllowedWalker);

//  LocalWords:  RNG's MPL possibleCached
