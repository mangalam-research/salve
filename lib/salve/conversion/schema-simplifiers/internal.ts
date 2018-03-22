/**
 * A simplifier implemented in TypeScript (thus internal to Salve).
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import * as sax from "sax";

import { readTreeFromJSON } from "../../json-format/read";
import { AnyName, ConcreteName, Grammar, Name, NameChoice,
         NsName } from "../../patterns";
import * as relaxng from "../../schemas/relaxng";
import { BasicParser, Element, Validator } from "../parser";
import { registerSimplifier, SchemaSimplifierOptions,
         SimplificationResult } from "../schema-simplification";
import { SchemaValidationError } from "../schema-validation";
import * as simplifier from "../simplifier";
import { findDescendantsByLocalName, findMultiDescendantsByLocalName,
         findMultiNames, getName, indexBy } from "../simplifier/util";
import { BaseSimplifier } from "./base";

function makeNamePattern(el: Element): ConcreteName {
  const first = el.children[0] as Element;
  const second = el.children[1] as Element;
  switch (el.local) {
    case "name":
      return new Name("", el.mustGetAttribute("ns"), el.text);
    case "choice":
      return new NameChoice("", [makeNamePattern(first),
                                 makeNamePattern(second)]);
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

function checkStep10Constraints(el: Element): void {
  switch (el.local) {
    case "except":
      // parent cannot be undefined at this point.
      // tslint:disable-next-line:no-non-null-assertion
      switch (el.parent!.local) {
        case "anyName":
          if (findDescendantsByLocalName(el, "anyName").length !== 0) {
            throw new SchemaValidationError(
              "an except in anyName has an anyName descendant");
          }
          break;
        case "nsName": {
          const { anyName: anyNames, nsName: nsNames } =
            findMultiDescendantsByLocalName(el, ["anyName", "nsName"]);
          if (anyNames.length !== 0) {
            throw new SchemaValidationError(
              "an except in nsName has an anyName descendant");
          }

          if (nsNames.length !== 0) {
            throw new SchemaValidationError(
              "an except in nsName has an nsName descendant");
          }
          break;
        }
        default:
      }
      break;
    case "attribute":
      for (const attrName of findMultiNames(el, ["name"]).name) {
        switch (attrName.getAttribute("ns")) {
          case "":
            if (attrName.text === "xmlns") {
              throw new SchemaValidationError(
                "found attribute with name xmlns outside all namespaces");
            }
            break;
            // tslint:disable-next-line:no-http-string
          case "http://www.w3.org/2000/xmlns":
            throw new SchemaValidationError(
              "found attribute in namespace http://www.w3.org/2000/xmlns");
          default:
        }
      }

      break;
    default:
  }

  for (const child of el.elements) {
    checkStep10Constraints(child);
  }

  // We do not do the checks on ``data`` and ``value`` here. They are done
  // later. The upshot is that fragments of the schema that may be removed in
  // later steps are not checked here.
}

enum ContentType {
  EMPTY,
  COMPLEX,
  SIMPLE,
}

function groupable(a: ContentType, b: ContentType): boolean {
  return a === ContentType.EMPTY || b === ContentType.EMPTY ||
    (a === ContentType.COMPLEX && b === ContentType.COMPLEX);
}

function computeContentType(pattern: Element): ContentType | null {
  const name = pattern.local;
  switch (name) {
    case "value":
    case "data":
    case "list":
      return ContentType.SIMPLE;
    case "text":
    case "ref":
      return ContentType.COMPLEX;
    case "empty":
    case "attribute":
      return ContentType.EMPTY;
    case "interleave":
    case "group": {
      const firstCt = computeContentType(pattern.children[0] as Element);

      if (firstCt === null) {
        return null;
      }

      const secondCt = computeContentType(pattern.children[1] as Element);

      return secondCt !== null && groupable(firstCt, secondCt) ?
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
    case "choice": {
      const firstCt = computeContentType(pattern.children[0] as Element);

      if (firstCt === null) {
        return null;
      }

      const secondCt = computeContentType(pattern.children[1] as Element);

      return secondCt !== null ?
        (firstCt > secondCt ? firstCt : secondCt) : null;
    }
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
  attributes: Map<Element, ConcreteName>;
  textInInterleaveCount: number;
}

// Sets for these did not appear to provide performance benefits.
const prohibitedInStart =
  ["attribute", "data", "value", "text", "list", "group", "interleave",
   "oneOrMore", "empty"];

const prohibitedInList = ["list", "ref", "attribute", "text", "interleave"];

const prohibitedInDataExcept =
  ["attribute", "ref", "text", "list", "group", "interleave", "oneOrMore",
   "empty"];

class ProhibitedPath extends SchemaValidationError {
  constructor(path: string) {
    super(`prohibited path: ${path}`);
  }
}

/**
 * Perform the final constraint checks, and record some information
 * for checkInterleaveRestriction.
 */
function generalCheck(el: Element): Record<string, Element[]> {
  const ret = Object.create(null);
  ret.interleave = [];
  ret.define = [];

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
    attributes: new Map(),
    textInInterleaveCount: 0,
  });

  return ret;
}

// tslint:disable-next-line:max-func-body-length
function _generalCheck(el: Element,
                       ret: Record<string, Element[]>, state: State): void {
  const name = el.local;

  // Or'ing is faster than checking if the name is in an array or a set.
  if (name === "interleave" ||
      name === "define") {
    ret[name].push(el);
  }

  if (state.inStart && prohibitedInStart.includes(name)) {
      throw new ProhibitedPath(`start//${name}`);
  }

  if (state.inAttribute && (name === "attribute" || name === "ref")) {
    throw new ProhibitedPath(`attribute//${name}`);
  }

  if (state.inList && prohibitedInList.includes(name)) {
    throw new ProhibitedPath(`list//${name}`);
  }

  if (state.inDataExcept && prohibitedInDataExcept.includes(name)) {
    throw new ProhibitedPath(`data/except//${name}`);
  }

  switch (name) {
    case "attribute":
      if (state.inOneOrMoreGroup) {
        throw new ProhibitedPath("oneOrMore//group//attribute");
      }

      if (state.inOneOrMoreInterleave) {
        throw new ProhibitedPath("oneOrMore//interleave//attribute");
      }

      const nameClass = findMultiNames(el, ["anyName", "nsName"]);
      if (state.inGroup || state.inInterlave) {
        const namePattern = makeNamePattern(el.children[0] as Element);
        state.attributes.set(el, namePattern);
      }

      if (nameClass.anyName.length + nameClass.nsName.length !== 0  &&
         !state.inOneOrMore) {
        throw new SchemaValidationError("an attribute with an infinite name \
class must be a descendant of oneOrMore (section 7.3)");
      }
      break;
    case "text":
      // Text in an attribute does not count.
      if (!state.inAttribute) {
        state.textInInterleaveCount++;
      }
      break;
    default:
  }

  if (el.children.length > 0) {
    // This code is crafted to avoid coyping the state object needlessly.
    let newState = state;
    switch (name) {
      case "start":
        if (!state.inStart) {
          newState = { ...state, inStart: true };
        }
        break;
      case "attribute":
        if (!state.inAttribute) {
          newState = { ...state, inAttribute: true };
        }
        break;
      case "list":
        if (!state.inList) {
          newState = { ...state, inList: true };
        }
        break;
      case "except":
        // parent cannot be undefined here.
        // tslint:disable-next-line:no-non-null-assertion
        if (!state.inDataExcept && el.parent!.local === "data") {
          newState = { ...state, inDataExcept: true };
        }
        break;
      case "oneOrMore":
        if (!state.inOneOrMore) {
          newState = { ...state, inOneOrMore: true };
        }
        break;
      case "group":
        if (!state.inGroup) {
          newState = { ...state, inGroup: true };
          if (!state.inOneOrMoreGroup) {
            newState.inOneOrMoreGroup = state.inOneOrMore;
          }
        }
        break;
      case "interleave":
        if (!state.inInterlave) {
          newState = { ...state, inInterlave: true };
          if (!state.inOneOrMoreInterleave) {
            newState.inOneOrMoreInterleave = state.inOneOrMore;
          }
        }
        break;
      case "define":
        const element = el.children[0] as Element;
        const pattern = element.children[1] as Element;
        const contentType = computeContentType(pattern);
        if (contentType === null) {
          throw new SchemaValidationError(
            `definition ${el.mustGetAttribute("name")} violates the constraint \
on string values (section 7.2)`);
        }
      default:
    }

    for (const child of el.elements) {
      _generalCheck(child, ret, newState);
    }

    if (name === "group" || name === "interleave") {
      if (newState.attributes.size > 1) {
        const names = Array.from(newState.attributes.values());
        for (let nameIx1 = 0; nameIx1 < names.length - 1; ++nameIx1) {
          const name1 = names[nameIx1];
          for (let nameIx2 = nameIx1 + 1; nameIx2 < names.length; ++nameIx2) {
            const name2 = names[nameIx2];
            if (name1.intersects(name2)) {
              throw new SchemaValidationError(
                `the name classes of two attributes in the same group or
interleave intersect (section 7.3): ${name1} and ${name2}`);
            }
          }
        }
      }

      if (name === "interleave" && newState.textInInterleaveCount > 1) {
        throw new SchemaValidationError(
          "text present in both patterns of an interleave (section 7.4)");
      }
    }

    if (state.inGroup || state.inInterlave) {
      if (state.attributes.size === 0) {
        state.attributes = newState.attributes;
      }
      else {
        for (const [attr, names] of newState.attributes) {
          state.attributes.set(attr, names);
        }
      }

      if (state.inInterlave) {
        state.textInInterleaveCount += newState.textInInterleaveCount;
      }
    }
    else {
      state.attributes.clear();
    }

    if (!state.inInterlave) {
      state.textInInterleaveCount = 0;
    }
  }
}

function findOccurring(el: Element, names: string[]):
Record<string, Element[]> {
  const ret: Record<string, Element[]> = Object.create(null);
  for (const name of names) {
    ret[name] = (el.local === name) ? [el] : [];
  }

  _findOccuring(el, names, ret);

  return ret;
}

const occuringSet = new Set(["group", "interleave", "choice", "oneOrMore"]);

function _findOccuring(el: Element, names: string[],
                       ret: Record<string, Element[]>): void {
  for (const child of el.elements) {
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
      const def = definesByName[name];
      const element = def.children[0] as Element;
      const namePattern = element.children[0] as Element;
      pattern = makeNamePattern(namePattern);
      defineNameToElementNames.set(name, pattern);
    }

    return pattern;
  }

  for (const interleave of interleaves) {
    const p1 = interleave.children[0] as Element;
    const p2 = interleave.children[1] as Element;
    const { ref: refs1 } = findOccurring(p1, ["ref"]);

    if (refs1.length === 0) {
      continue;
    }

    const { ref: refs2 } = findOccurring(p2, ["ref"]);
    if (refs2.length === 0) {
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

    const parser = new BasicParser(sax.parser(true, { xmlns: true }),
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
    let tree = await this.parse(schemaPath);

    if (this.options.simplifyTo >= 1) {
      this.stepStart(1);
      tree = await simplifier.step1(schemaPath, tree, this.parse.bind(this));
    }

    if (this.options.simplifyTo >= 3) {
      this.stepStart(3);
      tree = simplifier.step3(tree);
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
      tree = simplifier.step10(tree);

      // This has to happen after step 13 has been applied, which is included in
      // step 10.
      if (this.options.validate) {
        checkStep10Constraints(tree);
      }
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

        const cachedQueries = generalCheck(tree);
        checkInterleaveRestriction(cachedQueries, tree);
        warnings = this.processDatatypes(tree);

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
