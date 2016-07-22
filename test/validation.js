/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013-2015 Mangalam Research Center for Buddhist Languages
 */

"use strict";
import "amd-loader";
import validate from "../build/dist/lib/salve/validate";
import oop from "../build/dist/lib/salve/oop";
import namePatterns from "../build/dist/lib/salve/name_patterns";
import util from "util";
import fs from "fs";
import path from "path";
import { assert } from "chai";
import sax from "sax";
const test = validate.__test();

function fileAsString(p) {
  return fs.readFileSync(path.resolve(p), "utf8").toString();
}

function getEventList(eventSource) {
  const eventList = [];
  for (let x of eventSource.split("\n")) {
    if (!x.match(/^\s*$/)) {
      eventList.push(new validate.Event(x.split(/,\s*/)));
    }
  }
  return eventList;
}

function makeParser(er, walker) {
  const parser = sax.parser(true, { xmlns: true });

  const tagStack = [];
  parser.onopentag = function onopentag(node) {
    er.recordEvent(walker, "enterContext");

    const names = Object.keys(node.attributes);
    names.sort();
    for (let name of names) {
      const { prefix, local, value } = node.attributes[name];
      if (// xmlns="..."
        (local === "" && name === "xmlns") ||
          // xmlns:...=...
          (prefix === "xmlns")) {
        er.recordEvent(walker, "definePrefix", local, value);
      }
    }

    const ename = walker.resolveName(node.prefix + ":" + node.local);
    node.uri = ename.ns;

    er.recordEvent(walker, "enterStartTag", node.uri, node.local);
    for (let name of names) {
      const attr = node.attributes[name];
      const { local, prefix, value } = attr;
      let { uri } = attr;
      if (// xmlns="..."
        (local === "" && name === "xmlns") ||
          // xmlns:...=...
          (prefix === "xmlns")) {
        continue;
      }
      if (prefix !== "") {
        uri = walker.resolveName(`${prefix}:${local}`, true).ns;
      }
      er.recordEvent(walker, "attributeName", uri, local);
      er.recordEvent(walker, "attributeValue", value);
    }
    er.recordEvent(walker, "leaveStartTag", node.uri, node.local);
    tagStack.unshift([node.uri, node.local]);
  };

  parser.ontext = function ontext(text) {
    er.recordEvent(walker, "text", text.trim());
  };

  parser.onclosetag = function onclosetag(_node) {
    const tagInfo = tagStack.shift();
    er.recordEvent(walker, "endTag", tagInfo[0], tagInfo[1]);
    er.recordEvent(walker, "leaveContext");
  };

  return parser;
}

class EventRecorder {
  constructor(ComparisonEngine, options) {
    options = options || {
      check_fireEvent_invocation: true,
      check_possible: true,
    };

    this.events = [];
    this.recorded_states = [];
    this.ce = ComparisonEngine;
    this.dont_record_state = false;
    this.check_fireEvent_invocation = options.check_fireEvent_invocation;
    this.check_possible = options.check_possible;
  }

  recordEvent(walker) {
    this.events.push(Array.prototype.slice.call(arguments, 1));
    this.issueLastEvent(walker);
  }

  issueEventAt(walker, at) {
    this.issueEvent(walker, at, this.events[at]);
    return at < this.events.length - 1;
  }

  issueLastEvent(walker) {
    this.issueEventAt(walker, this.events.length - 1);
  }

  issueEvent(walker, evIx, ev) {
    const sliceLen = (ev[0] === "leaveStartTag") ? 1 : ev.length;
    const evParams = Array.prototype.slice.call(ev, 0, sliceLen);

    // For the clone check
    if (!this.dont_record_state) {
      this.recorded_states.push([walker.clone(),
                                 this.ce.exp_ix, evIx]);
    }

    const nev = new validate.Event(evParams);
    if (this.check_fireEvent_invocation) {
      this.ce.compare(
        `\ninvoking fireEvent with ${nev.toString().trim()}`, nev);
    }
    const ret = walker.fireEvent(nev);
    this.ce.compare(`fireEvent returned ${errorsToString(ret)}`, nev);
    if (this.check_possible) {
      const possibleEvs = walker.possible().toArray();
      // We sort events alphabetically, because the
      // implementation does not guarantee any specific order.
      possibleEvs.sort();
      if (evParams[0] !== "enterContext" &&
          evParams[0] !== "leaveContext" &&
          evParams[0] !== "definePrefix") {
        this.ce.compare(
          "possible events\n" +
            validate.eventsToTreeString(possibleEvs), nev);
      }
    }
  }
}

class ComparisonEngine {
  constructor(expected) {
    this.exp_ix = 0;
    this.expected = expected;
  }

  compare(msg, ev) {
    const lines = msg.split(/\n/);

    // Drop final blank lines
    while (lines[lines.length - 1] === "") {
      lines.pop();
    }
    msg = lines.join("\n");
    const to = this.expected.slice(this.exp_ix, this.exp_ix + lines.length);

    assert.equal(msg, to.join("\n"),
                 `at line: ${this.exp_ix + 1} event ${ev.toString()}`);
    this.exp_ix += lines.length;
  }
}

function errorsToString(errs) {
  if (!errs) {
    return errs + "";
  }

  return errs.join(",").toString();
}

function makeValidTest(dir) {
  return function () {
    // Read the RNG tree.
    const source = fileAsString(`test/${dir}/simplified-rng.js`);

    let tree;
    try {
      tree = validate.constructTree(source);
    }
    catch (e) {
      if (e instanceof validate.ValidationError) {
        console.log(e.toString());
      }
      throw e;
    }
    let walker = tree.newWalker();
    const xmlSource = fileAsString(`test/${dir}/to_parse.xml`);

    // Get the expected results
    const expectedSource = fileAsString(`test/${dir}/results.txt`);

    const expected = expectedSource.split("\n");
    const ce = new ComparisonEngine(expected);
    const er = new EventRecorder(ce);

    const contextIndependent = tree.whollyContextIndependent();
    ce.compare(`wholly context-independent ${contextIndependent}`,
               "*context-independent*");

    ce.compare("possible events\n" +
               validate.eventsToTreeString(walker.possible()),
               new validate.Event(["initial"]));

    const parser = makeParser(er, walker);
    parser.write(xmlSource).close();

    ce.compare(`end returned ${walker.end()}`, "*final*");

    // Roll back; >> gives us an integer
    const startAt = (er.recorded_states.length / 2) >> 0;
    walker = er.recorded_states[startAt][0];
    ce.exp_ix = er.recorded_states[startAt][1];
    let evIx = er.recorded_states[startAt][2];

    er.dont_record_state = true; // stop recording.
    let more = true;
    while (more) {
      more = er.issueEventAt(walker, evIx++);
    }

    ce.compare(`end returned ${walker.end()}`, "*final*");
  };
}

describe("GrammarWalker.fireEvent reports no errors on", function () {
  it("a simple test", makeValidTest("simple"));

  it("choice matching", makeValidTest("choice_matching"));

  it("a tei file", makeValidTest("tei"));

  it("a tei file, with namespaces", makeValidTest("namespaces"));

  it("a tei file using a more complex schema",
     makeValidTest("tei-with-modules"));

  it("an old error case (1)", makeValidTest("old-error-case-1"));

  it("a schema using anyName, etc.", makeValidTest("names"));
});

describe("GrammarWalker.fireEvent", function () {
  describe("reports errors on", function () {
    let walker;
    let rng;
    function makeErrorTest(dir, recorderOptions) {
      recorderOptions = recorderOptions || {
        check_fireEvent_invocation: false,
        check_possible: false,
      };
      return function () {
        let myrng = rng || `test/${dir}/simplified-rng.js`;
        // Read the RNG tree.
        const source = fileAsString(myrng);

        let tree;
        try {
          tree = validate.constructTree(source);
        }
        catch (e) {
          if (e instanceof validate.ValidationError) {
            console.log(e.toString());
          }
          throw e;
        }
        walker = tree.newWalker();

        const xmlSource = fileAsString(`test/${dir}/to_parse.xml`);

        // Get the expected results
        const expectedSource =
                fileAsString(`test/${dir}/results.txt`);
        const expected = expectedSource.split("\n");

        const ce = new ComparisonEngine(expected);
        const er = new EventRecorder(ce, recorderOptions);

        const parser = makeParser(er, walker);
        parser.write(xmlSource).close();
        ce.compare(`end returned ${walker.end()}`, "*final*");
      };
    }

    describe("a tei-based file", function () {
      before(() => {
        rng = "test/tei/simplified-rng.js";
      });
      it("which is empty", makeErrorTest("empty"));
      it("which has an unclosed element",
         makeErrorTest("not_closed1"));
      it("which has two unclosed elements",
         makeErrorTest("not_closed2"));
      it("which has two unclosed elements, with contents",
         makeErrorTest("not_closed3"));
      it("which has a missing namespace",
         makeErrorTest("missing_namespace"));
      it("which has a missing element",
         makeErrorTest("missing_element"));
    });

    describe("a tei-based file (optimized ids)", function () {
      before(() => {
        rng = "test/tei/simplified-rng.js";
      });
      it("which is empty", makeErrorTest("empty"));
      it("which has an unclosed element",
         makeErrorTest("not_closed1"));
      it("which has two unclosed elements",
         makeErrorTest("not_closed2"));
      it("which has two unclosed elements, with contents",
         makeErrorTest("not_closed3"));
      it("which has a missing namespace",
         makeErrorTest("missing_namespace"));
      it("which has a missing element",
         makeErrorTest("missing_element"));
    });

    describe("a simple schema", function () {
      before(() => {
        rng = "test/simple/simplified-rng.js";
      });
      it("which has a missing attribute",
         makeErrorTest("missing_attribute"));
      it("which has misplaced text",
         makeErrorTest("misplaced_text"));
      it("which has foreign elements followed by misplaced text",
         makeErrorTest("foreign_elements", {
           check_fireEvent_invocation: true,
           check_possible: true,
         }));
      it("which has inferable foreign elements",
         makeErrorTest("foreign_elements_inferable", {
           check_fireEvent_invocation: true,
           check_possible: true,
         }));
    });

    describe("ad hoc schema", function () {
      before(() => {
        rng = undefined;
      });
      it("which has a choice not chosen",
         makeErrorTest("choice_not_chosen", {
           check_fireEvent_invocation: true,
           check_possible: false,
         }));
      it("which has a choice ended by a subsequent item",
         makeErrorTest("choice_ended_by_following_item", {
           check_fireEvent_invocation: true,
           check_possible: false,
         }));

      it("which has a one-or-more prematurely ended",
         makeErrorTest("one_or_more_not_satisfied", {
           check_fireEvent_invocation: true,
           check_possible: false,
         }));

      it("top-level opening tag without closing",
         makeErrorTest("opening_no_closing", {
           check_fireEvent_invocation: true,
           check_possible: false,
         }));

      it("invalid attribute",
         makeErrorTest("invalid_attribute", {
           check_fireEvent_invocation: true,
           check_possible: false,
         }));

      it("NsName fails a match", makeErrorTest("name_error1"));

      it("NameChoice fails a match", makeErrorTest("name_error2"));

      it("Except fails a match", makeErrorTest("name_error3"));

    });

    it("an attribute without value", function () {
      // Read the RNG tree.
      const source = fileAsString("test/simple/simplified-rng.js");

      const tree = validate.constructTree(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent(
        new validate.Event("enterStartTag", "", "html"));
      assert.isFalse(ret);
      ret = walker.fireEvent(
        new validate.Event("attributeName", "", "style"));
      assert.isFalse(ret);
      ret = walker.fireEvent(
        new validate.Event("attributeName", "", "style"));
      assert.equal(ret.length, 1);
      assert.equal(
        ret[0].toString(),
        "attribute not allowed here: {\"ns\":\"\",\"name\":\"style\"}");
    });
  });

  describe("handles valid documents having", function () {
    it("attributes in any valid order", function () {
      // Read the RNG tree.
      const source = fileAsString(
        "test/attribute-order/simplified-rng.js");

      const tree = validate.constructTree(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent(
        new validate.Event("enterStartTag", "", "html"));
      assert.isFalse(ret);
      ret = walker.fireEvent(
        new validate.Event("leaveStartTag", "", "html"));
      assert.isFalse(ret);

      const permutations = [
        ["attr-a", "attr-b", "attr-c"],
        ["attr-a", "attr-c", "attr-b"],
        ["attr-b", "attr-a", "attr-c"],
        ["attr-b", "attr-c", "attr-a"],
        ["attr-c", "attr-a", "attr-b"],
        ["attr-c", "attr-b", "attr-a"],
      ];
      const stub =
              "attributeName:\n" +
              "    ";
      for (let perm of permutations) {
        let ret = walker.fireEvent(
          new validate.Event("enterStartTag", "", "em"));
        assert.isFalse(ret, "entering em");

        const possible = [];
        for (let attr of perm) {
          possible.push(`{"ns":"","name":"${attr}"}`);
        }
        for (let attr of perm) {
          const sorted = possible.slice().sort();
          assert.equal(
            validate.eventsToTreeString(walker.possible()),
            stub + sorted.join("\n    ") + "\n");

          ret = walker.fireEvent(
            new validate.Event("attributeName", "", attr));
          assert.isFalse(ret);

          // We've seen it. This array is in the same order
          // as perm.
          possible.shift();

          ret = walker.fireEvent(
            new validate.Event("attributeValue", "x"));
          assert.isFalse(ret);

          // Seen all possible attributes.
          if (!possible.length) {
            assert.equal(
              validate.eventsToTreeString(walker.possible()),
              "leaveStartTag\n");
          }
        }

        ret = walker.fireEvent(new validate.Event("leaveStartTag"));
        assert.isFalse(ret);
        ret = walker.fireEvent(new validate.Event("endTag", "", "em"));
        assert.isFalse(ret);
      }
    });
  });

  // These tests deal with situations that would probably occur if
  // the tokenizer or parser which feeds events to salve is
  // broken.
  //
  // Still try to handle these cases gracefully rather than
  // crash and burn.
  describe("handles mangled documents having", function () {
    it("misplaced text", function () {
      // Read the RNG tree.
      const source = fileAsString("test/simple/simplified-rng.js");

      const tree = validate.constructTree(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent(
        new validate.Event("enterStartTag", "", "html"));
      assert.isFalse(ret);
      ret = walker.fireEvent(new validate.Event("text", "q"));
      assert.equal(ret.length, 1);
      assert.equal(ret[0].toString(), "text not allowed here");
    });

    it("duplicate leaveStartTag", function () {
      // Read the RNG tree.
      const source = fileAsString("test/simple/simplified-rng.js");

      const tree = validate.constructTree(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent(
        new validate.Event("enterStartTag", "", "html"));
      assert.isFalse(ret);
      ret = walker.fireEvent(
        new validate.Event("attributeName", "", "style"));
      assert.isFalse(ret);
      ret = walker.fireEvent(
        new validate.Event("attributeValue", "", "x"));
      assert.isFalse(ret);
      ret = walker.fireEvent(new validate.Event("leaveStartTag"));
      assert.isFalse(ret);
      ret = walker.fireEvent(new validate.Event("leaveStartTag"));
      assert.equal(ret.length, 1);
      assert.equal(ret[0].toString(),
                   "unexpected leaveStartTag event; " +
                   "it is likely that " +
                   "fireEvent is incorrectly called");
    });

    it("duplicate attributeValue", function () {
      // Read the RNG tree.
      const source = fileAsString("test/simple/simplified-rng.js");

      const tree = validate.constructTree(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent(
        new validate.Event("enterStartTag", "", "html"));
      assert.isFalse(ret);
      ret = walker.fireEvent(
        new validate.Event("attributeName", "", "style"));
      assert.isFalse(ret);
      ret = walker.fireEvent(
        new validate.Event("attributeValue", "", "x"));
      assert.isFalse(ret);
      ret = walker.fireEvent(
        new validate.Event("attributeValue", "", "x"));
      assert.equal(ret.length, 1);
      assert.equal(ret[0].toString(),
                   "unexpected attributeValue event; " +
                   "it is likely that " +
                   "fireEvent is incorrectly called");
    });

    it("duplicate endTag", function () {
      // Read the RNG tree.
      const source = fileAsString("test/simple/simplified-rng.js");

      const tree = validate.constructTree(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent(
        new validate.Event("enterStartTag", "", "html"));
      assert.isFalse(ret);
      ret = walker.fireEvent(
        new validate.Event("attributeName", "", "style"));
      assert.isFalse(ret);
      ret = walker.fireEvent(
        new validate.Event("attributeValue", "", "x"));
      assert.isFalse(ret);
      ret = walker.fireEvent(new validate.Event("leaveStartTag"));
      assert.isFalse(ret);
      ret = walker.fireEvent(new validate.Event("endTag", "", "html"));
      assert.equal(ret.length, 1);
      assert.equal(ret[0].toString(),
                   "tag required: {\"ns\":\"\",\"name\":\"head\"}");
      ret = walker.fireEvent(new validate.Event("endTag", "", "html"));
      assert.equal(ret.length, 1);
      assert.equal(ret[0].toString(),
                   "unexpected end tag: {\"ns\":\"\",\"name\":\"html\"}");
    });
  });
});

describe("error objects", function () {
  function makeErrorTest(ctorName, names, fakeNames, first, second) {
    names = names || [new validate.EName("a", "b")];
    fakeNames = fakeNames || ["a"];
    first = first || "blah: {a}b";
    second = second || "blah: a";

    it(ctorName, function () {
      var ctor = validate[ctorName];
      var err = Object.create(ctor.prototype);
      ctor.apply(err, ["blah"].concat(names));
      assert.equal(err.toString(), first);
      assert.sameMembers(err.getNames(), names);
      assert.equal(err.toStringWithNames(fakeNames),
                   second);
    });
  }
  makeErrorTest("AttributeNameError");
  makeErrorTest("AttributeValueError");
  makeErrorTest("ElementNameError");

  it("ChoiceError", function () {
    const namesA = [new validate.EName("a", "b"),
                     new validate.EName("c", "d")];
    const namesB = [new validate.EName("e", "f"),
                     new validate.EName("g", "h")];
    const err = new validate.ChoiceError(namesA, namesB);
    assert.equal(err.toString(),
                 "must choose either {a}b, {c}d or {e}f, {g}h");
    assert.sameMembers(err.getNames(), namesA.concat(namesB));
    assert.equal(err.toStringWithNames(["a", "b", "c", "d"]),
                 "must choose either a, b or c, d");
  });
});


describe("Grammar", function () {
  describe("getNamespaces", function () {
    it("returns the namespaces", function () {
      // Read the RNG tree.
      const source = fileAsString("test/tei/simplified-rng.js");

      const tree = validate.constructTree(source);
      assert.sameMembers(
        tree.getNamespaces(),
        ["http://www.tei-c.org/ns/1.0",
         "http://www.w3.org/XML/1998/namespace"]);
    });

    it("returns an empty namespace when there are no namespaces",
       function () {
         // Read the RNG tree.
         const source = fileAsString("test/simple/simplified-rng.js");

         const tree = validate.constructTree(source);
         assert.sameMembers(tree.getNamespaces(), [""]);
       });

    it("returns * when anyName is used and ::except when except is used",
       function () {
         // Read the RNG tree.
         const source = fileAsString("test/names/simplified-rng.js");

         const tree = validate.constructTree(source);
         assert.sameMembers(tree.getNamespaces(), [
           "",
           "foo:foo",
           "*",
           "::except",
         ]);
       });
  });
});

describe("Misc", function () {
  it("Text singleton", function () {
    const t1 = new test.Text("a");
    const t2 = new test.Text("b");
    assert.equal(t1, t2);
  });
});

describe("Name pattern", function () {
  describe("Name", function () {
    let np;

    before(() => {
      np = new namePatterns.Name("", "a", "b");
    });

    it("is simple", function () {
      assert.isTrue(np.simple());
    });

    it("converts to an array", function () {
      assert.sameMembers(np.toArray(), [np]);
    });

    it("matches a matching namespace and name", function () {
      assert.isTrue(np.match("a", "b"));
    });

    it("does not match a non-matching namespace and name", function () {
      assert.isFalse(np.match("foo", "bar"));
    });

    it("never matches as a wildcard", function () {
      assert.isFalse(np.wildcardMatch("a", "b"));
      assert.isFalse(np.wildcardMatch("foo", "bar"));
    });

    it("converts to an object", function () {
      assert.deepEqual(np.toObject(), { ns: "a", name: "b" });
    });

    it("holds one namespace", function () {
      assert.sameMembers(np.getNamespaces(), ["a"]);
    });
  });

  describe("NameChoice", function () {
    let simple, complex, Asimple, Acomplex, b;

    before(() => {
      Asimple = new namePatterns.Name("", "a", "b");
      Acomplex = new namePatterns.AnyName("");
      b = new namePatterns.Name("", "c", "d");
      simple = new namePatterns.NameChoice("", [Asimple, b]);
      complex = new namePatterns.NameChoice("", [Acomplex, b]);
    });

    it("is simple or complex depending on contents", function () {
      assert.isTrue(simple.simple());
      assert.isFalse(complex.simple());
    });

    it("converts to an array, if simple", function () {
      assert.sameMembers(simple.toArray(), [Asimple, b]);
      assert.isNull(complex.toArray());
    });

    it("matches a matching namespace and name", function () {
      // Will match on the first element.
      assert.isTrue(simple.match("a", "b"));
      // Will match on the second.
      assert.isTrue(simple.match("c", "d"));
    });

    it("does not match a non-matching namespace and name", function () {
      assert.isFalse(simple.match("foo", "bar"));
    });

    it("matches as a wildcard if one option does", function () {
      assert.isFalse(simple.wildcardMatch("a", "b"));
      assert.isFalse(simple.wildcardMatch("c", "d"));
      assert.isTrue(complex.wildcardMatch("a", "b"));
      // We get true here because anyName matches anything.
      assert.isTrue(complex.wildcardMatch("c", "d"));

      var x = new namePatterns.NameChoice(
        "",
        [new namePatterns.AnyName(
          "",
          new namePatterns.Name("", "c", "d")),
         b]);
      // This is false because our AnyName explicitly excludes {c}d.
      assert.isFalse(x.wildcardMatch("c", "d"));
      assert.isTrue(x.wildcardMatch("a", "b"));
    });

    it("converts to an object", function () {
      assert.deepEqual(simple.toObject(), { a: { ns: "a", name: "b" },
                                           b: { ns: "c", name: "d" } });
    });

    it("holds multiple namespaces", function () {
      assert.sameMembers(simple.getNamespaces(), ["a", "c"]);
      assert.sameMembers(complex.getNamespaces(), ["c", "*"]);
    });
  });

  describe("NsName", function () {
    let np, withExcept;

    before(() => {
      np = new namePatterns.NsName("", "a");
      withExcept = new namePatterns.NsName(
        "", "a",
        new namePatterns.Name("", "a", "b"));
    });

    it("is not simple", function () {
      assert.isFalse(np.simple());
    });

    it("does not convert to an array", function () {
      assert.isNull(np.toArray());
    });

    it("matches a matching namespace and name", function () {
      assert.isTrue(np.match("a", "b"));
      assert.isTrue(np.match("a", "c"));
    });

    it("does not match a non-matching namespace", function () {
      assert.isFalse(np.match("foo", "b"));
    });

    it("does not match an exception", function () {
      assert.isFalse(withExcept.match("a", "b"));
    });

    it("matches as a wildcard if it matches at all", function () {
      assert.isTrue(np.wildcardMatch("a", "b"));
      assert.isFalse(withExcept.wildcardMatch("a", "b"));
    });

    it("converts to an object", function () {
      assert.deepEqual(np.toObject(), { ns: "a" });
      assert.deepEqual(withExcept.toObject(),
        {
          ns: "a",
          except: { ns: "a", name: "b" },
        });
    });

    it("holds a single namespace", function () {
      assert.sameMembers(np.getNamespaces(), ["a"]);
      assert.sameMembers(withExcept.getNamespaces(), ["a", "::except"]);
    });
  });


  describe("AnyName", function () {
    let np, withExcept;

    before(() => {
      np = new namePatterns.AnyName("");
      withExcept = new namePatterns.AnyName(
        "",
        new namePatterns.Name("", "a", "b"));
    });

    it("is not simple", function () {
      assert.isFalse(np.simple());
    });

    it("does not convert to an array", function () {
      assert.isNull(np.toArray());
    });

    it("matches anything", function () {
      assert.isTrue(np.match("a", "b"));
      assert.isTrue(np.match("q", "c"));
    });

    it("does not match an exception", function () {
      assert.isFalse(withExcept.match("a", "b"));
    });

    it("matches as a wildcard if it matches at all", function () {
      assert.isTrue(np.wildcardMatch("a", "b"));
      assert.isFalse(withExcept.wildcardMatch("a", "b"));
    });

    it("converts to an object", function () {
      assert.deepEqual(np.toObject(), { pattern: "AnyName" });
      assert.deepEqual(withExcept.toObject(),
        {
          pattern: "AnyName",
          except: { ns: "a", name: "b" },
        });
    });

    it("holds all namespaces", function () {
      assert.sameMembers(np.getNamespaces(), ["*"]);
      assert.sameMembers(withExcept.getNamespaces(), ["*", "::except"]);
    });
  });
});
