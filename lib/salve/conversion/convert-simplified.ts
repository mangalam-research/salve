/**
 * This module contains the logic for converting a simplified schema to a
 * pattern.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { AnyName, ConcreteName, Name, NameChoice,
         NsName } from "../name_patterns";
import { Attribute, Choice, Data, Define, Element as ElementPattern, Empty,
         Grammar, Group, Interleave, List, NotAllowed, OneOrMore, Pattern, Ref,
         Text as TextPattern, Value } from "../patterns";
import { Element } from "./parser";

function walk(el: Element): (Pattern | ElementPattern) {
  switch (el.local) {
      //  "param" is not needed as a separate case, because it is handled in
      //  "data"
      //
    case "grammar":
      return new Grammar(el.path, walk(el.children[0] as Element) as Pattern,
                         el.children.slice(1)
                         .map((x) => walk(x as Element)) as Define[]);
    case "except":
    case "start":
      return walk(el.children[0] as Element);
    case "define":
      return new Define(el.path, el.mustGetAttribute("name"),
                        walk(el.children[0] as Element) as ElementPattern);
    case "ref":
      return new Ref(el.path, el.mustGetAttribute("name"));
    case "value":
      return new Value(el.path, el.text, el.mustGetAttribute("type"),
                       el.mustGetAttribute("datatypeLibrary"),
                       el.mustGetAttribute("ns"));
    case "data":
      const children = el.children;
      const length = children.length;
      const last = children[length - 1] as Element;
      const except =
        (length !== 0 && last.local === "except") ? last : undefined;
      const params =
        ((except === undefined ? children : children.slice(0, -1)) as Element[])
        .map((param) => ({ name: param.mustGetAttribute("name"),
                           value: param.children[0].text }));

      return new Data(el.path, el.mustGetAttribute("type"),
                      el.mustGetAttribute("datatypeLibrary"),
                      params, except !== undefined ?
                      walk(except) as Pattern :
                      undefined);
    case "group":
      return new Group(el.path,
                       walk(el.children[0] as Element) as Pattern,
                       walk(el.children[1] as Element) as Pattern);
    case "interleave":
      return new Interleave(el.path,
                            walk(el.children[0] as Element) as Pattern,
                            walk(el.children[1] as Element) as Pattern);
    case "choice":
      return new Choice(el.path,
                        walk(el.children[0] as Element) as Pattern,
                        walk(el.children[1] as Element) as Pattern);
    case "oneOrMore":
      return new OneOrMore(el.path,
                           walk(el.children[0] as Element) as Pattern);
    case "element":
      return new ElementPattern(el.path,
                                walkNameClass(el.children[0] as Element),
                                walk(el.children[1] as Element) as Pattern);
    case "attribute":
      return new Attribute(el.path,
                           walkNameClass(el.children[0] as Element),
                           walk(el.children[1] as Element) as Pattern);
    case "empty":
      return new Empty(el.path);
    case "text":
      return new TextPattern(el.path);
    case "list":
      return new List(el.path, walk(el.children[0] as Element) as Pattern);
    case "notAllowed":
      return new NotAllowed(el.path);
    default:
      throw new Error(`unexpected local name: ${el.local}`);
  }
}

function walkNameClass(el: Element): ConcreteName {
  switch (el.local) {
    case "choice":
      return new NameChoice(el.path,
                            [walkNameClass(el.children[0] as Element),
                             walkNameClass(el.children[1] as Element)]);
    case "name":
      return new Name(el.path, el.mustGetAttribute("ns"), el.text);
    case "nsName":
      return new NsName(el.path, el.mustGetAttribute("ns"),
                        el.children.length !== 0 ?
                        walkNameClass(el.children[0] as Element) :
                        undefined);
    case "anyName":
      return new AnyName(el.path, el.children.length !== 0 ?
                         walkNameClass(el.children[0] as Element) :
                         undefined);
    case "except":
      return walkNameClass(el.children[0] as Element);
    default:
      throw new Error(`unexpected local name: ${el.local}`);
  }
}

export function makePatternFromSimplifiedSchema(tree: Element): Grammar {
  const ret = walk(tree);
  if (!(ret instanceof Grammar)) {
    throw new Error("tree did not produce a Grammar!");
  }

  return ret;
}
