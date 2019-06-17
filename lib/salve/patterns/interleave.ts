/**
 * Pattern and walker for RNG's ``interleave`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { NameResolver } from "../name_resolver";
import { union } from "../set";
import { EndResult, EventSet, InternalFireEventResult, InternalWalker,
         isAttributeEvent, TwoSubpatterns } from "./base";

/**
 * A pattern for ``<interleave>``.
 */
export class Interleave extends TwoSubpatterns {
  protected _computeHasEmptyPattern(): boolean {
    return this.patA.hasEmptyPattern() && this.patB.hasEmptyPattern();
  }

  newWalker(): InternalWalker {
    const hasAttrs = this.hasAttrs();
    const walkerA = this.patA.newWalker();
    const walkerB = this.patB.newWalker();

    // tslint:disable-next-line:no-use-before-declare
    return new InterleaveWalker(this,
                                walkerA,
                                walkerB,
                                hasAttrs,
                                false,
                                !hasAttrs || (walkerA.canEndAttribute &&
                                              walkerB.canEndAttribute),
                                walkerA.canEnd && walkerB.canEnd);
  }
}

/**
 * Walker for [[Interleave]].
 */
class InterleaveWalker implements InternalWalker {
  constructor(protected readonly el: Interleave,
              private readonly walkerA: InternalWalker,
              private readonly walkerB: InternalWalker,
              private readonly hasAttrs: boolean,
              private ended: boolean,
              public canEndAttribute: boolean,
              public canEnd: boolean) {}

  clone(): this {
    return new InterleaveWalker(this.el,
                                this.walkerA.clone(),
                                this.walkerB.clone(),
                                this.hasAttrs,
                                this.ended,
                                this.canEndAttribute,
                                this.canEnd) as this;
  }

  possible(): EventSet {
    if (this.ended) {
      return new Set();
    }

    const ret = this.walkerA.possible();
    union(ret, this.walkerB.possible());

    return ret;
  }

  possibleAttributes(): EventSet {
    if (this.ended) {
      return new Set();
    }

    const ret = this.walkerA.possibleAttributes();
    union(ret, this.walkerB.possibleAttributes());

    return ret;
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
  // not synonymous with ``canEnd === true``. Looking again at the B A C
  // scenario above, we can switch to A when B is done but the inner level
  // interleave is itself not "done" because C has not matched yet.
  //
  // We work around the issue by counting the number of start tags and end tags
  // seen by a pattern. When they are equal we can switch away from from the
  // pattern to another one.
  //
  fireEvent(name: string, params: string[],
            nameResolver: NameResolver): InternalFireEventResult {
    if (!this.hasAttrs && isAttributeEvent(name)) {
      return new InternalFireEventResult(false);
    }

    //
    // fireEvent is not called after ended is true
    // if (this.ended) {
    //   return new InternalFireEventResult(false);
    // }
    //

    const { walkerA, walkerB } = this;

    const retA = walkerA.fireEvent(name, params, nameResolver);
    if (retA.matched) {
      this.canEndAttribute = walkerA.canEndAttribute && walkerB.canEndAttribute;
      this.canEnd = walkerA.canEnd && walkerB.canEnd;

      // The constraints on interleave do not allow for two child patterns of
      // interleave to match. So if the first walker matched, the second
      // cannot. So we don't have to fireEvent on the second walker if the
      // first matched.
      return retA;
    }

    const retB = walkerB.fireEvent(name, params, nameResolver);
    if (retB.matched) {
      this.canEndAttribute =
        walkerA.canEndAttribute && walkerB.canEndAttribute;
      this.canEnd = walkerA.canEnd && walkerB.canEnd;

      return retB;
    }

    return new InternalFireEventResult(false);
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
    const retB = this.walkerB.end();

    if (retA) {
      return !retB ? retA : retA.concat(retB);
    }

    return retB;
  }

  endAttributes(): EndResult {
    if (this.ended || this.canEndAttribute) {
      return false;
    }

    const retA = this.walkerA.endAttributes();
    const retB = this.walkerB.endAttributes();

    if (retA) {
      return retB ? retA.concat(retB) : retA;
    }

    return retB;
  }
}

//  LocalWords:  RNG's MPL NG inA inB instantiateWalkers fireEvent retA retB
