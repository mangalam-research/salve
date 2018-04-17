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
   * object in the Relax NG schema from which this object was constructed.
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
   * Test whether a pattern intersects another pattern. Two pattern intersect if
   * there exist a name that can be matched by both.
   *
   * @param other The other pattern to check.
   */
  intersects(other: ConcreteName): boolean {
    return this.intersection(other) !== 0;
  }

  /**
   * Computes the intersection of two patterns.
   *
   * @param other The other pattern to check.
   *
   * @returns 0 if the intersection is the empty set. Otherwise, a ConcreteName
   * representing the intersection.
   */
  abstract intersection(other: ConcreteName | 0): ConcreteName | 0;

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
   * Determines whether a pattern is simple or not. A pattern is deemed simple
   * if it does not use ``<except>``, ``<anyName>`` or ``<NsName>``.  Put in
   * practical terms, non-simple patterns cannot generally be presented as a
   * list of choices to the user. In most cases, the appropriate input from the
   * user should be obtained by presenting an input field in which the user can
   * type the namespace and name of the entity to be named and the GUI reports
   * whether the name is allowed or not by the schema.
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
    this._recordNamespaces(namespaces, true);

    return Object.keys(namespaces);
  }

  /**
   * This is public due to limitations in how TypeScript works. You should never
   * call this function directly.
   *
   * @param namespaces A map in which to record namespaces.
   *
   * @param recordEmpty Whether to record an empty namespace in the map.
   */
  abstract _recordNamespaces(namespaces: NamespaceMemo,
                             recordEmpty: boolean): void;

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
}

export type ConcreteName = Name | NameChoice | NsName | AnyName;

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

  intersection(other: ConcreteName | 0): ConcreteName | 0 {
    if (other === 0) {
      return 0;
    }

    if (other instanceof Name) {
      return this.match(other.ns, other.name) ? this : 0;
    }

    // Delegate to the other classes.
    return other.intersection(this);
  }

  wildcardMatch(ns: string, name: string): boolean {
    return false; // This is not a wildcard.
  }

  toObject(): { ns: string; name: string } {
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

  _recordNamespaces(namespaces: NamespaceMemo, recordEmpty: boolean): void {
    if (this.ns === "" && !recordEmpty) {
      return;
    }

    namespaces[this.ns] = 1;
  }
}

/**
 * Models the Relax NG ``<choice>`` element when it appears in a name
 * class.
 */
export class NameChoice extends Base {

  readonly a: ConcreteName;
  readonly b: ConcreteName;

  /**
   * @param path See parent class.
   *
   * @param pats An array of length 2 which
   * contains the two choices allowed by this object.
   */
  constructor(path: string, pats: ConcreteName[]) {
    super(path);
    [this.a, this.b] = pats;
  }

  /**
   * Makes a tree of NameChoice objects out of a list of names.
   *
   * @param names The names from which to build a tree.
   *
   * @return If the list is a single name, then just that name. Otherwise,
   * the names from the list in a tree of [[NameChoice]].
   */
  static makeTree(names: ConcreteName[]): ConcreteName {
    if (names.length === 0) {
      throw new Error("trying to make a tree out of nothing");
    }

    let ret: ConcreteName;
    if (names.length > 1) {
      // More than one name left. Convert them to a tree.
      let top = new NameChoice("", [names[0], names[1]]);
      for (let ix = 2; ix < names.length; ix++) {
        top = new NameChoice("", [top, names[ix]]);
      }

      ret = top;
    }
    else {
      // Only one name: we can use it as-is for the except.
      ret = names[0];
    }

    return ret;
  }

  match(ns: string, name: string): boolean {
    return this.a.match(ns, name) || this.b.match(ns, name);
  }

  intersection(other: ConcreteName | 0): ConcreteName | 0 {
    if (other === 0) {
      return 0;
    }

    const a = this.a.intersection(other);
    const b = this.b.intersection(other);

    if (a !== 0 && b !== 0) {
      return new NameChoice("", [a, b]);
    }

    if (a !== 0) {
      return a;
    }

    return (b !== 0) ? b : 0;
  }

  /**
   * Recursively apply a transformation to a NameChoice tree.
   *
   * @param fn The transformation to apply. It may return 0 to indicate that the
   * child has been transformed to the empty set.
   *
   * @returns The transformed tree, or 0 if the tree has been transformed to
   * nothing.
   */
  applyRecursively(fn: (child: Name | NsName | AnyName) => ConcreteName | 0):
  ConcreteName | 0 {
    const { a, b } = this;
    const newA = a instanceof NameChoice ? a.applyRecursively(fn) : fn(a);
    const newB = b instanceof NameChoice ? b.applyRecursively(fn) : fn(b);

    if (newA !== 0 && newB !== 0) {
      return new NameChoice(this.path, [newA, newB]);
    }

    if (newA !== 0) {
      return newA;
    }

    if (newB !== 0) {
      return newB;
    }

    return 0;
  }

  wildcardMatch(ns: string, name: string): boolean {
    return this.a.wildcardMatch(ns, name) || this.b.wildcardMatch(ns, name);
  }

  toObject(): { a: any; b: any } {
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

    if (aArr === null) {
      return null;
    }

    const bArr: Name[] | null = this.b.toArray();
    if (bArr === null) {
      return null;
    }

    return aArr.concat(bArr);
  }

  _recordNamespaces(namespaces: NamespaceMemo, recordEmpty: boolean): void {
    this.a._recordNamespaces(namespaces, recordEmpty);
    this.b._recordNamespaces(namespaces, recordEmpty);
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
  constructor(path: string, readonly ns: string,
              readonly except?: ConcreteName) {
    super(path);
  }

  match(ns: string, name: string): boolean {
    return this.ns === ns && !(this.except !== undefined &&
                               this.except.match(ns, name));
  }

  intersection(other: ConcreteName | 0): ConcreteName | 0 {
    if (other === 0) {
      return 0;
    }

    if (other instanceof Name) {
      if (this.ns !== other.ns) {
        return 0;
      }

      if (this.except !== undefined) {
        // We're computing other - other ^ this.except
        //
        // Since other is a single name, there are only two possible values for
        // other ^ this.except: other and 0.
        //
        // Consequently the whole equation can also only resolve to other and 0.
        return other.intersection(this.except) === 0 ? other : 0;
      }

      return other;
    }

    if (other instanceof NsName) {
      if (this.ns !== other.ns) {
        return 0;
      }

      if (this.except !== undefined && other.except !== undefined) {
        // We have to create a new except that does not duplicate exceptions.
        // For instance if this excepts {q}foo and other excepts {q}foo too, we
        // don't want to have an exception that has {q}foo twice.

        // Due to Relax NG restrictions on NsName, both excepts necessarily
        // contain only Name or NameChoice elements.
        const theseNames = this.except.toArray();
        const otherNames = other.except.toArray();

        // And so these cannot be null.
        if (theseNames === null || otherNames === null) {
          throw new Error("complex pattern found in NsName except");
        }

        // Find the unique names.
        const map = theseNames.concat(otherNames).reduce((acc, name) => {
          acc.set(`{${name.ns}}${name.name}`, name);

          return acc;
        }, new Map() as Map<string, Name>);

        const names = Array.from(map.values());

        return new NsName(this.path, this.ns, NameChoice.makeTree(names));
      }

      return (other.except !== undefined) ? other : this;
    }

    // Delegate the logic to the other classes.
    return other.intersection(this);
  }

  /**
   * Subtract a [[Name]] or [[NsName]] from this one, or a [[NameChoice]] that
   * contains only a mix of these two. We support subtracting only these two
   * types because only these two cases are required by Relax NG.
   *
   * @param other The object to subtract from this one.
   *
   * @returns An object that represents the subtraction. If the result is the
   * empty set, 0 is returned.
   */
  subtract(other: Name | NsName | NameChoice): ConcreteName | 0 {
    if (other instanceof NameChoice) {
      // x - (a U b) = x - a U x - b
      return other
        .applyRecursively((child: Name | NsName | AnyName) => {
          if (!(child instanceof Name || child instanceof NsName)) {
            throw new Error("child is not Name or NsName");
          }

          return this.subtract(child);
        });
    }

    if (this.ns !== other.ns) {
      return this;
    }

    if (other instanceof Name) {
      return new NsName(this.path, this.ns,
                        (this.except === undefined) ?
                        other :
                        new NameChoice(this.path, [this.except, other]));
    }

    if (other.except === undefined) {
      return 0;
    }

    if (this.except === undefined) {
      return other.except;
    }

    // Otherwise, return other.except - this.except. Yes, the order is
    // correct.

    // Due to Relax NG restrictions on NsName, both excepts may contain only
    // Name or NameChoice, so only simple patterns that can be converted to
    // arrays.
    const theseNames = this.except.toArray();
    const otherNames = other.except.toArray();

    if (theseNames === null || otherNames === null) {
      throw new Error("NsName contains an except pattern which is not simple.");
    }

    const result = otherNames
      .filter((name) =>
              !theseNames.some((thisName) => name.ns === thisName.ns &&
                               name.name === thisName.name));

    return result.length === 0 ? 0 : NameChoice.makeTree(result);
  }

  wildcardMatch(ns: string, name: string): boolean {
    return this.match(ns, name);
  }

  toObject(): { ns: string; except?: any } {
    const ret: { ns: string; except?: any } = {
      ns: this.ns,
    };
    if (this.except !== undefined) {
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

  _recordNamespaces(namespaces: NamespaceMemo, recordEmpty: boolean): void {
    if (this.ns !== "" || recordEmpty) {
      namespaces[this.ns] = 1;
    }

    if (this.except !== undefined) {
      namespaces["::except"] = 1;
    }
  }
}

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
  constructor(path: string, readonly except?: ConcreteName) {
    super(path);
  }

  match(ns: string, name: string): boolean {
    return (this.except === undefined) || !this.except.match(ns, name);
  }

  intersection(other: ConcreteName | 0): ConcreteName | 0 {
    if (other === 0) {
      return 0;
    }

    if (this.except === undefined) {
      return other;
    }

    if (other instanceof Name) {
      return this.except.intersection(other) === 0 ? other : 0;
    }

    if (other instanceof NsName) {
      // Reminder: the except can only be one of three things: Name, NsName or
      // NameChoice so negation can only be 0, Name, NsName or NameChoice.
      const negation = this.except.intersection(other);
      if (negation === 0) {
        return other;
      }

      if (negation instanceof Name || negation instanceof NsName ||
          negation instanceof NameChoice) {
        return other.subtract(negation);
      }

      throw new Error("negation should be 0, Name, NsName or NameChoice");
    }

    if (other instanceof AnyName) {
      if (other.except !== undefined && this.except !== undefined) {
        return new AnyName(this.path,
                           new NameChoice(this.path,
                                          [this.except, other.except]));
      }

      return (other.except !== undefined) ? other : this;
    }

    throw new Error("cannot compute intersection!");
  }

  wildcardMatch(ns: string, name: string): boolean {
    return this.match(ns, name);
  }

  toObject(): { pattern: "AnyName"; except?: any } {
    const ret: { pattern: "AnyName"; except?: any } = {
      pattern: "AnyName",
    };
    if (this.except !== undefined) {
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

  _recordNamespaces(namespaces: NamespaceMemo, _recordEmpty: boolean): void {
    namespaces["*"] = 1;
    if (this.except !== undefined) {
      namespaces["::except"] = 1;
    }
  }
}

//  LocalWords:  MPL NG Stringify stringified AnyName
