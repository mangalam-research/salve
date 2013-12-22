/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013 Mangalam Research Center for Buddhist Languages
 */

'use strict';
require("amd-loader");
var datatypes = require("../build/lib/salve/datatypes");
var chai = require("chai");
var assert = chai.assert;

describe("datatypes", function () {
    describe("Builtin library", function () {
        var lib = datatypes.registry.get("");

        describe("string", function () {
            var type = lib.types.string;

            describe("equal", function () {
                it("returns true for two equal values", function () {
                    assert.isTrue(type.equal("foo", "foo"));
                });

                it("returns false for two unequal values", function () {
                    assert.isFalse(type.equal("foo", "bar"));
                });
            });

            describe("match", function () {
                it("returns MATCH for two equal values", function () {
                    assert.deepEqual(type.match("foo", "foo"),
                                     { type: datatypes.MATCH });
                });

                it("returns MATCH with length if document value is longer " +
                   "than schema value",
                   function () {
                    assert.deepEqual(type.match("foo bar", "foo"),
                                     { type: datatypes.MATCH,
                                       length: 3});
                });

                it("returns INCOMPLETE if document value is shorter " +
                   "than schema value",
                   function () {
                    assert.deepEqual(type.match("foo", "foo bar"),
                                     { type: datatypes.INCOMPLETE});
                });
            });

            describe("allows", function () {
                it("anything", function () {
                    assert.isTrue(type.allows("foo"));
                });
            });
        });

        describe("token", function () {
            var type = lib.types.token;

            describe("equal", function () {
                it("returns true for two equal values", function () {
                    assert.isTrue(type.equal("foo", "foo"));
                });

                it("returns true for string differing only regarding space (1)",
                   function () {
                    assert.isTrue(type.equal("foo", " foo "));
                });

                it("returns true for string differing only regarding space (2)",
                   function () {
                    assert.isTrue(type.equal("foo bar   fwip",
                                             " foo   bar fwip"));
                });

                it("returns false for two unequal values", function () {
                    assert.isFalse(type.equal("foobar", "foo bar"));
                });
            });

            describe("match", function () {
                it("returns MATCH for two equal values", function () {
                    assert.deepEqual(type.match("foo", "foo"),
                                     { type: datatypes.MATCH });
                });

                it("returns MATCH with length if document value is longer " +
                   "than schema value",
                   function () {
                    assert.deepEqual(type.match("  foo  bar  baz ", "foo bar"),
                                     { type: datatypes.MATCH,
                                       length: 12});
                });

                it("returns INCOMPLETE if document value is shorter " +
                   "than schema value",
                   function () {
                    assert.deepEqual(type.match("foo", "foo bar"),
                                     { type: datatypes.INCOMPLETE});
                });
            });

            describe("allows", function () {
                it("anything", function () {
                    assert.isTrue(type.allows("foo"));
                });
            });
        });
    });
});
