/**
 * A mock implementation of Node's util package. This module implements only
 * what is actually used in salve.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

/**
 * A mock of Node's ``util.inspect``.
 */
export function inspect(x: any): string {
  if (x === undefined) {
    return "undefined";
  }

  if (x === null) {
    return "null";
  }

  return x.toString();
}

// LocalWords:  util Dubeau MPL Mangalam
