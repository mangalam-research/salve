import { ElementNameError } from "../errors";
import { ConcreteName } from "../name_patterns";
import { addWalker, CloneMap, EndResult, Event, EventSet,
         InternalFireEventResult, InternalWalker, Pattern } from "./base";
import { Define } from "./define";
import { Element } from "./element";

/**
 * A pattern for RNG references.
 */
export class Ref extends Pattern {
  private resolvesTo?: Define;
  /**
   *
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param name The reference name.
   */
  constructor(xmlPath: string, readonly name: string) {
    super(xmlPath);
  }

  _prepare(definitions: Map<string, Define>): Ref[] | undefined {
    this.resolvesTo = definitions.get(this.name);

    return (this.resolvesTo === undefined) ? [this] : undefined;
  }

  hasEmptyPattern(): boolean {
    // Refs always contain an element at the top level.
    return false;
  }

  get element(): Element {
    const resolvesTo = this.resolvesTo;
    if (resolvesTo === undefined) {
      throw new Error("trying to get an element on a ref hat has not been \
resolved");
    }

    return resolvesTo.pat;
  }
}

export class RefWalker extends InternalWalker<Ref> {
  private startName: ConcreteName;
  private startTagEvent: Event;
  canEndAttribute: boolean;
  canEnd: boolean;
  readonly element: Element;

  /**
   * @param el The pattern for which this walker was constructed.
   */
  protected constructor(walker: RefWalker, memo: CloneMap);
  protected constructor(el: Ref);
  protected constructor(elOrWalker: RefWalker | Ref, memo?: CloneMap) {
    if ((elOrWalker as Ref).newWalker !== undefined) {
      super(elOrWalker as Ref);
      this.element = elOrWalker.element;
      this.startName = elOrWalker.element.name;
      this.startTagEvent = new Event("enterStartTag", this.startName);
      this.canEndAttribute = true;
      this.canEnd = false;
    }
    else {
      const walker = elOrWalker as RefWalker;
      super(walker, memo as CloneMap);
      this.startName = walker.startName;
      this.startTagEvent = walker.startTagEvent;
      this.element = walker.element;
      this.canEndAttribute = walker.canEndAttribute;
      this.canEnd = walker.canEnd;
    }
  }

  possible(): EventSet {
    return new Set(this.canEnd ? undefined : [this.startTagEvent]);
  }

  possibleAttributes(): EventSet {
    return new Set<Event>();
  }

  fireEvent(name: string, params: string[]): InternalFireEventResult {
    if (!this.canEnd &&
        (name === "enterStartTag" || name === "startTagAndAttributes") &&
        this.startName.match(params[0], params[1])) {
      this.canEnd = true;

      return [this];
    }

    return undefined;
  }

  end(): EndResult {
    return !this.canEnd ?
      [new ElementNameError("tag required", this.startName)] : false;
  }

  endAttributes(): EndResult {
    return false;
  }
}

addWalker(Ref, RefWalker);
