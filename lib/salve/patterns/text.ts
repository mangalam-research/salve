/**
 * Pattern and walker for RNG's ``text`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Event, EventSet, InternalFireEventResult, InternalWalker,
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

  newWalker(): InternalWalker<Text> {
    // tslint:disable-next-line:no-use-before-declare
    return singleton;
  }
}

/**
 *
 * Walker for [[Text]]
 *
 */
class TextWalker extends InternalWalker<Text> {
  protected readonly el: Text;
  private static readonly _textEvent: Event = new Event("text", /^.*$/);
  canEnd: boolean;
  canEndAttribute: boolean;

  /**
   * @param el The pattern for which this walker was constructed.
   */
  constructor(el: Text) {
    super();
    this.el = el;
    this.canEnd = true;
    this.canEndAttribute = true;
  }

  // Since TextWalker is a singleton, the cloning operation just
  // returns the original walker.
  clone(): this {
    return this;
  }

  // Since TextWalker is a singleton, the cloning operation just
  // returns the original walker.
  _clone(): this {
    return this;
  }

  possible(): EventSet {
    return new Set([TextWalker._textEvent]);
  }

  possibleAttributes(): EventSet {
    return new Set<Event>();
  }

  fireEvent(name: string): InternalFireEventResult {
    return new InternalFireEventResult(name === "text");
  }

  end(): false {
    return false;
  }

  endAttributes(): false {
    return false;
  }
}

const singleton = new TextWalker(new Text("FAKE ELEMENT"));

//  LocalWords:  RNG's MPL possibleCached
