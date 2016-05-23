/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */

'use strict';
import "amd-loader";
import regexp from "../build/dist/lib/salve/datatypes/regexp";
import { assert } from "chai";

const conversion_tests = [
    "", "^$",
    "abc", "^abc$",
    "abc|def", "^abc|def$",
    "abc+", "^abc+$",
    "abc?", "^abc?$",
    "abc*", "^abc*$",
    "ab{1}", "^ab{1}$",
    "ab{1,2}", "^ab{1,2}$",
    "ab{1,}", "^ab{1,}$",
    "ab(123)cd", "^ab(?:123)cd$",
    "ab.", "^ab.$",
    "ab\\scd", "^ab[ \\t\\n\\r]cd$",
    "abcd\\p{Lm}ef", "^abcd\\p{Lm}ef$",
    "ab[A-Z]cd", "^ab[A-Z]cd$",
    // Multiple char escape with other characters in char class.
    // Positive multi-char escape in positive character class.
    "ab[a\\sq]cd", "^ab[a \\t\\n\\rq]cd$",
    // Negative multi-char escape in positive character class.
    "ab[a\\S\\Dq]cd", "^ab(?:[^ \\t\\n\\r]|[^\\p{Nd}]|[aq])cd$",
    // Positive multi-char escape in negative character class.
    "ab[^a\\s\\dq]cd", "^ab[^a \\t\\n\\r\\p{Nd}q]cd$",
    // Negative multi-char escape in negative character class.
    "ab[^a\\Sq]cd", "^ab(?:(?=[ \\t\\n\\r])[^aq])cd$",
    "ab[^a\\S\\Dq]cd", "^ab(?:(?=[ \\t\\n\\r\\p{Nd}])[^aq])cd$",
    // Subtractions,
    "ab[abcd-[bc]]cd", "^ab(?:(?![bc])[abcd])cd$",
    "ab[abcd-[bc-[c]]]cd", "^ab(?:(?!(?:(?![c])[bc]))[abcd])cd$",
    "(\\p{L}|\\p{N}|\\p{P}|\\p{S})+", "^(?:\\p{L}|\\p{N}|\\p{P}|\\p{S})+$",
    "ab[a-d-[bc-[c]]]cd", "^ab(?:(?!(?:(?![c])[bc]))[a-d])cd$",
];

const matching_tests = [
    true, "ab[abcd\\-bc]cd", "abdcd",
    false, "ab[abcd\\-[bc]]cd", "abbcd",
    false, "ab[abcd\\-[bc]]cd", "ab1cd",
    true,  "ab[abcd\\-bc\\-c]cd", "abacd",
    false, "ab[abcd\\-bc\\-c]cd", "ab1cd",
    true, "ab[a\\sq]cd", "abacd",
    true, "ab[a\\sq]cd", "ab cd",
    false, "ab[a\\sq]cd", "ab1cd",
    true, "ab[a\\Sq]cd", "abwcd",
    false, "ab[a\\Sq]cd", "ab cd",
    true, "ab[a\\S\\Dq]cd", "abwcd",
    true, "ab[a\\S\\Dq]cd", "ab1cd", // 1 is fine because it matches \\S
    false, "ab[^a\\S\\dq]cd", "ab1cd",
];

describe("XML Schema regexp", function () {
    for(let i = 0; i < conversion_tests.length; i += 2) {
        const re = conversion_tests[i];
        const expected = conversion_tests[i + 1];
        it(`'${re}' becomes '${expected}'`, () => {
            assert.equal(regexp.parse(re, "string"), expected);
        });
    }

    for(let i = 0; i < matching_tests.length; i += 3) {
        const matches = matching_tests[i];
        const re = matching_tests[i + 1];
        const text = matching_tests[i + 2];
        if (matches)
            it(`'${re}' matches '${text}'`, () => {
                assert.isTrue(new RegExp(re).test(text));
            });
        else
            it(`'${re}' does not match '${text}'`, () =>  {
                assert.isFalse(new RegExp(re).test(text));
            });
    }

});
