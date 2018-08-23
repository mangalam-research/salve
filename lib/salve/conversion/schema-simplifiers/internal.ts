/**
 * A simplifier implemented in TypeScript (thus internal to Salve).
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { SaxesParser } from "saxes";

import { registry, ValueError, ValueValidationError } from "../../datatypes";
import { readTreeFromJSON } from "../../json-format/read";
import { NameResolver } from "../../name_resolver";
import { AnyName, ConcreteName, Grammar, Name, NameChoice,
         NsName } from "../../patterns";
import * as relaxng from "../../schemas/relaxng";
import { BasicParser, Element, Text, Validator } from "../parser";
import { ResourceLoader } from "../resource-loader";
import { ManifestEntry, registerSimplifier, SchemaSimplifierOptions,
         SimplificationResult } from "../schema-simplification";
import { SchemaValidationError } from "../schema-validation";
import * as simplifier from "../simplifier";
import { findMultiNames, getName, indexBy } from "../simplifier/util";
import { BaseSimplifier } from "./base";
import { fromQNameToURI, localName } from "./common";

function makeNamePattern(el: Element): ConcreteName {
  switch (el.local) {
    case "name":
      return new Name("", el.mustGetAttribute("ns"), el.text);
    case "choice":
      return new NameChoice("",
                            makeNamePattern(el.children[0] as Element),
                            makeNamePattern(el.children[1] as Element));
    case "anyName": {
      const first = el.children[0] as Element;

      return new AnyName("",
                         first !== undefined ? makeNamePattern(first) :
                         undefined);
    }
    case "nsName": {
      const first = el.children[0] as Element;

      return new NsName("",
                        el.mustGetAttribute("ns"),
                        first !== undefined ? makeNamePattern(first) :
                        undefined);
    }
    case "except":
      return makeNamePattern(el.children[0] as Element);
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
  readonly contentType: ContentType | null;

  readonly occurringAttributes: ReadonlyArray<Element>;

  // We considered making this variable a Set. Multiple ref of the same name are
  // bound to happen in any schemas beyond trivial ones. However, the cost of
  // maintaining Set objects negates the benefits that occur when checking
  // interleave elements.
  readonly occurringRefs: ReadonlyArray<Element>;

  readonly occurringTexts: number;
}

const EMPTY_ELEMENT_ARRAY: ReadonlyArray<Element> = [];

const TEXT_RESULT: CheckResult = {
  contentType: ContentType.COMPLEX,
  occurringAttributes: EMPTY_ELEMENT_ARRAY,
  occurringRefs: EMPTY_ELEMENT_ARRAY,
  occurringTexts: 1,
};

const EMPTY_RESULT: CheckResult = {
  contentType: ContentType.EMPTY,
  occurringAttributes: EMPTY_ELEMENT_ARRAY,
  occurringRefs: EMPTY_ELEMENT_ARRAY,
  occurringTexts: 0,
};

const DATA_RESULT: CheckResult = {
  contentType: ContentType.SIMPLE,
  occurringAttributes: EMPTY_ELEMENT_ARRAY,
  occurringRefs: EMPTY_ELEMENT_ARRAY,
  occurringTexts: 0,
};

const LIST_RESULT = DATA_RESULT;
const VALUE_RESULT = DATA_RESULT;

const NOT_ALLOWED_RESULT: CheckResult = {
  contentType: null,
  occurringAttributes: EMPTY_ELEMENT_ARRAY,
  occurringRefs: EMPTY_ELEMENT_ARRAY,
  occurringTexts: 0,
};

const DEFINE_RESULT = NOT_ALLOWED_RESULT;
const START_RESULT = NOT_ALLOWED_RESULT;
const GRAMMAR_RESULT = NOT_ALLOWED_RESULT;
const EXCEPT_RESULT = NOT_ALLOWED_RESULT;

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
      occurringRefs: EMPTY_ELEMENT_ARRAY,
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

    return EXCEPT_RESULT;
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

    return LIST_RESULT;
  }

  dataHandler(el: Element, state: State): CheckResult {
    if (state.inStart) {
      throw new ProhibitedStartPath(el.local);
    }

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

    const children = el.children;
    const last = children[children.length - 1] as Element;
    // We only need to scan the possible except child, which is necessarily
    // last.
    const hasExcept = (children.length !== 0 && last.local === "except");

    const limit = hasExcept ? children.length - 1 : children.length;
    // Running parseParams if we have no params is expensive. And if there are
    // no params, there's nothing to check so don't run parseParams without
    // params.
    if (limit > 0) {
      const params: { name: string; value: string }[] = [];
      for (let ix = 0; ix < limit; ++ix) {
        const child = children[ix] as Element;
        params.push({
          name: child.mustGetAttribute("name"),
          value: child.text,
        });
      }

      datatype.parseParams(el.path, params);
    }

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

    return DATA_RESULT;
  }

  valueHandler(el: Element, state: State): CheckResult {
    if (state.inStart) {
      throw new ProhibitedStartPath(el.local);
    }

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

    let value = el.text;
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

    return VALUE_RESULT;
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

    return TEXT_RESULT;
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
      occurringAttributes: EMPTY_ELEMENT_ARRAY,
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

    return EMPTY_RESULT;
  }

  notAllowedHandler(): CheckResult {
    return NOT_ALLOWED_RESULT;
  }

  defineHandler(el: Element, state: State): CheckResult {
    const { contentType } = this._check(el.children[0] as Element, state);
    if (contentType === null) {
      throw new SchemaValidationError(
        `definition ${el.mustGetAttribute("name")} violates the constraint \
on string values (section 7.2)`);
    }

    return DEFINE_RESULT;
  }

  startHandler(el: Element, state: State): CheckResult {
    this._check(el.children[0] as Element, { ...state, inStart: true });

    return START_RESULT;
  }

  grammarHandler(el: Element, state: State): CheckResult {
    for (const child of el.children) {
      this._check(child as Element, state);
    }

    return GRAMMAR_RESULT;
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
export class InternalSimplifier<RL extends ResourceLoader>
  extends BaseSimplifier {
  static validates: true = true;
  static createsManifest: true = true;

  private lastStepStart?: number;
  private readonly manifestPromises: PromiseLike<ManifestEntry>[] = [];

  constructor(options: SchemaSimplifierOptions<RL>) {
    super(options);
    if (options.timing) {
      options.verbose = true;
    }
  }

  private async parse(filePath: URL): Promise<Element> {
    const schemaResource = await this.options.resourceLoader.load(filePath);
    const schemaText = await schemaResource.getText();
    let validator: Validator | undefined;
    if (this.options.validate) {
      validator = new Validator(getGrammar());
    }

    const fileName = filePath.toString();
    const parser = new BasicParser(new SaxesParser({ xmlns: true,
                                                     position: false,
                                                     fileName }),
                                   validator);
    parser.saxesParser.write(schemaText);
    parser.saxesParser.close();

    if (validator !== undefined) {
      if (validator.errors.length !== 0) {
        const message = validator.errors.map((x) => x.toString()).join("\n");
        throw new SchemaValidationError(message);
      }
    }

    if (this.options.createManifest) {
      const algo = this.options.manifestHashAlgorithm;
      if (typeof algo === "string") {
        this.manifestPromises.push((async () => {
          const digest =
            // tslint:disable-next-line:await-promise
            await crypto.subtle.digest(algo,
                                       new TextEncoder().encode(schemaText));

          const arr = new Uint8Array(digest);
          let hash = `${algo}-`;
          for (const x of arr) {
            const hex = x.toString(16);
            hash += x > 0xF ? hex : `0${hex}`;
          }

          return { filePath: fileName, hash };
        })());
      }
      else {
        this.manifestPromises.push((async () => {
          const hash = await algo(schemaResource);

          return { filePath: fileName, hash };
        })());
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

    return {
      simplified: tree,
      warnings,
      manifest: await Promise.all(this.manifestPromises),
    };
  }
}

registerSimplifier("internal", InternalSimplifier);
