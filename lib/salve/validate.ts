/**
 * RNG-based validator.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

export const version: string = "4.1.1";

export { eventsToTreeString, Event, EventSet, Grammar, GrammarWalker,
         BasePattern, RefError, Walker, __test, FireEventResult,
         EndResult } from "./patterns";

export { constructTree } from "./formats";

export { EName }  from "./ename";

export { AttributeNameError, AttributeValueError, ChoiceError,
         ElementNameError, ValidationError } from "./errors";

export { NameResolver } from "./name_resolver";

export { Base as BaseName, Name, NameChoice, NsName,
         AnyName } from "./name_patterns";

/**
 * Do not use this. This is here only for historical reasons and may be yanked
 * at any time.
 * @private
 */
export { HashMap } from "./hashstructs";

//  LocalWords:  validator constructTree RNG MPL Dubeau Mangalam rng
