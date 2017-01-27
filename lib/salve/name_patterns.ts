/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

/**
 * @private
 */
export type NamespaceMemo = {[key: string]: number};

/**
 * Base class for all name patterns.
 */
export abstract class Base {
  /**
   * @param path The XML path of the element that corresponds to this
   * object in the Relax NG schema from which this object was contructed.
   */
  constructor(readonly path: string) {
  }

  /**
   * Tests whether the pattern matches a name.
   *
   * @param ns The namespace to match.
   * @param name The name to match.
   * @returns ``true`` if there is a match.
   */
  abstract match(ns: string, name: string): boolean;

  /**
   * Tests whether the pattern matches a name and this match is due only to a
   * wildcard match (``nsName`` or ``anyName``).
   *
   * @param ns The namespace to match.
   * @param name The name to match.
   *
   * @returns ``true`` if there is a match **and** the match is due only to a
   * wildcard match. If there is a choice between matching with a wildcard and
   * matching with a regular ``name`` pattern, this will return false because of
   * the ``name`` pattern.
   */
  abstract wildcardMatch(ns: string, name: string): boolean;

  /**
   * Determines whether a pattern is simple or not. A pattern is deemed simple if
   * it does not use ``<except>``, ``<anyName>`` or ``<NsName>``.  Put in
   * practical terms, non-simple patterns cannot generally be presented as a list
   * of choices to the user. In most cases, the appropriate input from the user
   * should be obtained by presenting an input field in which the user can type
   * the namespace and name of the entity to be named and the GUI reports whether
   * the name is allowed or not by the schema.
   *
   * @returns  ``true`` if the pattern is simple.
   */
  abstract simple(): boolean;

  /**
   * Gets the list of namespaces used in the pattern. An ``::except`` entry
   * indicates that there are exceptions in the pattern. A ``*`` entry indicates
   * that any namespace is allowed.
   *
   * This method should be used by client code to help determine how to prompt
   * the user for a namespace. If the return value is a list without
   * ``::except`` or ``*``, the client code knows there is a finite list of
   * namespaces expected, and what the possible values are. So it could present
   * the user with a choice from the set. If ``::except`` or ``*`` appears in
   * the list, then a different strategy must be used.
   *
   * @returns The list of namespaces.
   */
  getNamespaces(): string[] {
    const namespaces: NamespaceMemo = Object.create(null);
    this._recordNamespaces(namespaces);
    return Object.keys(namespaces);
  }

  /**
   * This is public due to limitations in how TypeScript works. You should never
   * call this function.
   *
   * @protected
   */
  abstract _recordNamespaces(_namespaces: NamespaceMemo): void;

  /**
   * Represent the name pattern as a plain object. The object returned contains
   * a ``pattern`` field which has the name of the JavaScript class that was
   * used to create the object. Other fields are present, depending on the
   * actual needs of the class.
   *
   * @returns The object representing the instance.
   */
  abstract toObject(): any;

  /**
   * Alias of [[Base.toObject]].
   *
   * ``toJSON`` is a misnomer, as the data returned is not JSON but a JavaScript
   * object. This method exists so that ``JSON.stringify`` can use it.
   */
  toJSON(): any {
    return this.toObject();
  }

  /**
   * Returns an array of [[Name]] objects which is a list of all
   * the possible names that this pattern allows.
   *
   * @returns An array of names. The value ``null`` is returned if the pattern
   * is not simple.
   */
  abstract toArray(): Name[] | null;

  /**
   * Stringify the pattern to a JSON string.
   *
   * @returns The stringified instance.
   */
  toString(): string {
    return JSON.stringify(this);
  }
};

/**
 * Models the Relax NG ``<name>`` element.
 *
 */
export class Name extends Base {
  /**
   * @param path See parent class.
   *
   * @param ns The namespace URI for this name. Corresponds to the
   * ``ns`` attribute in the simplified Relax NG syntax.
   *
   * @param name The name. Corresponds to the content of ``<name>``
   * in the simplified Relax NG syntax.
   */
  constructor(path: string, readonly ns: string, readonly name: string) {
    super(path);
  }

  match(ns: string, name: string): boolean {
    return this.ns === ns && this.name === name;
  }

  wildcardMatch(ns: string, name: string): boolean {
    return false; // This is not a wildcard.
  }

  toObject(): {ns: string, name: string} {
    return {
      ns: this.ns,
      name: this.name,
    };
  }

  simple(): boolean {
    return true;
  }

  toArray(): Name[] {
    return [this];
  }

  _recordNamespaces(namespaces: NamespaceMemo): void {
    namespaces[this.ns] = 1;
  }
}

/**
 * Models the Relax NG ``<choice>`` element when it appears in a name
 * class.
 */
export class NameChoice extends Base {

  readonly a: Base;
  readonly b: Base;

  /**
   * @param path See parent class.
   *
   * @param pats An array of length 2 which
   * contains the two choices allowed by this object.
   */
  constructor(path: string, pats: Base[]) {
    super(path);
    [this.a, this.b] = pats;
  }

  match(ns: string, name: string): boolean {
    return this.a.match(ns, name) || this.b.match(ns, name);
  }

  wildcardMatch(ns: string, name: string): boolean {
    return this.a.wildcardMatch(ns, name) || this.b.wildcardMatch(ns, name);
  }

  toObject(): {a: any, b: any} {
    return {
      a: this.a.toObject(),
      b: this.b.toObject(),
    };
  }

  simple(): boolean {
    return this.a.simple() && this.b.simple();
  }

  toArray(): Name[] | null {
    const aArr: Name[] | null = this.a.toArray();

    if (!aArr) {
      return null;
    }

    const bArr: Name[] | null = this.b.toArray();
    if (!bArr) {
      return null;
    }

    return aArr.concat(bArr);
  }

  _recordNamespaces(namespaces: NamespaceMemo): void {
    this.a._recordNamespaces(namespaces);
    this.b._recordNamespaces(namespaces);
  }
}

/**
 * Models the Relax NG ``<nsName>`` element.
 */
export class NsName extends Base {
  /**
   *
   * @param path See parent class.
   *
   * @param ns The namespace URI for this name. Corresponds to the ``ns``
   * attribute in the simplified Relax NG syntax.
   *
   * @param except Corresponds to an ``<except>`` element appearing as a child
   * of the ``<nsName>`` element in the Relax NG schema.
   */
  constructor(path: string, readonly ns: string, readonly except?: Base) {
    super(path);
  }

  match(ns: string, name: string): boolean {
    return this.ns === ns && !(this.except && this.except.match(ns, name));
  }

  wildcardMatch(ns: string, name: string): boolean {
    return this.match(ns, name);
  }

  toObject(): {ns: string, except?: any} {
    const ret: {ns: string, except?: any} = {
      ns: this.ns,
    };
    if (this.except) {
      ret.except = this.except.toObject();
    }
    return ret;
  }

  simple(): boolean {
    return false;
  }

  toArray(): null {
    return null;
  }

  _recordNamespaces(namespaces: NamespaceMemo): void {
    namespaces[this.ns] = 1;
    if (this.except) {
      namespaces["::except"] = 1;
    }
  }
};

/**
 * Models the Relax NG ``<anyName>`` element.
 */
export class AnyName extends Base {
  /**
   * @param path See parent class.
   *
   * @param except Corresponds to an ``<except>`` element appearing as a child
   * of the ``<anyName>`` element in the Relax NG schema.
   */
  constructor(path: string, readonly except?: Base) {
    super(path);
  }

  match(ns: string, name: string): boolean {
    return !this.except || !this.except.match(ns, name);
  }

  wildcardMatch(ns: string, name: string): boolean {
    return this.match(ns, name);
  }

  toObject(): {pattern: "AnyName", except?: Base} {
    const ret: {pattern: "AnyName", except?: Base} = {
      pattern: "AnyName",
    };
    if (this.except) {
      ret.except = this.except.toObject();
    }
    return ret;
  }

  simple(): boolean {
    return false;
  }

  toArray(): null {
    return null;
  }

  _recordNamespaces(namespaces: NamespaceMemo): void {
    namespaces["*"] = 1;
    if (this.except) {
      namespaces["::except"] = 1;
    }
  }
};
