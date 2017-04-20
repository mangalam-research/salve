/**
 * Naive set implementation.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 * @private
 */

/**
 * This is a naive implementation of sets. It stores all elements in an
 * array. All array manipulations are done by searching through the array from
 * start to hit. So when adding a new element to the ``NaiveSet`` for instance,
 * the add method will scan the whole array, find the element is not there and
 * then add the element at the end of the array. As naive as this implementation
 * is, it has been shown to be faster than [["hashstructs".HashSet]] when used
 * in the context of this library.
 *
 * Note that ``NaiveSet`` cannot hold undefined values.
 */
// tslint:disable: no-any no-reserved-keywords
export class NaiveSet {
  /**
   * The backing store for the set.
   */
  protected b: any[];

  /**
   * @param initial The value to initialize the set with. If a [[NaiveSet]],
   * then the new ``NaiveSet`` will be a clone of the parameter. If an
   * ``Array``, then the new ``NaiveSet`` will be initialized with the
   * ``Array``. If something else, then the new ``NaiveSet`` will contain
   * whatever value was passed.  The backing array that hold the values
   * contained in the set.
   */
  constructor(initial?: NaiveSet | any[] | any) {
    if (initial != null) {
      if (initial instanceof NaiveSet) {
        this.b = initial.b.concat([]);
      }
      else if (initial instanceof Array) {
        this.b = [];
        for (let i: number = 0; i < initial.length; ++i) {
          this.add(initial[i]);
        }
      }
      else {
        this.b = [initial];
      }
    }
    else {
      this.b = [];
    }
  }

  /**
   * Adds a value to the set.
   *
   * @param value The value to add.
   */
  add(value: any): void {
    const t: number = this.b.indexOf(value);
    if (t < 0) {
      this.b.push(value);
    }
  }

  /**
   * Destructively adds the elements of another set to this set.
   *
   * @param s The set to add.
   * @throws {Error} If ``s`` is not a ``NaiveSet`` object
   */
  union(s?: NaiveSet): void {
    if (s == null) {
      return;
    }
    if (!(s instanceof NaiveSet)) {
      throw new Error("union with non-NaiveSet");
    }
    const len: number = s.b.length;
    for (let i: number = 0; i < len; ++i) {
      this.add(s.b[i]);
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
  filter(f: (value: any, index: number, set: NaiveSet) => any): NaiveSet {
    const ret: NaiveSet = new (this.constructor as typeof NaiveSet)();
    // The fat arrow is used to prevent a caller from accessing ``this.b``
    // through the 3rd parameter that would be passed to ``f``.
    ret.b = this.b.filter((value: any, index: number) => f(value, index, this));
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
  map(f: (value: any, index: number, set: NaiveSet) => any): NaiveSet {
    const ret: NaiveSet = new (this.constructor as typeof NaiveSet)();
    for (let i: number = 0; i < this.b.length; ++i) {
      const value: any = this.b[i];
      const result: any = f(value, i, this);

      // Undefined is not added.
      if (result !== undefined) {
        ret.add(result);
      }
    }
    return ret;
  }

  /**
   * Applies a function on each value stored in the set.
   *
   * @param f A function which accepts one parameter. The function will be
   * called on each value.
   */
  forEach(f: (value: any, index: number, set: NaiveSet) => void): void {
    this.b.forEach((value: any, index: number) => {
      f(value, index, this);
    });
  }

  /**
   * Converts the set to a string.
   *
   * @returns All the values, joined with ", ".
   */
  toString(): string {
    return this.b.join(", ");
  }

  /**
   * @returns The number of values stored.
   */
  size(): number {
    return this.b.length;
  }

  /**
   * Determines whether or not this set has the parameter passed.
   *
   * @param obj The object which we want to look for.
   *
   * @returns True if the object is present, false if not.
   */
  has(obj: any): boolean {
    return this.b.indexOf(obj) >= 0;
  }

  /**
   * Converts the object on which this method is called to an array.
   *
   * @returns An array that corresponds to the object.
   */
  toArray(): any[] {
    return this.b.slice();
  }
}

// LocalWords:  hashstructs HashSet Dubeau MPL Mangalam LocalWords
// LocalWords:  param truthy
