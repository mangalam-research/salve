/**
 * Pattern and walker for RNG's ``element`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { AttributeNameError, AttributeValueError, ElementNameError,
         ValidationError } from "../errors";
import { HashMap } from "../hashstructs";
import { ConcreteName, Name } from "../name_patterns";
import { NameResolver } from "../name_resolver";
import { TrivialMap } from "../types";
import { BasePattern, ElementI, EndResult, Event, EventSet, FireEventResult,
         isHashMap, isNameResolver, OneSubpattern, Pattern,
         Walker } from "./base";
import { NotAllowed } from "./not_allowed";

/**
 * A pattern for elements.
 */
export class Element extends OneSubpattern implements ElementI {
  /**
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param name The qualified name of the element.
   *
   * @param pat The pattern contained by this one.
   */
  constructor(xmlPath: string, readonly name: ConcreteName,
              pat: Pattern) {
    super(xmlPath, pat);
  }

  _prepare(namespaces: TrivialMap<number>): void {
    this.name._recordNamespaces(namespaces);
    this.pat._prepare(namespaces);
  }

  // addWalker(Element, ElementWalker); Nope... see below..
  newWalker(resolver: NameResolver): Walker<BasePattern> {
    if (this.pat instanceof NotAllowed) {
      return this.pat.newWalker(resolver);
    }

    // tslint:disable-next-line:no-use-before-declare
    return ElementWalker.makeWalker(this, resolver);
  }

  _hasAttrs(): boolean {
    return false;
  }
}

/**
 *
 * Walker for [[Element]].
 */
class ElementWalker extends Walker<Element> {
  private static _leaveStartTagEvent: Event = new Event("leaveStartTag");

  private seenName: boolean;
  private endedStartTag: boolean;
  private closed: boolean;
  private walker: Walker<BasePattern> | undefined;
  private startTagEvent: Event;
  private endTagEvent: Event | undefined;
  private boundName: Name | undefined;
  private readonly nameResolver: NameResolver;

  /**
   * @param el The pattern for which this walker was
   * created.
   *
   * @param nameResolver The name resolver that
   * can be used to convert namespace prefixes to namespaces.
   */
  protected constructor(walker: ElementWalker, memo: HashMap);
  protected constructor(el: Element, nameResolver: NameResolver);
  protected constructor(elOrWalker: ElementWalker | Element,
                        nameResolverOrMemo: NameResolver | HashMap) {
    if (elOrWalker instanceof ElementWalker) {
      const walker: ElementWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.seenName = walker.seenName;
      this.endedStartTag = walker.endedStartTag;
      this.closed = walker.closed;
      this.walker = walker.walker !== undefined ? walker.walker._clone(memo) :
        undefined;

      // No cloning needed since these are immutable.
      this.startTagEvent = walker.startTagEvent;
      this.endTagEvent = walker.endTagEvent;
      this.boundName = walker.boundName;
    }
    else {
      const el: Element = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo);
      super(el);
      this.nameResolver = nameResolver;
      this.seenName = false;
      this.endedStartTag = false;
      this.closed = false;
      this.startTagEvent = new Event("enterStartTag", el.name);
    }
  }

  static makeWalker(el: Element, nameResolver: NameResolver): ElementWalker {
    return new ElementWalker(el, nameResolver);
  }

  _possible(): EventSet {
    if (!this.seenName) {
      return new EventSet(this.startTagEvent);
    }
    else if (!this.endedStartTag) {
      // If we have seen the name, then there is necessarily a walker.
      // tslint:disable-next-line:no-non-null-assertion
      const walker = this.walker!;

      const all: EventSet = walker._possible();
      let ret: EventSet = new EventSet();
      // We use valueEvs to record whether an attributeValue is a
      // possibility. If so, we must only return these possibilities and no
      // other.
      const valueEvs: EventSet = new EventSet();
      all.forEach((poss: Event) => {
        if (poss.params[0] === "attributeValue") {
          valueEvs.add(poss);
        }
        else if (poss.isAttributeEvent()) {
          ret.add(poss);
        }
      });

      if (valueEvs.size() !== 0) {
        ret = valueEvs;
      }
      else if (walker.canEnd(true)) {
        ret.add(ElementWalker._leaveStartTagEvent);
      }

      return ret;
    }
    else if (!this.closed) {
      // If we have seen the name, then there is necessarily a walker.
      // tslint:disable-next-line:no-non-null-assertion
      const walker = this.walker!;

      const posses: EventSet = new EventSet(walker._possible());
      if (walker.canEnd()) {
        posses.add(this.endTagEvent);
      }

      return posses;
    }

    return new EventSet();
  }

  // _possible always returns new sets
  possible(): EventSet {
    return this._possible();
  }

  fireEvent(ev: Event): FireEventResult {
    if (!this.endedStartTag) {
      if (!this.seenName) {
        if (ev.params[0] === "enterStartTag" &&
            this.el.name.match(ev.params[1] as string,
                               ev.params[2] as string)) {
          this.walker = this.el.pat.newWalker(this.nameResolver);
          this.seenName = true;
          this.boundName = new Name("", ev.params[1] as string,
                                    ev.params[2] as string);
          this.endTagEvent = new Event("endTag", this.boundName);

          return false;
        }
      }
      else if (ev.params[0] === "leaveStartTag") {
        this.endedStartTag = true;

        // If we have seen the name, then there is necessarily a walker.
        // tslint:disable-next-line:no-non-null-assertion
        const walker = this.walker!;

        const errs: EndResult = walker.end(true);
        const ret: ValidationError[] = [];
        if (errs) {
          for (const err of errs) {
            if (err instanceof AttributeValueError ||
                err instanceof AttributeNameError) {
              ret.push(err);
            }
          }
        }

        // And suppress the attributes.
        walker._suppressAttributes();

        return ret.length !== 0 ? ret : false;
      }

      return this.walker !== undefined ? this.walker.fireEvent(ev) : undefined;
    }
    else if (!this.closed) {
      // If we have ended the start tag, then there is necessarily a walker.
      // tslint:disable-next-line:no-non-null-assertion
      const walker = this.walker!;

      let ret: FireEventResult = walker.fireEvent(ev);
      if (ret === undefined) {
        // Our subwalker did not handle the event, so we must do it here.
        if (ev.params[0] === "endTag") {
          // boundName is necessarily defined by the time we get here.
          // tslint:disable-next-line:no-non-null-assertion
          if (this.boundName!.match(ev.params[1] as string,
                                    ev.params[2] as string)) {
            this.closed = true;

            const errs: EndResult = walker.end();
            ret = [];

            // Strip out the attributes errors as we've already reported
            // them.
            if (errs) {
              for (const err of errs) {
                if (!(err instanceof AttributeValueError ||
                      err instanceof AttributeNameError)) {
                  ret.push(err);
                }
              }
            }

            return ret.length !== 0 ? ret : false;
          }
        }
        else if (ev.params[0] === "leaveStartTag") {
          return [new ValidationError(
            "unexpected leaveStartTag event; it is likely that " +
              "fireEvent is incorrectly called")];
        }
      }

      return ret;
    }

    return undefined;
  }

  _suppressAttributes(): void {
    // _suppressAttributes does not cross element boundary
    return;
  }

  canEnd(attribute: boolean = false): boolean {
    if (attribute) {
      return true;
    }

    return this.closed;
  }

  end(attribute: boolean = false): EndResult {
    if (attribute) {
      return false;
    }

    let ret: ValidationError[] = [];
    if (!this.seenName) {
      ret.push(new ElementNameError("tag required", this.el.name));
    }
    else if (!this.endedStartTag || !this.closed) {
      if (this.walker !== undefined) {
        const errs: EndResult = this.walker.end();
        if (errs) {
          ret = errs;
        }
      }
      ret.push(this.endedStartTag ?
               new ElementNameError("tag not closed", this.el.name) :
               new ElementNameError("start tag not terminated", this.el.name));
    }

    if (ret.length > 0) {
      return ret;
    }

    return false;
  }
}

//  LocalWords:  RNG's MPL RNG addWalker ElementWalker leaveStartTag valueEvs
//  LocalWords:  enterStartTag attributeValue endTag errored subwalker
//  LocalWords:  neutralizeAttribute boundName fireEvent suppressAttributes
