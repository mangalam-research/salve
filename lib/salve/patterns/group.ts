/**
 * Pattern and walker for RNG's ``group`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { AttributeNameError, AttributeValueError } from "../errors";
import { NameResolver } from "../name_resolver";
import { union } from "../set";
import { EndResult, EventSet, InternalFireEventResult, InternalWalker,
         isAttributeEvent, TwoSubpatterns } from "./base";

/**
 * A pattern for ``<group>``.
 */
export class Group extends TwoSubpatterns {
  protected _computeHasEmptyPattern(): boolean {
    return this.patA.hasEmptyPattern() && this.patB.hasEmptyPattern();
  }

  newWalker(): InternalWalker {
    const hasAttrs = this.hasAttrs();
    const walkerA = this.patA.newWalker();
    const walkerB = this.patB.newWalker();

    // tslint:disable-next-line:no-use-before-declare
    return new GroupWalker(this,
                           walkerA,
                           walkerB,
                           hasAttrs,
                           false,
                           false,
                           !hasAttrs ||
                           (walkerA.canEndAttribute && walkerB.canEndAttribute),
                           walkerA.canEnd && walkerB.canEnd);
  }
}

/**
 * Walker for [[Group]].
 */
class GroupWalker implements InternalWalker {
  constructor(protected readonly el: Group,
              private readonly walkerA: InternalWalker,
              private readonly walkerB: InternalWalker,
              private readonly hasAttrs: boolean,
              private ended: boolean,
              private endedA: boolean,
              public canEndAttribute: boolean,
              public canEnd: boolean) {}

  clone(): this {
    return new GroupWalker(this.el,
                           this.walkerA.clone(),
                           this.walkerB.clone(),
                           this.hasAttrs,
                           this.ended,
                           this.endedA,
                           this.canEndAttribute,
                           this.canEnd) as this;
  }

  possible(): EventSet {
    if (this.ended) {
      return new Set();
    }

    const ret = this.walkerA.possible();

    if (this.walkerA.canEnd) {
      union(ret, this.walkerB.possible());
    }

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

  fireEvent(name: string, params: string[],
            nameResolver: NameResolver): InternalFireEventResult {
    const evIsAttributeEvent = isAttributeEvent(name);

    if (evIsAttributeEvent && !this.hasAttrs) {
      return new InternalFireEventResult(false);
    }

    // This is useful because it is possible for fireEvent to be called
    // after end() has been called.
    if (this.ended) {
      return new InternalFireEventResult(false);
    }

    const walkerA = this.walkerA;
    const walkerB = this.walkerB;
    if (!this.endedA) {
      const retA = walkerA.fireEvent(name, params, nameResolver);
      if (retA.matched || retA.errors !== undefined) {
        if (evIsAttributeEvent) {
          this.canEndAttribute = walkerA.canEndAttribute &&
            walkerB.canEndAttribute;
        }

        this.canEnd = walkerA.canEnd && walkerB.canEnd;

        return retA;
      }

      // We must return right away if walkerA cannot yet end. Only attribute
      // events are allowed to move forward.
      if (!evIsAttributeEvent && !walkerA.canEnd) {
        return retA;
      }
    }

    const retB = walkerB.fireEvent(name, params, nameResolver);
    if (evIsAttributeEvent) {
      this.canEndAttribute = walkerA.canEndAttribute && walkerB.canEndAttribute;
    }

    this.canEnd = walkerA.canEnd && walkerB.canEnd;

    // Non-attribute event: if walker b matched the event then we must end
    // walkerA, if we've not already done so.
    if (!evIsAttributeEvent && retB.matched) {
      this.endedA = true;

      // Having an end that errors here is not possible.
      if (walkerA.end() !== false) {
        throw new Error("walkerA can end but does not end cleanly!");
      }

      return retB;
    }

    return retB;
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
    // If we get here and the only errors we get are attribute errors, we must
    // move on to check the second walker too.
    if (retA) {
      for (const err of retA) {
        if (!(err instanceof AttributeValueError ||
              err instanceof AttributeNameError)) {
          // We ran into a non-attribute error. We can stop here.
          return retA;
        }
      }
    }

    const retB = this.walkerB.end();
    if (retB) {
      return retA ? retA.concat(retB) : retB;
    }

    return retA;
  }

  endAttributes(): EndResult {
    if (this.ended || this.canEndAttribute) {
      return false;
    }

    const endA = this.walkerA.endAttributes();
    const endB = this.walkerB.endAttributes();

    if (endB) {
      return endA ? endA.concat(endB) : endB;
    }

    return endA;
  }
}

//  LocalWords:  RNG's MPL instantiateWalkers walkerA retB canEnd endedA
