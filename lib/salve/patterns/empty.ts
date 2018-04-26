/**
 * Pattern and walker for RNG's ``empty`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { addWalker, CloneMap, Event, EventSet, InternalWalker,
         Pattern } from "./base";

/**
 * Pattern for ``<empty/>``.
 */
export class Empty extends Pattern {
  hasEmptyPattern(): boolean {
    return true;
  }

  newWalker(): EmptyWalker {
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
export class EmptyWalker extends InternalWalker<Empty> {
  canEnd: boolean;
  canEndAttribute: boolean;

  protected constructor(other: EmptyWalker, memo: CloneMap);
  protected constructor(el: Empty);
  protected constructor(elOrWalker: Empty | EmptyWalker, memo?: CloneMap) {
    super(elOrWalker as EmptyWalker, memo as CloneMap);
    this.canEnd = true;
    this.canEndAttribute = true;
  }

  static makeNew(el: Empty): EmptyWalker {
    return new EmptyWalker(el);
  }

  // Since the Empty walker is a singleton, the cloning operation just
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

  fireEvent(name: string, params: string[]): false | undefined {
    return ((name === "text") && !/\S/.test(params[0])) ? false : undefined;
  }

  _suppressAttributes(): void {
    // We don't contain attributes...
  }
}

addWalker(Empty, EmptyWalker);

const singleton = EmptyWalker.makeNew(new Empty("FAKE ELEMENT"));

//  LocalWords:  RNG's MPL possibleCached
