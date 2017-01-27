//
// We need this because we access function names.
//
declare interface Function {
  name: string;
}

declare interface Object {
  setPrototypeOf?: (obj: any, proto: Function) => void;
}
