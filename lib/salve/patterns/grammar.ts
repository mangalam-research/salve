/**
 * Pattern and walker for RNG's ``grammar`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { EName } from "../ename";
import { AttributeNameError, ElementNameError,
         ValidationError } from "../errors";
import { HashMap } from "../hashstructs";
import { Name } from "../name_patterns";
import { NameResolver } from "../name_resolver";
import { filter, union } from "../set";
import { fixPrototype } from "../tools";
import { TrivialMap } from "../types";
import { BasePattern, EndResult, Event, EventSet, FireEventResult,
         InternalFireEventResult, InternalWalker, makeEventSet, Pattern,
         Walker } from "./base";
import { Define } from "./define";
import { Element } from "./element";
import { Ref, RefWalker } from "./ref";

/**
 * This is an exception raised to indicate references to undefined entities in a
 * schema. If for instance element A has element B as its children but B is not
 * defined, then this exception would be raised.
 *
 * This exception is indicative of an internal error because by the time this
 * module loads a schema, the schema should have been simplified already and
 * simplification should have failed due to the unresolvable reference.
 *
 * This class used to be named ``ReferenceError`` in previous versions of salve
 * but this name clashes with the built-in ``ReferenceError`` that JavaScript
 * engines have built into their runtime. The clash did not make the code fail
 * but it had unfortunate side-effects.
 */
export class RefError extends Error {
  /**
   * @param references The set of references that could not be resolved.
   */
  constructor(readonly references: Ref[]) {
    super();
    fixPrototype(this, RefError);
  }

  /**
   * @returns string representation of the error.
   */
  toString(): string {
    return (
      `Cannot resolve the following references: ${this.references.join(", ")}`);
  }
}

/**
 * Grammar object. Users of this library normally do not create objects of this
 * class themselves but rely on the conversion facilities of salve to create
 * these objects.
 */
export class Grammar extends BasePattern {
  private definitions: Map<string, Define> = new Map();
  private _elementDefinitions: TrivialMap<Element[]>;
  private _namespaces: Set<string> = new Set();
  /**
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param start The start pattern of this grammar.
   *
   * @param definitions An array which contain all definitions specified in this
   * grammar.
   *
   * @throws {RefError} When any definition in the original
   * schema refers to a schema entity which is not defined in the schema.
   */
  constructor(public xmlPath: string, public start: Pattern,
              definitions?: Define[]) {
    super(xmlPath);
    if (definitions !== undefined) {
      for (const def of definitions) {
        this.add(def);
      }
    }

    const missing = this._prepare(this.definitions, this._namespaces);
    if (missing !== undefined) {
      throw new RefError(missing);
    }
  }

  /**
   * Adds a definition.
   *
   * @param d The definition to add.
   */
  add(d: Define): void {
    this.definitions.set(d.name, d);
  }

  get elementDefinitions(): TrivialMap<Element[]> {
    const ret = this._elementDefinitions;
    if (ret !== undefined) {
      return ret;
    }

    const newDef: TrivialMap<Element[]> =
      this._elementDefinitions = Object.create(null);

    for (const def of this.definitions.values()) {
      const el = def.pat;
      const key = el.name.toString();
      if (newDef[key] === undefined) {
        newDef[key] = [el];
      }
      else {
        newDef[key].push(el);
      }
    }

    return newDef;
  }

  /**
   * @returns ``true`` if the schema is wholly context independent. This means
   * that each element in the schema can be validated purely on the basis of
   * knowing its expanded name. ``false`` otherwise.
   */
  whollyContextIndependent(): boolean {
    const defs = this.elementDefinitions;
    for (const v in defs) {
      if (defs[v].length > 1) {
        return false;
      }
    }

    return true;
  }

  /**
   * @returns An array of all namespaces used in the schema.  The array may
   * contain two special values: ``*`` indicates that there was an ``anyName``
   * element in the schema and thus that it is probably possible to insert more
   * than the namespaces listed in the array, ``::except`` indicates that an
   * ``except`` element is affecting what namespaces are acceptable to the
   * schema.
   */
  getNamespaces(): string[] {
    return Array.from(this._namespaces);
  }

  _prepare(definitions: Map<string, Define>,
           namespaces: Set<string>): Ref[] | undefined {
    let allRefs: Ref[] = [];
    const startRefs = this.start._prepare(definitions, namespaces);
    if (startRefs !== undefined) {
      allRefs = startRefs;
    }

    for (const d of this.definitions.values()) {
      const defRefs = d._prepare(definitions, namespaces);
      if (defRefs !== undefined) {
        allRefs = allRefs.concat(defRefs);
      }
    }

    return (allRefs.length !== 0) ? allRefs : undefined;
  }

  /**
   * Creates a new walker to walk this pattern.
   *
   * @returns A walker.
   */
  newWalker(): GrammarWalker {
    // tslint:disable-next-line:no-use-before-declare
    return GrammarWalker.makeWalker(this);
  }
}

interface IWalker {
  fireEvent(ev: Event): InternalFireEventResult;
  canEnd: boolean;
  canEndAttribute: boolean;
  end(): EndResult;
  _clone(memo: HashMap): IWalker;
  possible(): EventSet;
}

class MisplacedElementWalker implements IWalker {
  private readonly stack: Event[] = [];
  canEnd: boolean = false;
  canEndAttribute: boolean = false;

  constructor(ev: Event) {
    this.stack.push(ev);
  }

  fireEvent(ev: Event): InternalFireEventResult {
    switch (ev.params[0] as string) {
      case "enterStartTag":
      case "startTagAndAttributes":
        this.stack.unshift(ev);
        break;
      case "endTag":
        this.stack.shift();
        this.canEndAttribute = this.canEnd = this.stack.length === 0;
        break;
      default:
    }

    return false;
  }

  end(): EndResult {
    return false;
  }

  possible(): EventSet {
    return makeEventSet();
  }

  _clone<T extends this>(this: T, memo: HashMap): T {
    const clone =
      new (this.constructor as { new (...args: any[]): T })(this.stack[0]);
    // We don't need to do more than this. And we don't need to mess with the
    // memo, as walkers don't engage in circular references.
    (clone as any).stack = this.stack.concat([]);

    return clone;
  }
}

interface MisplacedElementStub {
  walker: IWalker;
  event: Event;
}

/**
 * Walker for [[Grammar]].
 */
export class GrammarWalker extends Walker<Grammar> {
  private readonly nameResolver: NameResolver;

  // A stack that keeps state for misplace elements. The elements of this
  // stack are either Array or Walker objects. They are arrays when we are
  // dealing with an element which is unknown to the schema (or which
  // cannot be unambiguously determined. They are Walker objects when we
  // can find a definition in the schema.
  private readonly _misplacedElements: MisplacedElementStub[];

  private _swallowAttributeValue: boolean;

  private suspendedWs: string | undefined;

  private ignoreNextWs: boolean;

  private elementWalkerStack: InternalWalker<BasePattern>[][];

  /**
   * @param el The grammar for which this walker was
   * created.
   */
  protected constructor(walker: GrammarWalker, memo: HashMap);
  protected constructor(el: Grammar);
  protected constructor(elOrWalker: GrammarWalker | Grammar,
                        memo?: HashMap) {
    if ((elOrWalker as Grammar).newWalker !== undefined) {
      const grammar = elOrWalker as Grammar;
      super(grammar);
      this.nameResolver = new NameResolver();
      this._misplacedElements = [];
      this._swallowAttributeValue = false;
      this.ignoreNextWs = false;
      this.elementWalkerStack = [[grammar.start.newWalker(this.nameResolver)]];
    }
    else {
      const walker = elOrWalker as GrammarWalker;
      // tslint:disable-next-line:no-non-null-assertion
      super(walker, memo!);
      // tslint:disable-next-line:no-non-null-assertion
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo!);
      this.elementWalkerStack = walker.elementWalkerStack
      // tslint:disable-next-line:no-non-null-assertion
        .map((walkers) => walkers.map((x) => x._clone(memo!)));
      this._misplacedElements = [];
      const misplacedElements = this._misplacedElements;
      for (const mpe of walker._misplacedElements) {
        misplacedElements.push({
          // tslint:disable-next-line:no-non-null-assertion
          walker: mpe.walker._clone(memo!),
          event: mpe.event,
        });
      }
      this._swallowAttributeValue = walker._swallowAttributeValue;
      this.suspendedWs = walker.suspendedWs;
      this.ignoreNextWs = walker.ignoreNextWs;
    }
  }

  static makeWalker(el: Grammar): GrammarWalker {
    return new GrammarWalker(el);
  }

  /**
   * Resolves a name using the walker's own name resolver.
   *
   * @param name A qualified name.
   *
   * @param attribute Whether this qualified name refers to an attribute.
   *
   * @returns An expanded name, or undefined if the name cannot be resolved.
   */
  resolveName(name: string, attribute: boolean): EName | undefined {
    return this.nameResolver.resolveName(name, attribute);
  }

  /**
   * See [["name_resolver".NameResolver.unresolveName]].
   *
   * @param uri The URI part of the expanded name.
   *
   * @param name The name part.
   *
   * @returns The qualified name that corresponds to the expanded name, or
   * ``undefined`` if it cannot be resolved.
   */
  unresolveName(uri: string, name: string): string | undefined {
    return this.nameResolver.unresolveName(uri, name);
  }

  /**
   * On a [[GrammarWalker]] this method cannot return ``undefined``. An
   * undefined value would mean nothing matched, which is a validation error.
   *
   * @param ev The event to fire.
   *
   * @returns ``false`` if there is no error or an array errors.
   *
   * @throws {Error} When name resolving events (``enterContext``,
   * ``leaveContext``, or ``definePrefix``) are passed while this walker was not
   * instructed to create its own name resolver or when trying to process an
   * event type unknown to salve.
   */
  // tslint:disable-next-line: max-func-body-length
  fireEvent(ev: Event): FireEventResult {
    const evName = ev.params[0];
    switch (evName) {
      case "enterContext":
        this.nameResolver.enterContext();

        return false;
      case "leaveContext":
        this.nameResolver.leaveContext();

        return false;
      case "definePrefix":
        this.nameResolver.definePrefix(ev.params[1] as string,
                                       ev.params[2] as string);

        return false;
      case "text":
        // Process whitespace nodes
        const text = ev.params[1] as string;
        if (text === "") {
          throw new Error("firing empty text events makes no sense");
        }

        if (!/\S/.test(text)) {
          // We don't check the old value of suspendedWs because salve does not
          // allow two text events in a row. So we should never have to
          // concatenate values.
          this.suspendedWs = text;

          return false;
        }
      default:
    }

    // Whitespaces are problematic from a validation perspective. On the one
    // hand, if an element may contain only other elements and no text, then XML
    // allows putting whitespace between the elements. That whitespace must not
    // cause a validation error. When mixed content is possible, everywhere
    // where text is allowed, a text of length 0 is possible. (``<text/>`` does
    // not allow specifying a pattern or minimum length. And Relax NG
    // constraints do not allow having an element whose content is a mixture of
    // ``element`` and ``data`` and ``value`` that would constrain specific text
    // patterns between the elements.) We can satisfy all situations by dropping
    // text events that contain only whitespace.
    //
    // The only case where we'd want to pass a node consisting entirely of
    // whitespace is to satisfy a data or value pattern because they can require
    // a sequence of whitespaces.
    let wsErr: FireEventResult = false;
    const ignoreNextWsNow = this.ignoreNextWs;
    this.ignoreNextWs = false;
    switch (evName) {
      case "enterStartTag":
      case "startTagAndAttributes":
        break;
      case "endTag":
        this.ignoreNextWs = true;
        /* falls through */
      default:
        if (!ignoreNextWsNow && this.suspendedWs !== undefined) {
          const textEvent = new Event("text", this.suspendedWs);
          // Casting is safe here because text events cannot return
          // elements.
          wsErr = this._fireOnCurrentWalkers(textEvent) as FireEventResult;
        }
    }
    // Absorb the whitespace: poof, gone!
    this.suspendedWs = undefined;

    // This would happen if the user puts an attribute on a tag that does not
    // allow one. Instead of generating errors for both the attribute name
    // and value, we generate an error for the name and ignore the value.
    if (this._swallowAttributeValue) {
      // Swallow only one event.
      this._swallowAttributeValue = false;
      if (evName === "attributeValue") {
        return false;
      }

      return [new ValidationError("attribute value required")];
    }

    let ret = this._fireOnCurrentWalkers(ev);

    if (ret === undefined) {
      switch (evName) {
        case "enterStartTag":
        case "startTagAndAttributes":
          const name = new Name("", ev.params[1] as string,
                                ev.params[2] as string);
          ret = [new ElementNameError(
            evName === "enterStartTag" ?
              "tag not allowed here" :
              "tag not allowed here with these attributes", name)];

          // Try to infer what element is meant by this errant tag. If we can't
          // find a candidate, then fall back to a dumb mode.
          const candidates = this.el.elementDefinitions[name.toString()];
          if (candidates !== undefined && candidates.length === 1) {
            const newWalker = candidates[0].newWalker(this.nameResolver, name);
            this._misplacedElements.unshift({ walker: newWalker, event: ev });
            if (newWalker.fireEvent(ev) !== false) {
              throw new Error("internal error: the inferred element " +
                              "does not accept its initial event");
            }
          }
          else {
            // Dumb mode...
            this._misplacedElements.unshift({
              walker: new MisplacedElementWalker(ev),
              event: ev,
            });
          }
          break;
        case "endTag":
          ret = [new ElementNameError(
            "unexpected end tag",
            new Name("", ev.params[1] as string, ev.params[2] as string))];
          break;
        case "attributeName":
          ret = [new AttributeNameError(
            "attribute not allowed here",
            new Name("", ev.params[1] as string, ev.params[2] as string))];
          this._swallowAttributeValue = true;
          break;
        case "attributeNameAndValue":
          ret = [new AttributeNameError(
            "attribute not allowed here",
            new Name("", ev.params[1] as string, ev.params[2] as string))];
          break;
        case "attributeValue":
          ret = [new ValidationError("unexpected attributeValue event; it \
is likely that fireEvent is incorrectly called")];
          break;
        case "text":
          ret = [new ValidationError("text not allowed here")];
          break;
        case "leaveStartTag":
          // If the _misplacedElements stack did not exist then we would get
          // here if a file being validated contains a tag which is not
          // allowed. An ElementNameError will already have been issued. So
          // rather than violate our contract (which says no undefined value may
          // be returned) or require that callers do something special with
          // 'undefined' as a return value, just treat this event as a
          // non-error.
          //
          // But the stack exists, so we cannot get here. If we do end up here,
          // then there is an internal error somewhere.
          /* falls through */
        default:
          throw new Error(`unexpected event type in GrammarWalker's fireEvent: \
${evName.toString()}`);
      }
    }

    const errors: ValidationError[] = [];
    if (ret instanceof Array) {
      const newWalkers: InternalWalker<BasePattern>[] = [];
      let boundName: Name | undefined;
      for (const item of ret) {
        if (item instanceof ValidationError) {
          errors.push(item);
        }
        else {
          if (boundName === undefined) {
            boundName = new Name("", ev.params[1] as string,
                                 ev.params[2] as string);
          }

          const walker = item.element.newWalker(this.nameResolver,
                                                boundName);
          // If we get anything else than false here, the internal logic is
          // wrong.
          if (walker.fireEvent(ev) !== false) {
            throw new Error("got on error or failed to match on a new element \
walker: the internal logic is incorrect");
          }
          newWalkers.push(walker);
        }
      }

      if (newWalkers.length !== 0) {
        this.elementWalkerStack.unshift(newWalkers);
      }
    }

    let finalResult = errors.length !== 0 ? errors : false;

    if (evName === "endTag") {
      const topMisplacedElement = this._misplacedElements[0];
      // Check whether the context should end
      if (topMisplacedElement !== undefined) {
        if (topMisplacedElement.walker.canEnd) {
          const endRet = topMisplacedElement.walker.end();
          if (endRet) {
            finalResult = finalResult ? finalResult.concat(endRet) : endRet;
          }

          // When we drop a context from this._misplacedElements, we have to
          // issue an "endTag" event on the walker (if any!) that was in effect
          // when the context was added to this._misplacedElements. The endTag
          // event corresponds to the enterStartTag event that was issued for
          // the misplaced element.
          const startEvent = topMisplacedElement.event;
          this._misplacedElements.shift();
          this._fireOnCurrentWalkers(new Event("endTag",
                                               startEvent.params[1],
                                               startEvent.params[2]));
        }
      }
      else {
        // We do not need to end the walkers because the fireEvent handler
        // for elements calls end when it sees an "endTag" event.
        // We do not reduce the stack to nothing.
        if (this.elementWalkerStack.length > 1) {
          this.elementWalkerStack.shift();
        }
      }
    }

    if (wsErr === undefined) {
      // If we have another error, we don't want to make an issue that text
      // was not matched. Otherwise, we want to alert the user.
      wsErr = !finalResult ?
        [new ValidationError("text not allowed here")] : [];
    }
    else if (wsErr === false) {
      return finalResult;
    }

    return !finalResult ? wsErr : wsErr.concat(finalResult);
  }

  private _fireOnCurrentWalkers(ev: Event): InternalFireEventResult {
    const topMisplacedElement = this._misplacedElements[0];
    // This is the walker we must fire all our events on.
    const walkers = topMisplacedElement === undefined ?
      this.elementWalkerStack[0] :
      [topMisplacedElement.walker];

    if (walkers.length === 0) {
      return undefined;
    }

    // We want noMatch true if none of the walkers matched.
    let noMatch = true;
    let arr: (ValidationError | RefWalker)[] = [];
    const remainingWalkers: IWalker[] = [];
    for (const walker of walkers) {
      const result = walker.fireEvent(ev);
      // We immediately filter out results that report a match (i.e. false).
      if (result !== undefined) {
        noMatch = false;
        if (result !== false) {
          // There's no point in recording errors if we're going to toss them
          // anyway.
          if (remainingWalkers.length === 0) {
            arr = arr.concat(result);
          }
        }
        else {
          remainingWalkers.push(walker);
        }
      }
    }

    // We don't remove all walkers. If some walkers were successful and some
    // were not, then we just keep the successful ones. But removing all walkers
    // at once prevents us from giving useful error messages.
    if (remainingWalkers.length !== 0) {
      // Yes, we modify the array in-place.
      walkers.splice(0, walkers.length, ...remainingWalkers);

      // If some of the walkers matched, we ignore the errors from the other
      // walkers.
      return false;
    }

    if (noMatch) {
      return undefined;
    }

    return (arr.length !== 0) ? arr : false;
  }

  canEnd(attribute: boolean = false): boolean {
    const top = this.elementWalkerStack[0];

    return this.elementWalkerStack.length === 1 &&
      top.length > 0 && ((attribute && top[0].canEndAttribute) ||
                         (!attribute && top[0].canEnd));
  }

  end(attribute: boolean = false): EndResult {
    if (this.elementWalkerStack.length < 1) {
      throw new Error("stack underflow");
    }

    let finalResult: ValidationError[] = [];
    for (const stackElement of this.elementWalkerStack) {
      for (const walker of stackElement) {
        const result = walker.end(attribute);
        if (result) {
          finalResult = finalResult.concat(result);
        }
      }
    }

    return finalResult.length !== 0 ? finalResult : false;
  }

  _possible(): EventSet {
    if (this._misplacedElements.length !== 0) {
      const mpe = this._misplacedElements[0];

      // Return an empty set if the tags are unknown to us.
      return mpe.walker.possible();
    }

    let possible = makeEventSet();
    for (const walker of this.elementWalkerStack[0]) {
      union(possible, walker._possible());
    }

    // If we have any attributeValue possible, then the only possible
    // events are attributeValue events.
    if (possible.size !== 0) {
      const valueEvs =
        filter(possible, (poss: Event) => poss.params[0] === "attributeValue");

      if (valueEvs.size !== 0) {
        possible = valueEvs;
      }
    }

    return possible;
  }

  possible(): EventSet {
    return this._possible();
  }

  _suppressAttributes(): void {
    throw new Error("_suppressAttributes cannot be called on a GrammarWalker");
  }
}

// Nope, we're using a custom function.
// addWalker(Grammar, GrammarWalker);

//  LocalWords:  RNG's MPL unresolvable runtime RNG NG firstName enterContext
//  LocalWords:  leaveContext definePrefix whitespace enterStartTag endTag
//  LocalWords:  fireEvent attributeValue attributeName leaveStartTag addWalker
//  LocalWords:  misplacedElements ElementNameError GrammarWalker's
//  LocalWords:  suppressAttributes GrammarWalker
