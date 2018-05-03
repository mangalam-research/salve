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

function computeContentType(pattern: Element): ContentType | null {
  const name = pattern.local;
  switch (name) {
    case "group":
    case "interleave": {
      const firstCt = computeContentType(pattern.children[0] as Element);
      if (firstCt === null) {
        return null;
      }

      const secondCt = computeContentType(pattern.children[1] as Element);
      if (secondCt === null) {
        return null;
      }

      // These tests combine the groupable(firstCt, secondCt) test together with
      // the requirement that we return the content type which is the greatest.
      if (firstCt === ContentType.COMPLEX && secondCt === ContentType.COMPLEX) {
        return ContentType.COMPLEX;
      }

      if (firstCt === ContentType.EMPTY) {
        return secondCt;
      }

      return (secondCt === ContentType.EMPTY) ? firstCt : null;
    }
    case "choice": {
      // We check secondCt first because the schema simplification puts
      // ``empty`` in the first slot. If the first slot is ``empty``, there's no
      // opportunity for short-circuiting the computation. On the other hand if
      // the second child has a simple content type, we don't neet to know
      // whether the first child is empty or not.
      const secondCt = computeContentType(pattern.children[1] as Element);

      // If the secondCt is simple, we already know what the max value of the
      // two content types is and we can return right away.
      if (secondCt === null || secondCt === ContentType.SIMPLE) {
        return secondCt;
      }

      const firstCt = computeContentType(pattern.children[0] as Element);

      return firstCt !== null ?
        (firstCt > secondCt ? firstCt : secondCt) : null;
    }
    case "oneOrMore":
      const ct = computeContentType(pattern.children[0] as Element);

      // The test would be
      //
      // ct !== null && groupable(ct, ct)
      //
      // but the only thing not groupable with itself is ContentType.SIMPLE and
      // if ct === null then forcibly ct !== ContentType.SIMPLE is true so we
      // can simplify to the following.
      return ct !== ContentType.SIMPLE ? ct : null;
    case "text":
    case "ref":
      return ContentType.COMPLEX;
    case "empty":
    case "attribute":
      return ContentType.EMPTY;
    case "value":
    case "data":
    case "list":
      return ContentType.SIMPLE;
    default:
      throw new Error(`unexpected element: ${name}`);
  }
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
  attrNameCache: Map<Element, ConcreteName>;
  typeWarnings: string[];
}

const prohibitedInStart =
  new Set(["attribute", "data", "value", "text", "list", "group", "interleave",
           "oneOrMore", "empty"]);

const prohibitedInList =
  new Set(["list", "ref", "attribute", "text", "interleave"]);

const prohibitedInDataExcept =
  new Set(["attribute", "ref", "text", "list", "group", "interleave",
           "oneOrMore", "empty"]);

class ProhibitedPath extends SchemaValidationError {
  constructor(path: string) {
    super(`prohibited path: ${path}`);
  }
}

/**
 * Perform the final constraint checks, and record some information
 * for checkInterleaveRestriction.
 */
function generalCheck(el: Element): { cache: Record<string, Element[]>;
                                      typeWarnings: string[]; } {
  const ret = Object.create(null);
  ret.interleave = [];
  ret.define = [];

  const typeWarnings: string[] = [];
  _generalCheck(el, ret, {
    inStart: false,
    inAttribute: false,
    inList: false,
    inDataExcept: false,
    inOneOrMore: false,
    inOneOrMoreGroup: false,
    inOneOrMoreInterleave: false,
    inInterlave: false,
    inGroup: false,
    attrNameCache: new Map(),
    typeWarnings,
  });

  return { cache: ret, typeWarnings };
}

function getAttrName(attr: Element,
                     attrToName: Map<Element, ConcreteName>): ConcreteName {
  let pattern = attrToName.get(attr);
  if (pattern === undefined) {
    const namePattern = attr.children[0] as Element;
    pattern = makeNamePattern(namePattern);
    attrToName.set(attr, pattern);
  }

  return pattern;
}

// tslint:disable-next-line:max-func-body-length
function _generalCheck(el: Element,
                       ret: Record<string, Element[]>,
                       state: State): void {
  const name = el.local;

  // Or'ing is faster than checking if the name is in an array or a set.
  if (name === "interleave" || name === "define") {
    ret[name].push(el);
  }

  if (state.inStart && prohibitedInStart.has(name)) {
      throw new ProhibitedPath(`start//${name}`);
  }

  if (state.inAttribute && (name === "attribute" || name === "ref")) {
    throw new ProhibitedPath(`attribute//${name}`);
  }

  if (state.inList && prohibitedInList.has(name)) {
    throw new ProhibitedPath(`list//${name}`);
  }

  if (state.inDataExcept && prohibitedInDataExcept.has(name)) {
    throw new ProhibitedPath(`data/except//${name}`);
  }

  const children = el.children;
  switch (name) {
    case "group":
    case "interleave": {
      const attrs1 = findOccurring(children[0] as Element,
                                   ["attribute"]).attribute;
      if (attrs1.length !== 0) {
        const attrs2 = findOccurring(children[1] as Element,
                                     ["attribute"]).attribute;
        if (attrs2.length !== 0) {
          for (const attr1 of attrs1) {
            for (const attr2 of attrs2) {
              const name1 = getAttrName(attr1, state.attrNameCache);
              const name2 = getAttrName(attr2, state.attrNameCache);
              if (name1.intersects(name2)) {
                throw new SchemaValidationError(
                  `the name classes of two attributes in the same group or
interleave intersect (section 7.3): ${name1} and ${name2}`);
              }
            }
          }
        }
      }
      break;
    }
    case "attribute":
      if (state.inOneOrMoreGroup) {
        throw new ProhibitedPath("oneOrMore//group//attribute");
      }

      if (state.inOneOrMoreInterleave) {
        throw new ProhibitedPath("oneOrMore//interleave//attribute");
      }

      const nameClass = findMultiNames(el, ["anyName", "nsName"]);
      if (nameClass.anyName.length + nameClass.nsName.length !== 0  &&
         !state.inOneOrMore) {
        throw new SchemaValidationError("an attribute with an infinite name \
class must be a descendant of oneOrMore (section 7.3)");
      }
      break;
    case "value": {
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
        state.typeWarnings.push(
          `WARNING: ${el.path} uses the ${typeAttr} type in library \
${libname}`);
      }
      break;
    }
    case "data": {
      // Except is necessarily last.
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

      const hasExcept = (children.length !== 0 &&
                         (children[children.length - 1] as Element) .local ===
                         "except");

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
        state.typeWarnings.push(
          `WARNING: ${el.path} uses the ${typeAttr} type in library \
${libname}`);
      }
      break;
    }
    default:
  }

  // By this time, all elements have a specific internal structure, so we use
  // specialize code to walk the elements instead of using an iteration for
  // everything.
  if (children.length > 0) {
    // This code is crafted to avoid coyping the state object needlessly.
    let newState = state;
    switch (name) {
      case "grammar":
        for (const child of children) {
          _generalCheck(child as Element, ret, newState);
        }
        break;
      case "element":
        // The first child is the name class, which we do not need to walk.
        _generalCheck(children[1] as Element, ret, newState);
        break;
      case "attribute":
        if (!state.inAttribute) {
          newState = { ...state, inAttribute: true };
        }
        // The first child is the name class, which we do not need to walk.
        _generalCheck(children[1] as Element, ret, newState);
        break;
      case "list":
        if (!state.inList) {
          newState = { ...state, inList: true };
        }
        _generalCheck(children[0] as Element, ret, newState);
        break;
      case "except":
        // parent cannot be undefined here.
        // tslint:disable-next-line:no-non-null-assertion
        if (!state.inDataExcept && el.parent!.local === "data") {
          newState = { ...state, inDataExcept: true };
        }
        _generalCheck(children[0] as Element, ret, newState);
        break;
      case "oneOrMore":
        if (!state.inOneOrMore) {
          newState = { ...state, inOneOrMore: true };
        }
        _generalCheck(children[0] as Element, ret, newState);
        break;
      case "group":
        if (!state.inGroup) {
          newState = { ...state, inGroup: true };
          if (!state.inOneOrMoreGroup) {
            newState.inOneOrMoreGroup = state.inOneOrMore;
          }
        }
        _generalCheck(children[0] as Element, ret, newState);
        _generalCheck(children[1] as Element, ret, newState);
        break;
      case "interleave":
        if (!state.inInterlave) {
          newState = { ...state, inInterlave: true };
          if (!state.inOneOrMoreInterleave) {
            newState.inOneOrMoreInterleave = state.inOneOrMore;
          }
        }
        _generalCheck(children[0] as Element, ret, newState);
        _generalCheck(children[1] as Element, ret, newState);
        break;
      case "choice":
        _generalCheck(children[0] as Element, ret, newState);
        _generalCheck(children[1] as Element, ret, newState);
        break;
      case "define":
        const element = children[0] as Element;
        const pattern = element.children[1] as Element;
        const contentType = computeContentType(pattern);
        if (contentType === null) {
          throw new SchemaValidationError(
            `definition ${el.mustGetAttribute("name")} violates the constraint \
on string values (section 7.2)`);
        }
        _generalCheck(children[0] as Element, ret, newState);
        break;
      case "start":
        if (!state.inStart) {
          newState = { ...state, inStart: true };
        }
        _generalCheck(children[0] as Element, ret, newState);
        break;
      case "data":
        const last = children[children.length - 1] as Element;
        // We only need to scan the possible except child, which is necessarily
        // last.
        const hasExcept = (children.length !== 0 && last.local === "except");
        if (hasExcept) {
          _generalCheck(last, ret, newState);
        }
        break;
      case "value":
        // The child can only be a text node.
        break;
      default:
    }
  }
}

const occuringSet = new Set(["group", "interleave", "choice", "oneOrMore"]);

function findOccurring(el: Element,
                       names: string[]): Record<string, Element[]> {
  const ret: Record<string, Element[]> = Object.create(null);
  for (const name of names) {
    ret[name] = (el.local === name) ? [el] : [];
  }

  if (occuringSet.has(el.local)) {
    _findOccuring(el, names, ret);
  }

  return ret;
}

function _findOccuring(el: Element, names: string[],
                       ret: Record<string, Element[]>): void {
  for (const child of el.children) {
    if (!(child instanceof Element)) {
      continue;
    }

    const name = child.local;
    if (names.includes(name)) {
      ret[name].push(child);
    }

    if (occuringSet.has(name)) {
      _findOccuring(child, names, ret);
    }
  }
}

function checkInterleaveRestriction(cached: Record<string, Element[]>,
                                    root: Element): void {
  const { interleave: interleaves, define: defs } = cached;

  if (interleaves.length === 0) {
    return;
  }

  const definesByName = indexBy(defs, getName);
  const defineNameToElementNames: Map<string, ConcreteName> = new Map();

  function getElementNamesForDefine(name: string): ConcreteName {
    let pattern = defineNameToElementNames.get(name);
    if (pattern === undefined) {
      const def = definesByName.get(name);
      // tslint:disable-next-line:no-non-null-assertion
      const element = def!.children[0] as Element;
      const namePattern = element.children[0] as Element;
      pattern = makeNamePattern(namePattern);
      defineNameToElementNames.set(name, pattern);
    }

    return pattern;
  }

  for (const interleave of interleaves) {
    const p1 = interleave.children[0] as Element;
    const p2 = interleave.children[1] as Element;
    const { ref: refs1, text: texts1 } = findOccurring(p1, ["ref", "text"]);
    if (refs1.length === 0 && texts1.length === 0) {
      continue;
    }

    const { ref: refs2, text: texts2 } = findOccurring(p2, ["ref", "text"]);

    if (texts1.length !== 0 && texts2.length !== 0) {
      throw new SchemaValidationError(
        "text present in both patterns of an interleave (section 7.4)");
    }

    if (refs1.length === 0 || refs2.length === 0) {
      continue;
    }

    const names1 = refs1
      .map((x) => getElementNamesForDefine(x.mustGetAttribute("name")));

    const names2 = refs2
      .map((x) => getElementNamesForDefine(x.mustGetAttribute("name")));

    for (const name1 of names1) {
      for (const name2 of names2) {
        if (name1.intersects(name2)) {
          throw new SchemaValidationError(`name classes of elements in both \
patterns of an interleave intersect (section 7.4): ${name1} and ${name2}`);
        }
      }
    }
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

        const check = generalCheck(tree);
        warnings = check.typeWarnings;
        checkInterleaveRestriction(check.cache, tree);

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
