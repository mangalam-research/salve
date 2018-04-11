/**
 * Pattern and walker for RNG's ``empty`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { HashMap } from "../hashstructs";
import { addWalker, emptyEvent, Event, EventSet, InternalWalker, isHashMap,
         Pattern } from "./base";

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
export class EmptyWalker extends InternalWalker<Empty> {
  protected constructor(other: EmptyWalker, memo: HashMap);
  protected constructor(el: Empty);
  protected constructor(elOrWalker: Empty | EmptyWalker, memo?: HashMap) {
    if (elOrWalker instanceof EmptyWalker) {
      super(elOrWalker, isHashMap(memo));
    }
    else {
      super(elOrWalker);
    }
  }

  possible(): EventSet {
    // Save some time by avoiding calling _possible. We always want to return a
    // new object here.
    return new EventSet();
  }

  _possible(): EventSet {
    if (this.possibleCached === undefined) {
      this.possibleCached = new EventSet();
    }

    return this.possibleCached;
  }

  fireEvent(ev: Event): false | undefined {
    if ((ev === emptyEvent) ||
        ((ev.params[0] === "text") &&
         ((ev.params[1] as string).trim() === ""))) {
      return false;
    }

    return undefined;
  }

  _suppressAttributes(): void {
    // We don't contain attributes...
  }
}

addWalker(Empty, EmptyWalker);

//  LocalWords:  RNG's MPL possibleCached
