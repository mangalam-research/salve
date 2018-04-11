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
         InternalFireEventResult, InternalWalker, isHashMap, isNameResolver,
         TwoSubpatterns } from "./base";

/**
 * A pattern for ``<choice>``.
 */
export class Choice extends TwoSubpatterns {}

/**
 * Walker for [[Choice]].
 */
class ChoiceWalker extends InternalWalker<Choice> {
  private readonly hasAttrs: boolean;
  private walkerA: InternalWalker<BasePattern>;
  private walkerB: InternalWalker<BasePattern>;
  private deactivateA: boolean;
  private deactivateB: boolean;
  private readonly nameResolver: NameResolver;

  protected constructor(walker: ChoiceWalker, memo: HashMap);
  protected constructor(el: Choice, nameResolver: NameResolver);
  protected constructor(elOrWalker: ChoiceWalker | Choice,
                        nameResolverOrMemo: NameResolver | HashMap)
  {
    if (elOrWalker instanceof ChoiceWalker) {
      const walker = elOrWalker;
      const memo = isHashMap(nameResolverOrMemo);
      super(walker, memo);
      this.hasAttrs = walker.hasAttrs;
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.walkerA = walker.walkerA._clone(memo);
      this.walkerB = walker.walkerB._clone(memo);
      this.deactivateA = walker.deactivateA;
      this.deactivateB = walker.deactivateB;
    }
    else {
      const el = elOrWalker;
      const nameResolver = isNameResolver(nameResolverOrMemo);
      super(el);
      this.hasAttrs = el._hasAttrs();
      this.nameResolver = nameResolver;
      this.deactivateA = false;
      this.deactivateB = false;
      this.walkerA = this.el.patA.newWalker(this.nameResolver);
      this.walkerB = this.el.patB.newWalker(this.nameResolver);
    }
  }

  _possible(): EventSet {
    if (this.possibleCached !== undefined) {
      return this.possibleCached;
    }

    const walkerA = this.walkerA;
    this.possibleCached = this.deactivateA ? undefined : walkerA._possible();

    const walkerB = this.walkerB;
    if (!this.deactivateB) {
      this.possibleCached = new EventSet(this.possibleCached);
      const possibleB = walkerB._possible();
      this.possibleCached.union(possibleB);
    }
    else if (this.possibleCached === undefined) {
      this.possibleCached = new EventSet();
    }

    return this.possibleCached;
  }

  fireEvent(ev: Event): InternalFireEventResult {
    if (ev.isAttributeEvent && !this.hasAttrs) {
      return undefined;
    }

    const walkerA = this.walkerA;
    const walkerB = this.walkerB;

    if (this.deactivateA && this.deactivateB) {
      return undefined;
    }

    this.possibleCached = undefined;
    const retA = this.deactivateA ? undefined : walkerA.fireEvent(ev);
    const retB = this.deactivateB ? undefined : walkerB.fireEvent(ev);

    if (retA === undefined && retB === undefined) {
      return undefined;
    }

    if (retA !== undefined) {
      if (retB === undefined) {
        this.deactivateB = true;

        return retA;
      }

      if (retB === false) {
        return retA;
      }

      if (retA === false) {
        return retB;
      }

      return retA.concat(retB);
    }

    // We do not need to test if retA is undefined because we would not get
    // here if it were not.
    this.deactivateA = true;

    return retB;
  }

  _suppressAttributes(): void {
    // We don't protect against multiple calls to _suppressAttributes.
    // ElementWalker is the only walker that initiates _suppressAttributes
    // and it calls it only once per walker.
    this.possibleCached = undefined; // no longer valid
    this.walkerA._suppressAttributes();
    this.walkerB._suppressAttributes();
  }

  canEnd(attribute: boolean = false): boolean {
    const walkerA = this.walkerA;
    const walkerB = this.walkerB;

    if (this.deactivateA && this.deactivateB) {
      return true;
    }

    return attribute ? (!this.el.patA._hasAttrs() ||
                        !this.el.patB._hasAttrs()) :
      ((!this.deactivateA && walkerA.canEnd(false)) ||
       (!this.deactivateB && walkerB.canEnd(false)));
  }

  end(attribute: boolean = false): EndResult {
    if (this.canEnd(attribute)) {
      // Instead of an ended flag, we set both flags.
      if (!attribute) {
        this.deactivateA = true;
        this.deactivateB = true;
      }

      return false;
    }

    const retA = this.walkerA.end(attribute);
    const retB = this.walkerB.end(attribute);

    if (!retA && !retB) {
      return false;
    }

    if (retA && !retB) {
      // walkerB did not error, but walkerA did. If we had deactivated it, then
      // we ignore the error. Everything is fine because only one walker needs
      // to complete without error.
      return (this.deactivateA) ? false : retA;
    }

    if (!retA && retB) {
      // walkerA did not error, but walkerB did. If we had deactivated it, then
      // we ignore the error. Everything is fine because only one walker needs
      // to complete without error.
      return (this.deactivateB) ? false : retB;
    }

    // If we are here both walkers exist and returned an error. We combine the
    // errors no matter which walker may have been deactivated.
    const namesA: namePatterns.Base[] = [];
    let notAChoiceError = false;
    this.walkerA.possible().forEach((ev: Event) => {
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
      const namesB: namePatterns.Base[] = [];
      this.walkerB.possible().forEach((ev: Event) => {
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
}

addWalker(Choice, ChoiceWalker);

//  LocalWords:  RNG's MPL retA ChoiceWalker enterStartTag notAChoiceError
//  LocalWords:  tslint ChoiceError
