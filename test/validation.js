/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */

'use strict';
require("amd-loader");
var validate = require("../build/dist/lib/salve/validate");
var oop = require("../build/dist/lib/salve/oop");
var name_patterns = require("../build/dist/lib/salve/name_patterns");
var util = require("util");
var fs = require("fs");
var path = require("path");
var chai = require("chai");
var assert = chai.assert;
var sax = require("sax");
var test = validate.__test();

function fileAsString(p) {
    return fs.readFileSync(path.resolve(p), "utf8").toString();
}

function getEventList(event_source) {
    var event_list = [];
    event_source.split("\n").forEach(function (x) {
        if (!x.match(/^\s*$/))
            event_list.push(new validate.Event(x.split(/,\s*/)));
    });
    return event_list;
}

function makeParser(er, walker) {
    var parser = sax.parser(true, {xmlns: true});

    var tag_stack = [];
    parser.onopentag = function (node) {
        er.recordEvent(walker, "enterContext");

        var names = Object.keys(node.attributes);
        names.sort();
        names.forEach(function (name) {
            var attr = node.attributes[name];
            if (// xmlns="..."
                (attr.local === "" && name === "xmlns") ||
                    // xmlns:...=...
                    (attr.prefix === "xmlns")) {
                er.recordEvent(walker, "definePrefix",
                               attr.local, attr.value);
            }
        });

        var ename = walker.resolveName(node.prefix + ":" + node.local);
        node.uri = ename.ns;

        er.recordEvent(walker, "enterStartTag", node.uri, node.local);
        names.forEach(function (name) {
            var attr = node.attributes[name];
            if (// xmlns="..."
                (attr.local === "" && name === "xmlns") ||
                    // xmlns:...=...
                    (attr.prefix === "xmlns"))
                return;
            if (attr.prefix !== "") {
                var ename = walker.resolveName(attr.prefix + ":" +
                                               attr.local, true);
                attr.uri = ename.ns;
            }
            er.recordEvent(walker, "attributeName", attr.uri, attr.local);
            er.recordEvent(walker, "attributeValue", attr.value);
        });
        er.recordEvent(walker, "leaveStartTag", node.uri, node.local);
        tag_stack.unshift([node.uri, node.local]);
    };

    parser.ontext = function (text) {
        text = text.trim();
        var chunk = text.split(/&/);
        for(var x = 0; x < chunk.length; ++x)
            er.recordEvent(walker, "text", chunk[x].trim());
    };

    parser.onclosetag = function (node) {
        var tag_info = tag_stack.shift();
        er.recordEvent(walker, "endTag", tag_info[0], tag_info[1]);
        er.recordEvent(walker, "leaveContext");
    };

    return parser;
}

function EventRecorder(ComparisonEngine, options) {
    options = options || {
        check_fireEvent_invocation: true,
        check_possible: true
    };

    this.events = [];
    this.recorded_states = [];
    this.ce = ComparisonEngine;
    this.dont_record_state = false;
    this.check_fireEvent_invocation = options.check_fireEvent_invocation;
    this.check_possible = options.check_possible;
}

EventRecorder.prototype.recordEvent = function (walker) {
    this.events.push(Array.prototype.slice.call(arguments, 1));
    this.issueLastEvent(walker);
};

EventRecorder.prototype.issueEventAt = function (walker, at) {
    this.issueEvent(walker, at, this.events[at]);
    return at < this.events.length - 1;
};

EventRecorder.prototype.issueLastEvent = function (walker) {
    this.issueEventAt(walker, this.events.length - 1);
};

EventRecorder.prototype.issueEvent = function (walker, ev_ix, ev) {
    var slice_len = ev.length;
    if (ev[0] === "leaveStartTag")
        slice_len = 1;
    var ev_params = Array.prototype.slice.call(ev, 0, slice_len);

    // For the clone check
    if (!this.dont_record_state)
        this.recorded_states.push([walker.clone(),
                                   this.ce.exp_ix, ev_ix]);

    var nev = new validate.Event(ev_params);
    if (this.check_fireEvent_invocation)
        this.ce.compare("\ninvoking fireEvent with " + nev.toString().trim(), nev);
    var ret = walker.fireEvent(nev);
    this.ce.compare("fireEvent returned " + errorsToString(ret), nev);
    if (this.check_possible) {
        var possible_evs = walker.possible().toArray();
        // We sort events alphabetically, because the
        // implementation does not guarantee any specific order.
        possible_evs.sort();
        if (ev_params[0] !== "enterContext" &&
            ev_params[0] !== "leaveContext" &&
            ev_params[0] !== "definePrefix")
            this.ce.compare("possible events\n" +
                            validate.eventsToTreeString(possible_evs), nev);
    }
};

function ComparisonEngine(expected) {
    this.exp_ix = 0;
    this.expected = expected;
}

ComparisonEngine.prototype.compare =  function (msg, ev)
{
    var lines = msg.split(/\n/);

    // Drop final blank lines
    while(lines[lines.length - 1] === "")
        lines.pop();
    msg = lines.join("\n");
    var to = this.expected.slice(this.exp_ix, this.exp_ix + lines.length);

    assert.equal(msg, to.join("\n"), "at line: " +
                 (this.exp_ix + 1) + " event " + ev.toString());
    this.exp_ix += lines.length;
};


function errorsToString(errs) {
    if (!errs)
        return errs + "";

    return errs.join(",").toString();
}

function makeValidTest(dir) {
    return function () {
        // Read the RNG tree.
        var source = fileAsString("test/" + dir +
                                  "/simplified-rng.js");

        var tree;
        try {
            tree = validate.constructTree(source);
        }
        catch (e) {
            if (e instanceof validate.ValidationError)
                console.log(e.toString());
            throw e;
        }
        var walker = tree.newWalker();
        var xml_source = fileAsString("test/" + dir +
                                      "/to_parse.xml");

        // Get the expected results
        var expected_source =
                fileAsString("test/" + dir + "/results.txt");


        var expected = expected_source.split("\n");
        var ce = new ComparisonEngine(expected);
        var er = new EventRecorder(ce);

        var context_independent = tree.whollyContextIndependent();
        ce.compare("wholly context-independent " + context_independent,
                   "*context-independent*");

        ce.compare("possible events\n" +
                   validate.eventsToTreeString(walker.possible()),
                new validate.Event(["initial"]));

        var parser = makeParser(er, walker);
        parser.write(xml_source).close();

        ce.compare("end returned " + walker.end(), "*final*");

        // Roll back; >> gives us an integer
        var start_at = (er.recorded_states.length / 2) >> 0;
        walker = er.recorded_states[start_at][0];
        ce.exp_ix = er.recorded_states[start_at][1];
        var ev_ix = er.recorded_states[start_at][2];

        er.dont_record_state = true; // stop recording.
        var more = true;
        while(more)
            more = er.issueEventAt(walker, ev_ix++);

        ce.compare("end returned " + walker.end(), "*final*");
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

describe("GrammarWalker.fireEvent",  function () {
    describe("reports errors on", function () {
        var walker;
        var rng;
        function makeErrorTest(dir, recorder_options) {
            recorder_options = recorder_options || {
                check_fireEvent_invocation: false,
                check_possible: false
            };
            return function () {
                var myrng = rng;
                // Give it a default
                if (myrng === undefined)
                    myrng = "test/" + dir + "/simplified-rng.js";
                // Read the RNG tree.
                var source = fileAsString(myrng);

                var tree;
                try {
                    tree = validate.constructTree(source);
                }
                catch (e) {
                    if (e instanceof validate.ValidationError)
                        console.log(e.toString());
                    throw e;
                }
                walker = tree.newWalker();

                var xml_source = fileAsString("test/" + dir +
                                              "/to_parse.xml");

                // Get the expected results
                var expected_source = fileAsString("test/" + dir +
                                                   "/results.txt");
                var expected = expected_source.split("\n");

                var ce = new ComparisonEngine(expected);
                var er = new EventRecorder(ce, recorder_options);

                var parser = makeParser(er, walker);
                parser.write(xml_source).close();
                ce.compare("end returned " + walker.end(), "*final*");
            };
        }

        describe("a tei-based file", function () {
            before(function () {
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
            before(function () {
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
            before(function () {
                rng = "test/simple/simplified-rng.js";
            });
            it("which has a missing attribute",
               makeErrorTest("missing_attribute"));
            it("which has misplaced text",
               makeErrorTest("misplaced_text"));
            it("which has foreign elements followed by misplaced text",
               makeErrorTest("foreign_elements",   {
                   check_fireEvent_invocation: true,
                   check_possible: true
               }));
            it("which has inferable foreign elements",
               makeErrorTest("foreign_elements_inferable",   {
                   check_fireEvent_invocation: true,
                   check_possible: true
               }));
        });

        describe("ad hoc schema", function () {
            before(function () {
                rng = undefined;
            });
            it("which has a choice not chosen",
               makeErrorTest("choice_not_chosen", {
                   check_fireEvent_invocation: true,
                   check_possible: false
               }));
            it("which has a choice ended by a subsequent item",
               makeErrorTest("choice_ended_by_following_item", {
                   check_fireEvent_invocation: true,
                   check_possible: false
               }));

            it("which has a one-or-more prematurely ended",
               makeErrorTest("one_or_more_not_satisfied", {
                   check_fireEvent_invocation: true,
                   check_possible: false
               }));

            it("top-level opening tag without closing",
               makeErrorTest("opening_no_closing", {
                   check_fireEvent_invocation: true,
                   check_possible: false
               }));

            it("invalid attribute",
               makeErrorTest("invalid_attribute", {
                   check_fireEvent_invocation: true,
                   check_possible: false
               }));

            it("NsName fails a match",
               makeErrorTest("name_error1"));

            it("NameChoice fails a match",
               makeErrorTest("name_error2"));

            it("Except fails a match",
               makeErrorTest("name_error3"));

        });

        it("an attribute without value", function () {
            // Read the RNG tree.
            var source = fileAsString(
                "test/simple/simplified-rng.js");

            var tree;
            tree = validate.constructTree(source);
            var walker = tree.newWalker();
            var ret = walker.fireEvent(
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
                'attribute not allowed here: ' +
                    '{"ns":"","name":"style"}');
        });
    });

    describe("handles valid documents having", function () {
        it("attributes in any valid order", function () {
            // Read the RNG tree.
            var source = fileAsString(
                "test/attribute-order/simplified-rng.js");

            var tree;
            tree = validate.constructTree(source);
            var walker = tree.newWalker();
            var ret = walker.fireEvent(
                new validate.Event("enterStartTag", "", "html"));
            assert.isFalse(ret);
            ret = walker.fireEvent(
                new validate.Event("leaveStartTag", "", "html"));
            assert.isFalse(ret);

            var permutations = [
                ["attr-a", "attr-b", "attr-c"],
                ["attr-a", "attr-c", "attr-b"],
                ["attr-b", "attr-a", "attr-c"],
                ["attr-b", "attr-c", "attr-a"],
                ["attr-c", "attr-a", "attr-b"],
                ["attr-c", "attr-b", "attr-a"]
            ];
            var stub =
                "attributeName:\n" +
                "    ";
            permutations.forEach(function (perm) {
                var ret = walker.fireEvent(
                    new validate.Event("enterStartTag", "", "em"));
                assert.isFalse(ret, "entering em");

                var possible = [];
                perm.forEach(function (attr) {
                    possible.push('{"ns":"","name":"' +
                                  attr + '"}');
                });
                perm.forEach(function (attr) {
                    var sorted = possible.slice().sort();
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
                    if (!possible.length)
                        assert.equal(
                            validate.eventsToTreeString(walker.possible()),
                            "leaveStartTag\n");
                });

                ret = walker.fireEvent(
                    new validate.Event("leaveStartTag"));
                assert.isFalse(ret);
                ret = walker.fireEvent(
                    new validate.Event("endTag", "", "em"));
                assert.isFalse(ret);
            });
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
            var source = fileAsString(
                "test/simple/simplified-rng.js");

            var tree;
            tree = validate.constructTree(source);
            var walker = tree.newWalker();
            var ret = walker.fireEvent(
                new validate.Event("enterStartTag", "", "html"));
            assert.isFalse(ret);
            ret = walker.fireEvent(
                new validate.Event("text", "q"));
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(),
                         "text not allowed here");
        });

        it("duplicate leaveStartTag", function () {
            // Read the RNG tree.
            var source = fileAsString(
                "test/simple/simplified-rng.js");

            var tree;
            tree = validate.constructTree(source);
            var walker = tree.newWalker();
            var ret = walker.fireEvent(
                new validate.Event("enterStartTag", "", "html"));
            assert.isFalse(ret);
            ret = walker.fireEvent(
                new validate.Event("attributeName", "", "style"));
            assert.isFalse(ret);
            ret = walker.fireEvent(
                new validate.Event("attributeValue", "", "x"));
            assert.isFalse(ret);
            ret = walker.fireEvent(
                new validate.Event("leaveStartTag"));
            assert.isFalse(ret);
            ret = walker.fireEvent(
                new validate.Event("leaveStartTag"));
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(),
                         "unexpected leaveStartTag event; " +
                         "it is likely that "+
                         "fireEvent is incorrectly called");
        });

        it("duplicate attributeValue", function () {
            // Read the RNG tree.
            var source = fileAsString(
                "test/simple/simplified-rng.js");

            var tree;
            tree = validate.constructTree(source);
            var walker = tree.newWalker();
            var ret = walker.fireEvent(
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
                         "it is likely that "+
                         "fireEvent is incorrectly called");
        });

        it("duplicate endTag", function () {
            // Read the RNG tree.
            var source = fileAsString(
                "test/simple/simplified-rng.js");

            var tree;
            tree = validate.constructTree(source);
            var walker = tree.newWalker();
            var ret = walker.fireEvent(
                new validate.Event("enterStartTag", "", "html"));
            assert.isFalse(ret);
            ret = walker.fireEvent(
                new validate.Event("attributeName", "", "style"));
            assert.isFalse(ret);
            ret = walker.fireEvent(
                new validate.Event("attributeValue", "", "x"));
            assert.isFalse(ret);
            ret = walker.fireEvent(
                new validate.Event("leaveStartTag"));
            assert.isFalse(ret);
            ret = walker.fireEvent(
                new validate.Event("endTag", "", "html"));
            assert.equal(ret.length, 1);
            assert.equal(
                ret[0].toString(),
                'tag required: {"ns":"","name":"head"}');
            ret = walker.fireEvent(
                new validate.Event("endTag", "", "html"));
            assert.equal(ret.length, 1);
            assert.equal(
                ret[0].toString(),
                'unexpected end tag: {"ns":"","name":"html"}');
        });


    });
});

describe("error objects", function () {
    function makeErrorTest (ctor_name, names, fake_names,
                            first, second) {
        names = names || [new validate.EName("a", "b")];
        fake_names = fake_names || ["a"];
        first = first || 'blah: {a}b';
        second = second || "blah: a";

        it(ctor_name, function () {
            var ctor = validate[ctor_name];
            var err = Object.create(ctor.prototype);
            ctor.apply(err, ["blah"].concat(names));
            assert.equal(err.toString(), first);
            assert.sameMembers(err.getNames(), names);
            assert.equal(err.toStringWithNames(fake_names),
                         second);
        });
    }
    makeErrorTest("AttributeNameError");
    makeErrorTest("AttributeValueError");
    makeErrorTest("ElementNameError");

    it("ChoiceError", function () {
        var names_a = [new validate.EName("a", "b"),
                       new validate.EName("c", "d")];
        var names_b = [new validate.EName("e", "f"),
                       new validate.EName("g", "h")];
        var err = new validate.ChoiceError(names_a, names_b);
        assert.equal(err.toString(),
                     "must choose either {a}b, {c}d or {e}f, {g}h");
        assert.sameMembers(err.getNames(), names_a.concat(names_b));
        assert.equal(err.toStringWithNames(["a", "b", "c", "d"]),
                     "must choose either a, b or c, d");
    });

});


describe("Grammar", function () {
    describe("getNamespaces", function () {
        it("returns the namespaces", function () {
            // Read the RNG tree.
            var source = fileAsString("test/tei/simplified-rng.js");

            var tree = validate.constructTree(source);
            assert.sameMembers(
                tree.getNamespaces(),
                ["http://www.tei-c.org/ns/1.0",
                 "http://www.w3.org/XML/1998/namespace"]);
        });

        it("returns an empty namespace when there are no namespaces",
           function () {
            // Read the RNG tree.
            var source = fileAsString("test/simple/simplified-rng.js");

            var tree = validate.constructTree(source);
            assert.sameMembers(tree.getNamespaces(), [""]);
        });

        it("returns * when anyName is used and ::except when except is used",
           function () {
            // Read the RNG tree.
            var source = fileAsString("test/names/simplified-rng.js");

            var tree = validate.constructTree(source);
            assert.sameMembers(tree.getNamespaces(), [
                "",
                "foo:foo",
                "*",
                "::except"
            ]);
        });

    });
});


describe("Misc", function () {
    it("Text singleton", function() {
        var t1 = new test.Text("a");
        var t2 = new test.Text("b");
        assert.equal(t1, t2);
    });
});

describe("Name pattern", function () {
    describe("Name", function () {
        var np;

        before(function () {
            np = new name_patterns.Name("", "a", "b");
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

        it("converts to an object", function () {
            assert.deepEqual(np.toObject(), {ns: 'a', name: 'b'});
        });
    });

    describe("NameChoice", function () {
        var simple, complex, a_simple, a_complex, b;

        before(function () {
            a_simple = new name_patterns.Name("", "a", "b");
            a_complex = new name_patterns.AnyName("");
            b = new name_patterns.Name("", "c", "d");
            simple = new name_patterns.NameChoice("", [a_simple, b]);
            complex = new name_patterns.NameChoice("", [a_complex, b]);
        });

        it("is simple or complex depending on contents", function () {
            assert.isTrue(simple.simple());
            assert.isFalse(complex.simple());
        });

        it("converts to an array, if simple", function () {
            assert.sameMembers(simple.toArray(), [a_simple, b]);
            assert.isNull(complex.toArray());
        });

        it("matches a matching namespace and name", function () {
            // Will match on the first element.
            assert.isTrue(simple.match("a", "b"));
            // Will match on the second.
            assert.isTrue(simple.match("c", "d"));
        });

        it("converts to an object", function () {
            assert.deepEqual(simple.toObject(), {a: {ns: 'a', name: 'b'},
                                                 b: {ns: 'c', name: 'd'}});
        });
    });

    describe("NsName", function () {
        var np, with_except;

        before(function () {
            np = new name_patterns.NsName("", "a");
            with_except = new name_patterns.NsName(
                "", "a",
                new name_patterns.Name("", "a", "b"));
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

        it("does not match an exception", function () {
            assert.isFalse(with_except.match("a", "b"));
        });

        it("converts to an object", function () {
            assert.deepEqual(np.toObject(), {ns: 'a'});
            assert.deepEqual(with_except.toObject(),
                             {
                                 ns: 'a',
                                 except: { ns: 'a', name: 'b' }
                             });
        });
    });


    describe("AnyName", function () {
        var np, with_except;

        before(function () {
            np = new name_patterns.AnyName("");
            with_except = new name_patterns.AnyName(
                "",
                new name_patterns.Name("", "a", "b"));
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
            assert.isFalse(with_except.match("a", "b"));
        });

        it("converts to an object", function () {
            assert.deepEqual(np.toObject(), {pattern: 'AnyName'});
            assert.deepEqual(with_except.toObject(),
                             {
                                 pattern: 'AnyName',
                                 except: {ns: "a", name: "b"}
                             });
        });
    });
});
