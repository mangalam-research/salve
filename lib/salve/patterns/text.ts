/**
 * Pattern and walker for RNG's ``text`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { addWalker, CloneMap, Event, EventSet, InternalWalker, makeEventSet,
         Pattern } from "./base";

/**
 * Pattern for ``<text/>``.
 */
export class Text extends Pattern {
  hasEmptyPattern(): boolean {
    // A text node may always be a zero-length node, which mean that we
    // effectively allow the container to be empty.
    return true;
  }
}

/**
 *
 * Walker for [[Text]]
 *
 */
class TextWalker extends InternalWalker<Text> {
  private static readonly _textEvent: Event = new Event("text", /^.*$/);

  private ended: boolean;

  canEnd: boolean;
  canEndAttribute: boolean;

  /**
   * @param el The pattern for which this walker was constructed.
   */
  protected constructor(walker: TextWalker, memo: CloneMap);
  protected constructor(el: Text);
  protected constructor(elOrWalker: TextWalker | Text, memo?: CloneMap) {
    if ((elOrWalker as Text).newWalker !== undefined) {
      super(elOrWalker as Text);
      this.ended = false;
    }
    else {
      const walker = elOrWalker as TextWalker;
      super(walker, memo as CloneMap);
      this.ended = walker.ended;
    }

    this.canEnd = true;
    this.canEndAttribute = true;
  }

  _possible(): EventSet {
    if (this.possibleCached === undefined) {
      this.possibleCached = makeEventSet(TextWalker._textEvent);
    }

    return this.possibleCached;
  }

  fireEvent(name: string): false | undefined {
    return !this.ended && (name === "text") ? false : undefined;
  }

  _suppressAttributes(): void {
    // We don't contain attributes...
  }

  end(): false {
    this.ended = true;

    return false;
  }
}
addWalker(Text, TextWalker);

//  LocalWords:  RNG's MPL possibleCached
