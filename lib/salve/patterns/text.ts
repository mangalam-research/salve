/**
 * Pattern and walker for RNG's ``text`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { HashMap } from "../hashstructs";
import { addWalker, Event, EventSet, isHashMap, Pattern, Walker } from "./base";

/**
 * Pattern for ``<text/>``.
 */
export class Text extends Pattern {}

/**
 *
 * Walker for [[Text]]
 *
 */
class TextWalker extends Walker<Text> {
  private static readonly _textEvent: Event = new Event("text", /^.*$/);

  /**
   * @param el The pattern for which this walker was constructed.
   */
  protected constructor(walker: TextWalker, memo: HashMap);
  protected constructor(el: Text);
  protected constructor(elOrWalker: TextWalker | Text, memo?: HashMap) {
    if (elOrWalker instanceof TextWalker) {
      super(elOrWalker, isHashMap(memo));
    }
    else {
      super(elOrWalker);
    }
  }

  _possible(): EventSet {
    if (this.possibleCached === undefined) {
      this.possibleCached = new EventSet(TextWalker._textEvent);
    }

    return this.possibleCached;
  }

  fireEvent(ev: Event): false | undefined {
    return (ev.params[0] === "text") ? false : undefined;
  }
}
addWalker(Text, TextWalker);

//  LocalWords:  RNG's MPL possibleCached
