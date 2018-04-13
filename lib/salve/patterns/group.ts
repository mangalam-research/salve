/**
 * Pattern and walker for RNG's ``group`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { AttributeNameError, AttributeValueError } from "../errors";
import { HashMap } from "../hashstructs";
import { NameResolver } from "../name_resolver";
import { addWalker, BasePattern, EndResult, Event, EventSet,
         InternalFireEventResult, InternalWalker,
         TwoSubpatterns } from "./base";

/**
 * A pattern for ``<group>``.
 */
export class Group extends TwoSubpatterns {
  protected _computeHasEmptyPattern(): boolean {
    return this.patA.hasEmptyPattern() && this.patB.hasEmptyPattern();
  }
}

/**
 * Walker for [[Group]].
 */
class GroupWalker extends InternalWalker<Group> {
  private suppressedAttributes: boolean;
  private readonly hasAttrs: boolean;
  private ended: boolean;
  private walkerA: InternalWalker<BasePattern>;
  private walkerB: InternalWalker<BasePattern>;
  private readonly nameResolver: NameResolver;
  canEndAttribute: boolean;
  canEnd: boolean;

  /**
   * @param el The pattern for which this walker was created.
   *
   * @param nameResolver The name resolver that can be used to convert namespace
   * prefixes to namespaces.
   */
  protected constructor(walker: GroupWalker, memo: HashMap);
  protected constructor(el: Group, nameResolver: NameResolver);
  protected constructor(elOrWalker: GroupWalker | Group,
                        nameResolverOrMemo: HashMap | NameResolver) {
    if ((elOrWalker as Group).newWalker !== undefined) {
      const el = elOrWalker as Group;
      const nameResolver = nameResolverOrMemo as NameResolver;
      super(el);
      this.suppressedAttributes = false;
      this.hasAttrs = el.hasAttrs();
      this.nameResolver = nameResolver;
      this.ended = false;
      this.walkerA = this.el.patA.newWalker(nameResolver);
      this.walkerB = this.el.patB.newWalker(nameResolver);
      this.canEndAttribute = !this.hasAttrs ||
        (this.walkerA.canEndAttribute && this.walkerB.canEndAttribute);
      this.canEnd = this.walkerA.canEnd && this.walkerB.canEnd;
    }
    else {
      const walker = elOrWalker as GroupWalker;
      const memo = nameResolverOrMemo as HashMap;
      super(walker, memo);
      this.suppressedAttributes = walker.suppressedAttributes;
      this.hasAttrs = walker.hasAttrs;
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.walkerA = walker.walkerA._clone(memo);
      this.walkerB = walker.walkerB._clone(memo);
      this.ended = walker.ended;
      this.canEndAttribute = walker.canEndAttribute;
      this.canEnd = walker.canEnd;
    }
  }

  _possible(): EventSet {
    if (this.possibleCached !== undefined) {
      return this.possibleCached;
    }

    if (this.ended) {
      this.possibleCached = new EventSet();

      return this.possibleCached;
    }

    const cached = this.possibleCached = this.walkerA.possible();

    // When suppressedAttributes is true, if we are in the midst of processing
    // walker a and it cannot end yet, then we do not want to see anything from
    // b yet.
    if (!this.suppressedAttributes || this.walkerA.canEnd) {
      // We used to filter the possibilities to only attribute events when
      // this.suppressedAttributes was false, but that's a costly operation. It
      // is the responsibility of ElementWalker to ensure that when the start
      // tag is not closed it is events that pertain to anything else than
      // attributes or ending the start tag are not passed up to the user.
      cached.union(this.walkerB._possible());
    }

    return cached;
  }

  fireEvent(ev: Event): InternalFireEventResult {
    const isAttributeEvent = ev.isAttributeEvent;

    if (isAttributeEvent && !this.hasAttrs) {
      return undefined;
    }

    this.possibleCached = undefined;

    // This is useful because it is possible for fireEvent to be called
    // after end() has been called.
    if (this.ended) {
      return undefined;
    }

    const walkerA = this.walkerA;
    const walkerB = this.walkerB;
    const retA = walkerA.fireEvent(ev);
    if (retA !== undefined) {
      if (isAttributeEvent) {
        this.canEndAttribute = walkerA.canEndAttribute &&
          walkerB.canEndAttribute;
      }

      this.canEnd = walkerA.canEnd && walkerB.canEnd;

      return retA;
    }

    // We must return right away if walkerA cannot yet end. Only attribute
    // events are allowed to move forward.
    if (!isAttributeEvent && !walkerA.canEnd) {
      return undefined;
    }

    const retB = walkerB.fireEvent(ev);
    if (isAttributeEvent) {
      this.canEndAttribute = walkerA.canEndAttribute && walkerB.canEndAttribute;
    }

    this.canEnd = walkerA.canEnd && walkerB.canEnd;

    // Non-attribute event: if walker b matched the event then we must end
    // walkerA, if we've not already done so.
    if (!isAttributeEvent && retB !== undefined) {
      const endRet = walkerA.end();

      // Combine the possible errors.
      if (!retB) {
        // retB must be false, because retB === undefined has been
        // eliminated above; toss it.
        return endRet;
      }

      if (endRet) {
        return retB.concat(endRet);
      }
    }

    return retB;
  }

  _suppressAttributes(): void {
    // We don't protect against multiple calls to _suppressAttributes.
    // ElementWalker is the only walker that initiates _suppressAttributes
    // and it calls it only once per walker.
    this.possibleCached = undefined; // no longer valid
    this.suppressedAttributes = true;
    this.walkerA._suppressAttributes();
    this.walkerB._suppressAttributes();
  }

  end(attribute: boolean = false): EndResult {
    if (this.ended) {
      return false;
    }

    if ((attribute && this.canEndAttribute) || (!attribute && this.canEnd)) {
      // We're done once and for all only if called with attribute === false
      // or if we don't have any attributes.
      if (!this.hasAttrs || !attribute) {
        this.ended = true;
      }

      return false;
    }

    let ret: EndResult;

    const walkerA = this.walkerA;
    const walkerB = this.walkerB;

    if (attribute) {
      const aHas = this.el.patA.hasAttrs();
      const bHas = this.el.patB.hasAttrs();
      if (aHas) {
        ret = walkerA.end(true);

        if (bHas) {
          const endB = walkerB.end(true);
          if (endB) {
            ret = ret ? ret.concat(endB) : endB;
          }
        }

        return ret;
      }

      if (bHas) {
        return walkerB.end(true);
      }

      return false;
    }

    const retA = walkerA.end(false);

    // If we get here and the only errors we get are attribute errors,
    // we must move on to check the second walker too.
    if (retA) {
      for (const err of retA) {
        if (!(err instanceof AttributeValueError ||
              err instanceof AttributeNameError)) {
          // We ran into a non-attribute error. We can stop here.
          return retA;
        }
      }
    }

    const retB = walkerB.end(false);
    if (retB) {
      if (!retA) {
        return retB;
      }

      return retA.concat(retB);
    }

    return retA;
  }
}

addWalker(Group, GroupWalker);

//  LocalWords:  RNG's MPL instantiateWalkers walkerA retB canEnd endedA
