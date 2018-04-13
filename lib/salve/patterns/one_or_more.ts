/**
 * Pattern and walker for RNG's ``oneOrMore`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { HashMap } from "../hashstructs";
import { NameResolver } from "../name_resolver";
import { addWalker, BasePattern, EndResult, Event, EventSet,
         InternalFireEventResult, InternalWalker, matched,
         OneSubpattern } from "./base";

/**
 * A pattern for ``<oneOrMore>``.
 */
export class  OneOrMore extends OneSubpattern {
  _computeHasEmptyPattern(): boolean {
    return this.pat.hasEmptyPattern();
  }
}

/**
 * Walker for [[OneOrMore]]
 */
class OneOrMoreWalker extends InternalWalker<OneOrMore> {
  private suppressedAttributes: boolean;
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
  protected constructor(walker: OneOrMoreWalker, memo: HashMap);
  protected constructor(el: OneOrMore, nameResolver: NameResolver);
  protected constructor(elOrWalker: OneOrMoreWalker | OneOrMore,
                        nameResolverOrMemo: NameResolver | HashMap) {
    if ((elOrWalker as OneOrMore).newWalker !== undefined) {
      const el = elOrWalker as OneOrMore;
      const nameResolver = nameResolverOrMemo as NameResolver;
      super(el);
      this.hasAttrs = el.hasAttrs();
      this.suppressedAttributes = false;
      this.nameResolver = nameResolver;
      this.currentIteration = this.el.pat.newWalker(nameResolver);
      this.canEndAttribute = !this.hasAttrs ||
        this.currentIteration.canEndAttribute;
      this.canEnd = this.currentIteration.canEnd;
    }
    else {
      const walker = elOrWalker as OneOrMoreWalker;
      const memo = nameResolverOrMemo as HashMap;
      super(walker, memo);
      this.suppressedAttributes = walker.suppressedAttributes;
      this.hasAttrs = walker.hasAttrs;
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.currentIteration = walker.currentIteration._clone(memo);
      this.nextIteration = walker.nextIteration !== undefined ?
        walker.nextIteration._clone(memo) : undefined;
      this.canEndAttribute = walker.canEndAttribute;
      this.canEnd = walker.canEnd;
    }
  }

  _possible(): EventSet {
    if (this.possibleCached !== undefined) {
      return this.possibleCached;
    }

    this.possibleCached = this.currentIteration._possible();

    if (this.currentIteration.canEnd) {
      this.possibleCached = new EventSet(this.possibleCached);

      this._instantiateNextIteration();
      // nextIteration is necessarily defined here due to the previous call.
      // tslint:disable-next-line:no-non-null-assertion
      const nextPossible: EventSet = this.nextIteration!._possible();

      this.possibleCached.union(nextPossible);
    }

    return this.possibleCached;
  }

  fireEvent(ev: Event): InternalFireEventResult {
    const isAttributeEvent = ev.isAttributeEvent;
    if (isAttributeEvent && !this.hasAttrs) {
      return undefined;
    }

    this.possibleCached = undefined;

    const currentIteration = this.currentIteration;

    const ret = currentIteration.fireEvent(ev);
    if (ret !== undefined) {
      if (isAttributeEvent) {
        this.canEndAttribute = currentIteration.canEndAttribute;
      }
      this.canEnd = currentIteration.canEnd;

      return ret;
    }

    if (currentIteration.canEnd) {
      this._instantiateNextIteration();
      // nextIteration is necessarily defined here due to the previous call.
      // tslint:disable-next-line:no-non-null-assertion
      const nextRet = this.nextIteration!.fireEvent(ev);
      if (matched(nextRet)) {
        if (currentIteration.end()) {
          throw new Error(
            "internal error; canEnd returns true but end() fails");
        }

        // tslint:disable-next-line:no-non-null-assertion
        this.currentIteration = this.nextIteration!;
        this.nextIteration = undefined;
        if (isAttributeEvent) {
          this.canEndAttribute = this.currentIteration.canEndAttribute;
        }

        this.canEnd = this.currentIteration.canEnd;
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

    // We don't protect against multiple calls to _suppressAttributes.
    // ElementWalker is the only walker that initiates _suppressAttributes
    // and it calls it only once per walker.
    this.suppressedAttributes = true;
    this.possibleCached = undefined; // No longer valid.

    this.currentIteration._suppressAttributes();

    if (this.nextIteration !== undefined) {
      this.nextIteration._suppressAttributes();
    }
  }

  end(attribute: boolean = false): EndResult {
    return (attribute && this.canEndAttribute) || (!attribute && this.canEnd) ?
      false :
      this.currentIteration.end(attribute);
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

//  LocalWords:  RNG's MPL currentIteration nextIteration canEnd oneOrMore rng
//  LocalWords:  anyName suppressAttributes instantiateCurrentIteration
