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
         FireEventResult, isHashMap, isNameResolver, TwoSubpatterns,
         Walker } from "./base";

/**
 * A pattern for ``<group>``.
 */
export class Group extends TwoSubpatterns {}

/**
 * Walker for [[Group]].
 */
class GroupWalker extends Walker<Group> {
  private ended: boolean;
  private hitA: boolean;
  private endedA: boolean;
  private hitB: boolean;
  private walkerA: Walker<BasePattern>;
  private walkerB: Walker<BasePattern>;
  private readonly nameResolver: NameResolver;

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
    if (elOrWalker instanceof GroupWalker) {
      const walker: GroupWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.hitA = walker.hitA;
      this.endedA = walker.endedA;
      this.hitB = walker.hitB;
      this.walkerA = walker.walkerA._clone(memo);
      this.walkerB = walker.walkerB._clone(memo);
      this.ended = walker.ended;
    }
    else {
      const el: Group = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo);
      super(el);
      this.nameResolver = nameResolver;
      this.hitA = false;
      this.endedA = false;
      this.hitB = false;
      this.ended = false;
      this.walkerA = this.el.patA.newWalker(this.nameResolver);
      this.walkerB = this.el.patB.newWalker(this.nameResolver);
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

    const walkerA = this.walkerA;
    const walkerB = this.walkerB;

    this.possibleCached = (!this.endedA) ? walkerA._possible() : undefined;

    if (this.suppressedAttributes) {
      // If we are in the midst of processing walker a and it cannot end yet,
      // then we do not want to see anything from b.
      if (this.endedA || walkerA.canEnd()) {
        this.possibleCached = new EventSet(this.possibleCached);
        this.possibleCached.union(walkerB._possible());
      }
    }
    else {
      let possibleB: EventSet = walkerB._possible();

      // Attribute events are still possible event if the first walker is not
      // done with.
      if ((!this.endedA || this.hitB) && !walkerA.canEnd()) {
        // Narrow it down to attribute events...
        possibleB = possibleB.filter((x: Event) => x.isAttributeEvent());
      }
      this.possibleCached = new EventSet(this.possibleCached);
      this.possibleCached.union(possibleB);
    }

    // Necessarily defined once we get here.
    // tslint:disable-next-line:no-non-null-assertion
    return this.possibleCached!;
  }

  fireEvent(ev: Event): FireEventResult {
    this.possibleCached = undefined;

    // This is useful because it is possible for fireEvent to be called
    // after end() has been called.
    if (this.ended) {
      return undefined;
    }

    const isAttributeEvent = ev.isAttributeEvent();

    const walkerA = this.walkerA;
    if (!this.endedA) {
      const retA = walkerA.fireEvent(ev);
      if (retA !== undefined) {
        this.hitA = true;

        return retA;
      }

      // We must return right away if walkerA cannot yet end. Only attribute
      // events are allowed to move forward.
      if (!isAttributeEvent && !walkerA.canEnd()) {
        return undefined;
      }
    }

    const walkerB = this.walkerB;
    const retB: FireEventResult = walkerB.fireEvent(ev);
    if (retB !== undefined) {
      this.hitB = true;
    }

    // Non-attribute event: if walker b matched the event then we must end
    // walkerA, if we've not already done so.
    if (!isAttributeEvent && retB !== undefined && !this.endedA) {
      const endRet: EndResult = walkerA.end();
      this.endedA = true;

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
    if (!this.suppressedAttributes) {
      this.possibleCached = undefined; // no longer valid
      this.suppressedAttributes = true;

      this.walkerA._suppressAttributes();
      this.walkerB._suppressAttributes();
    }
  }

  canEnd(attribute: boolean = false): boolean {
    // We can end any number of times.
    if (this.ended) {
      return true;
    }

    const walkerA = this.walkerA;
    const walkerB = this.walkerB;

    if (!attribute) {
      return walkerA.canEnd(false) && walkerB.canEnd(false);
    }

    const { patA, patB } = this.el;

    return (patA._hasAttrs() ? walkerA.canEnd(true) : true) &&
      (patB._hasAttrs() ? walkerB.canEnd(true) : true);
  }

  end(attribute: boolean = false): EndResult {
    if (this.ended || this.canEnd(attribute)) {
      // We're done once and for all only if called with attribute === false.
      if (!attribute) {
        this.ended = true;
      }

      return false;
    }

    let ret: EndResult;

    const walkerA = this.walkerA;
    const walkerB = this.walkerB;

    if (attribute) {
      const aHas: boolean = this.el.patA._hasAttrs();
      const bHas: boolean = this.el.patB._hasAttrs();
      if (aHas) {
        // This should not happen. this.endedA is to become true when we run
        // into a non-attribute event that matches. This can happen only once we
        // have deal with all attributes.
        if (this.endedA) {
          throw new Error(
            "invalid state: endedA is true but we are processing attributes");
        }

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

    let retA: EndResult = false;
    // Don't end it more than once.
    if (!this.endedA) {
      retA = walkerA.end(false);

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
