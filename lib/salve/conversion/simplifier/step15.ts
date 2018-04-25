/**
 * Simplification step 15.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element } from "../parser";
import { SchemaValidationError } from "../schema-validation";
import { RELAXNG_URI } from "./util";

class GrammarNode {
  readonly childGrammars: GrammarNode[] = [];
  readonly defines: Element[] = [];
  readonly refs: Element[] = [];
  readonly parentRefs: Element[] = [];
  readonly refNames: Set<string> = new Set();
  readonly parentRefNames: Set<string> = new Set();
  readonly defineNames: Set<string> = new Set();

  constructor(readonly id: number, readonly grammar: Element) {}
}

interface State {
  latestId: number;
  root: GrammarNode | null;
  stack: GrammarNode[];
}

function gatherGrammars(el: Element, state: State): void {
  const { local } = el;

  const { stack } = state;
  const top = stack[0];
  let shift = false;
  switch (local) {
    case "grammar":
      shift = true;
      const thisGrammar = new GrammarNode(state.latestId++, el);
      stack.unshift(thisGrammar);
      if (top !== undefined) {
        top.childGrammars.push(thisGrammar);
      }
      break;
    case "define":
      top.defines.push(el);
      top.defineNames.add(el.mustGetAttribute("name"));
      break;
    case "ref":
      top.refs.push(el);
      top.refNames.add(el.mustGetAttribute("name"));
      break;
    case "parentRef":
      top.parentRefs.push(el);
      top.parentRefNames.add(el.mustGetAttribute("name"));
      break;
    default:
      if (state.root === null) {
        stack.unshift(new GrammarNode(state.latestId++, el));
        shift = true;
      }
  }

  if (state.root === null) {
    // We have to acquire it from stack[0] and not from the variable top.
    state.root = stack[0];
  }

  for (const child of el.children) {
    if (!(child instanceof Element)) {
      continue;
    }

    gatherGrammars(child, state);
  }

  if (shift) {
    stack.shift();
  }
}

function transformGrammars(root: GrammarNode,
                           parent: GrammarNode | null,
                           grammar: GrammarNode): void {
  for (const name of grammar.refNames) {
    if (!grammar.defineNames.has(name)) {
      throw new SchemaValidationError(`dangling ref: ${name}`);
    }
  }

  if (parent === null && grammar.parentRefNames.size !== 0) {
    throw new SchemaValidationError("top-level grammar contains parentRef!");
  }

  for (const name of grammar.parentRefNames) {
    // The test above ensures parent is not null.
    // tslint:disable-next-line:no-non-null-assertion
    if (!parent!.defineNames.has(name)) {
      throw new SchemaValidationError(`dangling parentRef: ${name}`);
    }
  }

  const toRename =
    grammar.defines.concat(grammar.refs,
                           ...grammar.childGrammars.map((x) => x.parentRefs));

  // Make all names unique globally.
  for (const el of toRename) {
    el.setAttribute("name",
                    `${el.mustGetAttribute("name")}-gr-${grammar.id}`);
  }

  // Move the ``define`` elements to the root grammar. We do this on the root
  // grammar too so that the ``define`` elements are moved after ``start``.
  root.grammar.append(grammar.defines);

  for (const child of grammar.childGrammars) {
    transformGrammars(root, grammar, child);
  }

  // Rename all parentRef elements to ref elements.
  for (const parentRef of grammar.parentRefs) {
    parentRef.name = parentRef.local = "ref";
  }

  if (grammar !== root) {
    // Remove the remaining ``grammar`` and ``start`` elements.
    const start = grammar.grammar.children[0] as Element;
    if (start.local !== "start") {
      throw new Error("there should be a single start element in the grammar!");
    }
    const pattern = start.children[0] as Element;
    grammar.grammar.replaceWith(pattern);
  }

}

/**
 * Implements step 15 of the XSL pipeline. Namely:
 *
 * - Rename each ``define`` element so as to make it unique across the
 *   schema. We do this by giving a unique id to each ``grammar`` element, which
 *   is the number of ``grammar`` elements before it, in document reading order,
 *   plus 1. Then we add to ``define/@name`` the string ``-gr-{id}`` where
 *   ``{id}`` is the grammar's id of the grammar to which the ``define``
 *   belongs. NOTE: this pattern was selected to avoid a clash with step 16,
 *   which creates new ``define`` element.
 *
 * - Rename each ``ref`` and ``parentRef`` to preserve the references the
 *   establish to ``define`` elements.
 *
 * - Create a top level ``grammar/start`` structure, if necessary.
 *
 * - Move all ``define`` elements to the top ``grammar``.
 *
 * - Rename all ``parentRef`` elements to ``ref``.
 *
 * - Replace all ``grammar/start`` elements with the expression contained
 *   therein, except for the top level ``grammar/start``.
 *
 * @param el The tree to process. It is modified in-place.
 *
 * @returns The new tree root.
 */
export function step15(el: Element): Element {
  let root = el;

  if (el.local !== "grammar") {
    root = Element.makeElement("grammar");
    const start = Element.makeElement("start");
    root.append(start);
    start.append(el);

    root.setXMLNS(RELAXNG_URI);
    el.removeAttribute("xmlns");
  }

  const state: State = {
    latestId: 1,
    root: null,
    stack: [],
  };

  gatherGrammars(root, state);

  // tslint:disable-next-line:no-non-null-assertion
  transformGrammars(state.root!, null, state.root!);

  return root;
}
