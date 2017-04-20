/**
 * Pattern and walker for RNG's ``group`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
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
  private hitA: boolean;
  private endedA: boolean;
  private hitB: boolean;
  private walkerA: Walker<BasePattern> | undefined;
  private walkerB: Walker<BasePattern> | undefined;
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
      this.walkerA = walker.walkerA !== undefined ?
        walker.walkerA._clone(memo) : undefined;
      this.walkerB = walker.walkerB !== undefined ?
        walker.walkerB._clone(memo) : undefined;
    }
    else {
      const el: Group = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo);
      super(el);
      this.nameResolver = nameResolver;
      this.hitA = false;
      this.endedA = false;
      this.hitB = false;
    }
  }

  _possible(): EventSet {
    this._instantiateWalkers();
    if (this.possibleCached !== undefined) {
      return this.possibleCached;
    }

    this.possibleCached = (!this.endedA) ?
      this.walkerA!._possible() : undefined;

    if (this.suppressedAttributes) {
      // If we are in the midst of processing walker a and it cannot end yet,
      // then we do not want to see anything from b.
      if (this.endedA || this.walkerA!.canEnd()) {
        this.possibleCached = new EventSet(this.possibleCached);
        this.possibleCached.union(this.walkerB!._possible());
      }
    }
    else {
      let possibleB: EventSet = this.walkerB!._possible();

      // Attribute events are still possible event if the first walker is not
      // done with.
      if ((!this.endedA || this.hitB) && !this.walkerA!.canEnd()) {
        // Narrow it down to attribute events...
        possibleB = possibleB.filter((x: Event) => x.isAttributeEvent());
      }
      this.possibleCached = new EventSet(this.possibleCached);
      this.possibleCached.union(possibleB);
    }

    return this.possibleCached!;
  }

  fireEvent(ev: Event): FireEventResult {
    this._instantiateWalkers();

    this.possibleCached = undefined;
    if (!this.endedA) {
      const retA: FireEventResult = this.walkerA!.fireEvent(ev);
      if (retA !== undefined) {
        this.hitA = true;
        return retA;
      }

      // We must return right away if walkerA cannot yet end. Only attribute
      // events are allowed to move forward.
      if (!ev.isAttributeEvent() && !this.walkerA!.canEnd()) {
        return undefined;
      }
    }

    let retB: FireEventResult = this.walkerB!.fireEvent(ev);
    if (retB !== undefined) {
      this.hitB = true;
    }

    // Non-attribute event: if walker b matched the event then we must end
    // walkerA, if we've not already done so.
    if (!ev.isAttributeEvent() && retB !== undefined && !this.endedA) {
      const endRet: EndResult = this.walkerA!.end();
      this.endedA = true;

      // Combine the possible errors.
      if (!retB) {
        // retB must be false, because retB === undefined has been
        // eliminated above; toss it.
        retB = endRet;
      }
      else if (endRet) {
        retB = retB.concat(endRet);
      }
    }
    return retB;
  }

  _suppressAttributes(): void {
    this._instantiateWalkers();
    if (!this.suppressedAttributes) {
      this.possibleCached = undefined; // no longer valid
      this.suppressedAttributes = true;

      this.walkerA!._suppressAttributes();
      this.walkerB!._suppressAttributes();
    }
  }

  canEnd(attribute: boolean = false): boolean {
    this._instantiateWalkers();
    if (attribute) {
      const aHas: boolean = this.el.patA._hasAttrs();
      const bHas: boolean = this.el.patB._hasAttrs();
      if (aHas && bHas) {
        return this.walkerA!.canEnd(attribute) &&
          this.walkerB!.canEnd(attribute);
      }
      else if (aHas) {
        return this.walkerA!.canEnd(true);
      }
      else if (bHas) {
        return this.walkerB!.canEnd(true);
      }

      return true;
    }

    return this.walkerA!.canEnd(attribute) && this.walkerB!.canEnd(attribute);
  }

  end(attribute: boolean = false): EndResult {
    if (this.canEnd(attribute)) {
      return false;
    }

    let ret: EndResult;

    if (attribute) {
      const aHas: boolean = this.el.patA._hasAttrs();
      const bHas: boolean = this.el.patB._hasAttrs();
      if (aHas) {
        // Don't end it more than once.
        if (!this.endedA) {
          ret = this.walkerA!.end(true);
          this.endedA = true;
        }
        else {
          ret = false;
        }

        if (bHas) {
          const endB = this.walkerB!.end(true);
          if (endB) {
            ret = ret ? ret.concat(endB) : endB;
          }
        }

        return ret;
      }

      if (bHas) {
        return this.walkerB!.end(true);
      }

      return false;
    }

    // Don't end it more than once.
    if (!this.endedA) {
      ret = this.walkerA!.end(false);
      this.endedA = true;
      if (ret) {
        return ret;
      }
    }

    ret = this.walkerB!.end(false);
    if (ret) {
      return ret;
    }

    return false;
  }

  /**
   * Creates walkers for the patterns contained by this one. Calling this
   * method multiple times is safe as the walkers are created once and only
   * once.
   */
  private _instantiateWalkers(): void {
    if (this.walkerA === undefined) {
      this.walkerA = this.el.patA.newWalker(this.nameResolver);
      this.walkerB = this.el.patB.newWalker(this.nameResolver);
    }
  }
}

addWalker(Group, GroupWalker);
