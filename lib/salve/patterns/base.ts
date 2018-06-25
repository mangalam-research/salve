/**
 * Classes that model RNG patterns.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { ValidationError } from "../errors";
import { ConcreteName } from "../name_patterns";
import { NameResolver } from "../name_resolver";
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

// A note on performance and the presence of the debug code here. We did a
// profiling test with the debug code entirely removed. It made no
// difference. Though TypeScript does not eliminate the code when DEBUG is
// false, its impact on real-world test runs is undetectable. (Note that
// uglification strips it from the minified code.)
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
  // @ts-ignore
  var possibleTracer: (oldMethod: Function, name: string, args: any[]) => any;
  // @ts-ignore
  var fireEventTracer: (oldMethod: Function, name: string, args: any[]) => any;
  // @ts-ignore
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

export type EventSet = Set<Event>;

export type FireEventResult = false | undefined | ValidationError[];

export class InternalFireEventResult {
  constructor(public matched: boolean,
              public errors?: ValidationError[],
              public refs?: RefWalker[]) {}

  static fromEndResult(result: EndResult): InternalFireEventResult {
    return (result === false) ?
      new InternalFireEventResult(true) :
      new InternalFireEventResult(false, result);
  }

  combine(other: InternalFireEventResult): this {
    if (this.errors === undefined) {
      this.errors = other.errors;
    }
    else if (other.errors !== undefined) {
      this.errors = this.errors.concat(other.errors);
    }

    if (this.refs === undefined) {
      this.refs = other.refs;
    }
    else if (other.refs !== undefined) {
      this.refs = this.refs.concat(other.refs);
    }

    return this;
  }
}

export type EndResult = false | ValidationError[];

/**
 * These patterns form a JavaScript representation of the simplified RNG
 * tree. The base class implements a leaf in the RNG tree. In other words, it
 * does not itself refer to children Patterns. (To put it in other words, it has
 * no subpatterns.)
 */
export class BasePattern {
  readonly xmlPath: string;

  /**
   * @param xmlPath This is a string which uniquely identifies the element from
   * the simplified RNG tree. Used in debugging.
   */
  constructor(xmlPath: string) {
    this.xmlPath = xmlPath;
  }

  /**
   * This method must be called after resolution has been performed.
   * ``_prepare`` recursively calls children but does not traverse ref-define
   * boundaries to avoid infinite regress...
   *
   * This function now performs these tasks:
   *
   * - it precomputes the values returned by ``hasAttr``,
   *
   * - it precomputes the values returned by ``hasEmptyPattern``,
   *
   * - it gathers all the namespaces seen in the schema.
   *
   * - it resolves the references.
   *
   * @param definitions The definitions present in the schema.
   *
   * @param namespaces An object whose keys are the namespaces seen in
   * the schema. This method populates the object.
   *
   * @returns The references that cannot be resolved, or ``undefined`` if no
   * references cannot be resolved. The caller is free to modify the value
   * returned as needed.
   *
   */
  _prepare(definitions: Map<string, Define>,
           namespaces: Set<string>): Ref[] | undefined {
    return undefined;
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
  hasAttrs(): boolean {
    return false;
  }

  /**
   * This method determines whether a pattern has the ``empty``
   * pattern. Generally, this means that either this pattern is the ``empty``
   * pattern or has ``empty`` as a child.
   */
  hasEmptyPattern(): boolean {
    return false;
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
  newWalker(): InternalWalker<BasePattern> {
    // Rather than make it abstract, we provide a default implementation for
    // this method, which throws an exception if called. We could probably
    // reorganize the code to do without but a) we would not gain much b) it
    // would complicate the type hierarchy. The cost is not worth the
    // benefits. There are two patterns that land on this default implementation
    // and neither can have newWalker called on them anyway.
    throw new Error("derived classes must override this");
  }
}

/**
 * Pattern objects of this class have exactly one child pattern.
 */
export abstract class OneSubpattern<T extends (Pattern | Element) = Pattern>
  extends Pattern {
  protected _cachedHasAttrs?: boolean;
  protected _cachedHasEmptyPattern?: boolean;

  constructor(xmlPath: string, readonly pat: T) {
    super(xmlPath);
  }

  protected abstract _computeHasEmptyPattern(): boolean;

  _prepare(definitions: Map<string, Define>,
           namespaces: Set<string>): Ref[] | undefined {
    const ret = this.pat._prepare(definitions, namespaces);
    this._cachedHasAttrs = this.pat.hasAttrs();
    this._cachedHasEmptyPattern = this._computeHasEmptyPattern();

    return ret;
  }

  hasAttrs(): boolean {
    // tslint:disable-next-line:no-non-null-assertion
    return this._cachedHasAttrs!;
  }

  hasEmptyPattern(): boolean {
    // tslint:disable-next-line:no-non-null-assertion
    return this._cachedHasEmptyPattern!;
  }
}

/**
 * Pattern objects of this class have exactly two child patterns.
 *
 */
export abstract class TwoSubpatterns extends Pattern {
  protected _cachedHasAttrs?: boolean;
  protected _cachedHasEmptyPattern?: boolean;

  constructor(xmlPath: string, readonly patA: Pattern, readonly patB: Pattern) {
    super(xmlPath);
  }

  protected abstract _computeHasEmptyPattern(): boolean;

  _prepare(definitions: Map<string, Define>,
           namespaces: Set<string>): Ref[] | undefined {
    const aRefs = this.patA._prepare(definitions, namespaces);
    const bRefs = this.patB._prepare(definitions, namespaces);
    this._cachedHasAttrs = this.patA.hasAttrs() || this.patB.hasAttrs();
    this._cachedHasEmptyPattern = this._computeHasEmptyPattern();

    if (aRefs !== undefined) {
      return bRefs === undefined ? aRefs : aRefs.concat(bRefs);
    }

    return bRefs;
  }

  hasAttrs(): boolean {
    // tslint:disable-next-line:no-non-null-assertion
    return this._cachedHasAttrs!;
  }

  hasEmptyPattern(): boolean {
    // tslint:disable-next-line:no-non-null-assertion
    return this._cachedHasEmptyPattern!;
  }
}

/**
 * This class models events occurring during parsing. Upon encountering the
 * start of a start tag, an "enterStartTag" event is generated, etc. Event
 * objects are held to be immutable. No precautions have been made to enforce
 * this. Users of these objects simply must not modify them.
 *
 * An event is made of a list of event parameters, with the first one being the
 * type of the event and the rest of the list varying depending on this type.
 */
export class Event {
  readonly params: (string|ConcreteName)[];

  /**
   * Is this Event an attribute event?
   */
  readonly isAttributeEvent: boolean;

  /**
   * @param args... The event parameters may be passed directly in the call
   * ``(new Event(a, b, ...))`` or the first call parameter may be a list
   * containing all the event parameters ``(new Event([a, b, ])``. All of the
   * event parameters must be strings.
   */
  constructor(...args: any[]) {
    const params: (string|ConcreteName)[] =
      (args.length === 1 && args[0] instanceof Array) ? args[0] : args;

    this.params = params;
    this.isAttributeEvent = (this.params[0] === "attributeName" ||
                             this.params[0] === "attributeValue" ||
                             this.params[0] === "attributeNameAndValue");
  }

  /**
   * @returns A string representation of the event.
   */
  toString(): string {
    return `Event: ${this.params.join(", ")}`;
  }
}

export function isAttributeEvent(name: string): boolean {
  // Using a set here is not clearly faster than using this logic.
  return (name === "attributeName" || name === "attributeValue" ||
          name === "attributeNameAndValue");
}

interface NodeMap extends Map<string, false | NodeMap> {}

/**
 * Utility function used mainly in testing to transform a set of
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
  const eventArray = (evs instanceof Set) ? Array.from(evs) : evs;

  const hash: NodeMap = new Map();
  eventArray.forEach((ev) => {
    const params = ev.params;

    let node = hash;
    const last = params.length - 1;
    for (let i = 0; i < params.length; ++i) {
      const key = params[i].toString();
      if (i === last) {
        node.set(key, false);
      }
      else {
        let nextNode = node.get(key) as NodeMap | undefined;
        if (nextNode === undefined) {
          nextNode = new Map();
          node.set(key, nextNode);
        }
        node = nextNode;
      }
    }
  });

  function dumpTree(toDump: NodeMap, indent: string): string {
    let ret = "";
    const keys = Array.from(toDump.keys());
    keys.sort();
    for (const key of keys) {
      // tslint:disable-next-line:no-non-null-assertion
      const sub = toDump.get(key)!;
      if (sub !== false) {
        ret += `${indent}${key}:\n`;
        ret += dumpTree(sub, `${indent}    `);
      }
      else {
        ret += `${indent}${key}\n`;
      }
    }

    return ret;
  }

  return dumpTree(hash, "");
  /* tslint:enable */
}

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
  protected abstract readonly el: T;

  // These functions return true if there is no problem, or a list of
  // ValidationError objects otherwise.

  /**
   * Deep copy the Walker.
   *
   * @returns A deep copy of the Walker.
   */
  clone(): this {
    return this._clone();
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
  * This method is meant only to be used by classes derived from
  * [[BaseWalker]]. It is public due to a limitation of TypeScript. Don't call
  * it from your own code. You've been warned.
  *
  * @protected
  *
  * @returns The clone.
  */
  abstract _clone(): this;

  hasEmptyPattern(): boolean {
    return this.el.hasEmptyPattern();
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
   * @param name The event name.
   *
   * @param params The event parameters.
   *
   * @param nameResolver The name resolver to use to resolve names.
   *
   * @returns The value ``false`` if there was no error. The value ``undefined``
   * if no walker matches the pattern. Otherwise, an array of
   * [[ValidationError]] objects.
   */
  abstract fireEvent(name: string, params: string[],
                     nameResolver: NameResolver): InternalFireEventResult;

  /**
   * Flag indicating whether the walker can end.
   */
  abstract canEnd: boolean;

  /**
   * Flag indicating whether the walker can end, in a context where
   * we are processing attributes.
   */
  abstract canEndAttribute: boolean;

  /**
   * @returns The set of non-attribute event that can be fired without resulting
   * in an error. ``ElementWalker`` exceptionally returns all possible events,
   * including attribute events.
   */
  abstract possible(): EventSet;

  /**
   * @returns The set of attribute events that can be fired without resulting in
   * an error. This method may not be called on ``ElementWalker``.
   */
  abstract possibleAttributes(): EventSet;

  /**
   * End the walker.
   *
   * @returns ``false`` if the walker ended without error. Otherwise, the
   * errors.
   */
  end(): EndResult {
    return false;
  }

  /**
   * End the processing of attributes.
   *
   * @returns ``false`` if the walker ended without error. Otherwise, the
   * errors.
   */
  endAttributes(): EndResult {
    return false;
  }
}

//  LocalWords:  RNG MPL lookahead xmlns uri CodeMirror tokenizer enterStartTag
//  LocalWords:  EOF attributeName el xmlPath buf nameOrPath util ret EventSet
//  LocalWords:  NameResolver args unshift HashSet subpatterns newID NG vm pre
//  LocalWords:  firstName lastName attributeValue leaveStartTag dumpTree const
//  LocalWords:  dumpTreeBuf subwalker fireEvent suppressAttributes HashMap
//  LocalWords:  ValidationError RefWalker DefineWalker
