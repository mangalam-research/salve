/**
 * Pattern and walker for RNG's ``attribute`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { AttributeNameError, AttributeValueError } from "../errors";
import { HashMap } from "../hashstructs";
import { ConcreteName } from "../name_patterns";
import { NameResolver } from "../name_resolver";
import { TrivialMap } from "../types";
import { addWalker, BasePattern, EndResult, Event, EventSet,
         FireEventResult, isHashMap, isNameResolver, OneSubpattern, Pattern,
         Walker } from "./base";

/**
 * A pattern for attributes.
 */
export class Attribute extends OneSubpattern {
  /**
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param name The qualified name of the attribute.
   *
   * @param pat The pattern contained by this one.
   */

  constructor(xmlPath: string, readonly name: ConcreteName, pat: Pattern) {
    super(xmlPath, pat);
  }

  _prepare(namespaces: TrivialMap<number>): void {
    const nss: TrivialMap<number> = Object.create(null);
    this.name._recordNamespaces(nss);

    // A lack of namespace on an attribute should not be recorded.
    delete nss[""];

    // Copy the resulting namespaces.
    // tslint:disable-next-line:forin
    for (const key in nss) {
      namespaces[key] = 1;
    }
  }

  _hasAttrs(): boolean {
    return true;
  }
}

/**
 * Walker for [[Attribute]].
 */
class AttributeWalker extends Walker<Attribute> {
  private seenName: boolean;
  private seenValue: boolean;
  private subwalker: Walker<BasePattern> | undefined;
  private readonly attrNameEvent: Event;
  private readonly nameResolver: NameResolver;
  private neutralized: boolean;

  /**
   * @param el The pattern for which this walker was created.
   *
   * @param nameResolver The name resolver that can be used to convert namespace
   * prefixes to namespaces.
   */
  protected constructor(walker: AttributeWalker, memo: HashMap);
  protected constructor(el: Attribute, nameResolver: NameResolver);
  protected constructor(elOrWalker: AttributeWalker | Attribute,
                        nameResolverOrMemo: HashMap | NameResolver) {
    if (elOrWalker instanceof AttributeWalker) {
      const walker = elOrWalker;
      const memo = isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.seenName = walker.seenName;
      this.seenValue = walker.seenValue;
      this.subwalker = walker.subwalker !== undefined ?
        walker.subwalker._clone(memo) : undefined;
      // No need to clone; values are immutable.
      this.attrNameEvent = walker.attrNameEvent;
      this.neutralized = walker.neutralized;
    }
    else {
      const el = elOrWalker;
      const nameResolver = isNameResolver(nameResolverOrMemo);
      super(el);
      this.nameResolver = nameResolver;
      this.attrNameEvent = new Event("attributeName", el.name);
      this.seenName = false;
      this.seenValue = false;
      this.neutralized = false;
    }
  }

  _possible(): EventSet {
    // We've been suppressed!
    if (this.suppressedAttributes) {
      return new EventSet();
    }

    if (!this.seenName) {
      return new EventSet(this.attrNameEvent);
    }
    else if (!this.seenValue) {
      if (this.subwalker === undefined) {
        this.subwalker = this.el.pat.newWalker(this.nameResolver);
      }

      const sub = this.subwalker._possible();
      const ret = new EventSet();
      // Convert text events to attributeValue events.
      sub.forEach((ev: Event) => {
        if (ev.params[0] !== "text") {
          throw new Error(`unexpected event type: ${ev.params[0]}`);
        }
        ret.add(new Event("attributeValue", ev.params[1]));
      });

      return ret;
    }

    return new EventSet();
  }

  possible(): EventSet {
    // _possible always return new sets.
    return this._possible();
  }

  fireEvent(ev: Event): FireEventResult {
    if (this.suppressedAttributes || this.neutralized) {
      return undefined;
    }

    let ret: FireEventResult;
    let value: string | undefined;
    const eventName = ev.params[0];
    if (this.seenName) {
      if (!this.seenValue && eventName === "attributeValue") {
        // Convert the attributeValue event to a text event.
        value = ev.params[1] as string;
      }
    }
    else if ((eventName === "attributeName" ||
              eventName === "attributeNameAndValue") &&
             this.el.name.match(ev.params[1] as string,
                                ev.params[2] as string)) {
      this.seenName = true;
      ret = false;

      if (eventName === "attributeNameAndValue") {
        value = ev.params[3] as string;
      }
    }

    if (value !== undefined) {
      this.seenValue = true;

      if (this.subwalker === undefined) {
        this.subwalker = this.el.pat.newWalker(this.nameResolver);
      }

      ret = this.subwalker.fireEvent(new Event("text", value));

      if (ret === undefined) {
        ret = [new AttributeValueError("invalid attribute value",
                                       this.el.name)];
      }

      // Attributes end immediately.
      if (ret === false) {
        ret = this.subwalker.end();
      }
    }

    return ret;
  }

  _suppressAttributes(): void {
    this.suppressedAttributes = true;
  }

  canEnd(attribute: boolean = false): boolean {
    return this.seenValue || this.neutralized;
  }

  end(attribute: boolean = false): EndResult {
    if (this.neutralized || (this.seenName && this.seenValue)) {
      return false;
    }

    if (!this.seenName) {
      //
      // We self-neutralize. This prevents producing errors about the same
      // attribute multiple times, because end is called by element walkers when
      // leaveStartTag is encountered, and again when the element closes.
      //
      // This flag has to be maintained separately from suppressedAttributes
      // because it controls how errors are reported, whereas
      // suppressedAttributes is broader in scope. (Or to put it differently, it
      // it may be impossible to know whether an attribute is missing until the
      // element is closed: by that time suppressedAttributes will be true, but
      // we still want to report the error. So we have to inhibit error
      // reporting on the basis of a state different from suppressedAttributes.)
      //
      this.neutralized = true;

      return [new AttributeNameError("attribute missing", this.el.name)];
    }

    // If we get here, necessarily seenValue is false.
    return [new AttributeValueError("attribute value missing", this.el.name)];
  }
}

addWalker(Attribute, AttributeWalker);

//  LocalWords:  RNG's MPL RNG attributeName attributeValue ev params
//  LocalWords:  neutralizeAttribute
