/**
 * Classes that model RNG patterns.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { EName } from "./ename";
import { Attribute } from "./patterns/attribute";
import { Define, Ref } from "./patterns/base";
import { Choice } from "./patterns/choice";
import { Data } from "./patterns/data";
import { Element } from "./patterns/element";
import { Empty } from "./patterns/empty";
import { Grammar, GrammarWalker } from "./patterns/grammar";
import { Group } from "./patterns/group";
import { Interleave } from "./patterns/interleave";
import { List } from "./patterns/list";
import { NotAllowed } from "./patterns/not_allowed";
import { OneOrMore } from "./patterns/one_or_more";
import { Param } from "./patterns/param";
import { Text } from "./patterns/text";
import { Value } from "./patterns/value";

import * as namePatterns from "./name_patterns";

export { eventsToTreeString, Event, EventSet, BasePattern, Walker,
         FireEventResult, EndResult } from "./patterns/base";
export { Grammar, GrammarWalker, RefError } from "./patterns/grammar";

//
// Things used only during testing.
//
const tret = {
  GrammarWalker,
  Text,
};

export function __test(): {[name: string]: any} {
  return tret;
}

// tslint:disable-next-line:variable-name
export const __protected: {[name: string]: any} = {
  Empty,
  Data,
  List,
  Param,
  Value,
  NotAllowed,
  Text,
  Ref,
  OneOrMore,
  Choice,
  Group,
  Attribute,
  Element,
  Define,
  Grammar,
  EName,
  Interleave,
  Name: namePatterns.Name,
  NameChoice: namePatterns.NameChoice,
  NsName: namePatterns.NsName,
  AnyName: namePatterns.AnyName,
};
/*  tslint:enable */

//  LocalWords:  EName NotAllowed oneOrMore RNG MPL Dubeau GrammarWalker rng
//  LocalWords:  notAllowed Mangalam EventSet
