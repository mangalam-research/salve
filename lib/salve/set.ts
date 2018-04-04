/**
 * Naive set implementation.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 * @private
 */

/**
 * Note that these sets cannot hold undefined values.
 */
// tslint:disable: no-any no-reserved-keywords
export class NaiveSet<T> {
  /**
   * The backing store for the set.
   */
  protected b: Set<T>;

  /**
   * @param initial The value to initialize the set with. If a [[NaiveSet]],
   * then the new ``NaiveSet`` will be a clone of the parameter. If an
   * ``Array``, then the new ``NaiveSet`` will be initialized with the
   * ``Array``. If something else, then the new ``NaiveSet`` will contain
   * whatever value was passed.
   */
  constructor(initial?: NaiveSet<T> | T[] | T) {
    if (initial != null) {
      if (initial instanceof NaiveSet) {
        this.b = new Set(initial.b);
      }
      else if (initial instanceof Array) {
        this.b = new Set(initial);
      }
      else {
        this.b = new Set();
        this.b.add(initial);
      }
    }
    else {
      this.b = new Set();
    }
  }

  /**
   * Adds a value to the set.
   *
   * @param value The value to add.
   */
  add(value: T): void {
    this.b.add(value);
  }

  /**
   * Add the elements of another set to this set. This mutates this set.
   *
   * @param s The set to add.
   * @throws {Error} If ``s`` is not a ``NaiveSet`` object
   */
  union(s?: NaiveSet<T>): void {
    if (s == null) {
      return;
    }
    if (!(s instanceof NaiveSet)) {
      throw new Error("union with non-NaiveSet");
    }
    for (const x of s.b) {
      this.add(x);
    }
  }

  /**
   * Selects a subset of values.
   *
   * @param f A function that selects values.
   *
   * @returns An object of the same class as the object on which the method is
   * called. This object contains only the value selected by the function.
   */
  filter(f: (value: T, index: number, set: NaiveSet<T>) => any): NaiveSet<T> {
    const ret: NaiveSet<T> = new (this.constructor as typeof NaiveSet)();
    // The fat arrow is used to prevent a caller from accessing ``this.b``
    // through the 3rd parameter that would be passed to ``f``.
    let index = 0;
    for (const x of this.b) {
      if (f(x, index++, this)) {
        ret.add(x);
      }
    }

    return ret;
  }

  /**
   * This method works like Array.map but with a provision for eliminating
   * elements from the resulting [[NaiveSet]].
   *
   * @param f This parameter plays the same role as for ``Array``'s ``map``
   * method.  However, when it returns an undefined value, this return value is
   * not added to the ``NaiveSet`` that will be returned.
   *
   * @returns The new set. This set is of the same class as the original set.
   */
  map(f: (value: T, index: number, set: NaiveSet<T>) => any): NaiveSet<T> {
    const ret: NaiveSet<T> = new (this.constructor as typeof NaiveSet)();
    let index = 0;
    for (const x of this.b) {
      const result: any = f(x, index++, this);
      if (result !== undefined) {
        ret.add(result);
      }
    }

    return ret;
  }

  /**
   * Applies a function on each value stored in the set.
   *
   * @param f A function to call on each value.
   */
  forEach(f: (value: T, index: number, set: NaiveSet<T>) => void): void {
    let index = 0;
    this.b.forEach((value: T) => {
      f(value, index++, this);
    });
  }

  /**
   * Converts the set to a string.
   *
   * @returns All the values, joined with ", ".
   */
  toString(): string {
    return Array.from(this.b).join(", ");
  }

  /**
   * @returns The number of values stored.
   */
  size(): number {
    return this.b.size;
  }

  /**
   * Determines whether or not this set has the parameter passed.
   *
   * @param obj The object which we want to look for.
   *
   * @returns True if the object is present, false if not.
   */
  has(obj: T): boolean {
    return this.b.has(obj);
  }

  /**
   * Converts the object on which this method is called to an array.
   *
   * @returns An array that corresponds to the object.
   */
  toArray(): T[] {
    return Array.from(this.b);
  }
}

//  LocalWords:  param NaiveSet Mangalam MPL Dubeau HashSet hashstructs
