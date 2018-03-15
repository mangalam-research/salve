/**
 * Autoload the simplifiers that are usable on this platform.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

export function autoload(): void {
  // Ideally, each module would contain the information as to what it needs to
  // run but then we'd run into a circular dependency problem: in order to know
  // whether a module can run, we'd need to load it, which may trigger loading
  // of modules that don't exist (like Node modules in a browser). Oops.
  //
  // So this module is responsible for detecting what may be loaded, and loads
  // it. Not as clean, but "good enough" for now.
  //
  // tslint:disable-next-line:no-typeof-undefined
  if (typeof window === "undefined") {
    // Assume we are in Node and load those validators that require Node
    // support.
    // tslint:disable-next-line:no-var-requires no-require-imports
    require("./xsl");
    // tslint:disable-next-line:no-var-requires no-require-imports
    require("./internal");
  }
}
