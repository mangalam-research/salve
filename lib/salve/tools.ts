/**
 * Common tools for salve.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

/**
 * @private
 */
function copy(target: any, source: any): void {
  for (const i in source) { // tslint:disable-line: forin
    target[i] = source[i];
  }
}

/**
 * Modify ``target`` by copying the sources into it. This function is designed
 * to fit the internal needs of salve and is not meant as a general purpose
 * "extend" function like provided by jQuery or Lodash (for instance).
 *
 * @param target The target to copy into.
 *
 * @param sources The sources from which to copy. These sources are
 * processed in order.
 *
 * @returns The target, modified.
 */
export function extend(target: any, ...sources: any[]): any {
  for (const source of sources) {
    copy(target, source);
  }

  return target;
}

/**
 * This is required to work around a problem when extending built-in classes
 * like ``Error``. Some of the constructors for these classes return a value
 * from the constructor, which is then picked up by the constructors generated
 * by TypeScript (same with ES6 code transpiled through Babel), and this messes
 * up the inheritance chain.
 *
 * See https://github.com/Microsoft/TypeScript/issues/12123.
 */
export function fixPrototype(obj: any, parent: Function): void {
  const oldProto: Function = Object.getPrototypeOf ? Object.getPrototypeOf(obj) :
    (obj as any).__proto__;

  if (oldProto !== parent) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(obj, parent.prototype);
    }
    else {
      (obj as any).__proto__ = parent.prototype;
    }
  }
}
