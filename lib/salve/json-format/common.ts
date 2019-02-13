/**
 * This module contains constants common to both reading and writing schemas in
 * the JSON format internal to salve.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { AnyName, Attribute, BasePattern, Choice, Data, Define, Element, Empty,
         Grammar, Group, Interleave, List, Name, NameChoice, NotAllowed,
         NsName, OneOrMore, Param, Ref, Text, Value } from "../patterns";

export type NamePattern = Name | NameChoice | NsName | AnyName;

export type PatternCtor = new (...args: any[]) => (BasePattern | NamePattern);

export type Ctors = PatternCtor | typeof Array;

//
// MODIFICATIONS TO THIS TABLE MUST BE REFLECTED IN ALL OTHER TABLES IN THIS
// MODULE.
//
export const codeToConstructor: Ctors[] = [
  Array,
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
  // EName used to be in this slot. Yes, we cheat with a cast. salve will
  // crash hard if this slot is accessed, which is what we want.
  undefined as any,
  Interleave,
  Name,
  NameChoice,
  NsName,
  AnyName,
];

//
// MODIFICATIONS TO THIS MAP MUST BE REFLECTED IN ALL OTHER TABLES IN THIS
// MODULE.
//
// Element name to code mapping
export const nameToCode: Record<string, number> = Object.create(null);
nameToCode.array = 0;
nameToCode.empty = 1;
nameToCode.data = 2;
nameToCode.list = 3;
nameToCode.param = 4;
nameToCode.value = 5;
nameToCode.notAllowed = 6;
nameToCode.text = 7;
nameToCode.ref = 8;
nameToCode.oneOrMore = 9;
nameToCode.choice = 10;
nameToCode.group = 11;
nameToCode.attribute = 12;
nameToCode.element = 13;
nameToCode.define = 14;
nameToCode.grammar = 15;
// Historical value.
// nameToCode.EName = 16;
nameToCode.interleave = 17;
nameToCode.name = 18;
nameToCode.nameChoice = 19;
nameToCode.nsName = 20;
nameToCode.anyName = 21;

// This is a bit field
export const OPTION_NO_PATHS = 1;
// var OPTION_WHATEVER = 2;
// var OPTION_WHATEVER_PLUS_1 = 4;
// etc...
