/**
 * Set utilities.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 * @private
 */

/**
 * Add the elements of another set to this set. This mutates this set.
 *
 * @param me The set to mutate.
 *
 * @param s The set to add.
 */
export function union<T>(me: Set<T>, s: Set<T>): void {
  for (const x of s) {
    me.add(x);
  }
}

/**
 * Selects a subset of values.
 *
 * @param me The set to filter.
 *
 * @param f A function that selects values.
 *
 * @returns An object of the same class as the object on which the method is
 * called. This object contains only the value selected by the function.
 */
export function filter<S extends Set<T>, T>
  (me: S, f: (value: T, index: number, me: S) => any): S {
  const ret = new (me.constructor as typeof Set)() as S;
  // The fat arrow is used to prevent a caller from accessing ``this.b``
  // through the 3rd parameter that would be passed to ``f``.
  let index = 0;
  for (const x of me) {
    if (f(x, index++, me)) {
      ret.add(x);
    }
  }

  return ret;
}

/**
 * This method works like Array.map but with a provision for eliminating
 * elements.
 *
 * @param me The set to map.
 *
 * @param f This parameter plays the same role as for ``Array``'s ``map``
 * method.  However, when it returns an undefined value, this return value is
 * not added to set that will be returned.
 *
 * @returns The new set. This set is of the same class as the original set.
 */
export function map<S extends Set<T>, T>
  (me: S, f: (value: T, index: number, me: S) => any): S {
  const ret = new (me.constructor as typeof Set)() as S;
  let index = 0;
  for (const x of me) {
    const result = f(x, index++, me);
    if (result !== undefined) {
      ret.add(result);
    }
  }

  return ret;
}

//  LocalWords:  param NaiveSet Mangalam MPL Dubeau HashSet hashstructs
