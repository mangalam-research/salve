/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

/* global it, describe, before, beforeEach */
const assert = require("chai").assert;
const salve = require("../salve");

const EName = salve.EName;
const NameResolver = salve.NameResolver;

const mapping = {
  btw: "http://lddubeau.com/ns/btw-storage",
  tei: "http://www.tei-c.org/ns/1.0",
  "": "http://www.tei-c.org/ns/1.0",
};

describe("NameResolver", () => {
  describe("resolveName", () => {
    let resolver;
    beforeEach(() => {
      resolver = new NameResolver();
      for (const k of Object.keys(mapping)) {
        resolver.definePrefix(k, mapping[k]);
      }
    });

    it("returns a name in the default namespace when trying " +
       "to resolve an unprefixed name even when no default " +
       "namespace has been defined",
       () => {
         resolver = new NameResolver();
         assert.equal(resolver.resolveName("blah").toString(), "{}blah");
       });

    it("resolves xml", () => {
      resolver = new NameResolver();
      assert.equal(resolver.resolveName("xml:lang", true).toString(),
                   "{http://www.w3.org/XML/1998/namespace}lang");
    });

    it("resolves xmlns", () => {
      resolver = new NameResolver();
      assert.equal(resolver.resolveName("xmlns:foo", true).toString(),
                   "{http://www.w3.org/2000/xmlns/}foo");
    });

    it("returns undefined when resolving an unknown prefix", () =>
       assert.equal(resolver.resolveName("garbage:blah", true), undefined));

    it("throws an error when trying to resolve a badly formed name",
       () => {
         assert.throws(
           resolver.resolveName.bind(resolver, "gar:bage:blah", true), Error,
           "invalid name passed to resolveName");
       });

    it("resolves name without prefixes",
       () => assert.equal(
         resolver.resolveName("blah", false).toString(),
         new EName("http://www.tei-c.org/ns/1.0", "blah").toString()));

    it("resolves names with prefixes",
       () => assert.equal(
         resolver.resolveName("btw:blah", false).toString(),
         new EName("http://lddubeau.com/ns/btw-storage", "blah").toString()));

    it("resolves attribute names without prefix",
       () => assert.equal(resolver.resolveName("blah", true).toString(),
                          new EName("", "blah").toString()));

    it("resolves attribute names with prefix", () =>
       assert.equal(
         resolver.resolveName("btw:blah", true).toString(),
         new EName("http://lddubeau.com/ns/btw-storage", "blah").toString()));

    it("resolves names even in a new context",
       () => {
         resolver.enterContext();
         assert.equal(resolver.resolveName("btw:blah", false).toString(),
                      new EName("http://lddubeau.com/ns/btw-storage",
                                "blah").toString());
       });
  });

  describe("definePrefix", () => {
    let resolver;
    before(() => {
      resolver = new NameResolver();
    });

    it("fails if trying to define xmlns", () => {
      assert.throws(resolver.definePrefix.bind(
        resolver, "xmlns", "http://www.w3.org/2000/xmlns/"),
                   Error,
                   "trying to define 'xmlns' but the XML Namespaces " +
                   "standard stipulates that 'xmlns' cannot be " +
                   "declared (= \"defined\")");
    });

    it("fails if trying to define xml to an invalid URI", () => {
      assert.throws(resolver.definePrefix.bind(resolver, "xml", "foo"),
                   Error, "trying to define 'xml' to an incorrect URI");
    });

    it("allows defining xml", () =>
       // The lack of error thrown is what we are looking for.
       resolver.definePrefix("xml", "http://www.w3.org/XML/1998/namespace"));
  });

  describe("", () => {
    let resolver;
    // We use this test twice because it tests both enterContext
    // and leaveContext.
    function enterLeaveTest() {
      resolver = new NameResolver();
      resolver.definePrefix("", "def1");
      resolver.definePrefix("X", "uri:X1");
      assert.equal(resolver.resolveName("blah").toString(),
                   new EName("def1", "blah").toString());
      assert.equal(resolver.resolveName("X:blah").toString(),
                   new EName("uri:X1", "blah").toString());

      resolver.enterContext();
      resolver.definePrefix("", "def2");
      resolver.definePrefix("X", "uri:X2");
      assert.equal(resolver.resolveName("blah").toString(),
                   new EName("def2", "blah").toString());
      assert.equal(resolver.resolveName("X:blah").toString(),
                   new EName("uri:X2", "blah").toString());

      resolver.leaveContext();
      assert.equal(resolver.resolveName("blah").toString(),
                   new EName("def1", "blah").toString());
      assert.equal(resolver.resolveName("X:blah").toString(),
                   new EName("uri:X1", "blah").toString());
    }

    describe("leaveContext", () => {
      it("allows leaving contexts that were entered, but no more",
         () => {
           resolver = new NameResolver();
           resolver.enterContext();
           resolver.enterContext();
           resolver.leaveContext();
           resolver.leaveContext();
           assert.throws(resolver.leaveContext.bind(resolver),
                         Error, "trying to leave the default context");
         });

      it("does away with the definitions in the context " +
         "previously entered", enterLeaveTest);
    });

    describe("enterContext", () => {
      it("allows definitions in the new context to override " +
         "those in the upper contexts", enterLeaveTest);
    });
  });

  describe("unresolveName", () => {
    let resolver;
    beforeEach(() => {
      resolver = new NameResolver();
      for (const k of Object.keys(mapping)) {
        resolver.definePrefix(k, mapping[k]);
      }
    });

    it("knows the uri for the default namespace", () =>
       assert.equal(resolver.unresolveName("http://www.tei-c.org/ns/1.0",
                                           "blah"), "blah"));

    it("knows the XML namespace",
       () => assert.equal(resolver.unresolveName(
         "http://www.w3.org/XML/1998/namespace", "lang"), "xml:lang"));

    it("knows the xmlns namespace",
       () => assert.equal(resolver.unresolveName(
         "http://www.w3.org/2000/xmlns/", "foo"), "xmlns:foo"));

    it("knows the uri of other namespaces that were defined",
       () => assert.equal(
         resolver.unresolveName("http://lddubeau.com/ns/btw-storage", "blah"),
         "btw:blah"));

    it("returns undefined when passed an unknown uri",
       () => assert.equal(resolver.unresolveName("ttt", "blah"), undefined));

    // The next two tests show that the order of defintions is irrelevant.
    it("gives priority to the default namespace (first)", () => {
      resolver.definePrefix("X", "uri:X");
      resolver.definePrefix("", "uri:X");
      assert.equal(resolver.unresolveName("uri:X", "blah"), "blah");
    });

    it("gives priority to the default namespace (second)", () => {
      resolver.definePrefix("", "uri:X");
      resolver.definePrefix("X", "uri:X");
      assert.equal(resolver.unresolveName("uri:X", "blah"), "blah");
    });

    it("handles attribute names outside namespaces",
       () => assert.equal(resolver.unresolveName("", "blah"), "blah"));
  });

  describe("prefixFromURI", () => {
    let resolver;
    beforeEach(() => {
      resolver = new NameResolver();
      for (const k of Object.keys(mapping)) {
        resolver.definePrefix(k, mapping[k]);
      }
    });

    it("knows the uri for the default namespace", () =>
       assert.equal(resolver.prefixFromURI("http://www.tei-c.org/ns/1.0"), ""));

    it("knows the uri of other namespaces that were defined", () =>
         assert.equal(
           resolver.prefixFromURI("http://lddubeau.com/ns/btw-storage"), "btw"));

    it("returns undefined when passed an unknown uri",
       () => assert.isUndefined(resolver.prefixFromURI("ttt")));

    // The next two tests show that the order of defintions
    // is irrelevant.
    it("gives priority to the default namespace (first)", () => {
      resolver.definePrefix("X", "uri:X");
      resolver.definePrefix("", "uri:X");
      assert.equal(resolver.prefixFromURI("uri:X"), "");
    });

    it("gives priority to the default namespace (second)", () => {
      resolver.definePrefix("", "uri:X");
      resolver.definePrefix("X", "uri:X");
      assert.equal(resolver.prefixFromURI("uri:X"), "");
    });
  });

  describe("clone", () => {
    let resolver;
    beforeEach(() => {
      resolver = new NameResolver();
      for (const k of Object.keys(mapping)) {
        resolver.definePrefix(k, mapping[k]);
      }
    });

    it("creates a clone", () => {
      const cloned = resolver.clone();
      Object.keys(mapping).forEach((k) => {
        assert.equal(cloned.resolveName(`${k}:x`).toString(),
                     resolver.resolveName(`${k}:x`).toString());
      });
    });

    it("creates a clone that is independent from the original",
       () => {
         const cloned = resolver.clone();
         resolver.enterContext();
         resolver.definePrefix("X", "uri:original");

         cloned.enterContext();
         cloned.definePrefix("X", "uri:cloned");

         assert.equal(resolver.resolveName("X:x").toString(),
                      new EName("uri:original", "x").toString());
         assert.equal(cloned.resolveName("X:x").toString(),
                      new EName("uri:cloned", "x").toString());
       });
  });
});
