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
import * as namePatterns from "../name_patterns";
import { NameResolver } from "../name_resolver";
import { fixPrototype } from "../tools";
import { TrivialMap } from "../types";
import { BasePattern, Define, ElementI, EndResult, Event, EventSet,
         FireEventResult, isHashMap, Pattern, Ref,
         SingleSubwalker } from "./base";

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
  private definitions: TrivialMap<Define> = Object.create(null);
  private _elementDefinitions: undefined;
  private _namespaces: TrivialMap<number> = Object.create(null);
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
      definitions.forEach((x) => {
        this.add(x);
      });
    }
    const missing = this._resolve(this.definitions);

    if (missing !== undefined) {
      throw new RefError(missing);
    }

    this._prepare(this._namespaces);
  }

  /**
   * Adds a definition.
   *
   * @param d The definition to add.
   */
  add(d: Define): void {
    this.definitions[d.name] = d;
    if (d.name === "start") {
      this.start = d;
    }
  }

  /**
   * Populates a memo with a mapping of (element name, [list of patterns]).  In
   * a Relax NG schema, the same element name may appear in multiple contexts,
   * with multiple contents. For instance an element named ``name`` could
   * require the sequence of elements ``firstName, lastName`` in a certain
   * context and text in a different context. This method allows determining
   * whether this happens or not within a pattern.
   *
   * @param memo The memo in which to store the information.
   */
  _gatherElementDefinitions(memo: TrivialMap<ElementI[]>): void {
    // tslint:disable-next-line:forin
    for (const d in this.definitions) {
      this.definitions[d]._gatherElementDefinitions(memo);
    }
  }

  get elementDefinitions(): TrivialMap<ElementI[]> {
    const ret = this._elementDefinitions;
    if (ret !== undefined) {
      return ret;
    }

    const newDef: TrivialMap<ElementI[]> =
      this._elementDefinitions = Object.create(null);
    this._gatherElementDefinitions(newDef);

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
    return Object.keys(this._namespaces);
  }

  /**
   * This method must be called after resolution has been performed.
   *
   * This function now performs two tasks: a) it prepares the attributes
   * (Definition and Element objects maintain a pattern which contains only
   * attribute patterns, and nothing else), b) it gathers all the namespaces
   * seen in the schema.
   *
   * @param namespaces An object whose keys are the namespaces seen in the
   * schema. This method populates the object.
   */
  _prepare(namespaces: TrivialMap<number>): void {
    this.start._prepare(namespaces);
    // tslint:disable-next-line:forin
    for (const d in this.definitions) {
      this.definitions[d]._prepare(namespaces);
    }
  }

  _resolve(definitions: TrivialMap<Define>): Ref[] | undefined {
    let all: Ref[] = [];
    let ret: Ref[] | undefined;

    // tslint:disable-next-line forin
    for (const d in definitions) {
      ret = definitions[d]._resolve(definitions);
      if (ret !== undefined) {
        all = all.concat(ret);
      }
    }

    ret = this.start._resolve(definitions);
    if (ret !== undefined) {
      all = all.concat(ret);
    }

    if (all.length !== 0) {
      return all;
    }

    return undefined;
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
  fireEvent(ev: Event): FireEventResult;
  canEnd(): boolean;
  end(): EndResult;
  _clone(memo: HashMap): IWalker;
  possible(): EventSet;
}

class MisplacedElementWalker implements IWalker {
  private readonly stack: Event[] = [];

  constructor(ev: Event) {
    this.stack.push(ev);
  }

  fireEvent(ev: Event): FireEventResult {
    switch (ev.params[0] as string) {
      case "enterStartTag":
        this.stack.unshift(ev);
        break;
      case "endTag":
        this.stack.shift();
        break;
      default:
    }

    return false;
  }

  canEnd(): boolean {
    return this.stack.length === 0;
  }

  end(): EndResult {
    return false;
  }

  possible(): EventSet {
    return new EventSet();
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
export class GrammarWalker extends SingleSubwalker<Grammar> {
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

  private _prevEvWasText: boolean;

  /**
   * @param el The grammar for which this walker was
   * created.
   */
  protected constructor(walker: GrammarWalker, memo: HashMap);
  protected constructor(el: Grammar);
  protected constructor(elOrWalker: GrammarWalker | Grammar,
                        memo?: HashMap) {
    if (elOrWalker instanceof GrammarWalker) {
      const walker = elOrWalker;
      // tslint:disable-next-line:no-parameter-reassignment
      memo = isHashMap(memo); // Checks for undefined.
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.subwalker = walker.subwalker._clone(memo);
      this._misplacedElements = [];
      const misplacedElements = this._misplacedElements;
      for (const mpe of walker._misplacedElements) {
        misplacedElements.push({
          walker: mpe.walker._clone(memo),
          event: mpe.event,
        });
      }
      this._swallowAttributeValue = walker._swallowAttributeValue;
      this.suspendedWs = walker.suspendedWs;
      this.ignoreNextWs = walker.ignoreNextWs;
      this._prevEvWasText = walker._prevEvWasText;
    }
    else {
      super(elOrWalker);
      this.nameResolver = new NameResolver();
      this._misplacedElements = [];
      this._swallowAttributeValue = false;
      this.ignoreNextWs = false;
      this._prevEvWasText = false;
      this.subwalker = elOrWalker.start.newWalker(this.nameResolver);
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
    let wsErr: FireEventResult = false;
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
        if ((ev.params[1] as string).trim() === "") {
          if (this.suspendedWs !== undefined) {
            this.suspendedWs += ev.params[1];
          }
          else {
            this.suspendedWs = ev.params[1] as string;
          }

          return false;
        }
      default:
    }

    let topMisplacedElement = this._misplacedElements[0];
    // This is the walker we must fire all our events on.
    const walker = topMisplacedElement === undefined ? this.subwalker :
      topMisplacedElement.walker;

    const ignoreNextWsNow = this.ignoreNextWs;
    this.ignoreNextWs = false;
    switch (evName) {
      case "enterStartTag":
        // Absorb the whitespace: poof, gone!
        this.suspendedWs = undefined;
        break;
      case "text":
        if (this._prevEvWasText) {
          throw new Error("fired two text events in a row: this is " +
                          "disallowed by salve");
        }

        if (ignoreNextWsNow) {
          this.suspendedWs = undefined;
          const trimmed = (ev.params[1] as string).replace(/^\s+/, "");
          if (trimmed.length !== (ev.params[1] as string).length) {
            // tslint:disable-next-line:no-parameter-reassignment
            ev = new Event("text", trimmed);
          }
        }
        else if (this.suspendedWs !== undefined && this.suspendedWs !== "") {
          wsErr = walker.fireEvent(new Event("text", this.suspendedWs));
          this.suspendedWs = undefined;
        }
        break;
      case "endTag":
        this.ignoreNextWs = true;
        /* falls through */
      default:
        // Process the whitespace that was suspended.
        if (this.suspendedWs !== undefined && this.suspendedWs !== "" &&
            !ignoreNextWsNow) {
          wsErr = walker.fireEvent(new Event("text", this.suspendedWs));
        }
        this.suspendedWs = undefined;
    }

    // We can update it here because we're done examining the value that was
    // set from the previous call to fireEvent.
    this._prevEvWasText = (evName === "text");

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

    let ret = walker.fireEvent(ev);

    if (ret === undefined) {
      switch (evName) {
        case "enterStartTag":
          const name = new namePatterns.Name("", ev.params[1] as string,
                                             ev.params[2] as string);
          ret = [new ElementNameError("tag not allowed here", name)];

          // Try to infer what element is meant by this errant tag. If we can't
          // find a candidate, then fall back to a dumb mode.
          const candidates = this.el.elementDefinitions[name.toString()];
          if (candidates !== undefined && candidates.length === 1) {
            const newWalker = candidates[0].newWalker(this.nameResolver);
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
            new namePatterns.Name("", ev.params[1] as string,
                                  ev.params[2] as string))];
          break;
        case "attributeName":
          ret = [new AttributeNameError(
            "attribute not allowed here",
            new namePatterns.Name("", ev.params[1] as string,
                                  ev.params[2] as string))];
          this._swallowAttributeValue = true;
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

    // The top may have changed.
    topMisplacedElement = this._misplacedElements[0];
    // Check whether the context should end
    if (topMisplacedElement !== undefined &&
        topMisplacedElement.walker.canEnd()) {
      const endRet = topMisplacedElement.walker.end();
      if (endRet) {
        ret = ret ? ret.concat(endRet) : endRet;
      }

      // When we drop a context from this._misplacedElements, we have to issue
      // an "endTag" event on the walker (if any!) that was in effect when the
      // context was added to this._misplacedElements. The endTag event
      // corresponds to the enterStartTag event that was issued for the
      // misplaced element.
      const startEvent = topMisplacedElement.event;
      this._misplacedElements.shift();
      topMisplacedElement = this._misplacedElements[0];
      const previousWalker = (topMisplacedElement === undefined) ?
        this.subwalker : topMisplacedElement.walker;

      previousWalker.fireEvent(new Event("endTag",
                                    startEvent.params[1],
                                    startEvent.params[2]));
    }

    if (wsErr === undefined) {
      wsErr = [new ValidationError("text not allowed here")];
    }
    else if (wsErr === false) {
      return ret;
    }

    return ret === false ? wsErr : wsErr.concat(ret);
  }

  possible(): EventSet {
    if (this._misplacedElements.length !== 0) {
      const mpe = this._misplacedElements[0];

      // Return an empty set if the tags are unknown to us.
      return mpe.walker.possible();
    }

    // There's no point in calling this._possible.
    return this.subwalker.possible();
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
