/**
 * Classes that model RNG patterns.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { ValidationError } from "../errors";
import { HashMap } from "../hashstructs";
import { ConcreteName } from "../name_patterns";
import { NameResolver } from "../name_resolver";
import { NaiveSet } from "../set";
import { TrivialMap } from "../types";
import * as util from "../util";
import { Define } from "./define";
import { Element } from "./element";
import { Ref, RefWalker } from "./ref";

// XML validation against a schema could work without any lookahead if it were
// not for namespaces. However, namespace support means that the interpretation
// of a tag or of an attribute may depend on information which appears *later*
// than the earliest time at which a validation decision might be called for:
//
// Consider:
//    <elephant a="a" b="b"... xmlns="elephant_uri"/>
//
// It is not until xmlns is encountered that the validator will know that
// elephant belongs to the elephant_uri namespace. This is not too troubling for
// a validator that can access the whole document but for validators used in a
// line-by-line process (which is the case if the validator is driven by a
// CodeMirror or Ace tokenizer, and anything based on them), this can be
// problematic because the attributes could appear on lines other than the line
// on which the start of the tag appears:
//
// <elephant
//  a="a"
//  b="b"
//  xmlns="elephant_uri"/>
//
// The validator encounters the start of the tag and the attributes, without
// knowing that eventually this elephant tag belongs to the elephant_uri
// namespace. This discovery might result in things that were seen previously
// and deemed valid becoming invalid. Or things that were invalid becoming
// valid.
//
// Handling namespaces will require lookahead. Although the validator would
// still expect all events that have tag and attribute names to have a proper
// namespace uri, upon ``enterStartTag`` the parsing code which feeds events to
// the validator would look ahead for these cases:
//
// * There is a valid ``>`` character ending the start tag. Scan the start tag
//   for all namespace declarations.
//
// * The tag ends at EOF. Scan from beginning of tag to EOF for namespace
//   declarations.
//
// * The tag is terminated by an invalid token. Scan from beginning of tag to
//   error.
//
// Then issue the enterStartTag and attributeName events on the basis of what
// was found in scanning.
//
// When the parsing code discovers a change in namespace declarations, for
// instance because the user typed xmlns="..." or removed a declaration, the
// parsing code must *restart* validation *from* the location of the original
// enterStartTag event.

const DEBUG: boolean = false;

// This is here to shut the compiler up about unused variables.
/* tslint:disable: no-empty no-invalid-this */
function noop(..._args: any[]): void {}

// tslint:disable-next-line:strict-boolean-expressions
if (DEBUG) {
  //
  // Debugging utilities
  //

  const trace: (msg: any) => void = (msg: string) => {
    console.log(msg); // tslint:disable-line:no-console
  };

  const stackTrace: () => void = () => {
    trace(new Error().stack);
  };
  noop(stackTrace);

  // tslint:disable:no-var-keyword
  var possibleTracer: (oldMethod: Function, name: string, args: any[]) => any;
  var fireEventTracer: (oldMethod: Function, name: string, args: any[]) => any;
  var plainTracer: (oldMethod: Function, name: string, args: any[]) => any;
  var callDump: (msg: string, name: string, me: any) => void;
  // tslint:enable:no-var-keyword

  // tslint:disable-next-line:only-arrow-functions no-void-expression
  (function buildTracingCode(): void {
    let buf: string = "";
    const step: string = " ";

    const nameOrPath: (walker: any) => string = (walker: any) => {
      const el = walker.el;

      if (el == null) {
        return "";
      }

      if (el.name === undefined) {
        return ` with path ${el.xmlPath}`;
      }

      const named: string = ` named ${el.name.toString()}`;
      if (walker.boundName == null) {
        return named;
      }

      return `${named} (bound to ${walker.boundName.toString()})`;
    };

    callDump = (msg: string, name: string, me: any) => {
      trace(`${buf}${msg}${name} on class ${me.constructor.name}` +
            ` id ${me.id}${nameOrPath(me)}`);
    };

    // tslint:disable-next-line:only-arrow-functions
    possibleTracer = function _possibleTracer(this: any,
                                              oldMethod: Function, name: string,
                                              args: any[]): any {
      buf += step;
      callDump("calling ", name, this);
      const ret: any = oldMethod.apply(this, args);
      callDump("called ", name, this);
      trace(`${buf}return from the call: ${util.inspect(ret)}`);
      buf = buf.slice(step.length);

      return ret;
    };

    // tslint:disable-next-line:only-arrow-functions
    fireEventTracer = function _fireEventTracer(this: any,
                                                oldMethod: Function,
                                                name: string,
                                                args: any[]): any {
      buf += step;
      callDump("calling ", name, this);
      trace(buf + util.inspect(args[0]));

      const ret: any = oldMethod.apply(this, args);
      callDump("called ", name, this);
      if (ret !== false) {
        trace(`${buf}return from the call: ${util.inspect(ret)}`);
      }
      buf = buf.slice(step.length);

      return ret;
    };

    // tslint:disable-next-line:only-arrow-functions
    plainTracer = function _plainTracer(this: any,
                                        oldMethod: Function, name: string,
                                        args: any[]): any {
      buf += step;
      callDump("calling ", name, this);

      const ret: any = oldMethod.apply(this, args);
      callDump("called ", name, this);
      trace(`${buf}return from the call: ${util.inspect(ret)}`);
      buf = buf.slice(step.length);

      return ret;
    };
  }());

  /**
   * Utility function for debugging. Wraps ``me[name]`` in a wrapper
   * function. ``me[name]`` must be a function.  ``me`` could be an instance or
   * could be a prototype. This function cannot trivially wrap the same field on
   * the same object twice.
   *
   * @private
   * @param me The object to modify.
   * @param name The field name to modify in the object.
   * @param f The function that should serve as wrapper.
   *
   */
  // tslint:disable-next-line:only-arrow-functions no-var-keyword prefer-const
  var wrap: (me: any, name: string, f: Function) => void =
    (me: any, name: string, f: Function) => {
      const mangledName: string = `___${name}`;
      me[mangledName] = me[name];
      // tslint:disable-next-line:only-arrow-functions
      me[name] = function wrapper(this: any): any {
        return f.call(this, me[mangledName], name, arguments);
      };
    };
  noop(wrap);
  /* tslint:enable */
}

/**
 * Sets up a ``newWalker`` method in a prototype.
 *
 * @private
 * @param elCls The class that will get the new method.
 * @param walkerCls The Walker class to instantiate.
 */
/* tslint:disable: no-invalid-this */
export function addWalker<T>(elCls: any, walkerCls: any): void {
  // `resolver` is a NameResolver.
  // tslint:disable-next-line:only-arrow-functions
  elCls.prototype.newWalker = function newWalker(this: any,
                                                 resolver: NameResolver): T {
    return new walkerCls(this, resolver) as T;
  };
}
/* tslint:enable */

export class EventSet extends NaiveSet<Event>{}

interface Hashable {
  hash(): any;
}

export interface Clonable {
  clone(): this;
}

/**
 * Calls the ``hash()`` method on the object passed to it.
 *
 * @private
 * @param o An object that implements ``hash()``.
 * @returns The return value of ``hash()``.
 */
function hashHelper(o: Hashable): any {
  return o.hash();
}

export type FireEventResult = false | undefined | ValidationError[];
export type InternalFireEventResult = false | undefined |
  (ValidationError | RefWalker)[];
export type EndResult = false | ValidationError[];

export function matched(result: InternalFireEventResult):
result is (false |  (ValidationError | RefWalker)[]) {
  if (result === undefined) {
    return false;
  }

  if (result === false) {
    return true;
  }

  for (const x of result) {
    // Any ElementI present in the array means there was a match.
    if (!(x instanceof ValidationError)) {
      return true;
    }
  }

  return false;
}

/**
 * These patterns form a JavaScript representation of the simplified RNG
 * tree. The base class implements a leaf in the RNG tree. In other words, it
 * does not itself refer to children Patterns. (To put it in other words, it has
 * no subpatterns.)
 */
export class BasePattern {
  /**
   * The next id to associate to the next Pattern object to be created. This is
   * used so that [[hash]] can return unique values.
   */
  private static __id: number = 0; // tslint:disable-line:variable-name

  readonly id: string;
  readonly xmlPath: string;

  /**
   * @param xmlPath This is a string which uniquely identifies the element from
   * the simplified RNG tree. Used in debugging.
   */
  constructor(xmlPath: string) {
    this.id = `P${this.__newID()}`;
    this.xmlPath = xmlPath;
  }

  /**
   * This method is mainly used to be able to use these objects in a
   * [["hashstructs".HashSet]] or a [["hashstructs".HashMap]].
   *
   * Returns a hash guaranteed to be unique to this object. There are some
   * limitations. First, if this module is instantiated twice, the objects
   * created by the two instances cannot mix without violating the uniqueness
   * guarantee. Second, the hash is a monotonically increasing counter, so when
   * it reaches beyond the maximum integer that the JavaScript vm can handle,
   * things go kaboom. Third, this hash is meant to work within salve only.
   *
   * @returns A hash unique to this object.
   */
  hash(): string {
    return this.id;
  }

  /**
   * Resolve references to definitions.
   *
   * @param definitions The definitions that exist in this grammar.
   *
   * @returns The references that cannot be resolved, or ``undefined`` if no
   * references cannot be resolved. The caller is free to modify the value
   * returned as needed.
   */
  _resolve(definitions: TrivialMap<Define>): Ref[] | undefined {
    return undefined;
  }

  /**
   * This method must be called after resolution has been performed.
   * ``_prepare`` recursively calls children but does not traverse ref-define
   * boundaries to avoid infinite regress...
   *
   * This function now performs two tasks: a) it precomputes the values returned
   * by ``hasAttr`` (it can be computed once and for all), b) it gathers all the
   * namespaces seen in the schema.
   *
   * @param namespaces An object whose keys are the namespaces seen in
   * the schema. This method populates the object.
   *
   */
  _prepare(namespaces: TrivialMap<number>): void {
    // nothing here
  }

  /**
   * This method tests whether a pattern is an attribute pattern or contains
   * attribute patterns. This method does not cross element boundaries. That is,
   * if element X cannot have attributes of its own but can contain elements
   * that can have attributes, the return value if this method is called on the
   * pattern contained by element X's pattern will be ``false``.
   *
   * @returns True if the pattern is or has attributes. False if not.
   */
  _hasAttrs(): boolean {
    return false;
  }

  /**
   * Gets a new Pattern id.
   *
   * @returns The new id.
   */
  private __newID(): number {
    return BasePattern.__id++;
  }
}

/**
 * This is the common class from which patterns are derived. Most patterns
 * create a new walker by passing a name resolver. The one exception is
 * [[Grammar]], which creates the name resolver that are used by other
 * patterns. So when calling it we do not need a ``resolver`` parameter and thus
 * it inherits from [[BasePattern]] rather than [[Pattern]].
 */
export abstract class Pattern extends BasePattern {
  /**
   * Creates a new walker to walk this pattern.
   *
   * @returns A walker.
   */
  newWalker(resolver: NameResolver): InternalWalker<BasePattern> {
    throw new Error("derived classes must override this");
  }
}

/**
 * Pattern objects of this class have exactly one child pattern.
 */
export abstract class OneSubpattern<T extends (Pattern | Element) = Pattern>
  extends Pattern {
  protected _cachedHasAttr?: boolean;

  constructor(xmlPath: string, readonly pat: T) {
    super(xmlPath);
  }

  _resolve(definitions: TrivialMap<Define>): Ref[] | undefined {
    return this.pat._resolve(definitions);
  }

  _prepare(namespaces: TrivialMap<number>): void {
    this.pat._prepare(namespaces);
    this._cachedHasAttr = this.pat._hasAttrs();
  }

  _hasAttrs(): boolean {
    // tslint:disable-next-line:no-non-null-assertion
    return this._cachedHasAttr!;
  }
}

/**
 * Pattern objects of this class have exactly two child patterns.
 *
 */
export class TwoSubpatterns extends Pattern {
  protected _cachedHasAttr?: boolean;

  constructor(xmlPath: string, readonly patA: Pattern, readonly patB: Pattern) {
    super(xmlPath);
  }

  _resolve(definitions: TrivialMap<Define>): Ref[] | undefined {
    const a: Ref[] | undefined = this.patA._resolve(definitions);
    const b: Ref[] | undefined = this.patB._resolve(definitions);
    if (a !== undefined && b !== undefined) {
      return a.concat(b);
    }

    if (a !== undefined) {
      return a;
    }

    return b;
  }

  _prepare(namespaces: TrivialMap<number>): void {
    this.patA._prepare(namespaces);
    this.patB._prepare(namespaces);
    this._cachedHasAttr = this.patA._hasAttrs() || this.patB._hasAttrs();
  }

  _hasAttrs(): boolean {
    // tslint:disable-next-line:no-non-null-assertion
    return this._cachedHasAttr!;
  }
}

/**
 * This class models events occurring during parsing. Upon encountering the
 * start of a start tag, an "enterStartTag" event is generated, etc. Event
 * objects are held to be immutable. No precautions have been made to enforce
 * this. Users of these objects simply must not modify them. Moreover, there is
 * one and only one of each event created.
 *
 * An event is made of a list of event parameters, with the first one being the
 * type of the event and the rest of the list varying depending on this type.
 *
 */
export class Event {
  /**
   * The cache of Event objects. So that we create one and only one Event object
   * per run.
   */
  // tslint:disable-next-line:variable-name
  private static __cache: {[key: string]: Event} = Object.create(null);

  readonly params: (string|ConcreteName)[];

  /**
   * Is this Event an attribute event?
   */
  readonly isAttributeEvent: boolean;
  // This field is never read but we still want it present on the object so that
  // we can use it for diagnosis.
  // @ts-ignore
  private readonly key: string;

  /**
   * @param args... The event parameters may be passed directly in the call
   * ``(new Event(a, b, ...))`` or the first call parameter may be a list
   * containing all the event parameters ``(new Event([a, b, ])``. All of the
   * event parameters must be strings.
   */
  constructor(...args: any[]) {
    const params: (string|ConcreteName)[] =
      (args.length === 1 && args[0] instanceof Array) ? args[0] : args;

    const key: string = params.join();

    // Ensure we have only one of each event created.
    const cached: Event | undefined = Event.__cache[key];
    if (cached !== undefined) {
      return cached;
    }

    this.params = params;
    this.key = key;
    this.isAttributeEvent = (this.params[0] === "attributeName" ||
                             this.params[0] === "attributeValue" ||
                             this.params[0] === "attributeNameAndValue");

    Event.__cache[key] = this;

    return this;
  }

  /**
   * @returns A string representation of the event.
   */
  toString(): string {
    return `Event: ${this.params.join(", ")}`;
  }
}

/**
 * Utility function used mainly in testing to transform a [["set".NaiveSet]] of
 * events into a string containing a tree structure.  The principle is to
 * combine events of a same type together and among events of a same type
 * combine those which are in the same namespace. So for instance if there is a
 * set of events that are all attributeName events plus one ``leaveStartTag``
 * event, the output could be:
 *
 * <pre>``
 * attributeName:
 * ..uri A:
 * ....name 1
 * ....name 2
 * ..uri B:
 * ....name 3
 * ....name 4
 * leaveStartTag
 * ``</pre>
 *
 * The dots above are to represent more visually the indentation. Actual output
 * does not contain leading dots.  In this list there are two attributeName
 * events in the "uri A" namespace and two in the "uri B" namespace.
 *
 * @param evs Events to turn into a string.
 * @returns A string which contains the tree described above.
 */
export function eventsToTreeString(evs: Event[] | EventSet): string {
  function hashF(x: any): any {
    return x;
  }

  const eventArray = (evs instanceof EventSet) ? evs.toArray() : evs;

  const hash: HashMap = new HashMap(hashF);
  eventArray.forEach((ev: Event) => {
    const params: (string|ConcreteName)[] = ev.params;

    let node: HashMap = hash;
    for (let i: number = 0; i < params.length; ++i) {
      if (i === params.length - 1) {
        // Our HashSet/Map cannot deal with undefined values. So we mark
        // leaf elements with the value false.
        node.add(params[i], false);
      }
      else {
        let nextNode: HashMap | undefined = node.has(params[i]);
        if (nextNode === undefined) {
          nextNode = new HashMap(hashF);
          node.add(params[i], nextNode);
        }
        node = nextNode;
      }
    }
  });

  // We don't set dumpTree to const because the compiler has a fit when dumpTree
  // is accessed recursively.
  // tslint:disable-next-line:prefer-const
  let dumpTree: (hash: HashMap) => string =
    // tslint:disable-next-line:only-arrow-functions
    (function makeDumpTree(): (hash: HashMap) => string {
      let dumpTreeBuf: string = "";
      const dumpTreeIndent: string = "    ";

      // tslint:disable-next-line:no-shadowed-variable
      return (hash: HashMap): string => {
        let ret: string = "";
        const keys: any[] = hash.keys();
        keys.sort();
        for (const key of keys) {
          const sub: any | undefined = hash.has(key);
          if (sub !== false) {
            ret += `${dumpTreeBuf}${key}:\n`;
            dumpTreeBuf += dumpTreeIndent;
            ret += dumpTree(hash.has(key));
            dumpTreeBuf = dumpTreeBuf.slice(dumpTreeIndent.length);
          }
          else {
            ret += `${dumpTreeBuf}${key}\n`;
          }
        }

        return ret;
      };
    }());

  return dumpTree(hash);
  /* tslint:enable */
}

/**
 * Special event to which only the [["patterns/empty".EmptyWalker]] responds
 * positively. This object is meant to be used internally by salve.
 */
export const emptyEvent: Event = new Event("<empty>");

/**
 * Roughly speaking each [[Pattern]] object has a corresponding ``Walker`` class
 * that models an object which is able to walk the pattern to which it
 * belongs. So an ``Element`` has an ``ElementWalker`` and an ``Attribute`` has
 * an ``AttributeWalker``. A ``Walker`` object responds to parsing events and
 * reports whether the structure represented by these events is valid.
 *
 * This base class records only a minimal number of properties so that child
 * classes can avoid keeping useless properties. A prime example is the walker
 * for ``<empty>`` which is a terminal walker (it has no subwalker) so does not
 * need to record the name resolver.
 *
 * Note that users of this API do not instantiate Walker objects themselves.
 */
export abstract class BaseWalker<T extends BasePattern> {

  /**
   * The next id to associate to the next Walker object to be created. This is
   * used so that [[hash]] can return unique values.
   */
  private static __id: number = 0; // tslint:disable-line:variable-name

  readonly id: string = `W${this.__newID()}`;

  protected readonly el: T;

  protected possibleCached: EventSet | undefined;

  /**
   * @param el The element to which this walker belongs.
   */
  protected constructor(other: BaseWalker<T>, memo: HashMap);
  protected constructor(el: T);
  protected constructor(elOrWalker: T | BaseWalker<T>) {
    if (elOrWalker instanceof BasePattern) {
      this.el = elOrWalker;
    }
    else {
      this.el = elOrWalker.el;
      this.possibleCached = elOrWalker.possibleCached;
    }
    if (DEBUG) {
        wrap(this, "_possible", possibleTracer);
        wrap(this, "fireEvent", fireEventTracer);
        wrap(this, "end", plainTracer);
        wrap(this, "_suppressAttributes", plainTracer);
        wrap(this, "_clone", plainTracer);
    }
  }

  /**
   * This method is mainly used to be able to use these objects in a
   * [["hashstructs".HashSet]] or a [["hashstructs".HashMap]].
   *
   * Returns a hash guaranteed to be unique to this object. There are some
   * limitations. First, if this module is instantiated twice, the objects
   * created by the two instances cannot mix without violating the uniqueness
   * guarantee. Second, the hash is a monotonically increasing counter, so when
   * it reaches beyond the maximum integer that the JavaScript vm can handle,
   * things go kaboom. Third, this hash is meant to work within salve only.
   *
   * @returns A hash unique to this object.
   */
  hash(): string {
    return this.id;
  }

  /**
   * Fetch the set of possible events at the current stage of parsing.
   *
   * @returns The set of events that can be fired without resulting in an error.
   */
  possible(): EventSet {
    return new EventSet(this._possible());
  }

  /**
   * Helper method for possible(). The possible() method is designed to be safe,
   * in that the value it returns is not shared, so the caller may change it
   * without breaking anything. However, this method returns a value that may
   * not be modified by the caller. It is used internally among the classes of
   * this file to save copying time.
   *
   * @returns The set of events that can be fired without resulting in an error.
   */
  abstract _possible(): EventSet;

  // These functions return true if there is no problem, or a list of
  // ValidationError objects otherwise.

  /**
   * Can this Walker validly end after the previous event fired?
   *
   * @param attribute ``true`` if calling this method while processing
   * attributes, ``false`` otherwise.
   *
   * @return ``true`` if the walker can validly end here.  ``false`` otherwise.
   */
  canEnd(attribute: boolean = false): boolean {
    return true;
  }

  /**
   * Obtain the errors that would occur if the walker were to end here. Note the
   * conditional phrasing. It **must** be idempotent. Therefore it **must not**
   * change the state of the walker. The internal code of salve will sometimes
   * call end more than once on the same walker.
   *
   * @param attribute ``true`` if calling this method while processing
   * attributes, ``false`` otherwise.
   *
   * @returns ``false`` if the walker ended without error. Otherwise, the
   * errors.
   */
  end(attribute: boolean = false): EndResult {
    return false;
  }

  /**
   * Deep copy the Walker.
   *
   * @returns A deep copy of the Walker.
   */
  clone(): this {
    return this._clone(new HashMap(hashHelper));
  }

 /**
  * Helper function for clone. Code that is not part of the Pattern family would
  * call clone() whereas Pattern and its derived classes call _clone() with the
  * appropriate memo.
  *
  * @param memo A mapping of old object to copy object. As a tree of patterns
  * is being cloned, this memo is populated.  So if A is cloned to B then a
  * mapping from A to B is stored in the memo.  If A is seen again in the same
  * cloning operation, then it will be substituted with B instead of creating a
  * new object.
  *
  * This method is meant only to be used by classes derived from [[Walker]]. It
  * is public due to a limitation of TypeScript. Don't call it from your own
  * code. You've been warned.
  *
  * @protected
  *
  * @returns The clone.
  */
  _clone(memo: HashMap): this {
    return new (this.constructor as any)(this, memo);
  }

  /**
   * Helper function used to prevent Walker objects from reporting attribute
   * events as possible. In RelaxNG it is normal to mix attributes and elements
   * in patterns. However, XML validation segregates attributes and
   * elements. Once a start tag has been processed, attributes are not possible
   * until a new start tag begins. For instance, if a Walker is processing
   * ``<foo a="1">``, as soon as the greater than symbol is encountered,
   * attribute events are no longer possible. This function informs the Walker
   * of this fact.
   *
   */
  abstract _suppressAttributes(): void;

  /**
   * Helper method for cloning. This method should be called to clone objects
   * that do not participate in the ``clone``, protocol. This typically means
   * instance properties that are not ``Walker`` objects and not immutable.
   *
   * This method will call a ``clone`` method on ``obj``, when it determines
   * that cloning must happen.
   *
   * @param obj The object to clone.
   *
   * @param memo A mapping of old object to copy object. As a tree of patterns
   * is being cloned, this memo is populated. So if A is cloned to B then a
   * mapping from A to B is stored in the memo. If A is seen again in the same
   * cloning operation, then it will be substituted with B instead of creating a
   * new object. This should be the same object as the one passed to the
   * constructor.
   *
   * @returns A clone of ``obj``.
   */
  protected _cloneIfNeeded<C extends Clonable>(obj: C, memo: HashMap): C {
    let other: C = memo.has(obj);
    if (other !== undefined) {
      return other;
    }
    other = obj.clone();
    memo.add(obj, other);

    return other;
  }

  /**
   * Gets a new Walker id.
   *
   * @returns The new id.
   */
  private __newID(): number {
    return BaseWalker.__id++;
  }
}

/**
 * This is the class of all walkers that are used internally to Salve.
 */
export abstract class InternalWalker<T extends BasePattern>
  extends BaseWalker<T> {
  /**
   * Passes an event to the walker for handling. The Walker will determine
   * whether it or one of its children can handle the event.
   *
   * @param ev The event to handle.
   *
   * @returns The value ``false`` if there was no error. The value ``undefined``
   * if no walker matches the pattern. Otherwise, an array of
   * [[ValidationError]] objects.
   */
  abstract fireEvent(ev: Event): InternalFireEventResult;
}

/**
 * This is the class of all walkers that may be seen by code that uses
 * salve. For historical reasons, it is just called ``Walker`` and not
 * ``ExternalWalker``.
 */
export abstract class Walker<T extends BasePattern>
  extends BaseWalker<T> {
  /**
   * Passes an event to the walker for handling. The Walker will determine
   * whether it or one of its children can handle the event.
   *
   * @param ev The event to handle.
   *
   * @returns The value ``false`` if there was no error. The value ``undefined``
   * if no walker matches the pattern. Otherwise, an array of
   * [[ValidationError]] objects.
   */
  abstract fireEvent(ev: Event): FireEventResult;
}

//  LocalWords:  RNG MPL lookahead xmlns uri CodeMirror tokenizer enterStartTag
//  LocalWords:  EOF attributeName el xmlPath buf nameOrPath util ret EventSet
//  LocalWords:  NameResolver args unshift HashSet subpatterns newID NG vm pre
//  LocalWords:  firstName lastName attributeValue leaveStartTag dumpTree const
//  LocalWords:  dumpTreeBuf subwalker fireEvent suppressAttributes HashMap
//  LocalWords:  ValidationError addWalker RefWalker DefineWalker
