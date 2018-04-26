/**
 * Pattern and walker for RNG's ``attribute`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { AttributeNameError, AttributeValueError } from "../errors";
import { ConcreteName } from "../name_patterns";
import { NameResolver } from "../name_resolver";
import { map } from "../set";
import { addWalker, BasePattern, cloneIfNeeded, CloneMap, EndResult, Event,
         EventSet, InternalFireEventResult, InternalWalker,
         Pattern } from "./base";
import { Define } from "./define";
import { Ref } from "./ref";

/**
 * A pattern for attributes.
 */
export class Attribute extends Pattern {
  /**
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param name The qualified name of the attribute.
   *
   * @param pat The pattern contained by this one.
   */

  constructor(xmlPath: string, readonly name: ConcreteName,
              readonly pat: Pattern) {
    super(xmlPath);
  }

  _prepare(definitions: Map<string, Define>,
           namespaces: Set<string>): Ref[] | undefined {
    const ret = this.pat._prepare(definitions, namespaces);
    this.name._recordNamespaces(namespaces, false);

    return ret;
  }

  hasAttrs(): boolean {
    return true;
  }

  hasEmptyPattern(): boolean {
    return false;
  }
}

/**
 * Walker for [[Attribute]].
 */
class AttributeWalker extends InternalWalker<Attribute> {
  private seenName: boolean;
  private readonly subwalker: InternalWalker<BasePattern>;
  private readonly nameResolver: NameResolver;
  private readonly name: ConcreteName;
  canEndAttribute: boolean;
  canEnd: boolean;

  /**
   * @param el The pattern for which this walker was created.
   *
   * @param nameResolver The name resolver that can be used to convert namespace
   * prefixes to namespaces.
   */
  protected constructor(walker: AttributeWalker, memo: CloneMap);
  protected constructor(el: Attribute, nameResolver: NameResolver);
  protected constructor(elOrWalker: AttributeWalker | Attribute,
                        nameResolverOrMemo: CloneMap | NameResolver) {
    if ((elOrWalker as Attribute).newWalker !== undefined) {
      const el = elOrWalker as Attribute;
      super(el);
      this.nameResolver = nameResolverOrMemo as NameResolver;
      this.subwalker = el.pat.newWalker(this.nameResolver);
      this.name = el.name;
      this.seenName = false;
      this.canEndAttribute = false;
      this.canEnd = false;
    }
    else {
      const walker = elOrWalker as AttributeWalker;
      const memo = nameResolverOrMemo as CloneMap;
      super(walker);
      this.nameResolver = cloneIfNeeded(walker.nameResolver, memo);
      this.seenName = walker.seenName;
      this.subwalker = walker.subwalker._clone(memo);
      this.name = walker.name;
      this.canEndAttribute = walker.canEndAttribute;
      this.canEnd = walker.canEnd;
    }
  }

  possible(): EventSet {
    return new Set<Event>();
  }

  possibleAttributes(): EventSet {
    if (this.canEnd) {
      return new Set<Event>();
    }

    if (!this.seenName) {
      return new Set([new Event("attributeName", this.name)]);
    }

    // Convert text events to attributeValue events.
    return map(this.subwalker.possible(), (ev: Event) => {
      if (ev.params[0] !== "text") {
        throw new Error(`unexpected event type: ${ev.params[0]}`);
      }

      return new Event("attributeValue", ev.params[1]);
    });
  }

  fireEvent(name: string, params: string[]): InternalFireEventResult {
    // If canEnd is true, we've done everything we could. So we don't
    // want to match again.
    if (this.canEnd) {
      return undefined;
    }

    let ret: InternalFireEventResult;
    let value: string | undefined;
    if (this.seenName) {
      if (name === "attributeValue") {
        // Convert the attributeValue event to a text event.
        value = params[0];
      }
    }
    else if ((name === "attributeName" || name === "attributeNameAndValue") &&
             this.name.match(params[0], params[1])) {
      this.seenName = true;
      ret = false;

      if (name === "attributeNameAndValue") {
        value = params[2];
      }
    }

    if (value !== undefined) {
      this.canEnd = true;
      this.canEndAttribute = true;

      if (value !== "") {
        ret = this.subwalker.fireEvent("text", [value]);

        if (ret === undefined) {
          ret = [new AttributeValueError("invalid attribute value",
                                         this.name)];
        }
      }
      else {
        ret = false;
      }

      // Attributes end immediately.
      if (ret === false) {
        ret = this.subwalker.end();
      }
    }

    return ret;
  }

  endAttributes(): EndResult {
    if (this.canEnd) {
      return false;
    }

    if (!this.seenName) {
      //
      // We set the _canEnd flags true even though we did not end properly. This
      // prevents producing errors about the same attribute multiple times,
      // because end is called by element walkers when leaveStartTag is
      // encountered, and again when the element closes.
      this.canEnd = true;
      this.canEndAttribute = true;

      return [new AttributeNameError("attribute missing", this.name)];
    }

    // If we get here, necessarily we have not seen a value.
    return [new AttributeValueError("attribute value missing", this.name)];
  }

  end(): EndResult {
    return false;
  }
}

addWalker(Attribute, AttributeWalker);

//  LocalWords:  RNG's MPL RNG attributeName attributeValue ev params
//  LocalWords:  neutralizeAttribute
