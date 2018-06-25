/**
 * Pattern and walker for RNG's ``element`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { ElementNameError } from "../errors";
import { ConcreteName, Name } from "../name_patterns";
import { NameResolver } from "../name_resolver";
import { BasePattern, EndResult, Event, EventSet, InternalFireEventResult,
         InternalWalker, Pattern } from "./base";
import { Define } from "./define";
import { NotAllowed } from "./not_allowed";
import { Ref } from "./ref";

/**
 * A pattern for elements.
 */
export class Element extends BasePattern {
  private readonly notAllowed: boolean;
  /**
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param name The qualified name of the element.
   *
   * @param pat The pattern contained by this one.
   */
  constructor(xmlPath: string, readonly name: ConcreteName,
              readonly pat: Pattern) {
    super(xmlPath);
    this.notAllowed = this.pat instanceof NotAllowed;
  }

  newWalker(boundName: Name): InternalWalker {
    return (this.notAllowed) ?
      this.pat.newWalker() :
      // tslint:disable-next-line:no-use-before-declare
      new ElementWalker(this,
                        this.pat.newWalker(),
                        false,
                        new Event("endTag", boundName),
                        boundName,
                        true,
                        false);
  }

  hasAttrs(): boolean {
    return false;
  }

  hasEmptyPattern(): boolean {
    // The question is whether an element allows empty content **in the context
    // in which it appears**, not empty content inside it. So the answer is
    // always negative.
    return false;
  }

  _prepare(definitions: Map<string, Define>,
           namespaces: Set<string>): Ref[] | undefined {
    this.name._recordNamespaces(namespaces, true);

    return this.pat._prepare(definitions, namespaces);
  }
}

/**
 *
 * Walker for [[Element]].
 */
class ElementWalker implements InternalWalker {
  private static _leaveStartTagEvent: Event = new Event("leaveStartTag");

  constructor(protected readonly el: Element,
              private readonly walker: InternalWalker,
              private endedStartTag: boolean,
              private readonly endTagEvent: Event,
              private boundName: Name,
              public canEndAttribute: boolean,
              public canEnd: boolean) {}

  clone(): this {
    return new ElementWalker(this.el,
                             this.walker.clone(),
                             this.endedStartTag,
                             this.endTagEvent,
                             this.boundName,
                             this.canEndAttribute,
                             this.canEnd) as this;
  }

  possible(): EventSet {
    // Contrarily to all other implementations, which must only return
    // non-attribute events. This implementation actually returns all types of
    // possible events. Representing this distinction through TS type
    // declarations would be cumbersome. The exception works because of the way
    // Relax NG constrains the structure of a simplified schema. The only
    // possible caller for this method is ``GrammarWalker``, which also aims to
    // return all possible events.

    if (!this.endedStartTag) {
      const walker = this.walker;

      const ret = walker.possibleAttributes();

      if (walker.canEndAttribute) {
        ret.add(ElementWalker._leaveStartTagEvent);
      }

      return ret;
    }
    else if (!this.canEnd) {
      const walker = this.walker;
      const posses = walker.possible();
      if (walker.canEnd) {
        posses.add(this.endTagEvent);
      }

      return posses;
    }

    return new Set<Event>();
  }

  possibleAttributes(): EventSet {
    throw new Error("calling possibleAttributes on ElementWalker is invalid");
  }

  fireEvent(name: string, params: string[],
            nameResolver: NameResolver): InternalFireEventResult {
    // This is not a useful optimization. canEnd becomes true once we see
    // the end tag, which means that this walker will be popped of
    // GrammarWalker's stack and won't be called again.
    //
    // if (this.canEnd) {
    //   return undefined;
    // }

    const walker = this.walker;
    if (this.endedStartTag) {
      if (name === "endTag") {
        // We cannot get here if canEnd is already true. So this will
        // necessarily leave it false or set it to true but it won't set a true
        // canEnd back to false.
        this.canEnd = this.boundName.match(params[0], params[1]);

        return InternalFireEventResult.fromEndResult(walker.end());
      }

      return walker.fireEvent(name, params, nameResolver);
    }

    switch (name) {
      case "enterStartTag":
        if (!this.boundName.match(params[0], params[1])) {
          throw new Error("event starting the element had an incorrect name");
        }

        return new InternalFireEventResult(true);
      case "startTagAndAttributes":
        if (!this.boundName.match(params[0], params[1])) {
          throw new Error("event starting the element had an incorrect name");
        }

        // We need to handle all attributes and leave the start tag.
        for (let ix = 2; ix < params.length; ix += 3) {
          const attrRet = walker.fireEvent("attributeNameAndValue",
                                           [params[ix], params[ix + 1],
                                            params[ix + 2]], nameResolver);
          if (!attrRet.matched) {
            return attrRet;
          }
        }

        /* fall through */
      case "leaveStartTag":
        this.endedStartTag = true;

        return this.el.pat.hasAttrs() ?
          InternalFireEventResult.fromEndResult(walker.endAttributes()) :
          new InternalFireEventResult(true);
      default:
    }

    return walker.fireEvent(name, params, nameResolver);
  }

  end(): EndResult {
    if (this.canEnd) {
      return false;
    }

    const err = new ElementNameError(this.endedStartTag ?
                                     "tag not closed" :
                                     "start tag not terminated",
                                     this.boundName);
    const walkerRet = this.walker.end();

    return walkerRet ? walkerRet.concat(err) : [err];
  }

  endAttributes(): EndResult {
    throw new Error("calling endAttributes on ElementWalker is illegal");
  }
}

//  LocalWords:  RNG's MPL RNG ElementWalker leaveStartTag valueEvs
//  LocalWords:  enterStartTag attributeValue endTag errored subwalker
//  LocalWords:  neutralizeAttribute boundName fireEvent suppressAttributes
