import { ElementNameError } from "../errors";
import { HashMap } from "../hashstructs";
import { ConcreteName, Name } from "../name_patterns";
import { TrivialMap } from "../types";
import { addWalker, EndResult, Event, EventSet, InternalFireEventResult,
         InternalWalker, isHashMap, Pattern } from "./base";
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

  _prepare(): void {
    // We do not cross ref/define boundaries to avoid infinite loops.
    return;
  }

  _resolve(definitions: TrivialMap<Define>): Ref[] | undefined {
    this.resolvesTo = definitions[this.name];
    if (this.resolvesTo === undefined) {
      return [this];
    }

    return undefined;
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
  private _boundName: Name | undefined;
  readonly element: Element;

  /**
   * @param el The pattern for which this walker was constructed.
   */
  protected constructor(walker: RefWalker, memo: HashMap);
  protected constructor(el: Ref);
  protected constructor(elOrWalker: RefWalker | Ref, memo?: HashMap) {
    if (elOrWalker instanceof RefWalker) {
      const walker = elOrWalker;
      super(walker, isHashMap(memo));
      this.startName = walker.startName;
      this.startTagEvent = walker.startTagEvent;
      this._boundName = walker._boundName;
      this.element = walker.element;
    }
    else {
      super(elOrWalker);
      this.element = elOrWalker.element;
      this.startName = elOrWalker.element.name;
      this.startTagEvent = new Event("enterStartTag", this.startName);
    }
  }

  get boundName(): Name {
    if (this._boundName === undefined) {
      throw new Error("boundName is not defined yet");
    }

    return this._boundName;
  }

  _possible(): EventSet {
    if (this._boundName === undefined) {
      return new EventSet(this.startTagEvent);
    }

    return new EventSet();
  }

  fireEvent(ev: Event): InternalFireEventResult {
    const params = ev.params;
    const eventName = params[0];
    if (this._boundName === undefined) {
      if ((eventName === "enterStartTag" ||
           eventName === "startTagAndAttributes") &&
          this.startName.match(params[1] as string, params[2] as string)) {
        this._boundName = new Name("", params[1] as string,
                                   params[2] as string);

        return [this];
      }
    }

    return undefined;
  }

  canEnd(attribute: boolean = false): boolean {
    return attribute || this._boundName !== undefined;
  }

  end(attribute: boolean = false): EndResult {
    return !attribute && this._boundName === undefined ?
      [new ElementNameError("tag required", this.startName)] : false;
  }

  _suppressAttributes(): void {
    // We don't cross ref/define boundaries.
  }
}

addWalker(Ref, RefWalker);
