/**
 * Pattern and walker for RNG's ``list`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { ValidationError } from "../errors";
import { HashMap } from "../hashstructs";
import { NameResolver } from "../name_resolver";
import { addWalker, emptyEvent, EndResult, Event, FireEventResult, isHashMap,
         isNameResolver, OneSubpattern, SingleSubwalker } from "./base";

/**
 * List pattern.
 */
export class List extends OneSubpattern {}

/**
 * Walker for [[List]].
 *
 */
class ListWalker extends SingleSubwalker<List> {
  private seenTokens: boolean;
  private matched: boolean;
  private readonly nameResolver: NameResolver;

  protected constructor(other: ListWalker, memo: HashMap);
  protected constructor(el: List, nameResolver: NameResolver);
  protected constructor(elOrWalker: List | ListWalker,
                        nameResolverOrMemo: NameResolver | HashMap) {
    if (elOrWalker instanceof ListWalker) {
      const walker: ListWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo, "as 2nd argument");
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.subwalker = walker.subwalker._clone(memo);
      this.seenTokens = walker.seenTokens;
      this.matched = walker.matched;
    }
    else {
      const el: List = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo,
                                                        "as 2nd argument");
      super(el);
      this.nameResolver = nameResolver;
      this.subwalker = el.pat.newWalker(this.nameResolver);
      this.seenTokens = false;
      this.matched = false;
    }
  }

  fireEvent(ev: Event): FireEventResult {
    // Only these two types can match.
    if (ev.params[0] !== "text") {
      return undefined;
    }

    const trimmed: string = (ev.params[1] as string).trim();

    // The list walker cannot send empty strings to its children because it
    // validates a list of **tokens**.
    if (trimmed === "") {
      return false;
    }

    this.seenTokens = true;

    const tokens: string[] = trimmed.split(/\s+/);

    for (const token of tokens) {
      const ret: FireEventResult =
        this.subwalker.fireEvent(new Event(ev.params[0], token));
      if (ret !== false) {
        return ret;
      }
    }

    this.matched = true;

    return false;
  }

  _suppressAttributes(): void {
    // Lists cannot contain attributes.
  }

  canEnd(attribute: boolean = false): boolean {
    if (!this.seenTokens) {
      return (this.subwalker.fireEvent(emptyEvent) === false);
    }

    return this.subwalker.canEnd(attribute);
  }

  end(attribute: boolean = false): EndResult {
    const ret: EndResult = this.subwalker.end(attribute);
    if (ret !== false) {
      return ret;
    }

    if (this.canEnd(attribute)) {
      return false;
    }

    return [new ValidationError("unfulfilled list")];
  }
}

addWalker(List, ListWalker);

//  LocalWords:  RNG's MPL nd
