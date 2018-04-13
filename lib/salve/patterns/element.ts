/**
 * Pattern and walker for RNG's ``element`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { ElementNameError } from "../errors";
import { HashMap } from "../hashstructs";
import { ConcreteName, Name } from "../name_patterns";
import { NameResolver } from "../name_resolver";
import { TrivialMap } from "../types";
import { BasePattern, EndResult, Event, EventSet, InternalFireEventResult,
         InternalWalker, Pattern } from "./base";
import { Define } from "./define";
import { NotAllowed } from "./not_allowed";
import { Ref } from "./ref";

/**
 * A pattern for elements.
 */
export class Element extends BasePattern {
  private readonly notAllowed: boolean;
  /**
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param name The qualified name of the element.
   *
   * @param pat The pattern contained by this one.
   */
  constructor(xmlPath: string, readonly name: ConcreteName,
              readonly pat: Pattern) {
    super(xmlPath);
    this.notAllowed = this.pat instanceof NotAllowed;
  }

  // addWalker(Element, ElementWalker); Nope... see below..
  newWalker(resolver: NameResolver,
            boundName: Name): InternalWalker<BasePattern> {
    return this.notAllowed ?
      this.pat.newWalker(resolver) :
      // tslint:disable-next-line:no-use-before-declare
      ElementWalker.makeWalker(this, resolver, boundName);
  }

  hasAttrs(): boolean {
    return false;
  }

  hasEmptyPattern(): boolean {
    // The question is whether an element allows empty content **in the context
    // in which it appears**, not empty content inside it. So the answer is
    // always negative.
    return false;
  }

  _prepare(namespaces: TrivialMap<number>): void {
    this.name._recordNamespaces(namespaces);
    this.pat._prepare(namespaces);
  }

  _resolve(definitions: TrivialMap<Define>): Ref[] | undefined {
    return this.pat._resolve(definitions);
  }
}

/**
 *
 * Walker for [[Element]].
 */
class ElementWalker extends InternalWalker<Element> {
  private static _leaveStartTagEvent: Event = new Event("leaveStartTag");

  private endedStartTag: boolean;
  private walker: InternalWalker<BasePattern>;
  private endTagEvent: Event;
  private boundName: Name;
  private readonly nameResolver: NameResolver;
  canEndAttribute: boolean;
  canEnd: boolean;

  /**
   * @param el The pattern for which this walker was
   * created.
   *
   * @param nameResolver The name resolver that
   * can be used to convert namespace prefixes to namespaces.
   */
  protected constructor(walker: ElementWalker, memo: HashMap);
  protected constructor(el: Element, nameResolver: NameResolver,
                        boundName: Name);
  protected constructor(elOrWalker: ElementWalker | Element,
                        nameResolverOrMemo: NameResolver | HashMap,
                        boundName?: Name) {
    if ((elOrWalker as Element).newWalker !== undefined) {
      const el = elOrWalker as Element;
      const nameResolver = nameResolverOrMemo as NameResolver;
      super(el);
      this.nameResolver = nameResolver;
      this.walker = this.el.pat.newWalker(nameResolver);
      this.endedStartTag = false;
      // tslint:disable-next-line:no-non-null-assertion
      this.boundName = boundName!;
      this.endTagEvent = new Event("endTag", this.boundName);
      this.canEndAttribute = true;
      this.canEnd = false;
    }
    else {
      const walker = elOrWalker as ElementWalker;
      const memo = nameResolverOrMemo as HashMap;
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.endedStartTag = walker.endedStartTag;
      this.walker = walker.walker._clone(memo);

      // No cloning needed since these are immutable.
      this.endTagEvent = walker.endTagEvent;
      this.boundName = walker.boundName;
      this.canEndAttribute = walker.canEndAttribute;
      this.canEnd = walker.canEnd;
    }
  }

  static makeWalker(el: Element, nameResolver: NameResolver,
                    boundName: Name): ElementWalker {
    return new ElementWalker(el, nameResolver, boundName);
  }

  _possible(): EventSet {
    if (!this.endedStartTag) {
      const walker = this.walker;

      const ret =
        walker._possible().filter((poss: Event) => poss.isAttributeEvent);

      if (walker.canEndAttribute) {
        ret.add(ElementWalker._leaveStartTagEvent);
      }

      return ret;
    }
    else if (!this.canEnd) {
      const walker = this.walker;
      const posses = new EventSet(walker._possible());
      if (walker.canEnd) {
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

  fireEvent(ev: Event): InternalFireEventResult {
    if (this.canEnd) {
      return undefined;
    }

    const walker = this.walker;
    const params = ev.params;
    const eventName = params[0];
    if (!this.endedStartTag) {
      let leaveNow = false;
      switch (eventName) {
        case "enterStartTag":
        case "startTagAndAttributes":
          if (!this.boundName.match(params[1] as string, params[2] as string)) {
            throw new Error("event starting the element had an incorrect name");
          }

          if (eventName === "enterStartTag") {
            return false;
          }

          // We need to handle all attributes and leave the start tag.
          for (let ix = 3; ix < params.length; ix += 3) {
            const attrRet = walker.fireEvent(new Event(
              "attributeNameAndValue", params[ix], params[ix + 1],
              params[ix + 2]));
            if (attrRet !== false) {
              return attrRet;
            }
          }

          leaveNow = true;
          break;
        case "leaveStartTag":
          leaveNow = true;
          break;
        default:
      }

      if (leaveNow) {
        this.endedStartTag = true;

        const errs = this.el.pat.hasAttrs() ? walker.end(true) : false;
        walker._suppressAttributes();

        return errs;
      }

      return walker.fireEvent(ev);
    }

    // Since we segregate walkers through the GrammarWalker's
    // elementWalkerStack, the events endTag and leaveStartTag cannot possibly
    // be handled by subpatterns.
    switch (eventName) {
      case "endTag": {
        if (this.boundName.match(params[1] as string, params[2] as string)) {
          this.canEnd = true;
        }

        return walker.end();
      }
      case "leaveStartTag":
        throw new Error("unexpected leaveStartTag event; it is likely that " +
                        "fireEvent is incorrectly called");
      default:
    }

    return walker.fireEvent(ev);
  }

  _suppressAttributes(): void {
    // _suppressAttributes does not cross element boundary
    return;
  }

  end(attribute: boolean = false): EndResult {
    if (attribute || this.canEnd) {
      return false;
    }

    const walkerRet = this.walker.end(attribute);
    const ret = walkerRet ? walkerRet : [];

    ret.push(new ElementNameError(this.endedStartTag ?
                                 "tag not closed" :
                                 "start tag not terminated",
                                  this.boundName));

    return ret;
  }
}

//  LocalWords:  RNG's MPL RNG addWalker ElementWalker leaveStartTag valueEvs
//  LocalWords:  enterStartTag attributeValue endTag errored subwalker
//  LocalWords:  neutralizeAttribute boundName fireEvent suppressAttributes
