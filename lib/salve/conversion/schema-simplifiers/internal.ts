/**
 * A simplifier implemented in TypeScript (thus internal to Salve).
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import * as sax from "sax";

import { registry, ValueError, ValueValidationError } from "../../datatypes";
import { readTreeFromJSON } from "../../json-format/read";
import { NameResolver } from "../../name_resolver";
import { AnyName, ConcreteName, Grammar, Name, NameChoice,
         NsName } from "../../patterns";
import * as relaxng from "../../schemas/relaxng";
import { BasicParser, Element, Text, Validator } from "../parser";
import { registerSimplifier, SchemaSimplifierOptions,
         SimplificationResult } from "../schema-simplification";
import { SchemaValidationError } from "../schema-validation";
import * as simplifier from "../simplifier";
import { findMultiNames, getName, indexBy } from "../simplifier/util";
import { BaseSimplifier } from "./base";
import { fromQNameToURI, localName } from "./common";

function makeNamePattern(el: Element): ConcreteName {
  const first = el.children[0] as Element;
  const second = el.children[1] as Element;
  switch (el.local) {
    case "name":
      return new Name("", el.mustGetAttribute("ns"), el.text);
    case "choice":
      return new NameChoice("", makeNamePattern(first),
                            makeNamePattern(second));
    case "anyName": {
      return new AnyName("",
                         first !== undefined ? makeNamePattern(first) :
                         undefined);
    }
    case "nsName": {
      return new NsName("",
                        el.mustGetAttribute("ns"),
                        first !== undefined ? makeNamePattern(first) :
                        undefined);
    }
    case "except":
      return makeNamePattern(first);
    default:
      throw new Error(`unexpected element in name pattern ${el.local}`);
  }
}

const enum ContentType {
  EMPTY,
  COMPLEX,
  SIMPLE,
}

interface State {
  inStart: boolean;
  inAttribute: boolean;
  inList: boolean;
  inDataExcept: boolean;
  inOneOrMore: boolean;
  inOneOrMoreGroup: boolean;
  inOneOrMoreInterleave: boolean;
  inInterlave: boolean;
  inGroup: boolean;
}

class ProhibitedPath extends SchemaValidationError {
  constructor(path: string) {
    super(`prohibited path: ${path}`);
  }
}

class ProhibitedAttributePath extends SchemaValidationError {
  constructor(name: string) {
    super(`attribute//${name}`);
  }
}

class ProhibitedListPath extends SchemaValidationError {
  constructor(name: string) {
    super(`list//${name}`);
  }
}

class ProhibitedStartPath extends SchemaValidationError {
  constructor(name: string) {
    super(`start//${name}`);
  }
}

class ProhibitedDataExceptPath extends SchemaValidationError {
  constructor(name: string) {
    super(`data/except//${name}`);
  }
}

interface CheckResult {
  contentType: ContentType | null;
  occurringAttributes: Element[];
  occurringRefs: Element[];
  occurringTexts: number;
}

type Handler = (this: GeneralChecker, el: Element,
                state: State) => CheckResult;

/**
 * Perform the final constraint checks, and record some information
 * for checkInterleaveRestriction.
 */
class GeneralChecker {
  private readonly attrNameCache: Map<Element, ConcreteName> = new Map();
  private definesByName!: Map<string, Element>;
  private readonly defineNameToElementNames: Map<string, ConcreteName> =
    new Map();
  readonly typeWarnings: string[] = [];

  check(el: Element): void {
    this.definesByName = indexBy(el.children.slice(1) as Element[], getName);
    this._check(el, {
      inStart: false,
      inAttribute: false,
      inList: false,
      inDataExcept: false,
      inOneOrMore: false,
      inOneOrMoreGroup: false,
      inOneOrMoreInterleave: false,
      inInterlave: false,
      inGroup: false,
    });
  }

  // tslint:disable-next-line:max-func-body-length
  private _check(el: Element, state: State): CheckResult {
    const name = el.local;

    const method = (this as any)[`${name}Handler`] as Handler;

    return method.call(this, el, state);
  }

  elementHandler(el: Element, state: State): CheckResult {
    // The first child is the name class, which we do not need to walk.
    return this._check(el.children[1] as Element, state);
  }

  attributeHandler(el: Element, state: State): CheckResult {
    if (state.inOneOrMoreGroup) {
      throw new ProhibitedPath("oneOrMore//group//attribute");
    }

    if (state.inOneOrMoreInterleave) {
      throw new ProhibitedPath("oneOrMore//interleave//attribute");
    }

    if (state.inAttribute) {
      throw new ProhibitedAttributePath(el.local);
    }

    if (state.inList) {
      throw new ProhibitedListPath(el.local);
    }

    if (state.inStart) {
      throw new ProhibitedStartPath(el.local);
    }

    if (state.inDataExcept) {
      throw new ProhibitedDataExceptPath(el.local);
    }

    const nameClass = findMultiNames(el, ["anyName", "nsName"]);
    if (nameClass.anyName.length + nameClass.nsName.length !== 0  &&
        !state.inOneOrMore) {
      throw new SchemaValidationError("an attribute with an infinite name \
class must be a descendant of oneOrMore (section 7.3)");
    }

    // The first child is the name class, which we do not need to walk.
    this._check(el.children[1] as Element, { ...state, inAttribute: true });

    return {
      contentType: ContentType.EMPTY,
      occurringAttributes: [el],
      occurringRefs: [],
      occurringTexts: 0,
    };
  }

  exceptHandler(el: Element, state: State): CheckResult {
    // parent cannot be undefined here.
    let newState = state;
    // tslint:disable-next-line:no-non-null-assertion
    if (!state.inDataExcept && el.parent!.local === "data") {
      newState = { ...state, inDataExcept: true };
    }
    this._check(el.children[0] as Element, newState);

    return {
      contentType: null,
      occurringAttributes: [],
      occurringRefs: [],
      occurringTexts: 0,
    };
  }

  oneOrMoreHandler(el: Element, state: State): CheckResult {
    if (state.inStart) {
      throw new ProhibitedStartPath(el.local);
    }

    if (state.inDataExcept) {
      throw new ProhibitedDataExceptPath(el.local);
    }

    const { contentType, occurringAttributes, occurringRefs,
            occurringTexts } =
      this._check(el.children[0] as Element, { ...state, inOneOrMore: true });

    // The test would be
    //
    // ct !== null && groupable(ct, ct)
    //
    // but the only thing not groupable with itself is ContentType.SIMPLE
    // and if ct === null then forcibly ct !== ContentType.SIMPLE
    // is true so we can simplify to the following.
    return {
      contentType: contentType !== ContentType.SIMPLE ? contentType : null,
      occurringAttributes,
      occurringRefs,
      occurringTexts,
    };
  }

  groupHandler(el: Element, state: State): CheckResult {
    if (state.inStart) {
      throw new ProhibitedStartPath(el.local);
    }

    if (state.inDataExcept) {
      throw new ProhibitedDataExceptPath(el.local);
    }

    return this.groupInterleaveHandler(
      el.children as Element[],
      {
        ...state,
        inGroup: true,
        inOneOrMoreGroup: state.inOneOrMore,
      },
      false);
  }

  interleaveHandler(el: Element, state: State): CheckResult {
    if (state.inStart) {
      throw new ProhibitedStartPath(el.local);
    }

    if (state.inList) {
      throw new ProhibitedListPath(el.local);
    }

    if (state.inDataExcept) {
      throw new ProhibitedDataExceptPath(el.local);
    }

    return this.groupInterleaveHandler(
      el.children as Element[],
      {
        ...state, inInterlave: true,
        inOneOrMoreInterleave: state.inOneOrMore,
      },
      true);
  }

  choiceHandler(el: Element, state: State): CheckResult {
    const { contentType: firstCt, occurringAttributes: firstAttributes,
            occurringRefs: firstRefs, occurringTexts: firstTexts } =
      this._check(el.children[0] as Element, state);
    const { contentType: secondCt, occurringAttributes: secondAttributes,
            occurringRefs: secondRefs, occurringTexts: secondTexts } =
      this._check(el.children[1] as Element, state);

    return {
      contentType: firstCt !== null && secondCt !== null ?
        (firstCt > secondCt ? firstCt : secondCt) : null,
      occurringAttributes: firstAttributes.concat(secondAttributes),
      occurringRefs: firstRefs.concat(secondRefs),
      occurringTexts: firstTexts + secondTexts,
    };
  }

  listHandler(el: Element, state: State): CheckResult {
    if (state.inList) {
      throw new ProhibitedListPath(el.local);
    }

    if (state.inStart) {
      throw new ProhibitedStartPath(el.local);
    }

    if (state.inDataExcept) {
      throw new ProhibitedDataExceptPath(el.local);
    }

    this._check(el.children[0] as Element, { ...state, inList: true });

    return {
      contentType: ContentType.SIMPLE,
      occurringAttributes: [],
      occurringRefs: [],
      occurringTexts: 0,
    };
  }

  dataHandler(el: Element, state: State): CheckResult {
    if (state.inStart) {
      throw new ProhibitedStartPath(el.local);
    }

    const children = el.children;
    const last = children[children.length - 1] as Element;
    // We only need to scan the possible except child, which is necessarily
    // last.
    const hasExcept = (children.length !== 0 && last.local === "except");

    const typeAttr = el.mustGetAttribute("type");
    const libname = el.mustGetAttribute("datatypeLibrary");
    const lib = registry.find(libname);
    if (lib === undefined) {
      throw new ValueValidationError(
        el.path, [new ValueError(`unknown datatype library: ${libname}`)]);
    }

    const datatype = lib.types[typeAttr];
    if (datatype === undefined) {
      throw new ValueValidationError(
        el.path,
        [new ValueError(`unknown datatype ${typeAttr} in \
${(libname === "") ? "default library" : `library ${libname}`}`)]);
    }

    const params = children.slice(
      0, hasExcept ? children.length - 1 : undefined).map(
        (child: Element) => ({
          name: child.mustGetAttribute("name"),
          value: child.text,
        }));

    datatype.parseParams(el.path, params);

    // tslint:disable-next-line: no-http-string
    if (libname === "http://www.w3.org/2001/XMLSchema-datatypes" &&
        (typeAttr === "ENTITY" || typeAttr === "ENTITIES")) {
      this.typeWarnings.push(
        `WARNING: ${el.path} uses the ${typeAttr} type in library \
${libname}`);
    }

    if (hasExcept) {
      this._check(last, state);
    }

    return {
      contentType: ContentType.SIMPLE,
      occurringAttributes: [],
      occurringRefs: [],
      occurringTexts: 0,
    };
  }

  valueHandler(el: Element, state: State): CheckResult {
    if (state.inStart) {
      throw new ProhibitedStartPath(el.local);
    }

    let value = el.text;
    const typeAttr = el.mustGetAttribute("type");
    const libname = el.mustGetAttribute("datatypeLibrary");
    let ns = el.mustGetAttribute("ns");

    const lib = registry.find(libname);
    if (lib === undefined) {
      throw new ValueValidationError(
        el.path,
        [new ValueError(`unknown datatype library: ${libname}`)]);
    }

    const datatype = lib.types[typeAttr];
    if (datatype === undefined) {
      throw new ValueValidationError(
        el.path,
        [new ValueError(`unknown datatype ${typeAttr} in \
${(libname === "") ? "default library" : `library ${libname}`}`)]);
    }

    if (datatype.needsContext &&
        // tslint:disable-next-line: no-http-string
        !(libname === "http://www.w3.org/2001/XMLSchema-datatypes" &&
          (typeAttr === "QName" || typeAttr === "NOTATION"))) {
      throw new Error("datatype needs context but is not " +
                      "QName or NOTATION form the XML Schema " +
                      "library: don't know how to handle");
    }

    let context: { resolver : NameResolver } | undefined;
    if (datatype.needsContext) {
      // Change ns to the namespace we need.
      ns = fromQNameToURI(value, el);
      el.setAttribute("ns", ns);
      value = localName(value);
      el.empty();
      el.appendChild(new Text(value));

      const nr = new NameResolver();
      nr.definePrefix("", ns);
      context = { resolver: nr };
    }

    datatype.parseValue(el.path, value, context);

    // tslint:disable-next-line: no-http-string
    if (libname === "http://www.w3.org/2001/XMLSchema-datatypes" &&
        (typeAttr === "ENTITY" || typeAttr === "ENTITIES")) {
      this.typeWarnings.push(
        `WARNING: ${el.path} uses the ${typeAttr} type in library \
${libname}`);
    }

    // The child of value can only be a text node.
    return {
      contentType: ContentType.SIMPLE,
      occurringAttributes: [],
      occurringRefs: [],
      occurringTexts: 0,
    };
  }

  textHandler(el: Element, state: State): CheckResult {
    if (state.inList) {
      throw new ProhibitedListPath(el.local);
    }

    if (state.inStart) {
      throw new ProhibitedStartPath(el.local);
    }

    if (state.inDataExcept) {
      throw new ProhibitedDataExceptPath(el.local);
    }

    return {
      contentType: ContentType.COMPLEX,
      occurringAttributes: [],
      occurringRefs: [],
      occurringTexts: 1,
    };
  }

  refHandler(el: Element, state: State): CheckResult {
    if (state.inList) {
      throw new ProhibitedListPath(el.local);
    }

    if (state.inAttribute) {
      throw new ProhibitedAttributePath(el.local);
    }

    if (state.inDataExcept) {
      throw new ProhibitedDataExceptPath(el.local);
    }

    return {
      contentType: ContentType.COMPLEX,
      occurringAttributes: [],
          occurringRefs: [el],
      occurringTexts: 0,
    };
  }

  emptyHandler(el: Element, state: State): CheckResult {
    if (state.inStart) {
      throw new ProhibitedStartPath(el.local);
    }

    if (state.inDataExcept) {
      throw new ProhibitedDataExceptPath(el.local);
    }

    return {
      contentType: ContentType.EMPTY,
      occurringAttributes: [],
      occurringRefs: [],
      occurringTexts: 0,
    };
  }

  notAllowedHandler(): CheckResult {
    return {
      contentType: null,
      occurringAttributes: [],
      occurringRefs: [],
      occurringTexts: 0,
    };
  }

  defineHandler(el: Element, state: State): CheckResult {
    const { contentType } = this._check(el.children[0] as Element, state);
    if (contentType === null) {
      throw new SchemaValidationError(
        `definition ${el.mustGetAttribute("name")} violates the constraint \
on string values (section 7.2)`);
    }

    return {
      contentType: null,
      occurringAttributes: [],
      occurringRefs: [],
      occurringTexts: 0,
    };
  }

  startHandler(el: Element, state: State): CheckResult {
    this._check(el.children[0] as Element, { ...state, inStart: true });

    return {
      contentType: null,
      occurringAttributes: [],
          occurringRefs: [],
      occurringTexts: 0,
    };
  }

  grammarHandler(el: Element, state: State): CheckResult {
    for (const child of el.children) {
      this._check(child as Element, state);
    }

    return {
      contentType: null,
      occurringAttributes: [],
      occurringRefs: [],
      occurringTexts: 0,
    };
  }

  private getAttrName(attr: Element): ConcreteName {
    let pattern = this.attrNameCache.get(attr);
    if (pattern === undefined) {
      const namePattern = attr.children[0] as Element;
      pattern = makeNamePattern(namePattern);
      this.attrNameCache.set(attr, pattern);
    }

    return pattern;
  }

  private getElementNamesForDefine(name: string): ConcreteName {
    let pattern = this.defineNameToElementNames.get(name);
    if (pattern === undefined) {
      const def = this.definesByName.get(name);
      // tslint:disable-next-line:no-non-null-assertion
      const element = def!.children[0] as Element;
      const namePattern = element.children[0] as Element;
      pattern = makeNamePattern(namePattern);
      this.defineNameToElementNames.set(name, pattern);
    }

    return pattern;
  }

  private groupInterleaveHandler(children: Element[],
                                 newState: State,
                                 isInterleave: boolean): CheckResult {
    const { contentType: firstCt, occurringAttributes: firstAttributes,
            occurringRefs: firstRefs, occurringTexts: firstTexts} =
      this._check(children[0], newState);
    const { contentType: secondCt, occurringAttributes: secondAttributes,
            occurringRefs: secondRefs, occurringTexts: secondTexts} =
      this._check(children[1], newState);

    for (const attr1 of firstAttributes) {
      for (const attr2 of secondAttributes) {
        const name1 = this.getAttrName(attr1);
        const name2 = this.getAttrName(attr2);
        if (name1.intersects(name2)) {
          throw new SchemaValidationError(
            `the name classes of two attributes in the same group or
interleave intersect (section 7.3): ${name1} and ${name2}`);
        }
      }
    }

    if (isInterleave) {
      if (firstTexts !== 0 && secondTexts !== 0) {
        throw new SchemaValidationError(
          "text present in both patterns of an interleave (section 7.4)");
      }

      const names1 = firstRefs
        .map((x) => this.getElementNamesForDefine(x.mustGetAttribute("name")));

      const names2 = secondRefs
        .map((x) => this.getElementNamesForDefine(x.mustGetAttribute("name")));

      for (const name1 of names1) {
        for (const name2 of names2) {
          if (name1.intersects(name2)) {
            throw new SchemaValidationError(`name classes of elements in both \
patterns of an interleave intersect (section 7.4): ${name1} and ${name2}`);
          }
        }
      }
    }

    // These tests combine the groupable(firstCt, secondCt) test together with
    // the requirement that we return the content type which is the greatest.
    let contentType: ContentType | null;
    if (firstCt === ContentType.COMPLEX && secondCt === ContentType.COMPLEX) {
      contentType = ContentType.COMPLEX;
    }
    else if (firstCt === ContentType.EMPTY) {
      contentType = secondCt;
    }
    else {
      contentType = (secondCt === ContentType.EMPTY) ? firstCt : null;
    }

    return {
      contentType,
      occurringAttributes: firstAttributes.concat(secondAttributes),
      occurringRefs: firstRefs.concat(secondRefs),
      occurringTexts: firstTexts + secondTexts,
    };
  }
}

let cachedGrammar: Grammar | undefined;

function getGrammar(): Grammar {
  if (cachedGrammar === undefined) {
    cachedGrammar = readTreeFromJSON(JSON.stringify(relaxng));
  }

  return cachedGrammar;
}

/**
 * A simplifier implemented in TypeScript (thus internal to Salve).
 */
export class InternalSimplifier extends BaseSimplifier {
  static validates: true = true;

  private lastStepStart?: number;

  constructor(options: SchemaSimplifierOptions) {
    super(options);
    if (options.timing) {
      options.verbose = true;
    }
  }

  private async parse(filePath: URL): Promise<Element> {
    const schema = await this.options.resourceLoader.load(filePath);
    let validator: Validator | undefined;
    if (this.options.validate) {
      validator = new Validator(getGrammar());
    }

    const parser = new BasicParser(sax.parser(true,
                                              { xmlns: true,
                                                strictEntities: true } as any),
                                   validator);
    parser.saxParser.write(schema);

    if (validator !== undefined) {
      if (validator.errors.length !== 0) {
        const message = validator.errors.map((x) => x.toString()).join("\n");
        throw new SchemaValidationError(message);
      }
    }

    return parser.root;
  }

  stepStart(no: number): void {
    this.stepTiming();
    if (this.options.verbose) {
      // tslint:disable-next-line:no-console
      console.log(`Simplification step ${no}`);
    }
  }

  stepTiming(): void {
    if (this.lastStepStart !== undefined) {
      // tslint:disable-next-line:no-console
      console.log(`${Date.now() - this.lastStepStart}ms`);
      this.lastStepStart = undefined;
    }

    if (this.options.timing) {
      this.lastStepStart = Date.now();
    }
  }

  async simplify(schemaPath: URL): Promise<SimplificationResult> {
    let startTime: number | undefined;
    if (this.options.verbose) {
      // tslint:disable-next-line:no-console
      console.log("Simplifying...");
      if (this.options.timing) {
        startTime = Date.now();
      }
    }

    let warnings: string[] = [];
    let tree!: Element;

    if (this.options.simplifyTo >= 1) {
      this.stepStart(1);
      tree = await this.parse(schemaPath);
      tree = await simplifier.step1(schemaPath, tree, this.parse.bind(this));
    }

    if (this.options.simplifyTo >= 4) {
      this.stepStart(4);
      tree = simplifier.step4(tree);
    }

    if (this.options.simplifyTo >= 6) {
      this.stepStart(6);
      tree = simplifier.step6(tree);
    }

    if (this.options.simplifyTo >= 9) {
      this.stepStart(9);
      tree = simplifier.step9(tree);
    }

    if (this.options.simplifyTo >= 10) {
      this.stepStart(10);
      tree = simplifier.step10(tree, this.options.validate);
    }

    if (this.options.simplifyTo >= 14) {
      this.stepStart(14);
      tree = simplifier.step14(tree);
    }

    if (this.options.simplifyTo >= 15) {
      this.stepStart(15);
      tree = simplifier.step15(tree);
    }

    if (this.options.simplifyTo >= 16) {
      this.stepStart(16);
      tree = simplifier.step16(tree);
    }

    if (this.options.simplifyTo >= 17) {
      this.stepStart(17);
      tree = simplifier.step17(tree);
    }

    if (this.options.simplifyTo >= 18) {
      this.stepStart(18);
      tree = simplifier.step18(tree);
      if (this.options.validate) {
        let checkStart: number | undefined;
        if (this.options.timing) {
          checkStart = Date.now();
        }

        const checker = new GeneralChecker();
        checker.check(tree);
        warnings = checker.typeWarnings;

        if (this.options.timing) {
          // tslint:disable-next-line:no-non-null-assertion no-console
          console.log(`Step 18 check delta: ${Date.now() - checkStart!}`);
        }
      }
    }

    if (this.options.timing) {
      this.stepTiming(); // Output the last timing.
      // tslint:disable-next-line:no-non-null-assertion no-console
      console.log(`Simplification delta: ${Date.now() - startTime!}`);
    }

    return { simplified: tree, warnings };
  }
}

registerSimplifier("internal", InternalSimplifier);
