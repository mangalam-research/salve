/**
 * Classes that model RNG patterns.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { ValidationError } from "../errors";
import { Events } from "../events";
import { NameResolver } from "../name_resolver";
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

export type EventSet = Set<Events>;

export type FireEventResult = false | undefined | readonly ValidationError[];

export class InternalFireEventResult {
  constructor(readonly matched: boolean,
              readonly errors?: ReadonlyArray<ValidationError>,
              readonly refs?: ReadonlyArray<RefWalker>) {}

  static fromEndResult(result: EndResult): InternalFireEventResult {
    return (result === false) ?
      new InternalFireEventResult(true) :
      new InternalFireEventResult(false, result);
  }

  combine(other: InternalFireEventResult): InternalFireEventResult {
    if (this.matched) {
      const { refs } = this;
      const oRefs = other.refs;
      return oRefs === undefined ?
        this :
        new InternalFireEventResult(true, undefined,
                                    refs === undefined ? oRefs :
                                    refs.concat(oRefs));
    }

    const { errors } = this;
    const oErrors = other.errors;
    return oErrors === undefined ?
      this :
      new InternalFireEventResult(false,
                                  errors === undefined ? oErrors :
                                  errors.concat(oErrors),
                                  undefined);
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
  newWalker(): InternalWalker {
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
export function eventsToTreeString(evs: Events[] | EventSet): string {
  const eventArray = evs instanceof Set ? Array.from(evs) : evs;

  const hash: NodeMap = new Map<string, false | NodeMap>();
  for (const { name, param } of eventArray) {
    if (param !== null) {
      let nextNode = hash.get(name) as NodeMap | undefined;
      if (nextNode === undefined) {
        nextNode = new Map<string, false | NodeMap>();
        hash.set(name, nextNode);
      }
      nextNode.set(param.toString(), false);
    }
    else {
      hash.set(name, false);
    }
  }

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
 * This is the class of all walkers that are used internally to Salve.
 */
export interface InternalWalker {
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
  fireEvent(name: string, params: string[],
            nameResolver: NameResolver): InternalFireEventResult;

  /**
   * Flag indicating whether the walker can end.
   */
  canEnd: boolean;

  /**
   * Flag indicating whether the walker can end, in a context where
   * we are processing attributes.
   */
  canEndAttribute: boolean;

  /**
   * @returns The set of non-attribute event that can be fired without resulting
   * in an error. ``ElementWalker`` exceptionally returns all possible events,
   * including attribute events.
   */
  possible(): EventSet;

  /**
   * @returns The set of attribute events that can be fired without resulting in
   * an error. This method may not be called on ``ElementWalker``.
   */
  possibleAttributes(): EventSet;

  /**
   * End the walker.
   *
   * @returns ``false`` if the walker ended without error. Otherwise, the
   * errors.
   */
  end(): EndResult;

  /**
   * End the processing of attributes.
   *
   * @returns ``false`` if the walker ended without error. Otherwise, the
   * errors.
   */
  endAttributes(): EndResult;

  /**
   * Deep copy the Walker.
   *
   * @returns A deep copy of the Walker.
   */
  clone(): this;
}

//  LocalWords:  RNG MPL lookahead xmlns uri CodeMirror tokenizer enterStartTag
//  LocalWords:  EOF attributeName el xmlPath buf nameOrPath util ret EventSet
//  LocalWords:  NameResolver args unshift HashSet subpatterns newID NG vm pre
//  LocalWords:  firstName lastName attributeValue leaveStartTag dumpTree const
//  LocalWords:  dumpTreeBuf subwalker fireEvent suppressAttributes HashMap
//  LocalWords:  ValidationError RefWalker DefineWalker
