import { ElementNameError } from "../errors";
import { ConcreteName } from "../name_patterns";
import { EndResult, Event, EventSet, InternalFireEventResult, InternalWalker,
         Pattern } from "./base";
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

  newWalker(): InternalWalker {
    const element = this.element;

    // tslint:disable-next-line:no-use-before-declare
    return new RefWalker(this,
                         element,
                         element.name,
                         new Event("enterStartTag", element.name),
                         true,
                         false);
  }
}

export class RefWalker implements InternalWalker {
  /**
   * @param el The pattern for which this walker was constructed.
   */
  constructor(protected readonly el: Ref,
              readonly element: Element,
              private readonly startName: ConcreteName,
              private readonly startTagEvent: Event,
              public canEndAttribute: boolean,
              public canEnd: boolean) {}

  clone(): this {
    return new RefWalker(this.el,
                         this.element,
                         this.startName,
                         this.startTagEvent,
                         this.canEndAttribute,
                         this.canEnd) as this;
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

      return new InternalFireEventResult(true, undefined, [this]);
    }

    return new InternalFireEventResult(false);
  }

  end(): EndResult {
    return !this.canEnd ?
      [new ElementNameError("tag required", this.startName)] : false;
  }

  endAttributes(): EndResult {
    return false;
  }
}
