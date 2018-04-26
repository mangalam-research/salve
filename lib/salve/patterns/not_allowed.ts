/**
 * Pattern and walker for RNG's ``notAllowed`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { addWalker, CloneMap, EventSet, InternalWalker, makeEventSet,
         Pattern } from "./base";

/**
 * Pattern for ``<notAllowed/>``.
 */
export class NotAllowed extends Pattern {}

/**
 * Walker for [[NotAllowed]];
 */
export class NotAllowedWalker extends InternalWalker<NotAllowed> {
  canEnd: boolean;
  canEndAttribute: boolean;

  /**
   * @param el The pattern for which this walker was created.
   */
  protected constructor(walker: NotAllowedWalker, memo: CloneMap);
  protected constructor(el: NotAllowed);
  protected constructor(elOrWalker: NotAllowedWalker | NotAllowed,
                        memo?: CloneMap) {
    if ((elOrWalker as NotAllowed).newWalker !== undefined) {
      super(elOrWalker as NotAllowed);
    }
    else {
      super(elOrWalker as NotAllowedWalker, memo as CloneMap);
    }

    this.canEnd = true;
    this.canEndAttribute = true;
  }

  possible(): EventSet {
    return makeEventSet();
  }

  fireEvent(): undefined {
    return undefined; // we never match!
  }

  _suppressAttributes(): void {
    // We don't contain attributes...
  }
}

addWalker(NotAllowed, NotAllowedWalker);

//  LocalWords:  RNG's MPL possibleCached
