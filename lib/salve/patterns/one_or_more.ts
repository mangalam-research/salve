/**
 * Pattern and walker for RNG's ``oneOrMore`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { NameResolver } from "../name_resolver";
import { union } from "../set";
import { BasePattern, cloneIfNeeded, CloneMap, EndResult, EventSet,
         InternalFireEventResult, InternalWalker, isAttributeEvent,
         OneSubpattern, Pattern} from "./base";

/**
 * A pattern for ``<oneOrMore>``.
 */
export class  OneOrMore extends OneSubpattern {
  _computeHasEmptyPattern(): boolean {
    return this.pat.hasEmptyPattern();
  }

  newWalker(nameResolver: NameResolver): InternalWalker<OneOrMore> {
    // tslint:disable-next-line:no-use-before-declare
    return new OneOrMoreWalker(this, nameResolver);
  }
}

/**
 * Walker for [[OneOrMore]]
 */
class OneOrMoreWalker extends InternalWalker<OneOrMore> {
  private readonly subPat: Pattern;
  private readonly hasAttrs: boolean;
  private currentIteration: InternalWalker<BasePattern>;
  private nextIteration: InternalWalker<BasePattern> | undefined;
  private readonly nameResolver: NameResolver;
  canEndAttribute: boolean;
  canEnd: boolean;

  /**
   * @param el The pattern for which this walker was created.
   *
   * @param resolver The name resolver that can be used to convert namespace
   * prefixes to namespaces.
   */
  constructor(walker: OneOrMoreWalker, memo: CloneMap);
  constructor(el: OneOrMore, nameResolver: NameResolver);
  constructor(elOrWalker: OneOrMoreWalker | OneOrMore,
              nameResolverOrMemo: NameResolver | CloneMap) {
    super(elOrWalker);
    if ((elOrWalker as OneOrMore).newWalker !== undefined) {
      const el = elOrWalker as OneOrMore;
      const nameResolver = nameResolverOrMemo as NameResolver;
      this.subPat = el.pat;
      this.hasAttrs = el.hasAttrs();
      this.nameResolver = nameResolver;
      this.currentIteration = el.pat.newWalker(nameResolver);
      this.canEndAttribute = !this.hasAttrs ||
        this.currentIteration.canEndAttribute;
      this.canEnd = this.currentIteration.canEnd;
    }
    else {
      const walker = elOrWalker as OneOrMoreWalker;
      const memo = nameResolverOrMemo as CloneMap;
      this.subPat = walker.subPat;
      this.hasAttrs = walker.hasAttrs;
      this.nameResolver = cloneIfNeeded(walker.nameResolver, memo);
      this.currentIteration = walker.currentIteration._clone(memo);
      this.nextIteration = walker.nextIteration !== undefined ?
        walker.nextIteration._clone(memo) : undefined;
      this.canEndAttribute = walker.canEndAttribute;
      this.canEnd = walker.canEnd;
    }
  }

  _clone(memo: CloneMap): this {
    return new OneOrMoreWalker(this, memo) as this;
  }

  possible(): EventSet {
    const ret = this.currentIteration.possible();

    if (this.currentIteration.canEnd) {
      if (this.nextIteration === undefined) {
        this.nextIteration = this.subPat.newWalker(this.nameResolver);
      }
      union(ret, this.nextIteration.possible());
    }

    return ret;
  }

  possibleAttributes(): EventSet {
    const ret = this.currentIteration.possibleAttributes();

    if (this.currentIteration.canEnd) {
      if (this.nextIteration === undefined) {
        this.nextIteration = this.subPat.newWalker(this.nameResolver);
      }
      union(ret, this.nextIteration.possibleAttributes());
    }

    return ret;
  }

  fireEvent(name: string, params: string[]): InternalFireEventResult {
    let ret = new InternalFireEventResult(false);
    const evIsAttributeEvent = isAttributeEvent(name);
    if (evIsAttributeEvent && !this.hasAttrs) {
      return ret;
    }

    const currentIteration = this.currentIteration;

    ret = currentIteration.fireEvent(name, params);
    if (ret.matched) {
      if (evIsAttributeEvent) {
        this.canEndAttribute = currentIteration.canEndAttribute;
      }
      this.canEnd = currentIteration.canEnd;

      return ret;
    }

    if (currentIteration.canEnd) {
      if (this.nextIteration === undefined) {
        this.nextIteration = this.subPat.newWalker(this.nameResolver);
      }
      const nextRet = this.nextIteration.fireEvent(name, params);
      if (nextRet.matched) {
        if (currentIteration.end()) {
          throw new Error(
            "internal error; canEnd returns true but end() fails");
        }

        this.currentIteration = this.nextIteration;
        this.nextIteration = undefined;
        if (evIsAttributeEvent) {
          this.canEndAttribute = this.currentIteration.canEndAttribute;
        }

        this.canEnd = this.currentIteration.canEnd;
      }

      return nextRet;
    }

    return ret;
  }

  end(): EndResult {
    return this.canEnd ? false : this.currentIteration.end();
  }

  endAttributes(): EndResult {
    return this.canEndAttribute ? false : this.currentIteration.endAttributes();
  }
}

//  LocalWords:  RNG's MPL currentIteration nextIteration canEnd oneOrMore rng
//  LocalWords:  anyName suppressAttributes instantiateCurrentIteration
