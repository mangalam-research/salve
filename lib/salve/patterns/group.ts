/**
 * Pattern and walker for RNG's ``group`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { AttributeNameError, AttributeValueError } from "../errors";
import { NameResolver } from "../name_resolver";
import { union } from "../set";
import { BasePattern, cloneIfNeeded, CloneMap, EndResult, Event, EventSet,
         InternalFireEventResult, InternalWalker, isAttributeEvent,
         TwoSubpatterns } from "./base";

/**
 * A pattern for ``<group>``.
 */
export class Group extends TwoSubpatterns {
  protected _computeHasEmptyPattern(): boolean {
    return this.patA.hasEmptyPattern() && this.patB.hasEmptyPattern();
  }

  newWalker(nameResolver: NameResolver): InternalWalker<Group> {
    // tslint:disable-next-line:no-use-before-declare
    return new GroupWalker(this, nameResolver);
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
  constructor(walker: GroupWalker, memo: CloneMap);
  constructor(el: Group, nameResolver: NameResolver);
  constructor(elOrWalker: GroupWalker | Group,
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

  _clone(memo: CloneMap): this {
    return new GroupWalker(this, memo) as this;
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
    const ret = new InternalFireEventResult(false);
    const evIsAttributeEvent = isAttributeEvent(name);

    if (evIsAttributeEvent && !this.hasAttrs) {
      return ret;
    }

    // This is useful because it is possible for fireEvent to be called
    // after end() has been called.
    if (this.ended) {
      return ret;
    }

    const walkerA = this.walkerA;
    const walkerB = this.walkerB;
    if (!this.endedA) {
      const retA = walkerA.fireEvent(name, params);
      if (retA.matched) {
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
        return retA;
      }
    }

    const retB = walkerB.fireEvent(name, params);
    if (evIsAttributeEvent) {
      this.canEndAttribute = walkerA.canEndAttribute && walkerB.canEndAttribute;
    }

    this.canEnd = walkerA.canEnd && walkerB.canEnd;

    // Non-attribute event: if walker b matched the event then we must end
    // walkerA, if we've not already done so.
    if (!evIsAttributeEvent && retB.matched) {
      this.endedA = true;

      return retB.combine(InternalFireEventResult.fromEndResult(walkerA.end()));
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
    // If we get here and the only errors we get are attribute errors, we must
    // move on to check the second walker too.
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

    const endA = this.walkerA.endAttributes();
    const endB = this.walkerB.endAttributes();

    if (endB) {
      return endA ? endA.concat(endB) : endB;
    }

    return endA;
  }
}

//  LocalWords:  RNG's MPL instantiateWalkers walkerA retB canEnd endedA
