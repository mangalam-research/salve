/**
 * Pattern and walker for RNG's ``oneOrMore`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { HashMap } from "../hashstructs";
import { NameResolver } from "../name_resolver";
import { addWalker, BasePattern, EndResult, Event, EventSet,
         FireEventResult, isHashMap, isNameResolver, OneSubpattern,
         Walker } from "./base";

/**
 * A pattern for ``<oneOrMore>``.
 */
export class  OneOrMore extends OneSubpattern {}

/**
 * Walker for [[OneOrMore]]
 */
class OneOrMoreWalker extends Walker<OneOrMore> {
  private seenOnce: boolean;
  private currentIteration: Walker<BasePattern> | undefined;
  private nextIteration: Walker<BasePattern> | undefined;
  private readonly nameResolver: NameResolver;

  /**
   * @param el The pattern for which this walker was created.
   *
   * @param resolver The name resolver that can be used to convert namespace
   * prefixes to namespaces.
   */
  protected constructor(walker: OneOrMoreWalker, memo: HashMap);
  protected constructor(el: OneOrMore, nameResolver: NameResolver);
  protected constructor(elOrWalker: OneOrMoreWalker | OneOrMore,
                        nameResolverOrMemo: NameResolver | HashMap) {
    if (elOrWalker instanceof OneOrMoreWalker) {
      const walker: OneOrMoreWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.seenOnce = walker.seenOnce;
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.currentIteration = walker.currentIteration !== undefined ?
        walker.currentIteration._clone(memo) : undefined;
      this.nextIteration = walker.nextIteration !== undefined ?
        walker.nextIteration._clone(memo) : undefined;
    }
    else {
      const el: OneOrMore = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo);
      super(el);
      this.nameResolver = nameResolver;
      this.seenOnce = false;
    }
  }

  _possible(): EventSet {
    if (this.possibleCached !== undefined) {
      return this.possibleCached;
    }

    this._instantiateCurrentIteration();
    this.possibleCached = this.currentIteration!._possible();

    if (this.currentIteration!.canEnd()) {
      this.possibleCached = new EventSet(this.possibleCached);
      this._instantiateNextIteration();

      const nextPossible: EventSet = this.nextIteration!._possible();

      this.possibleCached.union(nextPossible);
    }

    return this.possibleCached;
  }

  fireEvent(ev: Event): FireEventResult {
    this.possibleCached = undefined;

    this._instantiateCurrentIteration();

    let ret: FireEventResult = this.currentIteration!.fireEvent(ev);
    if (ret === false) {
      this.seenOnce = true;
    }

    if (ret !== undefined) {
      return ret;
    }

    if (this.seenOnce && this.currentIteration!.canEnd()) {
      ret = this.currentIteration!.end();
      if (ret) {
        throw new Error(
          "internal error; canEnd() returns true but end() fails");
      }

      this._instantiateNextIteration();
      const nextRet: FireEventResult = this.nextIteration!.fireEvent(ev);
      if (nextRet === false) {
        this.currentIteration = this.nextIteration;
        this.nextIteration = undefined;
      }
      return nextRet;
    }
    return undefined;
  }

  _suppressAttributes(): void {
    // A oneOrMore element can happen if we have the pattern ``(attribute * {
    // text })+`` for instance. Once converted to the simplified RNG, it
    // becomes:
    //
    // ``<oneOrMore><attribute><anyName/><rng:text/></attribute></oneOrMore>``
    //
    // An attribute in ``oneOrMore`` cannot happen when ``anyName`` is not used
    // because an attribute of any given name cannot be repeated.
    //
    this._instantiateCurrentIteration();
    if (!this.suppressedAttributes) {
      this.suppressedAttributes = true;
      this.possibleCached = undefined; // No longer valid.
      this.currentIteration!._suppressAttributes();

      if (this.nextIteration !== undefined) {
        this.nextIteration._suppressAttributes();
      }
    }
  }

  canEnd(attribute: boolean = false): boolean {
    if (attribute) {
      if (!this.el.pat._hasAttrs()) {
        return true;
      }

      this._instantiateCurrentIteration();

      return this.currentIteration!.canEnd(true);
    }
    return this.seenOnce && this.currentIteration!.canEnd();
  }

  end(attribute: boolean = false): EndResult {
    if (this.canEnd(attribute)) {
      return false;
    }

    // Undefined currentIteration can happen in rare cases.
    this._instantiateCurrentIteration();

    return this.currentIteration!.end(attribute);
  }

  private _instantiateCurrentIteration(): void {
    if (this.currentIteration === undefined) {
      this.currentIteration = this.el.pat.newWalker(this.nameResolver);
    }
  }

  private _instantiateNextIteration(): void {
    if (this.nextIteration === undefined) {
      this.nextIteration = this.el.pat.newWalker(this.nameResolver);

      // Whereas _suppressAttributes calls _instantiateCurrentIteration() so
      // that currentIteration is always existing and its _suppressAttributes()
      // method is called before _suppressAttributes() returns, the same is not
      // true of nextIteration. So if we create it **after**
      // _suppressAttributes() was called we need to call _suppressAttributes()
      // on it.
      if (this.suppressedAttributes) {
        this.nextIteration._suppressAttributes();
      }
    }
  }
}

addWalker(OneOrMore, OneOrMoreWalker);
