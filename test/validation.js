'use strict';
require("amd-loader");
var validate = require("../build/lib/salve/validate");
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

function makeParser(recordEvent) {
    var parser = sax.parser(true, {xmlns: true});

    var tag_stack = [];
    parser.onopentag = function (node) {
        recordEvent("enterStartTag", node.uri, node.local);
        var names = Object.keys(node.attributes);
        names.sort();
        names.forEach(function (name) {
            var attr = node.attributes[name];
            // The parser hadles all namespace issues
            if (// xmlns="..."
                (attr.local === "" && name === "xmlns") ||
                    // xmlns:...=...
                    (attr.prefix == "xmlns"))
                return;
            recordEvent("attributeName", attr.uri, attr.local);
            recordEvent("attributeValue", attr.value);
        });
        recordEvent("leaveStartTag", node.uri, node.local);
        tag_stack.unshift([node.uri, node.local]);
    };

    parser.ontext = function (text) {
        text = text.trim();
        var chunk = text.split(/&/);
        for(var x = 0; x < chunk.length; ++x)
            recordEvent("text", chunk[x].trim());
    };

    parser.onclosetag = function (node) {
        var tag_info = tag_stack.shift();
        recordEvent("endTag", tag_info[0], tag_info[1]);
    };

    return parser;
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

        // Get the events we expect to emit
        var event_list = getEventList(fileAsString("test/" + dir +
                                                   "/events.txt"));
        var xml_source = fileAsString("test/" + dir +
                                      "/to_parse.xml");

        // Get the expected results
        var expected_source = fileAsString("test/" + dir +
                                           "/results.txt");
        var expected = expected_source.split("\n");

        var exp_ix = 0;
        function compare(msg, ev)
        {
            var lines = msg.split(/\n/);

            // Drop final blank lines
            while(lines[lines.length - 1] === "")
                lines.pop();
            msg = lines.join("\n");
            var to = expected.slice(exp_ix, exp_ix + lines.length);

            assert.equal(msg, to.join("\n"), "at line: " +
                         (exp_ix + 1) + " event " + ev.toString());
            exp_ix += lines.length;
        }

        var ev_x = 0; // event index
        var eventCheck = function (ev) {
            var expected = event_list[ev_x++];
            assert.equal(ev.toString(),
                         ((expected !== undefined) ? expected
                          : "NO MORE").toString(),
                         "event check at line: " + ev_x);
        };

        var recorded_states = [];
        function issueEvent(gev_ix, gev) {
            var slice_len = gev.length;
            if (gev[0] === "leaveStartTag")
                slice_len = 1;
            else if (gev[0] === "text") {
                var text = gev[1];
                var issue = true;
                if (text === "") {
                    var text_possible =
                        walker.possible().filter(function (x) {
                            return x.params[0] === "text";
                        });
                    issue = text_possible.length > 0;
                }
                if (!issue)
                    return;
                slice_len = 1;
            }
            var ev_params =
                Array.prototype.slice.call(gev, 0, slice_len);

            // Clone check
            recorded_states.push([walker.clone(),
                                  exp_ix, ev_x, gev_ix]);

            var ev = new validate.Event(ev_params);
            var possible_evs = walker.possible().toArray();
            // We sort events alphabetically, because the
            // implementation does not guarantee any specific order.
            possible_evs.sort();
            compare("possible events\n" +
                    validate.eventsToTreeString(possible_evs), ev);
            eventCheck(ev);
            var ret = walker.fireEvent(ev);
            compare("fireEvent returned " +
                    (!ret ? ret : ret[0].toString()), ev);
        }

        var recorded_events = [];
        function recordEvent() {
            recorded_events.push(arguments);
        }

        var parser = makeParser(recordEvent);
        parser.write(xml_source).close();

        var context_independent = tree.whollyContextIndependent();
        compare("wholly context-independent " + context_independent,
                "*context-independent*");

        var gev_ix = 0;
        for (var gev; (gev = recorded_events[gev_ix]) !== undefined;
             gev_ix++) {
            issueEvent(gev_ix, gev);
        }

        compare("possible events " + walker.possible().toString(),
                new validate.Event(["final"]));

        compare("end returned " + walker.end(), "*final*");

        // Roll back; >> gives us an integer
        var start_at = (recorded_events.length / 2) >> 0;
        walker = recorded_states[start_at][0];
        exp_ix = recorded_states[start_at][1];
        ev_x = recorded_states[start_at][2];
        gev_ix = recorded_states[start_at][3];

        for (gev; (gev = recorded_events[gev_ix++]) !== undefined;) {
            issueEvent(gev_ix, gev);
        }

        compare("possible events " + walker.possible().toString(),
                new validate.Event(["final"]));

        compare("end returned " + walker.end(), "*final*");
    };
}

describe("GrammarWalker.fireEvent reports no error on",
         function () {
             it("a simple test", makeValidTest("simple"));

             it("choice matching", makeValidTest("choice_matching"));

             it("a tei file", makeValidTest("tei"));
         });

describe("GrammarWalker.fireEvent",  function () {
    describe("reports errors on", function () {
        var walker;
        var rng;
        function makeErrorTest(dir) {
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

                var exp_ix = 0;
                function compare(msg, ev)
                {
                    var lines = msg.split(/\n/);

                    // Drop final blank lines
                    while(lines[lines.length - 1] === "")
                        lines.pop();
                    msg = lines.join("\n");
                    var to = expected.slice(exp_ix, exp_ix +
                                            lines.length);

                    assert.equal(msg, to.join("\n"), "at line: " +
                                 (exp_ix + 1) + " event " +
                                 ev.toString());
                    exp_ix += lines.length;
                }

                function handleEvent() {
                    var gev = arguments;
                    var slice_len = gev.length;
                    if (gev[0] === "leaveStartTag")
                        slice_len = 1;
                    else if (gev[0] === "text") {
                        var text = gev[1];
                        var issue = true;
                        if (text === "") {
                            var text_possible =
                                walker.possible().filter(function (x) {
                                    return x.params[0] === "text";
                                });
                            issue = text_possible.length > 0;
                        }
                        if (!issue)
                            return;
                        slice_len = 1;
                    }
                    var ev_params =
                        Array.prototype.slice.call(gev, 0, slice_len);

                    var ev = new validate.Event(ev_params);
                    var ret = walker.fireEvent(ev);
                    compare("fireEvent returned " +
                            (!ret ? ret : ret[0].toString()), ev);
                }

                var parser = makeParser(handleEvent);
                parser.write(xml_source).close();
                compare("end returned " + walker.end(), "*final*");
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
               makeErrorTest("foreign_elements"));
        });

        describe("ad hoc schema", function () {
            before(function () {
                rng = undefined;
            });
            it("which has a choice not chosen",
               makeErrorTest("choice_not_chosen"));
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
            assert.equal(ret[0].toString(),
                         "attribute not allowed here: {}style");
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
                new validate.Event("text"));
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
            assert.equal(ret[0].toString(), "tag required: {}head");
            ret = walker.fireEvent(
                new validate.Event("endTag", "", "html"));
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(), "unexpected end tag: {}html");
        });


    });
});

describe("error objects", function () {
    function makeErrorTest (ctor_name, names, fake_names,
                            first, second) {
        names = names || [new validate.EName("a", "b")];
        fake_names = fake_names || ["a"];
        first = first || "blah: {a}b";
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
    });
    describe("getNamespaces", function () {
        it("returns an empty namespace when there are no namespaces",
           function () {
               // Read the RNG tree.
               var source = fileAsString(
                   "test/simple/simplified-rng.js");

               var tree = validate.constructTree(source);
               assert.sameMembers(tree.getNamespaces(), [""]);
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
