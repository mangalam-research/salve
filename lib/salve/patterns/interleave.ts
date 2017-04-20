/**
 * Pattern and walker for RNG's ``interleave`` elements.
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
 * A pattern for ``<interleave>``.
 */
export class Interleave extends TwoSubpatterns {}

/**
 * Walker for [[Interleave]].
 */
class InterleaveWalker extends Walker<Interleave> {
  private inA: boolean;
  private inB: boolean;
  private walkerA: Walker<BasePattern> | undefined;
  private walkerB: Walker<BasePattern> | undefined;
  private readonly nameResolver: NameResolver;

  /**
   * @param el The pattern for which this walker was
   * created.
   *
   * @param resolver The name resolver that
   * can be used to convert namespace prefixes to namespaces.
   */
  protected constructor(walker: InterleaveWalker, memo: HashMap);
  protected constructor(el: Interleave, nameResolver: NameResolver);
  protected constructor(elOrWalker: InterleaveWalker | Interleave,
                        nameResolverOrMemo: NameResolver | HashMap) {
    if (elOrWalker instanceof InterleaveWalker) {
      const walker: InterleaveWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.inA = walker.inA;
      this.inB = walker.inB;
      this.walkerA = walker.walkerA !== undefined ?
        walker.walkerA._clone(memo) : undefined;
      this.walkerB = walker.walkerB !== undefined ?
        walker.walkerB._clone(memo) : undefined;
    }
    else {
      const el: Interleave = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo);
      super(el);
      this.nameResolver = nameResolver;
      this.inA = false;
      this.inB = false;
    }
  }

  _possible(): EventSet {
    this._instantiateWalkers();
    if (this.possibleCached !== undefined) {
      return this.possibleCached;
    }

    if (this.inA && this.inB) {
      // It due to the restrictions imposed by Relax NG, it should not be
      // possible to be both inA and inB.
      throw new Error("impossible state");
    }

    if (this.inA && !this.walkerA!.canEnd()) {
      this.possibleCached = this.walkerA!._possible();
    }
    else if (this.inB && !this.walkerB!.canEnd()) {
      this.possibleCached = this.walkerB!._possible();
    }

    if (this.possibleCached === undefined) {
      this.possibleCached = this.walkerA!.possible();
      this.possibleCached.union(this.walkerB!._possible());
    }

    return this.possibleCached;
  }

  fireEvent(ev: Event): FireEventResult {
    this._instantiateWalkers();

    this.possibleCached = undefined;

    if (this.inA && this.inB) {
      // It due to the restrictions imposed by Relax NG, it should not be
      // possible to be both inA and inB.
      throw new Error("impossible state");
    }

    let retA: FireEventResult;
    let retB: FireEventResult;
    if (!this.inA && !this.inB) {
      retA = this.walkerA!.fireEvent(ev);
      if (retA === false) {
        this.inA = true;
        return false;
      }

      // The constraints on interleave do not allow for two child patterns of
      // interleave to match. So if the first walker matched, the second
      // cannot. So we don't have to fireEvent on the second walker if the first
      // matched.
      retB = this.walkerB!.fireEvent(ev);
      if (retB === false) {
        this.inB = true;
        return false;
      }

      if (retB === undefined) {
        return retA;
      }

      if (retA === undefined) {
        return retB;
      }

      return retA.concat(retB);
    }
    else if (this.inA) {
      retA = this.walkerA!.fireEvent(ev);
      if (retA instanceof Array || retA === false) {
        return retA;
      }

      // If we got here, retA === undefined
      retB = this.walkerB!.fireEvent(ev);

      if (retB === false) {
        this.inA = false;
        this.inB = true;
        return false;
      }
    }
    else { // inB
      retB = this.walkerB!.fireEvent(ev);
      if (retB instanceof Array || retB === false) {
        return retB;
      }

      // If we got here, retB === undefined
      retA = this.walkerA!.fireEvent(ev);

      if (retA === false) {
        this.inA = true;
        this.inB = false;
        return false;
      }
    }

    return undefined;
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
    return this.walkerA!.canEnd(attribute) && this.walkerB!.canEnd(attribute);
  }

  end(attribute: boolean = false): EndResult {
    this._instantiateWalkers();
    const retA: EndResult = this.walkerA!.end(attribute);
    const retB: EndResult = this.walkerB!.end(attribute);

    if (retA && !retB) {
      return retA;
    }

    if (retB && !retA) {
      return retB;
    }

    if (retA && retB) {
      return retA.concat(retB);
    }

    return false;
  }

  /**
   * Creates walkers for the patterns contained by this one. Calling this method
   * multiple times is safe as the walkers are created once and only once.
   */
  private _instantiateWalkers(): void {
    if (this.walkerA === undefined) {
      this.walkerA = this.el.patA.newWalker(this.nameResolver);
    }
    if (this.walkerB === undefined) {
      this.walkerB = this.el.patB.newWalker(this.nameResolver);
    }
  }
}

addWalker(Interleave, InterleaveWalker);
