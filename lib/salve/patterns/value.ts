/**
 * Pattern and walker for RNG's ``list`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Datatype, registry } from "../datatypes";
import { ValidationError } from "../errors";
import { HashMap } from "../hashstructs";
import { NameResolver } from "../name_resolver";
import { addWalker, EndResult, Event, EventSet, InternalWalker, isHashMap,
         isNameResolver, Pattern } from "./base";

/**
 * Value pattern.
 */
export class Value extends Pattern {
  readonly datatype: Datatype;
  readonly rawValue: string;
  private _value: any | undefined;

  /**
   * @param xmlPath This is a string which uniquely identifies the
   * element from the simplified RNG tree. Used in debugging.
   *
   * @param value The value expected in the document.
   *
   * @param type The type of value. ``undefined`` means
   * ``"token"``.
   *
   * @param datatypeLibrary The URI of the datatype library to
   * use. ``undefined`` means use the builtin library.
   *
   * @param ns The namespace in which to interpret the value.
   */
  // tslint:disable-next-line: no-reserved-keywords
  constructor(xmlPath: string, value: string, readonly type: string = "token",
              readonly datatypeLibrary: string = "", readonly ns: string = "") {
    super(xmlPath);
    this.datatype = registry.get(this.datatypeLibrary).types[this.type];
    if (this.datatype === undefined) {
      throw new Error(`unknown type: ${type}`);
    }
    this.rawValue = value;
  }

  get value(): any {
    let ret: any = this._value;
    if (ret != null) {
      return ret;
    }

    // We construct a pseudo-context representing the context in the schema
    // file.
    let context: { resolver: NameResolver } | undefined;
    if (this.datatype.needsContext) {
      const nr: NameResolver = new NameResolver();
      nr.definePrefix("", this.ns);
      context = { resolver: nr };
    }
    ret = this._value = this.datatype.parseValue(this.xmlPath,
                                                 this.rawValue, context);

    return ret;
  }
}

/**
 * Walker for [[Value]].
 */
class ValueWalker extends InternalWalker<Value> {
  private matched: boolean;
  private readonly context: { resolver: NameResolver } | undefined;
  private readonly nameResolver: NameResolver;

  protected constructor(other: ValueWalker, memo: HashMap);
  protected constructor(el: Value, nameResolver: NameResolver);
  protected constructor(elOrWalker: Value |  ValueWalker,
                        nameResolverOrMemo: HashMap | NameResolver) {
    if (elOrWalker instanceof ValueWalker) {
      const walker: ValueWalker = elOrWalker;
      const memo: HashMap = isHashMap(nameResolverOrMemo, "as 2nd argument");
      super(walker, memo);
      this.nameResolver = this._cloneIfNeeded(walker.nameResolver, memo);
      this.context = walker.context !== undefined ?
        { resolver: this.nameResolver } : undefined;
      this.matched = walker.matched;
    }
    else {
      const el: Value = elOrWalker;
      const nameResolver: NameResolver = isNameResolver(nameResolverOrMemo,
                                                        "as 2nd argument");
      super(el);
      this.nameResolver = nameResolver;
      this.context = el.datatype.needsContext ?
        { resolver: this.nameResolver } : undefined;
      this.matched = false;
    }
  }

  _possible(): EventSet {
    if (this.possibleCached === undefined) {
      this.possibleCached = this.matched ? new EventSet() :
        new EventSet(new Event("text", this.el.rawValue));
    }

    return this.possibleCached;
  }

  fireEvent(ev: Event): false | undefined {
    if (this.matched || ev.params[0] !== "text" ||
       !this.el.datatype.equal(ev.params[1] as string, this.el.value,
                               this.context)) {
      return undefined;
    }

    this.matched = true;
    this.possibleCached = undefined;

    return false;
  }

  canEnd(attribute: boolean = false): boolean {
    return this.matched || this.el.rawValue === "";
  }

  end(attribute: boolean = false): EndResult {
    return this.canEnd(attribute) ? false :
      [new ValidationError(`value required: ${this.el.rawValue}`)];
  }

  _suppressAttributes(): void {
    // No child attributes.
  }
}

addWalker(Value, ValueWalker);

//  LocalWords:  RNG's MPL RNG nd possibleCached
