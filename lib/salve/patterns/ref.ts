import { ElementNameError } from "../errors";
import { HashMap } from "../hashstructs";
import { ConcreteName } from "../name_patterns";
import { addWalker, EndResult, Event, EventSet, InternalFireEventResult,
         InternalWalker, makeEventSet, Pattern } from "./base";
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
  protected constructor(walker: RefWalker, memo: HashMap);
  protected constructor(el: Ref);
  protected constructor(elOrWalker: RefWalker | Ref, memo?: HashMap) {
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
      super(walker, memo as HashMap);
      this.startName = walker.startName;
      this.startTagEvent = walker.startTagEvent;
      this.element = walker.element;
      this.canEndAttribute = walker.canEndAttribute;
      this.canEnd = walker.canEnd;
    }
  }

  _possible(): EventSet {
    return makeEventSet(this.canEnd ? undefined : this.startTagEvent);
  }

  fireEvent(ev: Event): InternalFireEventResult {
    const params = ev.params;
    const eventName = params[0];
    if (!this.canEnd &&
        (eventName === "enterStartTag" ||
         eventName === "startTagAndAttributes") &&
        this.startName.match(params[1] as string, params[2] as string)) {
      this.canEnd = true;

      return [this];
    }

    return undefined;
  }

  end(attribute: boolean = false): EndResult {
    return !attribute && !this.canEnd ?
      [new ElementNameError("tag required", this.startName)] : false;
  }

  _suppressAttributes(): void {
    // We don't cross ref/define boundaries.
  }
}

addWalker(Ref, RefWalker);
