/**
 * @desc RNG-based validator.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
"use strict";

var patterns = require("./patterns");
var formats = require("./formats");
var EName = require("./ename").EName;
var errors = require("./errors");
var NameResolver = require("./name_resolver").NameResolver;
var namePatterns = require("./name_patterns");
var hashStructs = require("./hashstructs");

exports.version = "3.0.0-dev";

/**
 * @see module:patterns.Event
 * @static
 */
exports.Event = patterns.Event;

/**
 * @see module:patterns.eventsToTreeString
 * @static
 */
exports.eventsToTreeString = patterns.eventsToTreeString;

/**
 * @see module:patterns.ReferenceError
 * @static
 */
exports.ReferenceError = patterns.ReferenceError;

/**
 * @see module:patterns.Grammar
 * @static
 */
exports.Grammar = patterns.Grammar;

/**
 * @see module:patterns.Walker
 * @static
 */
exports.Walker = patterns.Walker;

/**
 * @see module:patterns.__test
 * @private
 * @static
 */
exports.__test = patterns.__test;

/**
 * @see module:ename.EName
 * @static
 */
exports.EName = EName;


/**
 * @see module:errors.ValidationError
 * @static
 */
exports.ValidationError = errors.ValidationError;

/**
 * @see module:errors.AttributeNameError
 * @static
 */
exports.AttributeNameError = errors.AttributeNameError;

/**
 * @see module:errors.AttributeValueError
 * @static
 */
exports.AttributeValueError = errors.AttributeValueError;

/**
 * @see module:errors.ElementNameError
 * @static
 */
exports.ElementNameError = errors.ElementNameError;

/**
 * @see module:errors.ChoiceError
 * @static
 */
exports.ChoiceError = errors.ChoiceError;

/**
 * @see module:formats.constructTree
 * @static
 */
exports.constructTree = formats.constructTree;

/**
 * @see module:name_resolver.NameResolver
 * @static
 */
exports.NameResolver = NameResolver;

/**
 * @see module:name_patterns.Name
 * @static
 */
exports.Name = namePatterns.Name;

/**
 * @see module:name_patterns.NameChoice
 * @static
 */
exports.NameChoice = namePatterns.NameChoice;

/**
 * @see module:name_patterns.NsName
 * @static
 */
exports.NsName = namePatterns.NsName;

/**
 * @see module:name_patterns.AnyName
 * @static
 */
exports.AnyName = namePatterns.AnyName;

/**
 * Do not use this. This is here only for historical reasons and may be yanked
 * at any time.
 *
 * @see module:hashstructs.HashMap
 * @static
 * @private
 */
exports.HashMap = hashStructs.HashMap;

//  LocalWords:  validator constructTree RNG MPL Dubeau Mangalam rng
