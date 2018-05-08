/**
 * Pattern and walker for RNG's ``empty`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Event, EventSet, InternalFireEventResult, InternalWalker,
         Pattern } from "./base";

/**
 * Pattern for ``<empty/>``.
 */
export class Empty extends Pattern {
  hasEmptyPattern(): boolean {
    return true;
  }

  newWalker(): InternalWalker<Empty> {
    // tslint:disable-next-line:no-use-before-declare
    return singleton;
  }
}

/**
 * Walker for [[Empty]].
 *
 * @param el The pattern for which this walker was created.
 *
 * @param resolver Ignored by this walker.
 */
class EmptyWalker extends InternalWalker<Empty> {
  protected readonly el: Empty;
  canEnd: boolean;
  canEndAttribute: boolean;

  constructor(el: Empty) {
    super();
    this.el = el;
    this.canEnd = true;
    this.canEndAttribute = true;
  }

  // Since the Empty walker is a singleton, the cloning operation just
  // returns the original walker.
  clone(): this {
    return this;
  }

  // Since the Empty walker is a singleton, the cloning operation just
  // returns the original walker.
  _clone(): this {
    return this;
  }

  possible(): EventSet {
    return new Set<Event>();
  }

  possibleAttributes(): EventSet {
    return new Set<Event>();
  }

  fireEvent(name: string, params: string[]): InternalFireEventResult {
    return new InternalFireEventResult((name === "text") &&
                                       !/\S/.test(params[0]));
  }
}

const singleton = new EmptyWalker(new Empty("FAKE ELEMENT"));

//  LocalWords:  RNG's MPL possibleCached
