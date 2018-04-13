/**
 * Pattern and walker for RNG's ``empty`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { HashMap } from "../hashstructs";
import { addWalker, Event, EventSet, InternalWalker, Pattern } from "./base";

/**
 * Pattern for ``<empty/>``.
 */
export class Empty extends Pattern {
  hasEmptyPattern(): boolean {
    return true;
  }
}

/**
 * Walker for [[Empty]].
 *
 * @param el The pattern for which this walker was created.
 *
 * @param resolver Ignored by this walker.
 */
export class EmptyWalker extends InternalWalker<Empty> {
  canEnd: boolean;
  canEndAttribute: boolean;

  protected constructor(other: EmptyWalker, memo: HashMap);
  protected constructor(el: Empty);
  protected constructor(elOrWalker: Empty | EmptyWalker, memo?: HashMap) {
    if ((elOrWalker as Empty).newWalker !== undefined) {
      super(elOrWalker as Empty);
    }
    else {
      super(elOrWalker as EmptyWalker, memo as HashMap);
    }
    this.canEnd = true;
    this.canEndAttribute = true;
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
    if (((ev.params[0] === "text") &&
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
