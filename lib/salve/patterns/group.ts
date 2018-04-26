/**
 * Pattern and walker for RNG's ``group`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { AttributeNameError, AttributeValueError } from "../errors";
import { NameResolver } from "../name_resolver";
import { union } from "../set";
import { addWalker, BasePattern, cloneIfNeeded, CloneMap, EndResult, Event,
         EventSet, InternalFireEventResult, InternalWalker, isAttributeEvent,
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
  private readonly hasAttrs: boolean;
  private ended: boolean;
  private walkerA: InternalWalker<BasePattern>;
  private walkerB: InternalWalker<BasePattern>;
  private endedA: boolean;
  private readonly nameResolver: NameResolver;
  canEndAttribute: boolean;
  canEnd: boolean;

  /**
   * @param el The pattern for which this walker was created.
   *
   * @param nameResolver The name resolver that can be used to convert namespace
   * prefixes to namespaces.
   */
  protected constructor(walker: GroupWalker, memo: CloneMap);
  protected constructor(el: Group, nameResolver: NameResolver);
  protected constructor(elOrWalker: GroupWalker | Group,
                        nameResolverOrMemo: CloneMap | NameResolver) {
    super(elOrWalker);
    if ((elOrWalker as Group).newWalker !== undefined) {
      const el = elOrWalker as Group;
      const nameResolver = nameResolverOrMemo as NameResolver;
      this.hasAttrs = el.hasAttrs();
      this.nameResolver = nameResolver;
      this.ended = false;
      const walkerA = this.walkerA = el.patA.newWalker(nameResolver);
      const walkerB = this.walkerB = el.patB.newWalker(nameResolver);
      this.endedA = false;
      this.canEndAttribute = !this.hasAttrs ||
        (walkerA.canEndAttribute && walkerB.canEndAttribute);
      this.canEnd = walkerA.canEnd && walkerB.canEnd;
    }
    else {
      const walker = elOrWalker as GroupWalker;
      const memo = nameResolverOrMemo as CloneMap;
      this.hasAttrs = walker.hasAttrs;
      this.nameResolver = cloneIfNeeded(walker.nameResolver, memo);
      this.walkerA = walker.walkerA._clone(memo);
      this.walkerB = walker.walkerB._clone(memo);
      this.endedA = walker.endedA;
      this.ended = walker.ended;
      this.canEndAttribute = walker.canEndAttribute;
      this.canEnd = walker.canEnd;
    }
  }

  possible(): EventSet {
    if (this.ended) {
      return new Set<Event>();
    }

    const ret = this.walkerA.possible();

    if (this.walkerA.canEnd) {
      union(ret, this.walkerB.possible());
    }

    return ret;
  }

  possibleAttributes(): EventSet {
    if (this.ended) {
      return new Set<Event>();
    }

    const ret = this.walkerA.possibleAttributes();
    union(ret, this.walkerB.possibleAttributes());

    return ret;
  }

  fireEvent(name: string, params: string[]): InternalFireEventResult {
    const evIsAttributeEvent = isAttributeEvent(name);

    if (evIsAttributeEvent && !this.hasAttrs) {
      return undefined;
    }

    // This is useful because it is possible for fireEvent to be called
    // after end() has been called.
    if (this.ended) {
      return undefined;
    }

    const walkerA = this.walkerA;
    const walkerB = this.walkerB;
    if (!this.endedA) {
      const retA = walkerA.fireEvent(name, params);
      if (retA !== undefined) {
        if (evIsAttributeEvent) {
          this.canEndAttribute = walkerA.canEndAttribute &&
            walkerB.canEndAttribute;
        }

        this.canEnd = walkerA.canEnd && walkerB.canEnd;

        return retA;
      }

      // We must return right away if walkerA cannot yet end. Only attribute
      // events are allowed to move forward.
      if (!evIsAttributeEvent && !walkerA.canEnd) {
        return undefined;
      }
    }

    const retB = walkerB.fireEvent(name, params);
    if (evIsAttributeEvent) {
      this.canEndAttribute = walkerA.canEndAttribute && walkerB.canEndAttribute;
    }

    this.canEnd = walkerA.canEnd && walkerB.canEnd;

    // Non-attribute event: if walker b matched the event then we must end
    // walkerA, if we've not already done so.
    if (!evIsAttributeEvent && retB !== undefined) {
      const endRet = walkerA.end();
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

  end(): EndResult {
    if (this.ended) {
      return false;
    }

    if (this.canEnd) {
      this.ended = true;

      return false;
    }

    const retA = this.walkerA.end();
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

    const retB = this.walkerB.end();
    if (retB) {
      return retA ? retA.concat(retB) : retB;
    }

    return retA;
  }

  endAttributes(): EndResult {
    if (this.ended || this.canEndAttribute) {
      return false;
    }

    if (this.el.patA.hasAttrs()) {
      let ret = this.walkerA.endAttributes();

      if (this.el.patB.hasAttrs()) {
        const endB = this.walkerB.endAttributes();
        if (endB) {
          ret = ret ? ret.concat(endB) : endB;
        }
      }

      return ret;
    }

    if (this.el.patB.hasAttrs()) {
      return this.walkerB.endAttributes();
    }

    return false;
  }
}

addWalker(Group, GroupWalker);

//  LocalWords:  RNG's MPL instantiateWalkers walkerA retB canEnd endedA
