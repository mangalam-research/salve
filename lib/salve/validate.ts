/**
 * RNG-based validator.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

export const version: string = "8.0.0";

export { eventsToTreeString, Event, EventSet, Grammar, GrammarWalker,
         BasePattern, RefError, FireEventResult,
         EndResult } from "./patterns";

export { ConversionResult, convertRNGToPattern,
         ManifestEntry } from "./conversion";

export { writeTreeToJSON } from "./json-format/write";
export { constructTree, readTreeFromJSON } from "./json-format/read";

export { EName }  from "./ename";

export { AttributeNameError, AttributeValueError, ChoiceError,
         ElementNameError, ValidationError } from "./errors";

export { NameResolver } from "./name_resolver";

export { Base as BaseName, ConcreteName, Name, NameChoice, NsName,
         AnyName } from "./name_patterns";

//  LocalWords:  rng Mangalam Dubeau MPL RNG constructTree validator
