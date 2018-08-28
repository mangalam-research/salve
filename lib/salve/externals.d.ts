/**
 * Glue for external libraries and symbols.
 */
declare module "xregexp/lib/xregexp" {
  export default class XRegExp extends RegExp {
    constructor(pattern: string);
  }
}

declare module "xregexp/lib/addons/unicode-base" {
  // tslint:disable-next-line:import-name
  import XRegExp from "xregexp/lib/xregexp";

  export default function base(something: typeof XRegExp): void;
}

declare module "xregexp/lib/addons/unicode-blocks" {
  // tslint:disable-next-line:import-name
  import XRegExp from "xregexp/lib/xregexp";

  export default function blocks(something: typeof XRegExp): void;
}

declare module "xregexp/lib/addons/unicode-categories" {
  // tslint:disable-next-line:import-name
  import XRegExp from "xregexp/lib/xregexp";

  export default function categories(something: typeof XRegExp): void;
}
