/**
 * Pattern and walker for RNG's ``element`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { ElementNameError } from "../errors";
import { ConcreteName, Name } from "../name_patterns";
import { NameResolver } from "../name_resolver";
import { BasePattern, cloneIfNeeded, CloneMap, EndResult, Event, EventSet,
         InternalFireEventResult, InternalWalker, Pattern } from "./base";
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

  newWalker(resolver: NameResolver,
            boundName: Name): InternalWalker<BasePattern> {
    return this.notAllowed ?
      this.pat.newWalker(resolver) :
      // tslint:disable-next-line:no-use-before-declare
      new ElementWalker(this, resolver, boundName);
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
class ElementWalker extends InternalWalker<Element> {
  private static _leaveStartTagEvent: Event = new Event("leaveStartTag");

  private endedStartTag: boolean;
  private walker: InternalWalker<BasePattern>;
  private endTagEvent: Event;
  private boundName: Name;
  private readonly nameResolver: NameResolver;
  canEndAttribute: boolean;
  canEnd: boolean;

  /**
   * @param el The pattern for which this walker was
   * created.
   *
   * @param nameResolver The name resolver that
   * can be used to convert namespace prefixes to namespaces.
   */
  constructor(walker: ElementWalker, memo: CloneMap);
  constructor(el: Element, nameResolver: NameResolver, boundName: Name);
  constructor(elOrWalker: ElementWalker | Element,
              nameResolverOrMemo: NameResolver | CloneMap,
              boundName?: Name) {
    super(elOrWalker);
    if ((elOrWalker as Element).newWalker !== undefined) {
      const el = elOrWalker as Element;
      const nameResolver = nameResolverOrMemo as NameResolver;
      this.nameResolver = nameResolver;
      this.walker = el.pat.newWalker(nameResolver);
      this.endedStartTag = false;
      // tslint:disable-next-line:no-non-null-assertion
      this.boundName = boundName!;
      this.endTagEvent = new Event("endTag", this.boundName);
      this.canEndAttribute = true;
      this.canEnd = false;
    }
    else {
      const walker = elOrWalker as ElementWalker;
      const memo = nameResolverOrMemo as CloneMap;
      this.nameResolver = cloneIfNeeded(walker.nameResolver, memo);
      this.endedStartTag = walker.endedStartTag;
      this.walker = walker.walker._clone(memo);

      // No cloning needed since these are immutable.
      this.endTagEvent = walker.endTagEvent;
      this.boundName = walker.boundName;
      this.canEndAttribute = walker.canEndAttribute;
      this.canEnd = walker.canEnd;
    }
  }

  _clone(memo: CloneMap): this {
    return new ElementWalker(this, memo) as this;
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

  fireEvent(name: string, params: string[]): InternalFireEventResult {
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

        return walker.end();
      }

      return walker.fireEvent(name, params);
    }

    switch (name) {
      case "enterStartTag":
        if (!this.boundName.match(params[0], params[1])) {
          throw new Error("event starting the element had an incorrect name");
        }

        return false;
      case "startTagAndAttributes":
        if (!this.boundName.match(params[0], params[1])) {
          throw new Error("event starting the element had an incorrect name");
        }

        // We need to handle all attributes and leave the start tag.
        for (let ix = 2; ix < params.length; ix += 3) {
          const attrRet = walker.fireEvent("attributeNameAndValue",
                                           params.slice(ix, ix + 3));
          if (attrRet !== false) {
            return attrRet;
          }
        }

        /* fall through */
      case "leaveStartTag":
        this.endedStartTag = true;

        return this.el.pat.hasAttrs() ? walker.endAttributes() : false;
      default:
    }

    return walker.fireEvent(name, params);
  }

  end(): EndResult {
    if (this.canEnd) {
      return false;
    }

    const walkerRet = this.walker.end();
    const ret = walkerRet ? walkerRet : [];

    ret.push(new ElementNameError(this.endedStartTag ?
                                 "tag not closed" :
                                 "start tag not terminated",
                                  this.boundName));

    return ret;
  }

  endAttributes(): EndResult {
    throw new Error("calling endAttributes on ElementWalker is illegal");
  }
}

//  LocalWords:  RNG's MPL RNG ElementWalker leaveStartTag valueEvs
//  LocalWords:  enterStartTag attributeValue endTag errored subwalker
//  LocalWords:  neutralizeAttribute boundName fireEvent suppressAttributes
