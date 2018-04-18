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
import { BasePattern, EndResult, Event, EventSet, InternalFireEventResult,
         InternalWalker, Pattern, TwoSubpatterns } from "./base";
import { Empty } from "./empty";

/**
 * A pattern for ``<choice>``.
 */
export class Choice extends TwoSubpatterns {
  optional: boolean;

  constructor(xmlPath: string, patA: Pattern, patB: Pattern) {
    super(xmlPath, patA, patB);
    this.optional = patA instanceof Empty;
  }

  protected _computeHasEmptyPattern(): boolean {
    return this.patA.hasEmptyPattern() || this.patB.hasEmptyPattern();
  }

  newWalker(resolver: NameResolver): InternalWalker<BasePattern> {
    return this.optional ?
      // tslint:disable-next-line:no-use-before-declare
      OptionalChoiceWalker.makeWalker(this, resolver) :
      // tslint:disable-next-line:no-use-before-declare
      ChoiceWalker.makeWalker(this, resolver);
  }
}

/**
 * Walker for [[Choice]].
 */
class ChoiceWalker extends InternalWalker<Choice> {
  private readonly hasAttrs: boolean;
  private readonly walkerA: InternalWalker<BasePattern>;
  private readonly walkerB: InternalWalker<BasePattern>;
  private deactivateA: boolean;
  private deactivateB: boolean;
  private readonly nameResolver: NameResolver;
  canEndAttribute: boolean;
  canEnd: boolean;

  protected constructor(walker: ChoiceWalker, memo: HashMap);
  protected constructor(el: Choice, nameResolver: NameResolver);
  protected constructor(elOrWalker: ChoiceWalker | Choice,
                        nameResolverOrMemo: NameResolver | HashMap)
  {
    if ((elOrWalker as Choice).newWalker !== undefined) {
      const el = elOrWalker as Choice;
      const nameResolver = nameResolverOrMemo as NameResolver;
      super(el);
      this.hasAttrs = el.hasAttrs();
      this.nameResolver = nameResolver;
      this.deactivateA = false;
      this.deactivateB = false;
      this.walkerA = this.el.patA.newWalker(nameResolver);
      this.walkerB = this.el.patB.newWalker(nameResolver);
      this.canEndAttribute = !this.hasAttrs ||
        this.walkerA.canEndAttribute || this.walkerB.canEndAttribute;
      this.canEnd = this.walkerA.canEnd || this.walkerB.canEnd;
    }
    else {
      const walker = elOrWalker as ChoiceWalker;
      const memo = nameResolverOrMemo as HashMap;
      super(walker, memo);
      this.hasAttrs = walker.hasAttrs;
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.walkerA = walker.walkerA._clone(memo);
      this.walkerB = walker.walkerB._clone(memo);
      this.deactivateA = walker.deactivateA;
      this.deactivateB = walker.deactivateB;
      this.canEndAttribute = walker.canEndAttribute;
      this.canEnd = walker.canEnd;
    }
  }

  static makeWalker(el: Choice, nameResolver: NameResolver): ChoiceWalker {
    return new ChoiceWalker(el, nameResolver);
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
    if (this.deactivateA && this.deactivateB) {
      return undefined;
    }

    const isAttributeEvent = ev.isAttributeEvent;
    if (isAttributeEvent && !this.hasAttrs) {
      return undefined;
    }

    this.possibleCached = undefined;
    const retA = this.deactivateA ? undefined : this.walkerA.fireEvent(ev);
    const retB = this.deactivateB ? undefined : this.walkerB.fireEvent(ev);

    if (retA !== undefined) {
      if (retB === undefined) {
        this.deactivateB = true;
        // If we get here, retA is not undefined therefore, this.deactivateA
        // cannot be true.
        if (isAttributeEvent) {
          this.canEndAttribute = this.walkerA.canEndAttribute;
        }

        this.canEnd = this.walkerA.canEnd;

        return retA;
      }

      // If we get here retB is not undefined, therefore this.deactivateB cannot
      // be true.
      if (isAttributeEvent) {
        this.canEndAttribute = this.walkerA.canEndAttribute ||
          this.walkerB.canEndAttribute;
      }

      this.canEnd = this.walkerA.canEnd || this.walkerB.canEnd;

      if (!retB) {
        return retA;
      }

      return !retA ? retB : retA.concat(retB);
    }

    // We do not need to test if retA is undefined because we would not get
    // here if it were not.
    if (retB === undefined) {
      return undefined;
    }

    // If we get here retB is not undefined, therefore this.deactivateB cannot
    // be true.
    this.deactivateA = true;
    if (isAttributeEvent) {
      this.canEndAttribute = this.walkerB.canEndAttribute;
    }

    this.canEnd = this.walkerB.canEnd;

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

  end(attribute: boolean = false): EndResult {
    if ((attribute && this.canEndAttribute) || (!attribute && this.canEnd)) {
      // Instead of an ended flag, we set both flags.
      if (!attribute) {
        this.deactivateA = true;
        this.deactivateB = true;
      }

      return false;
    }

    const retA = this.deactivateA ? false : this.walkerA.end(attribute);
    const retB = this.deactivateB ? false : this.walkerB.end(attribute);

    if (!retA) {
      return retB;
    }

    if (!retB) {
      return retA;
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
    return retA;
  }
}

/**
 * Walker for [[Choice]].
 */
class OptionalChoiceWalker extends InternalWalker<Choice> {
  private readonly hasAttrs: boolean;
  private readonly walkerB: InternalWalker<BasePattern>;
  private ended: boolean;
  private readonly nameResolver: NameResolver;
  canEndAttribute: boolean;
  canEnd: boolean;

  protected constructor(walker: OptionalChoiceWalker, memo: HashMap);
  protected constructor(el: Choice, nameResolver: NameResolver);
  protected constructor(elOrWalker: OptionalChoiceWalker | Choice,
                        nameResolverOrMemo: NameResolver | HashMap)
  {
    if ((elOrWalker as Choice).newWalker !== undefined) {
      const el = elOrWalker as Choice;
      const nameResolver = nameResolverOrMemo as NameResolver;
      super(el);
      this.hasAttrs = el.hasAttrs();
      this.nameResolver = nameResolver;
      this.ended = false;
      this.walkerB = this.el.patB.newWalker(nameResolver);
      this.canEndAttribute = true;
      this.canEnd = true;
    }
    else {
      const walker = elOrWalker as OptionalChoiceWalker;
      const memo = nameResolverOrMemo as HashMap;
      super(walker, memo);
      this.hasAttrs = walker.hasAttrs;
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.walkerB = walker.walkerB._clone(memo);
      this.ended = walker.ended;
      this.canEndAttribute = walker.canEndAttribute;
      this.canEnd = walker.canEnd;
    }
  }

  static makeWalker(el: Choice,
                    nameResolver: NameResolver): OptionalChoiceWalker {
    return new OptionalChoiceWalker(el, nameResolver);
  }

  _possible(): EventSet {
    if (this.possibleCached !== undefined) {
      return this.possibleCached;
    }

    this.possibleCached = this.ended ? new EventSet() :
      this.walkerB._possible();

    return this.possibleCached;
  }

  fireEvent(ev: Event): InternalFireEventResult {
    if (this.ended) {
      return undefined;
    }

    const isAttributeEvent = ev.isAttributeEvent;
    if (isAttributeEvent && !this.hasAttrs) {
      return undefined;
    }

    this.possibleCached = undefined;
    const retA = (ev.params[0] === "text" &&
                  !/\S/.test(ev.params[1] as string)) ? false : undefined;
    const retB = this.walkerB.fireEvent(ev);

    if (retA !== undefined) {
      return (retB === undefined || retB === false) ? retA : retB;
    }

    if (retB === undefined) {
      return undefined;
    }

    if (isAttributeEvent) {
      this.canEndAttribute = this.walkerB.canEndAttribute;
    }

    this.canEnd = this.walkerB.canEnd;

    return retB;
  }

  _suppressAttributes(): void {
    // We don't protect against multiple calls to _suppressAttributes.
    // ElementWalker is the only walker that initiates _suppressAttributes
    // and it calls it only once per walker.
    this.possibleCached = undefined; // no longer valid
    this.walkerB._suppressAttributes();
  }

  end(attribute: boolean = false): EndResult {
    if ((attribute && this.canEndAttribute) || (!attribute && this.canEnd)) {
      // Instead of an ended flag, we set both flags.
      if (!attribute) {
        this.ended = true;
      }

      return false;
    }

    return this.walkerB.end(attribute);
  }
}

//  LocalWords:  RNG's MPL retA ChoiceWalker enterStartTag notAChoiceError
//  LocalWords:  tslint ChoiceError
