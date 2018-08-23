/**
 * A resource loader that loads resources using Node's ``fs`` facilities or
 * ``fetch``.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import * as fs from "fs";

import { Resource, ResourceLoader } from "../resource-loader";
import { FetchResourceLoader } from "./fetch";

export class NodeResource implements Resource {
  constructor(readonly url: URL, private readonly text: string) {}

  async getText(): Promise<string> {
    return this.text;
  }
}

/**
 * A resource loader that loads resources using Node's ``fs`` facilities or
 * ``fetch``.
 *
 * URLs with the file: protocol are loaded through Node's ``fs``
 * facilities. Otherwise, fetch is used.
 */
export class NodeResourceLoader implements ResourceLoader {
  // We use composition to delegate network loads to the fetch loader. Extending
  // FetchResourceLoader causes interface complications.
  private readonly fetchLoader: FetchResourceLoader = new FetchResourceLoader();

  async load(url: URL): Promise<Resource> {
    if (url.protocol === "file:") {
      // We convert it back to a path because we need to support Node prior to
      // version 8. Only version 8 and above allows passing a file:// URL
      // directly to fs functions.
      const asString = url.toString().replace(/^file:\/\//, "");

      return new Promise<Resource>((resolve, reject) => {
        fs.readFile(asString, (err, data) => {
          if (err != null) {
            reject(err);

            return;
          }

          resolve(new NodeResource(url, data.toString()));
        });
      });
    }

    return this.fetchLoader.load(url);
  }
}
