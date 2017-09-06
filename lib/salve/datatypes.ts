/**
 * Classes that model datatypes used in RNG schemas.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 *
 */

import { builtin } from "./datatypes/builtin";
import { TypeLibrary } from "./datatypes/library";
import { xmlschema } from "./datatypes/xmlschema";

/**
 * The registry of types.
 */
export class Registry {
  private readonly libraries: { [name: string]: TypeLibrary}
    = Object.create(null);

  /**
   * Adds a library to the registry.
   *
   * @param library The library to add to the registry.
   *
   * @throws {Error} If the URI is already registered.
   */
  add(library: TypeLibrary): void {
    const uri: string = library.uri;
    if (uri in this.libraries) {
      throw new Error(`URI clash: ${uri}`);
    }
    this.libraries[uri] = library;
  }

  /**
   * Searches for a URI in the library.
   *
   * @param uri The URI to search for.
   *
   * @returns The library that corresponds to the URI or ``undefined`` if no
   * such library exists.
   */
  find(uri: string): TypeLibrary | undefined {
    return this.libraries[uri];
  }

  /**
   * Gets the library corresponding to a URI.
   *
   * @param uri The URI.
   *
   * @returns The library that corresponds to the URI.
   *
   * @throws {Error} If the library does not exist.
   */
  // tslint:disable-next-line: no-reserved-keywords
  get(uri: string): TypeLibrary {
    const ret: TypeLibrary | undefined = this.find(uri);
    if (ret === undefined) {
      throw new Error(`can't get library with URI: ${uri}`);
    }

    return ret;
  }
}

export const registry: Registry = new Registry();
registry.add(builtin);
registry.add(xmlschema);

export { ParameterParsingError, ValueValidationError, ValueError }
from "./datatypes/errors";
export { Datatype, RawParameter, TypeLibrary } from "./datatypes/library";

//  LocalWords:  datatypes RNG MPL uri
