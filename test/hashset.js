/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */

/* global it, describe */
import "amd-loader";
import { assert } from "chai";
import hashstructs from "../build/dist/lib/salve/hashstructs";

function id(x) {
  return x;
}

describe("HashSet", () => {
  describe("integers with id hash", () => {
    it("creation", () => {
      const hs = new hashstructs.HashSet(id, [1, 2, 3]);
      for (let x = 1; x <= 3; ++x) {
        assert.equal(hs.backing[x], x);
      }
      assert.equal(hs.size(), 3);
    });

    it("forEach", () => {
      const hs = new hashstructs.HashSet(id, [1, 2, 3]);
      const t = {};
      hs.forEach((x) => {
        t[x] = x;
      });
      for (let x = 1; x <= 3; ++x) {
        assert.equal(t[x], x);
      }
      assert.equal(hs.size(), 3);
    });

    it("adding", () => {
      const hs = new hashstructs.HashSet(id, [1, 2, 3]);
      hs.add(1);
      hs.add(2);
      hs.add(3);
      for (let x = 1; x <= 3; ++x) {
        assert.equal(hs.backing[x], x);
      }
      assert.equal(hs.size(), 3);
    });

    it("union", () => {
      const hs = new hashstructs.HashSet(id, [1, 2, 3]);
      const hs2 = new hashstructs.HashSet(id, [1, 2, 3, 4, 5, 6]);
      hs2.union(hs);
      for (let x = 1; x <= 6; ++x) {
        assert.equal(hs2.backing[x], x);
      }
      assert.equal(hs2.size(), 6);
    });
  });
  describe("strings with id hash", () => {
    const init = ["dog", "cat", "hamster"];
    it("creation", () => {
      const hs = new hashstructs.HashSet(id, init);
      for (const q of init) {
        assert.equal(hs.backing[q], q);
      }
      assert.equal(hs.size(), 3);
    });

    it("forEach", () => {
      const hs = new hashstructs.HashSet(id, init);
      const t = {};
      hs.forEach((x) => {
        t[x] = x;
      });
      for (const q of init) {
        assert.equal(t[q], q);
      }
      assert.equal(hs.size(), 3);
    });

    it("adding", () => {
      const hs = new hashstructs.HashSet(id, init);
      hs.add("dog");
      hs.add("cat");
      hs.add("hamster");
      for (const q of init) {
        assert.equal(hs.backing[q], q);
      }
      assert.equal(hs.size(), 3);
    });

    it("union", () => {
      const hs = new hashstructs.HashSet(id, init);
      const init2 = init.concat(["4", "5", "6"]);
      const hs2 = new hashstructs.HashSet(id, init2);
      hs2.union(hs);
      for (const q of init2) {
        assert.equal(hs2.backing[q], q);
      }
      assert.equal(hs2.size(), 6);
      hs.union(hs2);
      for (const q of init2) {
        assert.equal(hs.backing[q], q);
      }
      assert.equal(hs.size(), 6);
    });
  });

  let nextId = 0;

  class Test {
    constructor(name) {
      this.name = name;
      this.id = Test.createID();
    }

    static createID() {
      return nextId++;
    }

    hash() {
      return this.id;
    }
  }

  const ahHash = function ahHash(x) {
    return x.hash();
  };

  describe("Object with ad-hoc hash", () => {
    const init = [new Test("dog"), new Test("cat"), new Test("hamster")];
    it("creation", () => {
      const hs = new hashstructs.HashSet(ahHash, init);
      const t = {};
      hs.forEach((x) => {
        t[x.name] = x.name;
      });
      for (const q of init) {
        assert.equal(t[q.name], q.name);
      }
      assert.equal(hs.size(), 3);
    });

    it("forEach", () => {
      const hs = new hashstructs.HashSet(ahHash, init);
      const t = {};
      hs.forEach((x) => {
        t[x.name] = x.name;
      });
      for (const q of init) {
        assert.equal(t[q.name], q.name);
      }
      assert.equal(hs.size(), 3);
    });

    it("adding", () => {
      const hs = new hashstructs.HashSet(ahHash, init);
      init.forEach((x) => {
        hs.add(x);
      });
      assert.equal(hs.size(), 3);
      hs.add(new Test("dog"));
      hs.add(new Test("cat"));
      hs.add(new Test("hamster"));
      // Each object is unique due to the hashing function.
      assert.equal(hs.size(), 6);
    });

    it("union", () => {
      const hs = new hashstructs.HashSet(ahHash, init);
      const init2 = init.concat(
        [new Test("dog"), new Test("cat"), new Test("hamster")]);
      const hs2 = new hashstructs.HashSet(ahHash, init2);
      hs2.union(hs);
      assert.equal(hs2.size(), 6, "hs2");
      hs.union(hs2);
      assert.equal(hs.size(), 6, "hs");
    });

    it("filter", () => {
      const hs = new hashstructs.HashSet(ahHash, init);
      const subset = hs.filter(x => x.name.indexOf("a") >= 0);
      // Makesure HashBase used the right type.
      assert.equal(subset.constructor, hashstructs.HashSet);
      assert.equal(subset.size(), 2);
    });
  });
});

describe("HashMap", () => {
  let nextId = 0;

  class Test {
    constructor(name) {
      this.name = name;
      this.id = Test.createID();
    }

    static createID() {
      return nextId++;
    }

    hash() {
      return this.id;
    }
  }

  const ahHash = function ahHash(x) {
    return x.hash();
  };

  describe("ad-hoc hash", () => {
    const init = [
      [new Test("Alice"), new Test("dog")],
      [new Test("Bob"), new Test("cat")],
      [new Test("Charlie"), new Test("hamster")],
    ];
    it("simple", () => {
      const map = new hashstructs.HashMap(ahHash);
      for (const e of init) {
        map.add(e[0], e[1]);
      }
      for (const e of init) {
        assert.equal(map.has(e[0]), e[1]);
      }
      assert.equal(map.size(), 3);
    });
    it("filter", () => {
      const map = new hashstructs.HashMap(ahHash);
      for (const e of init) {
        map.add(e[0], e[1]);
      }
      assert.equal(map.size(), 3);
      const submap = map.filter(
        (a, b) => (a.name.indexOf("o") + b.name.indexOf("o")) > -2);
      // Makesure HashBase used the right type.
      assert.equal(submap.constructor, hashstructs.HashMap);
      assert.equal(submap.size(), 2);
    });
  });
});
