/**
 * Common tools for salve.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

/**
 * This is required to work around a problem when extending built-in classes
 * like ``Error``. Some of the constructors for these classes return a value
 * from the constructor, which is then picked up by the constructors generated
 * by TypeScript (same with ES6 code transpiled through Babel), and this messes
 * up the inheritance chain.
 *
 * See https://github.com/Microsoft/TypeScript/issues/12123.
 */
export function fixPrototype(obj: any, parent: (...args: any[]) => any): void {
  const oldProto = Object.getPrototypeOf !== undefined ?
    Object.getPrototypeOf(obj) : obj.__proto__;

  if (oldProto !== parent) {
    if (Object.setPrototypeOf !== undefined) {
      Object.setPrototypeOf(obj, parent.prototype);
    }
    else {
      obj.__proto__ = parent.prototype;
    }
  }
}

//  LocalWords:  MPL jQuery Lodash
