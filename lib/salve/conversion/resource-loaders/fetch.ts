/**
 * A resource loader that loads resources using ``fetch``.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Resource, ResourceLoader } from "../resource-loader";

// tslint:disable-next-line:no-typeof-undefined
if (typeof fetch === "undefined") {
  throw new Error("trying to load the fetch loader when fetch is absent");
}

export class FetchResource implements Resource {
  constructor(readonly url: URL, readonly response: Response) {}

  async getText(): Promise<string> {
    return this.response.text();
  }
}

/**
 * A resource loader that loads resources using ``fetch``. It can only be used
 * in an environment where ``fetch`` is native or provided by a polyfill.
 *
 * This loader does not allow loading from ``file://``.
 */
export class FetchResourceLoader implements ResourceLoader<FetchResource> {
  async load(url: URL): Promise<FetchResource> {
    if (url.protocol === "file:") {
      throw new Error("this loader cannot load from the file system");
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`unable to fetch ${url}`);
    }

    return new FetchResource(url, response);
  }
}
