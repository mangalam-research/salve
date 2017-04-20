/**
 * Implementations of some simple collections. This module is meant for salve's
 * internal purposes only. It may be yanked at any time. Do not use in your own
 * code.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 * @private
 */

/**
 * A function which returns a uniquely identifying hash when called with an
 * object that a ``HashBase`` instance uses. Note that it is a valid
 * implementation strategy for the hash function to know how to handle only a
 * certain type of object, and not everything under the sun. This entails that a
 * ``HashBase`` object using this hash function can only contain objects of the
 * type that the hash function knows how to handle.
 *
 * @param object The object to be hashed.
 *
 * @returns The hash value. This should be unique for the object passed, and
 * should be suitable to be used as a property name in a plain object. (A
 * ``string`` is perfect. A ``number`` would work. But an object won't work.)
 *
 */
export type HashFunction = (object: any) => any;

/**
 * The type for the backing objects created for ``HashBase``.
 *
 * @protected
 */
export type Backing = {[propName: string]: any};

/**
 * The HashBase class provides a base class for the collections in this module.
 */
export abstract class HashBase {

  /**
   * The backing store that holds objects added to this collection.
   */
  protected readonly backing: Backing = Object.create(null);

  /**
   * The cached size of the collection.
   */
  protected _size: number = 0;

  /**
   * @param hashF A function which returns a uniquely identifying hash when
   * called with an object that a ``HashBase`` instance uses.
   *
   * @param initial An initial value for the object being constructed.
   */
  constructor(protected hashF: HashFunction, initial?: HashBase | any[] | any) {
    if (initial !== undefined) {
      if (initial instanceof HashBase) {
        const backing: Backing = this.backing;
        const initialBacking: Backing = initial.backing;
        const keys: string[] = Object.keys(initialBacking);
        for (const key of keys) {
          backing[key] = initialBacking[key];
        }
        this._size = keys.length;
      }
      else if (initial instanceof Array) {
        for (const value of initial) {
          this.add(value);
        }
      }
      else {
        this.add(initial);
      }
    }
  }

  /**
   * This is the method used for adding objects in this collection. Adding an
   * object that already exists is a no-op. The actual signature of this method
   * depends on the derived classes.
   */
  abstract add(...params: any[]): void;

  /**
   * Unites this object with another object. This method modifies the object
   * upon which it is called so as to make it a mathematical union of the two
   * objects.
   *
   * @param s The object to unite with this one. Must be of the same class as
   * this object.
   *
   * @throws {Error} If ``s`` is not of the same type as this object.
   */
  union(s: this): void {
    if (s == null) {
      return;
    }

    if (!(s instanceof this.constructor)) {
      throw new Error("union invalid class object; my class " +
                      this.constructor.name + " other class " +
                      s.constructor.name);
    }

    const backing: Backing = s.backing;
    const keys: string[] = Object.keys(backing);
    for (const key of keys) {
      this._store(key, backing[key]);
    }
  }

  /**
   * Applies a function on each value stored in the object.
   *
   * @param f A function which accepts one parameter. The function will be
   * called on each value.
   */
  forEach(f: (value: any) => void): void {
    const backing: Backing = this.backing;
    const keys: string[] = Object.keys(backing);
    for (const key of keys) {
      f(backing[key]);
    }
  }

  /**
   * @returns The number of values stored.
   */
  size(): number {
    return this._size;
  }

  /**
   * Selects a subset of values.
   *
   * @param f A function that selects values. It is called with each value. If
   * the value happens to be an ``Array`` then the function is *applied* to this
   * array. A return value which is truthy includes the value, otherwise the
   * value is excluded.
   *
   * @returns An object of the same class as the object on which the method is
   * called. This object contains only the value selected by the function.
   */
  filter(f: (...params: any[]) => boolean): this {
    const ret: this = new (this.constructor as any)();
    if (ret.hashF === undefined) {
      ret.hashF = this.hashF;
    }
    const backing: Backing = this.backing;
    const keys: string[] = Object.keys(backing);
    for (const key of keys) {
      const data: any = backing[key];
      const args: any[] = data instanceof Array ? data : [data];
      if (f.apply(undefined, args) as boolean) {
        ret._store(key, data);
      }
    }
    return ret;
  }

  /**
   * Tests whether a value is contained in the object on which this method is
   * called.
   *
   * @param obj The value for which to test.
   *
   * @returns ``true`` if the value is present, ``false`` if not.
   */
  has(obj: any): boolean {
    const hash: any = this.hashF(obj);
    return this.backing[hash] !== undefined;
  }

  /**
   * Converts the object on which this method is called to a string.
   *
   * @returns All the values, joined with ", ".
   */
  toString(): string {
    return this.toArray().join(", ");
  }

  /**
   * Converts the object on which this method is called to an array.
   *
   * @returns An array that corresponds to the object.
   *
   */
  toArray(): any[] {
    const t: any[] = [];
    const backing: Backing = this.backing;
    const keys: string[] = Object.keys(backing);
    for (const key of keys) {
      t.push(backing[key]);
    }
    return t;
  }

  /**
   * Record a hash and value pair into the backing store. Effectively associates
   * the hash with the value. This method assumes but does not verify that the
   * mapping from hash to value is unique. This method cannot be used to
   * **change** such mapping.
   *
   * @param hash Hash to which to associate the value. Can be any type that can
   * be used as an array index.
   *
   * @param val The value to associate with the hash.
   *
   * @throws {Error} If the hash is undefined or null.
   */
  protected _store(hash: any, val: any): void {
    if (hash == null) {
      throw new Error("undefined or null hash");
    }
    if (this.backing[hash] === undefined) {
      this.backing[hash] = val;
      this._size++;
    }
    // else noop
  }

}

/**
 * A set of objects. The objects are distinguished by a hash
 * function.
 */
export class HashSet extends HashBase {

  /**
   * Adds a value to the set.
   *
   * @param x The value to add. This value must be hashable by the hash function
   * that was used to create the collection.
   */
  add(x: any): void {
    this._store(this.hashF(x), x);
  };
}

/**
 * A map of (key, value) pairs. The keys are distinguished by means of a hash
 * function.
 */
export class HashMap extends HashBase {
  constructor(protected readonly hashF: HashFunction, initial?: HashMap) {
    super(hashF, initial);
  }

  // The arrays stored in the backing store are considered immutable.

  /**
   * Adds a (key, value) mapping to the map.
   *
   * @param key This must be a value hashable with the hash function that was
   * used to create the collection.
   *
   * @param value The value to associate with the key.
   */
  add(key: any, value: any): void {
    this._store(this.hashF(key), [key, value]);
  }

  forEach(f: (key: any, value: any) => void): void {
    const backing: Backing = this.backing;
    const keys: string[] = Object.keys(backing);
    for (const key of keys) {
      f(backing[key][0], backing[key][1]);
    }
  }

  /**
   * Checks whether an object is a key of the map, and returns its associated
   * value if present.
   *
   * @param obj The object to check.
   *
   * @returns The value associated with the object if present. ``undefined`` if
   * not.
   */
  has(obj: any): any {
    const hash: any = this.hashF(obj);
    const pair: any = this.backing[hash];
    if (pair !== undefined) {
      return pair[1];
    }

    return undefined;
  }

  /**
   * Gets the keys present in this mapping.
   */
  keys(): any[] {
    return Object.keys(this.backing);
  }
}

//  LocalWords:  hashstructs MPL oop HashBase noop HashSet HashMap
//  LocalWords:  Dubeau Mangalam LocalWords truthy
