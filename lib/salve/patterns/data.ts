/**
 * Pattern and walker for RNG's ``data`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Datatype, RawParameter, registry } from "../datatypes";
import { ValidationError } from "../errors";
import { NameResolver } from "../name_resolver";
import { EndResult, Event, EventSet, InternalFireEventResult, InternalWalker,
         Pattern } from "./base";
/**
 * Data pattern.
 */
export class Data extends Pattern {
  readonly datatype: Datatype;
  readonly rngParams?: RawParameter[];
  private _params: any;

  /**
   *
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param type The type of value.
   *
   * @param datatypeLibrary The URI of the datatype library to use.
   *
   * @param params The parameters from the RNG file.
   *
   * @param except The exception pattern.
   */
  // tslint:disable-next-line: no-reserved-keywords
  constructor(xmlPath: string, readonly type: string = "token",
              readonly datatypeLibrary: string = "", params?: RawParameter[],
              readonly except?: Pattern) {
    super(xmlPath);
    this.datatype = registry.get(this.datatypeLibrary).types[this.type];
    if (this.datatype === undefined) {
      throw new Error(`unknown type: ${type}`);
    }
    this.rngParams = params;
  }

  get params(): any {
    let ret: any = this._params;
    if (ret != null) {
      return ret;
    }

    ret = this._params = this.datatype.parseParams(this.xmlPath,
                                                   this.rngParams);

    return ret;
  }

  allowsEmptyContent(): boolean {
    return !(this.except !== undefined && this.except.hasEmptyPattern()) &&
      !this.datatype.disallows("", this.params);
  }

  newWalker(): InternalWalker<Data> {
    // tslint:disable-next-line:no-use-before-declare
    return new DataWalker(this);
  }
}

/**
 * Walker for [[Data]].
 */
class DataWalker extends InternalWalker<Data> {
  protected readonly el: Data;
  private matched: boolean;
  canEndAttribute: boolean;
  canEnd: boolean;

  /**
   * @param el The pattern for which this walker was created.
   *
   * @param resolver The name resolver that can be used to convert namespace
   * prefixes to namespaces.
   */
  constructor(other: DataWalker);
  constructor(el: Data);
  constructor(elOrWalker: DataWalker | Data) {
    super();
    if ((elOrWalker as Data).newWalker !== undefined) {
      const el = elOrWalker as Data;
      this.el = el;
      this.matched = false;
      this.canEnd = this.el.allowsEmptyContent();
      this.canEndAttribute = this.canEnd;
    }
    else {
      const walker = elOrWalker as DataWalker;
      this.el = walker.el;
      this.matched = walker.matched;
      this.canEnd = walker.canEnd;
      this.canEndAttribute = walker.canEndAttribute;
    }
  }

  _clone(): this {
    return new DataWalker(this) as this;
  }

  possible(): EventSet {
    // We completely ignore the possible exception when producing the
    // possibilities. There is no clean way to specify such an exception.
    return new Set(this.matched ? undefined :
                   [new Event("text", this.el.datatype.regexp)]);
  }

  possibleAttributes(): EventSet {
    return new Set();
  }

  fireEvent(name: string, params: string[],
            nameResolver: NameResolver): InternalFireEventResult {
    const ret = new InternalFireEventResult(false);
    if (this.matched || name !== "text" ||
        this.el.datatype.disallows(params[0], this.el.params,
                                   { resolver: nameResolver })) {
      return ret;
    }

    if (this.el.except !== undefined) {
      const walker = this.el.except.newWalker();
      const exceptRet = walker.fireEvent(name, params, nameResolver);

      // False, so the except does match the text, and so this pattern does
      // not match it.
      if (exceptRet.matched) {
        return ret;
      }

      // Otherwise, it is undefined, in which case it means the except does
      // not match the text, and we are fine. Or it would be possible for the
      // walker to have returned an error but there is nothing we can do with
      // such errors here.
    }

    // If we matched, we are done. salve does not allow text that appears in
    // an XML element to be passed as two "text" events. So there is nothing
    // to come that could falsify the match. (If a client *does* pass
    // multiple text events one after the other, it is using salve
    // incorrectly.)
    this.matched = true;
    this.canEnd = true;
    this.canEndAttribute = true;

    ret.matched = true;

    return ret;
  }

  end(): EndResult {
    return this.canEnd ? false : [new ValidationError("value required")];
  }

  endAttributes(): EndResult {
    return false;
  }
}

//  LocalWords:  RNG's MPL RNG nd possibleCached
