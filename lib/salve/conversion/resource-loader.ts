/**
 * Facilities for loading resources.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

export interface Resource {
  /**
   * Get the resource as a string.
   */
  getText(): Promise<string>;
}

export interface ResourceLoader<R extends Resource = Resource> {
  /**
   * @param path The path from which to load the resource. ``file://`` paths are
   * understood to be pointing into the filesystem local to the JavaScript
   * virtual machine executing this code. Note that some resource loaders may be
   * incapable of loading specific URLs. For instance a browser-based resource
   * loader will normally refuse loading files from the local file system.
   *
   * @returns The resource.
   */
  load(path: URL): Promise<R>;
}

// tslint:disable-next-line:no-typeof-undefined
if (typeof fetch === "undefined") {
  throw new Error("all resource loaders require fetch to be available");
}

// These imports actually only import TypeScript type information, and do not
// result in ``require`` calls being made. We use them for the castings done
// below.
import * as fetch_ from "./resource-loaders/fetch";
import * as node_ from "./resource-loaders/node";

export function makeResourceLoader(): ResourceLoader {
  // tslint:disable-next-line:no-typeof-undefined
  if (typeof window === "undefined") {
    // tslint:disable-next-line:no-require-imports
    const node = require("./resource-loaders/node") as typeof node_;

    return new node.NodeResourceLoader();
  }

  // tslint:disable-next-line:no-require-imports
  const fetch = require("./resource-loaders/fetch") as typeof fetch_;

  return new fetch.FetchResourceLoader();
}
