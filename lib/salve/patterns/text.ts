/**
 * Pattern and walker for RNG's ``text`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { HashMap } from "../hashstructs";
import { addWalker, Event, EventSet, InternalWalker, isHashMap,
         Pattern } from "./base";

/**
 * Pattern for ``<text/>``.
 */
export class Text extends Pattern {}

/**
 *
 * Walker for [[Text]]
 *
 */
class TextWalker extends InternalWalker<Text> {
  private static readonly _textEvent: Event = new Event("text", /^.*$/);

  private ended: boolean;

  /**
   * @param el The pattern for which this walker was constructed.
   */
  protected constructor(walker: TextWalker, memo: HashMap);
  protected constructor(el: Text);
  protected constructor(elOrWalker: TextWalker | Text, memo?: HashMap) {
    if (elOrWalker instanceof TextWalker) {
      super(elOrWalker, isHashMap(memo));
      this.ended = elOrWalker.ended;
    }
    else {
      super(elOrWalker);
      this.ended = false;
    }
  }

  _possible(): EventSet {
    if (this.possibleCached === undefined) {
      this.possibleCached = new EventSet(TextWalker._textEvent);
    }

    return this.possibleCached;
  }

  fireEvent(ev: Event): false | undefined {
    return !this.ended && (ev.params[0] === "text") ? false : undefined;
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
