/**
 * Pattern and walker for RNG's ``notAllowed`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { HashMap } from "../hashstructs";
import { addWalker, Event, EventSet, isHashMap, Pattern, Walker } from "./base";

/**
 * Pattern for ``<notAllowed/>``.
 */
export class NotAllowed extends Pattern {}

/**
 * Walker for [[NotAllowed]];
 */
export class NotAllowedWalker extends Walker<NotAllowed> {
  /**
   * @param el The pattern for which this walker was created.
   */
  protected constructor(walker: NotAllowedWalker, memo: HashMap);
  protected constructor(el: NotAllowed);
  protected constructor(elOrWalker: NotAllowedWalker | NotAllowed,
                        memo?: HashMap) {
    if (elOrWalker instanceof NotAllowedWalker) {
      const walker: NotAllowedWalker = elOrWalker;
      memo = isHashMap(memo); // Makes sure it is not undefined.
      super(walker, memo);
    }
    else {
      const el: NotAllowed = elOrWalker;
      super(el);
      this.possibleCached = new EventSet();
    }
  }

  possible(): EventSet {
    // Save some time by avoiding calling _possible
    return new EventSet();
  }

  _possible(): EventSet {
    // possibleCached is necessarily defined because of the constructor's
    // logic.
    // tslint:disable-next-line:no-non-null-assertion
    return this.possibleCached!;
  }

  fireEvent(ev: Event): undefined {
    return undefined; // we never match!
  }
}

addWalker(NotAllowed, NotAllowedWalker);

//  LocalWords:  RNG's MPL possibleCached
