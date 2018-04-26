/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

/* global it, describe, before */

"use strict";

const fs = require("fs");
const path = require("path");
const { assert } = require("chai");
const sax = require("sax");
const salve = require("../build/dist");

function fileAsString(p) {
  return fs.readFileSync(path.resolve(p), "utf8").toString();
}

function errorsToString(errs) {
  if (!errs) {
    return errs;
  }

  return errs.join(",").toString();
}

function makeParser(er, walker) {
  const parser = sax.parser(true, { xmlns: true });

  const tagStack = [];
  parser.onopentag = function onopentag(node) {
    er.recordEvent(walker, "enterContext");

    const names = Object.keys(node.attributes);
    names.sort();
    for (const name of names) {
      const attr = node.attributes[name];
      const { local, prefix, value } = attr;
      if (// xmlns="..."
        (local === "" && name === "xmlns") ||
          // xmlns:...=...
          (prefix === "xmlns")) {
        er.recordEvent(walker, "definePrefix", local, value);
      }
    }

    const ename = walker.resolveName(`${node.prefix}:${node.local}`);
    node.uri = ename.ns;

    er.recordEvent(walker, "enterStartTag", node.uri, node.local);
    for (const name of names) {
      const attr = node.attributes[name];
      const { local, prefix, value } = attr;
      // eslint-disable-next-line prefer-destructuring
      let uri = attr.uri;
      if (// xmlns="..."
        (local === "" && name === "xmlns") ||
          // xmlns:...=...
          (prefix === "xmlns")) {
        continue; // eslint-disable-line no-continue
      }
      if (prefix !== "") {
        uri = walker.resolveName(`${prefix}:${local}`, true).ns;
      }
      er.recordEvent(walker, "attributeName", uri, local);
      er.recordEvent(walker, "attributeValue", value);
    }
    er.recordEvent(walker, "leaveStartTag", []);
    tagStack.unshift([node.uri, node.local]);
  };

  parser.ontext = function ontext(text) {
    er.recordEvent(walker, "text", text);
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
    // eslint-disable-next-line prefer-rest-params
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
      this.recorded_states.push([walker.clone(), this.ce.exp_ix, evIx]);
    }

    if (this.check_fireEvent_invocation) {
      this.ce.compare(
        `\ninvoking fireEvent with Event: ${evParams.join(", ").trim()
.replace(/\s+\n/g, "\n")}`, evParams);
    }

    let ret;
    switch (evParams[0]) {
    case "enterContext":
      walker.enterContext();
      ret = false;
      break;
    case "leaveContext":
      walker.leaveContext();
      ret = false;
      break;
    case "definePrefix":
      walker.definePrefix(...evParams.slice(1));
      ret = false;
      break;
    default:
      ret = walker.fireEvent(evParams[0], evParams.slice(1));
    }
    this.ce.compare(`fireEvent returned ${errorsToString(ret)}`, evParams);
    if (this.check_possible) {
      const possibleEvs = Array.from(walker.possible());
      // We sort events alphabetically, because the
      // implementation does not guarantee any specific order.
      possibleEvs.sort();
      if (evParams[0] !== "enterContext" &&
          evParams[0] !== "leaveContext" &&
          evParams[0] !== "definePrefix") {
        this.ce.compare(
          `possible events\n${salve.eventsToTreeString(possibleEvs)}`, evParams);
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
                 `at line: ${this.exp_ix + 1} event ${ev.join(", ")}`);
    this.exp_ix += lines.length;
  }
}

function makeValidTest(dir) {
  return function validTest() {
    // Read the RNG tree.
    const source = fileAsString(`test/${dir}/simplified-rng.js`);

    let tree;
    try {
      tree = salve.readTreeFromJSON(source);
    }
    catch (e) {
      if (e instanceof salve.ValidationError) {
        // eslint-disable-next-line no-console
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
               ["*context-independent*"]);

    ce.compare(`possible events\n${salve.eventsToTreeString(walker.possible())}`,
               ["initial"]);

    const parser = makeParser(er, walker);
    parser.write(xmlSource).close();

    ce.compare(`end returned ${walker.end()}`, ["*final*"]);

    // Roll back; >> gives us an integer
    // eslint-disable-next-line no-bitwise
    const startAt = (er.recorded_states.length / 2) >> 0;
    [walker, ce.exp_ix] = er.recorded_states[startAt];
    let evIx = er.recorded_states[startAt][2];

    er.dont_record_state = true; // stop recording.
    let more = true;
    while (more) {
      more = er.issueEventAt(walker, evIx++);
    }

    ce.compare(`end returned ${walker.end()}`, ["*final*"]);
  };
}

function dropId(obj, memo) {
  if (memo.indexOf(obj) !== -1) {
    return;
  }
  memo.push(obj);

  for (const key in obj) {
    if (key === "id") {
      delete obj[key];
    }
    else if (typeof obj[key] === "object") {
      dropId(obj[key], memo);
    }
  }
}

describe("readTreeFromJSON", () => {
  it("accepts a string or an object", () => {
    const source = fileAsString("test/simple/simplified-rng.js");
    const fromString = salve.readTreeFromJSON(source);
    const fromObject = salve.readTreeFromJSON(JSON.parse(source));
    // We have to remove the ids because they are generated to make each object
    // unique.
    assert.deepEqual(dropId(fromString, []), dropId(fromObject, []));
  });
});

describe("GrammarWalker.fireEvent reports no errors on", () => {
  it("a simple test", makeValidTest("simple"));

  it("choice matching", makeValidTest("choice_matching"));

  it("a tei file", makeValidTest("tei"));

  it("a tei file, with namespaces", makeValidTest("namespaces"));

  it("a tei file using a more complex schema",
     makeValidTest("tei-with-modules"));

  it("an old error case (1)", makeValidTest("old-error-case-1"));

  it("a schema using anyName, etc.", makeValidTest("names"));
});

describe("GrammarWalker.fireEvent", () => {
  describe("reports errors on", () => {
    let rng;
    function makeErrorTest(dir, recorderOptions) {
      recorderOptions = recorderOptions || {
        check_fireEvent_invocation: false,
        check_possible: false,
      };
      return function errorTest() {
        const myrng = rng || `test/${dir}/simplified-rng.js`;
        // Read the RNG tree.
        const source = fileAsString(myrng);

        let tree;
        try {
          tree = salve.readTreeFromJSON(source);
        }
        catch (e) {
          if (e instanceof salve.ValidationError) {
            // eslint-disable-next-line no-console
            console.log(e.toString());
          }
          throw e;
        }
        const walker = tree.newWalker();

        const xmlSource = fileAsString(`test/${dir}/to_parse.xml`);

        // Get the expected results
        const expectedSource =
                fileAsString(`test/${dir}/results.txt`);
        const expected = expectedSource.split("\n");

        const ce = new ComparisonEngine(expected);
        const er = new EventRecorder(ce, recorderOptions);

        const parser = makeParser(er, walker);
        parser.write(xmlSource).close();
        ce.compare(`end returned ${walker.end()}`, ["*final*"]);
      };
    }

    describe("a tei-based file", () => {
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

    describe("a tei-based file (optimized ids)", () => {
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

    describe("a simple schema", () => {
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

    describe("ad hoc schema", () => {
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

      it("Element in Interleave",
         makeErrorTest("element_in_interleave"));

      it("Text in Interleave",
         makeErrorTest("text_in_interleave"));
    });

    it("an attribute without value", () => {
      // Read the RNG tree.
      const source = fileAsString("test/simple/simplified-rng.js");

      const tree = salve.readTreeFromJSON(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent("enterStartTag", ["", "html"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("attributeName", ["", "style"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("attributeName", ["", "style"]);
      assert.equal(ret.length, 1);
      assert.equal(
        ret[0].toString(),
        "attribute not allowed here: {\"ns\":\"\",\"name\":\"style\"}");
    });
  });

  describe("handles valid documents having", () => {
    it("attributes in any valid order", () => {
      // Read the RNG tree.
      const source = fileAsString(
        "test/attribute-order/simplified-rng.js");

      const tree = salve.readTreeFromJSON(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent("enterStartTag", ["", "html"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("leaveStartTag", []);
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
      for (const perm of permutations) {
        ret = walker.fireEvent("enterStartTag", ["", "em"]);
        assert.isFalse(ret, "entering em");

        const possible = [];
        for (const attr of perm) {
          possible.push(`{"ns":"","name":"${attr}"}`);
        }
        for (const attr of perm) {
          const sorted = possible.slice().sort();
          assert.equal(salve.eventsToTreeString(walker.possible()),
                       `${stub}${sorted.join("\n    ")}\n`);

          ret = walker.fireEvent("attributeName", ["", attr]);
          assert.isFalse(ret);

          // We've seen it. This array is in the same order
          // as perm.
          possible.shift();

          ret = walker.fireEvent("attributeValue", ["x"]);
          assert.isFalse(ret);

          // Seen all possible attributes.
          if (!possible.length) {
            assert.equal(salve.eventsToTreeString(walker.possible()),
                         "leaveStartTag\n");
          }
        }

        ret = walker.fireEvent("leaveStartTag", []);
        assert.isFalse(ret);
        ret = walker.fireEvent("endTag", ["", "em"]);
        assert.isFalse(ret);
      }
    });

    it("missing attributes", () => {
      // Read the RNG tree.
      const source = fileAsString(
        "test/multiple_missing_attributes/simplified-rng.js");

      const tree = salve.readTreeFromJSON(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent("enterStartTag", ["", "html"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("leaveStartTag", []);
      assert.isFalse(ret);

      ret = walker.fireEvent("enterStartTag", ["", "em"]);
      assert.isFalse(ret, "entering em");
      ret = walker.fireEvent("leaveStartTag", []);
      assert.deepEqual(ret.map(x => x.toString()), [
        "attribute missing: {\"ns\":\"\",\"name\":\"attr-a\"}",
        "attribute missing: {\"ns\":\"\",\"name\":\"attr-b\"}",
        "attribute missing: {\"ns\":\"\",\"name\":\"attr-c\"}",
      ]);
      ret = walker.fireEvent("endTag", ["", "em"]);
      assert.deepEqual(ret.map(x => x.toString()), [
        "tag required: {\"ns\":\"\",\"name\":\"foo\"}",
      ]);
    });

    it("errors after attributes: report errors", () => {
      // This test was added to check for a problem with the internal state of
      // salve.

      // Read the RNG tree.
      const source = fileAsString(
        "test/multiple_missing_attributes/simplified-rng.js");

      const tree = salve.readTreeFromJSON(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent("enterStartTag", ["", "html"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("leaveStartTag", []);
      assert.isFalse(ret);

      ret = walker.fireEvent("enterStartTag", ["", "em"]);
      assert.isFalse(ret, "entering em");
      ret = walker.fireEvent("attributeName", ["", "attr-a"]);
      assert.isFalse(ret, "attr-a");
      ret = walker.fireEvent("attributeValue", ["x"]);
      assert.isFalse(ret, "attr-a value");
      ret = walker.fireEvent("attributeName", ["", "attr-b"]);
      assert.isFalse(ret, "attr-b");
      ret = walker.fireEvent("attributeValue", ["x"]);
      assert.isFalse(ret, "attr-b value");
      ret = walker.fireEvent("attributeName", ["", "attr-c"]);
      assert.isFalse(ret, "attr-c");
      ret = walker.fireEvent("attributeValue", ["x"]);
      assert.isFalse(ret, "attr-c value");
      ret = walker.fireEvent("leaveStartTag", []);
      assert.isFalse(ret, "leaveStartTag has no errors");

      ret = walker.fireEvent("enterStartTag", ["", "foo"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("leaveStartTag", []);
      assert.isFalse(ret);
      ret = walker.fireEvent("endTag", ["", "foo"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("endTag", ["", "em"]);
      assert.deepEqual(ret.map(x => x.toString()), [
        "must choose either {\"ns\":\"\",\"name\":\"bar\"} or " +
          "{\"ns\":\"\",\"name\":\"baz\"}",
      ]);
    });

    it("errors after attributes: don't report extraneous errors", () => {
      // This test was added to check for a problem with the internal state of
      // salve.

      // Read the RNG tree.
      const source = fileAsString(
        "test/multiple_missing_attributes/simplified-rng.js");

      const tree = salve.readTreeFromJSON(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent("enterStartTag", ["", "html"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("leaveStartTag", []);
      assert.isFalse(ret);

      ret = walker.fireEvent("enterStartTag", ["", "em"]);
      assert.isFalse(ret, "entering em");
      ret = walker.fireEvent("leaveStartTag", []);
      assert.deepEqual(ret.map(x => x.toString()), [
        "attribute missing: {\"ns\":\"\",\"name\":\"attr-a\"}",
        "attribute missing: {\"ns\":\"\",\"name\":\"attr-b\"}",
        "attribute missing: {\"ns\":\"\",\"name\":\"attr-c\"}",
      ]);

      ret = walker.fireEvent("enterStartTag", ["", "foo"]);
      assert.isFalse(ret);
      // ret = walker.fireEvent("leaveStartTag", []);
      // assert.isFalse(ret);
      // ret = walker.fireEvent("endTag", ["", "foo"]);
      // assert.isFalse(ret);
      // ret = walker.fireEvent("endTag", ["", "em"]);
    });
  });

  // These tests deal with situations that would probably occur if
  // the tokenizer or parser which feeds events to salve is
  // broken.
  //
  // Still try to handle these cases gracefully rather than
  // crash and burn.
  describe("handles mangled documents having", () => {
    it("misplaced text", () => {
      // Read the RNG tree.
      const source = fileAsString("test/simple/simplified-rng.js");

      const tree = salve.readTreeFromJSON(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent("enterStartTag", ["", "html"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("text", ["q"]);
      assert.equal(ret.length, 1);
      assert.equal(ret[0].toString(), "text not allowed here");
    });

    it("duplicate leaveStartTag", () => {
      // Read the RNG tree.
      const source = fileAsString("test/simple/simplified-rng.js");

      const tree = salve.readTreeFromJSON(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent("enterStartTag", ["", "html"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("attributeName", ["", "style"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("attributeValue", ["", "x"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("leaveStartTag", []);
      assert.isFalse(ret);
      assert.throws(() => walker.fireEvent("leaveStartTag", []),
                    Error,
                    "unexpected leaveStartTag event; it is likely that \
fireEvent is incorrectly called");
    });

    it("duplicate attributeValue", () => {
      // Read the RNG tree.
      const source = fileAsString("test/simple/simplified-rng.js");

      const tree = salve.readTreeFromJSON(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent(
        "enterStartTag", ["", "html"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("attributeName", ["", "style"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("attributeValue", ["", "x"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("attributeValue", ["", "x"]);
      assert.equal(ret.length, 1);
      assert.equal(ret[0].toString(),
                   "unexpected attributeValue event; " +
                   "it is likely that " +
                   "fireEvent is incorrectly called");
    });

    it("duplicate endTag", () => {
      // Read the RNG tree.
      const source = fileAsString("test/simple/simplified-rng.js");

      const tree = salve.readTreeFromJSON(source);
      const walker = tree.newWalker();
      let ret = walker.fireEvent(
        "enterStartTag", ["", "html"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("attributeName", ["", "style"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("attributeValue", ["", "x"]);
      assert.isFalse(ret);
      ret = walker.fireEvent("leaveStartTag", []);
      assert.isFalse(ret);
      ret = walker.fireEvent("endTag", ["", "html"]);
      assert.equal(ret.length, 1);
      assert.equal(ret[0].toString(),
                   "tag required: {\"ns\":\"\",\"name\":\"head\"}");
      ret = walker.fireEvent("endTag", ["", "html"]);
      assert.equal(ret.length, 1);
      assert.equal(ret[0].toString(),
                   "unexpected end tag: {\"ns\":\"\",\"name\":\"html\"}");
    });
  });
});

describe("error objects", () => {
  function makeErrorTest(ctorName, names, fakeNames, first, second) {
    names = names || [new salve.EName("a", "b")];
    fakeNames = fakeNames || ["a"];
    first = first || "blah: {a}b";
    second = second || "blah: a";

    it(ctorName, () => {
      const ctor = salve[ctorName];
      const err = Object.create(ctor.prototype);
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

  it("ChoiceError", () => {
    const namesA = [new salve.EName("a", "b"), new salve.EName("c", "d")];
    const namesB = [new salve.EName("e", "f"), new salve.EName("g", "h")];
    const err = new salve.ChoiceError(namesA, namesB);
    assert.equal(err.toString(),
                 "must choose either {a}b, {c}d or {e}f, {g}h");
    assert.sameMembers(err.getNames(), namesA.concat(namesB));
    assert.equal(err.toStringWithNames(["a", "b", "c", "d"]),
                 "must choose either a, b or c, d");
  });
});


describe("Grammar", () => {
  describe("getNamespaces", () => {
    it("returns the namespaces", () => {
      // Read the RNG tree.
      const source = fileAsString("test/tei/simplified-rng.js");

      const tree = salve.readTreeFromJSON(source);
      assert.sameMembers(
        tree.getNamespaces(),
        ["http://www.tei-c.org/ns/1.0", "http://www.w3.org/XML/1998/namespace"]);
    });

    it("returns an empty namespace when there are no namespaces",
       () => {
         // Read the RNG tree.
         const source = fileAsString("test/simple/simplified-rng.js");

         const tree = salve.readTreeFromJSON(source);
         assert.sameMembers(tree.getNamespaces(), [""]);
       });

    it("returns * when anyName is used and ::except when except is used",
       () => {
         // Read the RNG tree.
         const source = fileAsString("test/names/simplified-rng.js");

         const tree = salve.readTreeFromJSON(source);
         assert.sameMembers(tree.getNamespaces(), [
           "",
           "foo:foo",
           "*",
           "::except",
         ]);
       });
  });
});

describe("Name pattern", () => {
  describe("Name", () => {
    let np;

    before(() => {
      np = new salve.Name("", "a", "b");
    });

    it("is simple", () => {
      assert.isTrue(np.simple());
    });

    it("converts to an array", () => {
      assert.sameMembers(np.toArray(), [np]);
    });

    it("matches a matching namespace and name", () => {
      assert.isTrue(np.match("a", "b"));
    });

    it("does not match a non-matching namespace and name", () => {
      assert.isFalse(np.match("foo", "bar"));
    });

    it("never matches as a wildcard", () => {
      assert.isFalse(np.wildcardMatch("a", "b"));
      assert.isFalse(np.wildcardMatch("foo", "bar"));
    });

    it("converts to an object", () => {
      assert.deepEqual(np.toObject(), { ns: "a", name: "b" });
    });

    it("converts to a string", () => {
      // eslint-disable-next-line quotes
      assert.equal(np.toString(), `{"ns":"a","name":"b"}`);
      assert.equal(new salve.Name("", "1\"\\2", "q").toString(),
                   // eslint-disable-next-line quotes
                   `{"ns":"1\\"\\\\2","name":"q"}`);
    });

    it("holds one namespace", () => {
      assert.sameMembers(np.getNamespaces(), ["a"]);
    });

    describe("#intersects", () => {
      it("with itself", () => {
        assert.isTrue(np.intersects(np));
      });

      it("not with a name in a different namespace", () => {
        assert.isFalse(np.intersects(new salve.Name("", `${np.ns}x`, np.name)));
      });

      it("not with a name with a different local part", () => {
        assert.isFalse(np.intersects(new salve.Name("", np.ns, `${np.name}x`)));
      });
    });
  });

  describe("NameChoice", () => {
    let simple;
    let complex;
    let Asimple;
    let Acomplex;
    let b;

    before(() => {
      Asimple = new salve.Name("", "a", "b");
      Acomplex = new salve.AnyName("");
      b = new salve.Name("", "c", "d");
      simple = new salve.NameChoice("", Asimple, b);
      complex = new salve.NameChoice("", Acomplex, b);
    });

    it("is simple or complex depending on contents", () => {
      assert.isTrue(simple.simple());
      assert.isFalse(complex.simple());
    });

    it("converts to an array, if simple", () => {
      assert.sameMembers(simple.toArray(), [Asimple, b]);
      assert.isNull(complex.toArray());
    });

    it("matches a matching namespace and name", () => {
      // Will match on the first element.
      assert.isTrue(simple.match("a", "b"));
      // Will match on the second.
      assert.isTrue(simple.match("c", "d"));
    });

    it("does not match a non-matching namespace and name", () => {
      assert.isFalse(simple.match("foo", "bar"));
    });

    it("matches as a wildcard if one option does", () => {
      assert.isFalse(simple.wildcardMatch("a", "b"));
      assert.isFalse(simple.wildcardMatch("c", "d"));
      assert.isTrue(complex.wildcardMatch("a", "b"));
      // We get true here because anyName matches anything.
      assert.isTrue(complex.wildcardMatch("c", "d"));

      const x = new salve.NameChoice(
        "", new salve.AnyName("", new salve.Name("", "c", "d")), b);
      // This is false because our AnyName explicitly excludes {c}d.
      assert.isFalse(x.wildcardMatch("c", "d"));
      assert.isTrue(x.wildcardMatch("a", "b"));
    });

    it("converts to an object", () => {
      assert.deepEqual(simple.toObject(), {
        a: { ns: "a", name: "b" },
        b: { ns: "c", name: "d" },
      });
    });

    it("converts to a string", () => {
      assert.equal(simple.toString(),
                   // eslint-disable-next-line quotes
                   `{"a":{"ns":"a","name":"b"},"b":{"ns":"c","name":"d"}}`);
    });

    it("holds multiple namespaces", () => {
      assert.sameMembers(simple.getNamespaces(), ["a", "c"]);
      assert.sameMembers(complex.getNamespaces(), ["c", "*"]);
    });

    describe("#intersects", () => {
      it("with itself", () => {
        assert.isTrue(complex.intersects(complex));
      });

      it("if the first pattern intersects", () => {
        assert.isTrue(simple.intersects(simple.a));
      });

      it("if the second pattern intersects", () => {
        assert.isTrue(simple.intersects(simple.b));
      });

      it("not if the two patterns don't interect", () => {
        assert.isFalse(simple.intersects(new salve.Name("", "zzz", "zzz")));
      });
    });
  });

  describe("NsName", () => {
    let np;
    let withExcept;

    before(() => {
      np = new salve.NsName("", "a");
      withExcept = new salve.NsName("", "a", new salve.Name("", "a", "b"));
    });

    it("is not simple", () => {
      assert.isFalse(np.simple());
    });

    it("does not convert to an array", () => {
      assert.isNull(np.toArray());
    });

    it("matches a matching namespace and name", () => {
      assert.isTrue(np.match("a", "b"));
      assert.isTrue(np.match("a", "c"));
    });

    it("does not match a non-matching namespace", () => {
      assert.isFalse(np.match("foo", "b"));
    });

    it("does not match an exception", () => {
      assert.isFalse(withExcept.match("a", "b"));
    });

    it("matches as a wildcard if it matches at all", () => {
      assert.isTrue(np.wildcardMatch("a", "b"));
      assert.isFalse(withExcept.wildcardMatch("a", "b"));
    });

    it("converts to an object", () => {
      assert.deepEqual(np.toObject(), { ns: "a" });
      assert.deepEqual(withExcept.toObject(),
                       {
                         ns: "a",
                         except: { ns: "a", name: "b" },
                       });
    });

    it("converts to a string", () => {
      // eslint-disable-next-line quotes
      assert.equal(np.toString(), `{"ns":"a"}`);
      assert.equal(withExcept.toString(),
                   // eslint-disable-next-line quotes
                   `{"ns":"a","except":{"ns":"a","name":"b"}}`);
      // eslint-disable-next-line quotes
      assert.equal(np.toString(), `{"ns":"a"}`);
      assert.equal(new salve.NsName("", "1\"\\2").toString(),
                   // eslint-disable-next-line quotes
                   `{"ns":"1\\"\\\\2"}`);
    });

    it("holds a single namespace", () => {
      assert.sameMembers(np.getNamespaces(), ["a"]);
      assert.sameMembers(withExcept.getNamespaces(), ["a", "::except"]);
    });

    describe("#intersects", () => {
      it("with itself", () => {
        assert.isTrue(np.intersects(np));
      });

      it("with a NsName with the same @ns", () => {
        // The except has no effect so with test without and with.
        assert.isTrue(np.intersects(new salve.NsName("", "a")));
        assert.isTrue(withExcept.intersects(new salve.NsName("", "a")));
      });

      it("not with a NsName with a different @ns", () => {
        // The except has no effect so with test without and with.
        assert.isFalse(np.intersects(new salve.NsName("", "zzz")));
        assert.isFalse(withExcept.intersects(new salve.NsName("", "zzz")));
      });

      it("with a Name with the same @ns", () => {
        assert.isTrue(np.intersects(new salve.Name("", "a", "zzz")));
      });

      it("not with a Name with a different @ns", () => {
        assert.isFalse(np.intersects(new salve.Name("", "b", "zzz")));
      });

      it("not with a Name if the exception is hit", () => {
        assert.isFalse(withExcept.intersects(new salve.Name("", "a", "b")));
      });

      it("with a Name if the exception not hit", () => {
        assert.isTrue(withExcept.intersects(new salve.Name("", "a", "zzz")));
      });
    });
  });

  describe("AnyName", () => {
    let np;
    let withExcept;
    let withNsNameExcept;
    let doubleExcept;
    let doubleExceptWithChoice;

    before(() => {
      np = new salve.AnyName("");
      withExcept = new salve.AnyName("", new salve.Name("", "a", "b"));
      withNsNameExcept = new salve.AnyName("", new salve.NsName("", "a"));
      // This matches all names in all namespaces, except for namespace "a"
      // where it matches only "{a}foo".
      doubleExcept =
        new salve.AnyName("",
                          new salve.NsName("", "a",
                                           new salve.Name("", "a", "foo")));
      // This is the same as the previous one, except that it also excludes
      // {q}moo from the names matched.
      doubleExceptWithChoice =
        new salve.AnyName("",
                          new salve.NameChoice(
                            "",
                            new salve.Name("", "q", "moo"),
                            new salve.NsName("", "a",
                                             new salve.Name("", "a", "foo"))));
    });

    it("is not simple", () => {
      assert.isFalse(np.simple());
    });

    it("does not convert to an array", () => {
      assert.isNull(np.toArray());
    });

    it("matches anything", () => {
      assert.isTrue(np.match("a", "b"));
      assert.isTrue(np.match("q", "c"));
    });

    it("does not match an exception", () => {
      assert.isFalse(withExcept.match("a", "b"));
    });

    it("matches as a wildcard if it matches at all", () => {
      assert.isTrue(np.wildcardMatch("a", "b"));
      assert.isFalse(withExcept.wildcardMatch("a", "b"));
    });

    it("converts to an object", () => {
      assert.deepEqual(np.toObject(), { pattern: "AnyName" });
      assert.deepEqual(withExcept.toObject(),
                       {
                         pattern: "AnyName",
                         except: { ns: "a", name: "b" },
                       });
    });

    it("converts to a string", () => {
      // eslint-disable-next-line quotes
      assert.equal(np.toString(), `{"pattern":"AnyName"}`);
      assert.equal(withExcept.toString(),
                   // eslint-disable-next-line quotes
                   `{"pattern":"AnyName","except":{"ns":"a","name":"b"}}`);
    });

    it("holds all namespaces", () => {
      assert.sameMembers(np.getNamespaces(), ["*"]);
      assert.sameMembers(withExcept.getNamespaces(), ["*", "::except"]);
    });

    describe("#intersects", () => {
      it("with itself", () => {
        assert.isTrue(np.intersects(np));
      });

      it("with another anyName", () => {
        // The except has no effect so with test without and with.
        assert.isTrue(np.intersects(new salve.AnyName("")));
        assert.isTrue(withExcept.intersects(new salve.AnyName("")));
      });

      it("with a Name, when there is no exception", () => {
        assert.isTrue(np.intersects(new salve.Name("", "a", "zzz")));
      });

      it("not with a Name if the exception is hit", () => {
        assert.isFalse(withExcept.intersects(new salve.Name("", "a", "b")));
      });

      it("with a Name if the exception not hit", () => {
        assert.isTrue(withExcept.intersects(new salve.Name("", "a", "zzz")));
      });

      it("with an NsName, when there is no exception", () => {
        assert.isTrue(np.intersects(new salve.NsName("", "a")));
      });

      it("not with an NsName if the exception is hit", () => {
        assert.isFalse(withNsNameExcept.intersects(new salve.NsName("", "a")));
      });

      it("with an NsName if the exception not hit", () => {
        assert.isTrue(withNsNameExcept.intersects(new salve.NsName("", "zzz")));
      });

      describe("when having a double except", () => {
        it("with a Name matching the inner except", () => {
          assert.isTrue(
            doubleExcept.intersects(new salve.Name("", "a", "foo")));
        });

        it("with an NsName matching the except", () => {
          assert.isTrue(doubleExcept.intersects(new salve.NsName("", "a")));
        });

        it("with an NsName avoiding all excepts", () => {
          assert.isTrue(doubleExcept.intersects(new salve.NsName("", "b")));
        });

        it("with a Name avoiding all excepts", () => {
          assert.isTrue(
            doubleExcept.intersects(new salve.Name("", "zzz", "foo")));
        });

        it("not with a Name avoiding the inner except", () => {
          assert.isFalse(
            doubleExcept.intersects(new salve.Name("", "a", "blah")));
        });

        it("not with an NsName that except the inner except", () => {
          assert.isFalse(
            doubleExcept.intersects(
              new salve.NsName("", "a",
                               new salve.Name("", "a", "foo"))));
        });
      });

      describe("when having a double except with choice", () => {
        it("with a Name matching the inner except", () => {
          assert.isTrue(
            doubleExceptWithChoice.intersects(new salve.Name("", "a", "foo")));
        });

        it("with an NsName matching the except", () => {
          assert.isTrue(doubleExceptWithChoice.intersects(
            new salve.NsName("", "a")));
        });

        it("with an NsName avoiding all excepts", () => {
          assert.isTrue(doubleExceptWithChoice.intersects(
            new salve.NsName("", "b")));
        });

        it("with a Name avoiding all excepts", () => {
          assert.isTrue(
            doubleExceptWithChoice.intersects(
              new salve.Name("", "zzz", "foo")));
        });

        it("not with a Name avoiding the inner except", () => {
          assert.isFalse(
            doubleExceptWithChoice.intersects(
              new salve.Name("", "a", "blah")));
        });

        it("not with an NsName that except the inner except", () => {
          assert.isFalse(
            doubleExceptWithChoice.intersects(
              new salve.NsName("", "a",
                               new salve.Name("", "a", "foo"))));
        });
      });
    });
  });
});
