/**
 * Pattern and walker for RNG's ``empty`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { HashMap } from "../hashstructs";
import { addWalker, emptyEvent, Event, EventSet, isHashMap, Pattern,
         Walker } from "./base";

/**
 * Pattern for ``<empty/>``.
 */
export class Empty extends Pattern {}

/**
 * Walker for [[Empty]].
 *
 * @param el The pattern for which this walker was created.
 *
 * @param resolver Ignored by this walker.
 */
export class EmptyWalker extends Walker<Empty> {
  protected constructor(other: EmptyWalker, memo: HashMap);
  protected constructor(el: Empty);
  protected constructor(elOrWalker: Empty | EmptyWalker, memo?: HashMap) {
    if (elOrWalker instanceof EmptyWalker) {
      memo = isHashMap(memo);
      super(elOrWalker, memo);
    }
    else {
      super(elOrWalker);
      this.possibleCached = new EventSet();
    }
  }

  possible(): EventSet {
    // Save some time by avoiding calling _possible. We always want to return a
    // new object here.
    return new EventSet();
  }

  _possible(): EventSet {
    // possibleCached is necessarily defined because of the constructor's
    // logic.
    // tslint:disable-next-line:no-non-null-assertion
    return this.possibleCached!;
  }

  fireEvent(ev: Event): false | undefined {
    if ((ev === emptyEvent) ||
        ((ev.params[0] === "text") &&
         ((ev.params[1] as string).trim() === ""))) {
      return false;
    }

    return undefined;
  }
}

addWalker(Empty, EmptyWalker);

//  LocalWords:  RNG's MPL possibleCached
