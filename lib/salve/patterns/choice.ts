/**
 * Pattern and walker for RNG's ``choice`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { ChoiceError } from "../errors";
import { HashMap } from "../hashstructs";
import * as namePatterns from "../name_patterns";
import { NameResolver } from "../name_resolver";
import { addWalker, BasePattern, EndResult, Event, EventSet,
         FireEventResult, isHashMap, isNameResolver, TwoSubpatterns,
         Walker } from "./base";

/**
 * A pattern for ``<choice>``.
 */
export class Choice extends TwoSubpatterns {}

/**
 * Walker for [[Choice]].
 */
class ChoiceWalker extends Walker<Choice> {
  private chosen: boolean;
  private walkerA: Walker<BasePattern> | undefined;
  private walkerB: Walker<BasePattern> | undefined;
  private instantiatedWalkers: boolean;
  private readonly nameResolver: NameResolver;

  protected constructor(walker: ChoiceWalker, memo: HashMap);
  protected constructor(el: Choice, nameResolver: NameResolver);
  protected constructor(elOrWalker: ChoiceWalker | Choice,
                        nameResolverOrMemo: NameResolver | HashMap)
  {
    if (elOrWalker instanceof ChoiceWalker) {
      const walker: ChoiceWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.chosen = walker.chosen;
      this.walkerA = walker.walkerA !== undefined ?
        walker.walkerA._clone(memo) : undefined;
      this.walkerB = walker.walkerB !== undefined ?
        walker.walkerB._clone(memo) : undefined;
      this.instantiatedWalkers = walker.instantiatedWalkers;
    }
    else {
      const el: Choice = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo);
      super(el);
      this.nameResolver = nameResolver;
      this.chosen = false;
      this.instantiatedWalkers = false;
    }
  }

  _possible(): EventSet {
    this._instantiateWalkers();
    if (this.possibleCached !== undefined) {
      return this.possibleCached;
    }

    this.possibleCached = this.walkerA !== undefined ?
      this.walkerA._possible() : undefined;

    if (this.walkerB !== undefined) {
      this.possibleCached = new EventSet(this.possibleCached);
      const possibleB: EventSet = this.walkerB._possible();
      this.possibleCached.union(possibleB);
    }
    else if (this.possibleCached === undefined) {
      this.possibleCached = new EventSet();
    }

    return this.possibleCached;
  }

  fireEvent(ev: Event): FireEventResult {
    this._instantiateWalkers();

    this.possibleCached = undefined;
    // We purposely do not normalize this.walker_{a,b} to a boolean value
    // because we do want `undefined` to be the result if the walkers are
    // undefined.
    const retA: FireEventResult = this.walkerA !== undefined ?
      this.walkerA.fireEvent(ev) : undefined;
    const retB: FireEventResult = this.walkerB !== undefined ?
      this.walkerB.fireEvent(ev) : undefined;

    if (retA !== undefined) {
      this.chosen = true;
      if (retB === undefined) {
        this.walkerB = undefined;

        return retA;
      }

      return retA;
    }

    if (retB !== undefined) {
      this.chosen = true;
      // We do not need to test if retA is undefined because we would not get
      // here if it were not.
      this.walkerA = undefined;

      return retB;
    }

    return undefined;
  }

  _suppressAttributes(): void {
    this._instantiateWalkers();
    if (!this.suppressedAttributes) {
      this.possibleCached = undefined; // no longer valid
      this.suppressedAttributes = true;

      if (this.walkerA !== undefined) {
        this.walkerA._suppressAttributes();
      }
      if (this.walkerB !== undefined) {
        this.walkerB._suppressAttributes();
      }
    }
  }

  canEnd(attribute: boolean = false): boolean {
    this._instantiateWalkers();

    let retA: boolean = false;
    let retB: boolean  = false;
    if (attribute) {
      retA = !this.el.patA._hasAttrs();
      retB = !this.el.patB._hasAttrs();
    }

    retA = retA || (this.walkerA !== undefined &&
                    this.walkerA.canEnd(attribute));
    retB = retB || (this.walkerB !== undefined &&
                    this.walkerB.canEnd(attribute));

    // ChoiceWalker can end if any walker can end. The assignments earlier
    // ensure that the logic works.
    return retA || retB;
  }

  end(attribute: boolean = false): EndResult {
    this._instantiateWalkers();

    if (this.canEnd(attribute)) {
      return false;
    }

    const retA: EndResult = this.walkerA !== undefined &&
      this.walkerA.end(attribute);
    const retB: EndResult = this.walkerB !== undefined &&
      this.walkerB.end(attribute);

    if (!retA && !retB) {
      return false;
    }

    if (retA && !retB) {
      return retA;
    }

    if (!retA && retB) {
      return retB;
    }

    // If we are here both walkers exist and returned an error.
    const namesA: namePatterns.Base[] = [];
    const namesB: namePatterns.Base[] = [];
    let notAChoiceError: boolean = false;
    // tslint:disable-next-line:no-non-null-assertion
    this.walkerA!.possible().forEach((ev: Event) => {
      if (ev.params[0] === "enterStartTag") {
        namesA.push(ev.params[1] as namePatterns.Base);
      }
      else {
        notAChoiceError = true;
      }
    });

    // The as boolean casts are necessary due to a flaw in the type inference
    // done by TS. Without the cast, TS thinks notAChoiceError is necessarily
    // false here and tslint issues a warning.
    if (!(notAChoiceError as boolean)) {
      // tslint:disable-next-line:no-non-null-assertion
      this.walkerB!.possible().forEach((ev: Event) => {
        if (ev.params[0] === "enterStartTag") {
          namesB.push(ev.params[1] as namePatterns.Base);
        }
        else {
          notAChoiceError = true;
        }
      });

      if (!(notAChoiceError as boolean)) {
        return [new ChoiceError(namesA, namesB)];
      }
    }

    // If we get here, we were not able to raise a ChoiceError, possibly
    // because there was not enough information to decide among the two
    // walkers. Return whatever error comes first.
    return retA || retB;
  }

  /**
   * Creates walkers for the patterns contained by this one. Calling this method
   * multiple times is safe as the walkers are created once and only once.
   */
  private _instantiateWalkers(): void {
    if (!this.instantiatedWalkers) {
      this.instantiatedWalkers = true;

      this.walkerA = this.el.patA.newWalker(this.nameResolver);
      this.walkerB = this.el.patB.newWalker(this.nameResolver);
    }
  }
}

addWalker(Choice, ChoiceWalker);

//  LocalWords:  RNG's MPL retA ChoiceWalker enterStartTag notAChoiceError
//  LocalWords:  tslint ChoiceError
