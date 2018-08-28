/**
 * Pattern and walker for RNG's ``list`` elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Datatype, registry } from "../datatypes";
import { EName } from "../ename";
import { ValidationError } from "../errors";
import { NameResolver } from "../name_resolver";
import { EndResult, Event, EventSet, InternalFireEventResult, InternalWalker,
         Pattern } from "./base";

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
    let ret = this._value;
    if (ret != null) {
      return ret;
    }

    // We construct a pseudo-context representing the context in the schema
    // file.
    let context: { resolver: NameResolver } | undefined;
    if (this.datatype.needsContext) {
      context = {
        resolver: {
          resolveName: (name: string): EName => {
            return new EName(this.ns, name);
          },

          clone(): NameResolver {
            throw new Error("cannot clone this resolver");
          },
        },
      };
    }
    ret = this._value = this.datatype.parseValue(this.xmlPath,
                                                 this.rawValue, context);

    return ret;
  }

  hasEmptyPattern(): boolean {
    return this.rawValue === "";
  }

  newWalker(): InternalWalker {
    const hasEmptyPattern = this.hasEmptyPattern();

    // tslint:disable-next-line:no-use-before-declare
    return new ValueWalker(this,
                           false,
                           hasEmptyPattern,
                           hasEmptyPattern);
  }
}

/**
 * Walker for [[Value]].
 */
class ValueWalker implements InternalWalker {
  constructor(protected readonly el: Value,
              private matched: boolean,
              public canEndAttribute: boolean,
              public canEnd: boolean) {}

  clone(): this {
    return new ValueWalker(this.el,
                           this.matched,
                           this.canEndAttribute,
                           this.canEnd) as this;
  }

  possible(): EventSet {
    return new Set(this.matched ? undefined :
                   [new Event("text", this.el.rawValue)]);
  }

  possibleAttributes(): EventSet {
    return new Set<Event>();
  }

  fireEvent(name: string, params: string[],
            nameResolver: NameResolver): InternalFireEventResult {
    if (this.matched || name !== "text" ||
        !this.el.datatype.equal(params[0], this.el.value,
                                { resolver: nameResolver })) {
      return new InternalFireEventResult(false);
    }

    this.matched = true;
    this.canEndAttribute = this.canEnd = true;

    return new InternalFireEventResult(true);
  }

  end(): EndResult {
    return this.canEnd ? false :
      [new ValidationError(`value required: ${this.el.rawValue}`)];
  }

  endAttributes(): EndResult {
    return this.canEndAttribute ? false :
      [new ValidationError(`value required: ${this.el.rawValue}`)];
  }
}

//  LocalWords:  RNG's MPL RNG nd possibleCached
