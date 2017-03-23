/**
 * Fix omissions in the global declarations.
 */
//
// We need this because we access function names.
//
declare interface Function {
  name: string;
}

declare interface Object {
  // tslint:disable-next-line: prefer-method-signature
  setPrototypeOf?: (obj: any, proto: Function) => void;
}
