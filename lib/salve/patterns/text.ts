/**
 * Pattern and walker for RNG's ``text`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { HashMap } from "../hashstructs";
import { addWalker, Event, EventSet, isHashMap, Pattern, Walker } from "./base";
import { NotAllowedWalker } from "./not_allowed";

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
  protected constructor(walker: NotAllowedWalker, memo: HashMap);
  protected constructor(el: Text);
  protected constructor(elOrWalker: NotAllowedWalker | Text, memo?: HashMap) {
    if (elOrWalker instanceof NotAllowedWalker) {
      const walker: NotAllowedWalker = elOrWalker;
      memo = isHashMap(memo);
      super(walker, memo);
    }
    else {
      super(elOrWalker);
      this.possibleCached = new EventSet(TextWalker._textEvent);
    }
  }

  _possible(): EventSet {
    // possibleCached is necessarily defined because of the constructor's
    // logic.
    // tslint:disable-next-line:no-non-null-assertion
    return this.possibleCached!;
  }

  fireEvent(ev: Event): false | undefined {
    return (ev.params[0] === "text") ? false : undefined;
  }
}
addWalker(Text, TextWalker);
