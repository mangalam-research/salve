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
  private tagStateA: number;
  private tagStateB: number;
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
      this.tagStateA = walker.tagStateA;
      this.tagStateB = walker.tagStateB;
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
      this.tagStateA = 0;
      this.tagStateB = 0;
    }
  }

  _possible(): EventSet {
    if (this.possibleCached !== undefined) {
      return this.possibleCached;
    }

    if (this.inA && this.inB) {
      // It due to the restrictions imposed by Relax NG, it should not be
      // possible to be both inA and inB.
      throw new Error("impossible state");
    }

    if (this.walkerA === undefined) {
      this.walkerA = this.el.patA.newWalker(this.nameResolver);
      this.walkerB = this.el.patB.newWalker(this.nameResolver);
    }

    const walkerA = this.walkerA;
    // tslint:disable-next-line:no-non-null-assertion
    const walkerB = this.walkerB!;

    if (this.inA && !walkerA.canEnd()) {
      this.possibleCached = walkerA._possible();
    }
    else if (this.inB && !walkerB.canEnd()) {
      this.possibleCached = walkerB._possible();
    }

    if (this.possibleCached === undefined) {
      this.possibleCached = walkerA.possible();
      this.possibleCached.union(walkerB._possible());
    }

    return this.possibleCached;
  }

  //
  // Interleave is very unusual among the patterns due to the fact that it
  // ignores subpattern order. For instance
  //
  // <interleave>A<interleave>B C</interleave></interleave>
  //
  // can match any permutation of the patterns A B and C. In particular, the
  // sequence B A C needs to be handled by the inner interleave, then by the
  // pattern for A and then by the inner interleave again.
  //
  // Moreover, while validating, it may match subpatterns only partially.
  // For instance:
  //
  // <interleave><group>A B</group>C</interleave>
  //
  // will match all permutations of A B C where A appears before B (so A B C, A
  // C B and C A B). The sequence A C B is particularly problematic as it means
  // matching the inner group, then matching C, then going back to the inner
  // group!
  //
  // When an interleave subpattern starts to match, we may not switch to
  // another subpattern until that subpattern is done. However, "done" here is
  // not synonymous with ``canEnd() === true``. Looking again at the B A C
  // scenario above, we can switch to A when B is done but the inner level
  // interleave is itself not "done" because C has not matched yet.
  //
  // We work around the issue by counting the number of start tags and end tags
  // seen by a pattern. When they are equal we can switch away from from the
  // pattern to another one.
  //
  fireEvent(ev: Event): FireEventResult {
    if (this.walkerA === undefined) {
      this.walkerA = this.el.patA.newWalker(this.nameResolver);
      this.walkerB = this.el.patB.newWalker(this.nameResolver);
    }

    this.possibleCached = undefined;

    if (this.inA && this.inB) {
      // It due to the restrictions imposed by Relax NG, it is not possible to
      // be both inA and inB. If we get here, then we are dealing with an
      // internal error.
      throw new Error("prohibited state");
    }

    if (!this.inA && !this.inB) {
      const retA = this.fireEventOnSubWalker(this.walkerA, ev);
      if (retA === false) {
        this.inA = true;

        // The constraints on interleave do not allow for two child patterns of
        // interleave to match. So if the first walker matched, the second
        // cannot. So we don't have to fireEvent on the second walker if the
        // first matched.
        return false;
      }

      // tslint:disable-next-line:no-non-null-assertion
      const retB = this.fireEventOnSubWalker(this.walkerB!, ev);
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
      const retA = this.fireEventOnSubWalker(this.walkerA, ev);
      if (retA !== undefined) {
        return retA;
      }

      if (this.tagStateA === 0) {
        // We can move to walkerB.
        // tslint:disable-next-line:no-non-null-assertion
        const retB = this.fireEventOnSubWalker(this.walkerB!, ev);

        if (retB === false) {
          this.inA = false;
          this.inB = true;
        }

        return retB;
      }
    }
    else { // inB
      // tslint:disable-next-line:no-non-null-assertion
      const retB = this.fireEventOnSubWalker(this.walkerB!, ev);
      if (retB !== undefined) {
        return retB;
      }

      if (this.tagStateB === 0) {
        // We can move to walkerA.
        const retA = this.fireEventOnSubWalker(this.walkerA, ev);

        if (retA === false) {
          this.inA = true;
          this.inB = false;
        }

        return retA;
      }
    }

    return undefined;
  }

  fireEventOnSubWalker(walker: Walker<BasePattern>,
                       ev: Event): FireEventResult {
    const ret = walker.fireEvent(ev);

    if (ret !== false) {
      return ret;
    }

    switch (ev.params[0]) {
      case "enterStartTag":
      case "startTagAndAttributes":
        if (walker === this.walkerA) {
          this.tagStateA++;
        }
        else {
          this.tagStateB++;
        }
        break;
      case "endTag":
        if (walker === this.walkerA) {
          this.tagStateA--;
        }
        else {
          this.tagStateB--;
        }
        break;
      default:
    }

    return ret;
  }

  _suppressAttributes(): void {
    if (!this.suppressedAttributes) {
      if (this.walkerA === undefined) {
        this.walkerA = this.el.patA.newWalker(this.nameResolver);
        this.walkerB = this.el.patB.newWalker(this.nameResolver);
      }

      this.possibleCached = undefined; // no longer valid
      this.suppressedAttributes = true;

      this.walkerA._suppressAttributes();
      // tslint:disable-next-line:no-non-null-assertion
      this.walkerB!._suppressAttributes();
    }
  }

  canEnd(attribute: boolean = false): boolean {
    if (this.walkerA === undefined) {
      this.walkerA = this.el.patA.newWalker(this.nameResolver);
      this.walkerB = this.el.patB.newWalker(this.nameResolver);
    }

    // tslint:disable-next-line:no-non-null-assertion
    return this.walkerA.canEnd(attribute) && this.walkerB!.canEnd(attribute);
  }

  end(attribute: boolean = false): EndResult {
    if (this.walkerA === undefined) {
      this.walkerA = this.el.patA.newWalker(this.nameResolver);
      this.walkerB = this.el.patB.newWalker(this.nameResolver);
    }

    const retA: EndResult = this.walkerA.end(attribute);
    // tslint:disable-next-line:no-non-null-assertion
    const retB: EndResult = this.walkerB!.end(attribute);

    if (!retA) {
      return !retB ? false : retB;
    }

    return !retB ? retA : retA.concat(retB);
  }
}

addWalker(Interleave, InterleaveWalker);

//  LocalWords:  RNG's MPL NG inA inB instantiateWalkers fireEvent retA retB
