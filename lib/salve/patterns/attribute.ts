/**
 * Pattern and walker for RNG's ``attribute`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Datatype, ParsedParams } from "../datatypes";
import { AttributeNameError, AttributeValueError } from "../errors";
import { AttributeNameEvent, AttributeValueEvent } from "../events";
import { ConcreteName } from "../name_patterns";
import { NameResolver } from "../name_resolver";
import { map } from "../set";
import { EndResult, EventSet, InternalFireEventResult, InternalWalker,
         Pattern } from "./base";
import { Data } from "./data";
import { Define } from "./define";
import { Text } from "./text";

const enum Kind {
  DEFAULT,
  TEXT,
  DATA,
}

/**
 * A pattern for attributes.
 */
export class Attribute extends Pattern {
  private readonly kind: Kind;

  /**
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param name The qualified name of the attribute.
   *
   * @param pat The pattern contained by this one.
   */

  constructor(xmlPath: string, readonly name: ConcreteName,
              readonly pat: Pattern) {
    super(xmlPath);
    if (pat instanceof Text) {
      this.kind = Kind.TEXT;
    }
    else if (pat instanceof Data) {
      this.kind = Kind.DATA;
    }
    else {
      this.kind = Kind.DEFAULT;
    }
  }

  _prepare(definitions: Map<string, Define>, namespaces: Set<string>): void {
    this.pat._prepare(definitions, namespaces);
    this.name._recordNamespaces(namespaces, false);
  }

  hasAttrs(): boolean {
    return true;
  }

  hasEmptyPattern(): boolean {
    return false;
  }

  newWalker(): InternalWalker {
    switch (this.kind) {
      case Kind.TEXT:
        return new AttributeTextWalker(this, this.name, false, false, false);
      case Kind.DATA:
        const pat = this.pat as Data;
        return new AttributeDataWalker(this, this.name, pat.datatype,
                                       pat.params, pat.except, false, false,
                                       false);
      default:
        // tslint:disable-next-line:no-use-before-declare
        return new AttributeWalker(this,
                                   this.name,
                                   this.pat.newWalker(),
                                   false, /* seenName */
                                   false,
                                   false);
    }
  }
}

/**
 * Walker for [[Attribute]].
 */
class AttributeWalker implements InternalWalker {

  /**
   * @param el The pattern for which this walker was created.
   */
  constructor(protected readonly el: Attribute,
              private readonly name: ConcreteName,
              private readonly subwalker: InternalWalker,
              private seenName: boolean,
              public canEndAttribute: boolean,
              public canEnd: boolean) {
  }

  clone(): this {
    return new AttributeWalker(this.el,
                               this.name,
                               this.subwalker.clone(),
                               this.seenName,
                               this.canEndAttribute,
                               this.canEnd) as this;
  }

  possible(): EventSet {
    return new Set();
  }

  possibleAttributes(): EventSet {
    if (this.canEnd) {
      return new Set();
    }

    if (!this.seenName) {
      return new Set([new AttributeNameEvent(this.name)]);
    }

    // Convert text events to attributeValue events.
    return map(this.subwalker.possible(), ev => {
      if (ev.name !== "text") {
        throw new Error(`unexpected event type: ${ev.name}`);
      }

      return new AttributeValueEvent(ev.value);
    });
  }

  fireEvent(name: string, params: string[],
            nameResolver: NameResolver): InternalFireEventResult {
    // If canEnd is true, we've done everything we could. So we don't
    // want to match again.
    if (this.canEnd) {
      return new InternalFireEventResult(false);
    }

    let value: string;
    if (this.seenName) {
      if (name !== "attributeValue") {
        return new InternalFireEventResult(false);
      }

      value = params[0];
    }
    else if ((name === "attributeName" || name === "attributeNameAndValue") &&
             this.name.match(params[0], params[1])) {
      this.seenName = true;

      if (name === "attributeName") {
        return new InternalFireEventResult(true);
      }

      value = params[2];
    }
    else {
      return new InternalFireEventResult(false);
    }

    this.canEnd = true;
    this.canEndAttribute = true;

    if (value !== "" &&
        !this.subwalker.fireEvent("text", [value], nameResolver).matched) {
      return new InternalFireEventResult(
        false,
        [new AttributeValueError("invalid attribute value", this.name)]);
    }

    return InternalFireEventResult.fromEndResult(this.subwalker.end());
  }

  endAttributes(): EndResult {
    if (this.canEnd) {
      return false;
    }

    // We set the canEnd flags true even though we did not end properly. This
    // prevents producing errors about the same attribute multiple times,
    // because end is called by element walkers when leaveStartTag is
    // encountered, and again when the element closes.
    this.canEnd = true;
    this.canEndAttribute = true;

    return [this.seenName ?
            new AttributeValueError("attribute value missing", this.name) :
            new AttributeNameError("attribute missing", this.name)];
  }

  end(): EndResult {
    return false;
  }
}

/**
 * This is a specialized walker for attributes that contain <text/> (which is
 * the default when an attribute does not have a more specific content
 * specified).
 */
class AttributeTextWalker implements InternalWalker {

  /**
   * @param el The pattern for which this walker was created.
   */
  constructor(protected readonly el: Attribute,
              private readonly name: ConcreteName,
              private seenName: boolean,
              public canEndAttribute: boolean,
              public canEnd: boolean) {
  }

  clone(): this {
    return new AttributeTextWalker(this.el,
                                   this.name,
                                   this.seenName,
                                   this.canEndAttribute,
                                   this.canEnd) as this;
  }

  possible(): EventSet {
    return new Set();
  }

  possibleAttributes(): EventSet {
    return this.canEnd ?
      new Set() :
      new Set([this.seenName ?
               new AttributeValueEvent(/^[^]*$/) :
               new AttributeNameEvent(this.name)]);
  }

  fireEvent(name: string, params: string[],
            nameResolver: NameResolver): InternalFireEventResult {
    // If canEnd is true, we've done everything we could. So we don't
    // want to match again.
    if (this.canEnd) {
      return new InternalFireEventResult(false);
    }

    if (this.seenName) {
      if (name !== "attributeValue") {
        return new InternalFireEventResult(false);
      }
    }
    else if ((name === "attributeName" || name === "attributeNameAndValue") &&
             this.name.match(params[0], params[1])) {
      this.seenName = true;

      if (name === "attributeName") {
        return new InternalFireEventResult(true);
      }
    }
    else {
      return new InternalFireEventResult(false);
    }

    this.canEnd = true;
    this.canEndAttribute = true;

    return new InternalFireEventResult(true);
  }

  endAttributes(): EndResult {
    if (this.canEnd) {
      return false;
    }

    // We set the canEnd flags true even though we did not end properly. This
    // prevents producing errors about the same attribute multiple times,
    // because end is called by element walkers when leaveStartTag is
    // encountered, and again when the element closes.
    this.canEnd = true;
    this.canEndAttribute = true;

    return [this.seenName ?
            new AttributeValueError("attribute value missing", this.name) :
            new AttributeNameError("attribute missing", this.name)];
  }

  end(): EndResult {
    return false;
  }
}

/**
 * This is a specialized walker for attributes that contain <data> (which is
 * rather common).
 */
class AttributeDataWalker implements InternalWalker {

  /**
   * @param el The pattern for which this walker was created.
   */
  constructor(protected readonly el: Attribute,
              private readonly name: ConcreteName,
              private readonly datatype: Datatype,
              private readonly params: ParsedParams,
              private readonly except: Pattern | undefined,
              private seenName: boolean,
              public canEndAttribute: boolean,
              public canEnd: boolean) {
  }

  clone(): this {
    return new AttributeDataWalker(this.el,
                                   this.name,
                                   this.datatype,
                                   this.params,
                                   this.except,
                                   this.seenName,
                                   this.canEndAttribute,
                                   this.canEnd) as this;
  }

  possible(): EventSet {
    return new Set();
  }

  possibleAttributes(): EventSet {
    return this.canEnd ?
      new Set() :
      new Set([this.seenName ?
               new AttributeValueEvent(this.datatype.regexp) :
               new AttributeNameEvent(this.name)]);
  }

  fireEvent(name: string, params: string[],
            nameResolver: NameResolver): InternalFireEventResult {
    // If canEnd is true, we've done everything we could. So we don't
    // want to match again.
    if (this.canEnd) {
      return new InternalFireEventResult(false);
    }

    let value: string;
    if (this.seenName) {
      if (name !== "attributeValue") {
        return new InternalFireEventResult(false);
      }

      value = params[0];
    }
    else if ((name === "attributeName" || name === "attributeNameAndValue") &&
             this.name.match(params[0], params[1])) {
      this.seenName = true;

      if (name === "attributeName") {
        return new InternalFireEventResult(true);
      }

      value = params[2];
    }
    else {
      return new InternalFireEventResult(false);
    }

    this.canEnd = true;
    this.canEndAttribute = true;

    if (this.datatype.disallows(value, this.params,
                                this.datatype.needsContext ?
                                { resolver: nameResolver } : undefined)) {
      return new InternalFireEventResult(
        false,
        [new AttributeValueError("invalid attribute value", this.name)]);
    }

    if (this.except !== undefined) {
      const walker = this.except.newWalker();
      const exceptRet = walker.fireEvent(name, params, nameResolver);

      // False, so the except does match the text, and so this pattern does
      // not match it.
      if (exceptRet.matched) {
        return new InternalFireEventResult(false);
      }

      // Otherwise, it is undefined, in which case it means the except does
      // not match the text, and we are fine. Or it would be possible for the
      // walker to have returned an error but there is nothing we can do with
      // such errors here.
    }

    return new InternalFireEventResult(true);
  }

  endAttributes(): EndResult {
    if (this.canEnd) {
      return false;
    }

    // We set the canEnd flags true even though we did not end properly. This
    // prevents producing errors about the same attribute multiple times,
    // because end is called by element walkers when leaveStartTag is
    // encountered, and again when the element closes.
    this.canEnd = true;
    this.canEndAttribute = true;

    return [this.seenName ?
            new AttributeValueError("attribute value missing", this.name) :
            new AttributeNameError("attribute missing", this.name)];
  }

  end(): EndResult {
    return false;
  }
}

//  LocalWords:  RNG's MPL RNG attributeName attributeValue ev params
//  LocalWords:  neutralizeAttribute
