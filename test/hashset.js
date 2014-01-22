/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */

'use strict';
require("amd-loader");
var assert = require("chai").assert;
var hashstructs = require("../build/dist/lib/salve/hashstructs");

function id(x) { return x; }

describe("HashSet", function () {
    describe("integers with id hash", function () {
        it("creation", function () {
            var hs = new hashstructs.HashSet(id, [1, 2, 3]);
            for(var x = 1; x <=3; ++x)
                assert.equal(hs.backing[x], x);
            assert.equal(hs.size(), 3);
        });
        it("forEach", function () {
            var hs = new hashstructs.HashSet(id, [1, 2, 3]);
            var t = {};
            hs.forEach(function (x) {
                t[x] = x;
            });
            for(var x = 1; x <=3; ++x)
                assert.equal(t[x], x);
            assert.equal(hs.size(), 3);
        });

        it("adding", function () {
            var hs = new hashstructs.HashSet(id, [1, 2, 3]);
            hs.add(1);
            hs.add(2);
            hs.add(3);
            for(var x = 1; x <=3; ++x)
                assert.equal(hs.backing[x], x);
            assert.equal(hs.size(), 3);
        });
        it("union", function () {
            var hs = new hashstructs.HashSet(id, [1, 2, 3]);
            var hs2 = new hashstructs.HashSet(id, [1, 2, 3, 4, 5, 6]);
            hs2.union(hs);
            for(var x = 1; x <=6; ++x)
                assert.equal(hs2.backing[x], x);
            assert.equal(hs2.size(), 6);
        });
    });
    describe("strings with id hash", function () {
        var init = ["dog", "cat", "hamster"];
        it("creation", function () {
            var hs = new hashstructs.HashSet(id, init);
            for(var x = 0, q; q = init[x]; ++x)
                assert.equal(hs.backing[q], q);
            assert.equal(hs.size(), 3);
        });

        it("forEach", function () {
            var hs = new hashstructs.HashSet(id, init);
            var t = {};
            hs.forEach(function (x) {
                t[x] = x;
            });
            for(var x = 0, q; q = init[x]; ++x)
                assert.equal(t[q], q);
            assert.equal(hs.size(), 3);
        });

        it("adding", function () {
            var hs = new hashstructs.HashSet(id, init);
            hs.add("dog");
            hs.add("cat");
            hs.add("hamster");
            for(var x = 0, q; q = init[x]; ++x)
                assert.equal(hs.backing[q], q);
            assert.equal(hs.size(), 3);
        });
        it("union", function () {
            var hs = new hashstructs.HashSet(id, init);
            var init2 = init.concat(["4", "5", "6"]);
            var hs2 = new hashstructs.HashSet(id, init2);
            hs2.union(hs);
            for(var x = 1, q; q = init2[x]; ++x)
                assert.equal(hs2.backing[q], q);
            assert.equal(hs2.size(), 6);
            hs.union(hs2);
            for(var x = 1, q; q = init2[x]; ++x)
                assert.equal(hs.backing[q], q);
            assert.equal(hs.size(), 6);
        });
    });

    function Test(name) {
        this.name = name;
        this.id = this.createID();
    }

    (function () {
        var next_id = 0;
        this.createID = function () {
            return next_id++;
        }

        this.hash = function () { return this.id }
    }).call(Test.prototype);

    var ah_hash = function (x) { return x.hash() }

    describe("Object with ad-hoc hash", function () {
        var init = [new Test("dog"), new Test("cat"), new Test("hamster")];
        it("creation", function () {
            var hs = new hashstructs.HashSet(ah_hash, init);
            var t = {};
            hs.forEach(function (x) {
                t[x.name] = x.name;
            });
            for(var x = 0, q; q = init[x]; ++x)
                assert.equal(t[q.name], q.name);
            assert.equal(hs.size(), 3);
        });

        it("forEach", function () {
            var hs = new hashstructs.HashSet(ah_hash, init);
            var t = {};
            hs.forEach(function (x) {
                t[x.name] = x.name;
            });
            for(var x = 0, q; q = init[x]; ++x)
                assert.equal(t[q.name], q.name);
            assert.equal(hs.size(), 3);
        });

        it("adding", function () {
            var hs = new hashstructs.HashSet(ah_hash, init);
            init.forEach(function (x) {
                hs.add(x);
            });
            assert.equal(hs.size(), 3);
            hs.add(new Test("dog"));
            hs.add(new Test("cat"));
            hs.add(new Test("hamster"));
            // Each object is unique due to the hashing function.
            assert.equal(hs.size(), 6);
        });

        it("union", function () {
            var hs = new hashstructs.HashSet(ah_hash, init);
            var init2 = init.concat(
                [new Test("dog"), new Test("cat"), new Test("hamster")]);
            var hs2 = new hashstructs.HashSet(ah_hash, init2);
            hs2.union(hs);
            assert.equal(hs2.size(), 6, "hs2");
            hs.union(hs2);
            assert.equal(hs.size(), 6, "hs");
        });

        it("filter", function () {
            var hs = new hashstructs.HashSet(ah_hash, init);
            var subset = hs.filter(function (x) {
                return x.name.indexOf("a") >= 0;
            });
            // Makesure HashBase used the right type.
            assert.equal(subset.constructor, hashstructs.HashSet);
            assert.equal(subset.size(), 2);
        });
    });

});

describe("HashMap", function () {
    function Test(name) {
        this.name = name;
        this.id = this.createID();
    }

    (function () {
        var next_id = 0;
        this.createID = function () {
            return next_id++;
        }

        this.hash = function () { return this.id }
    }).call(Test.prototype);

    var ah_hash = function (x) { return x.hash() }

    describe("ad-hoc hash",function () {
        var init = [
            [new Test("Alice"), new Test("dog")],
            [new Test("Bob"), new Test("cat")],
            [new Test("Charlie"), new Test("hamster")]
        ];
        it("simple", function () {
            var map = new hashstructs.HashMap(ah_hash);
            for (var i = 0, e; e = init[i]; ++i) {
                map.add(e[0], e[1]);
            }
            for (var i = 0, e; e = init[i]; ++i) {
                assert.equal(map.has(e[0]), e[1]);
            }
            assert.equal(map.size(), 3);

        });
        it("filter", function () {
            var map = new hashstructs.HashMap(ah_hash);
            for (var i = 0, e; e = init[i]; ++i) {
                map.add(e[0], e[1]);
            }
            assert.equal(map.size(), 3);
            var submap = map.filter(function (a, b) {
                return (a.name.indexOf("o") + b.name.indexOf("o")) > -2;
            });
            // Makesure HashBase used the right type.
            assert.equal(submap.constructor, hashstructs.HashMap);
            assert.equal(submap.size(), 2);
        });
    });
});
