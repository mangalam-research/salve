/**
 * A resource loader that loads resources using Node's ``fs`` facilities or
 * ``fetch``.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import * as fs from "fs";

import { FetchResourceLoader } from "./fetch";

/**
 * A resource loader that loads resources using Node's ``fs`` facilities or
 * ``fetch``.
 *
 * URLs with the file: protocol are loaded through Node's ``fs``
 * facilities. Otherwise, fetch is used.
 */
export class NodeResourceLoader extends FetchResourceLoader {
  async load(url: URL): Promise<string> {
    if (url.protocol === "file:") {
      // We convert it back to a path because we need to support Node prior to
      // version 8. Only version 8 and above allows passing a file:// URL
      // directly to fs functions.
      const asString = url.toString().replace(/^file:\/\//, "");

      return new Promise<string>((resolve, reject) => {
        fs.readFile(asString, (err, data) => {
          if (err != null) {
            reject(err);

            return;
          }

          resolve(data.toString());
        });
      });
    }

    return super.load(url);
  }
}
