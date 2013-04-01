'use strict';
require("amd-loader");
var validate = require("../lib/salve/validate");
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

function makeTest(dir) {
    return function () {
        // Read the RNG tree.
        var source = fileAsString("test/" + dir + "/simplified-rng.js");

        try {
            var tree = validate.constructTree(source);
        }
        catch (e) {
            if (e instanceof validate.ValidationError)
                console.log(e.toString());
            throw e;
        }
        var walker = tree.newWalker();

        // Get the events we expect to emit
        var event_list = getEventList(fileAsString("test/" + dir + "/events.txt"));
        var xml_source = fileAsString("test/" + dir + "/to_parse.xml");
        var parser = sax.parser(true, {xmlns: true});

        // Get the expected results
        var expected_source = fileAsString("test/" + dir + "/results.txt");
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

            assert.equal(msg, to.join("\n"), "at line: " + (exp_ix + 1) + " event " + ev.toString());
            exp_ix += lines.length;
        }
        
        var ev_x = 0; // event index
        var eventCheck = function (ev) {
                var expected = event_list[ev_x++];
            assert.equal(ev.toString(), ((expected !== undefined)?expected:"NO MORE").toString());
        }

        var recorded_states = [];
        function issueEvent() {
            var slice_len = arguments.length;
            if (arguments[0] === "leaveStartTag")
                slice_len = 1;
            var ev_params = Array.prototype.slice.call(arguments, 0, slice_len);

            // Clone check
            recorded_states.push([walker.clone(), exp_ix, ev_x]);

            var ev = new validate.Event(ev_params);
            var possible_evs = walker.possible().toArray();
            // We sort events alphabetically, because the implementation
            // does not guarantee any specific order.
            possible_evs.sort();
            compare("possible events\n" + validate.eventsToTreeString(possible_evs), ev);
            eventCheck(ev);
            var ret = walker.fireEvent(ev);
            if (ret !== true)
                console.log(util.inspect(ret[0]));
            compare("fireEvent returned " + ((ret === true)?ret:ret[0].toString()), ev);
        }

        var recorded_events = [];
        function recordEvent() {
            recorded_events.push(arguments);
        }


        var tag_stack = [];
        parser.onopentag = function (node) {
            recordEvent("enterStartTag", node.uri, node.local);
            var names = Object.keys(node.attributes);
            names.sort();
            names.forEach(function (name) {
                var attr = node.attributes[name];
                // The parser hadles all namespace issues
                if ((attr.local == "" && name == "xmlns") || // xmlns="..."
                    (attr.prefix == "xmlns")) // xmlns:...=...
                    return;
                recordEvent("attributeName", attr.uri, attr.local);
                recordEvent("attributeValue", attr.value);
            });
            recordEvent("leaveStartTag", node.uri, node.local);
            tag_stack.unshift([node.uri, node.local]);
        }

        parser.ontext = function (text) {
            var text = text.trim();
            var issue = true;
            if (text === "") {
                var text_possible = walker.possible().filter(function (x) {
                    return x[0] === "text";
                });
                issue = text_possible.length > 0;
            }
            if (issue) {
                // This is a hack to simulate cases where "text"
                // events would be issued in sequence. Any ampersand
                // in the source marks a break, and adds an additional
                // "text" event.
                var chunk = text.split(/&/);
                for(var x = 0; x < chunk.length; ++x)
                    recordEvent("text");
            }
        }
        parser.onclosetag = function (node) {
            var tag_info = tag_stack.shift();
            recordEvent("endTag", tag_info[0], tag_info[1]);
        }

        parser.write(xml_source).close();
        
        recorded_events.forEach(function (ev) {
            issueEvent.apply(undefined, ev);
        });

        compare("possible events " + walker.possible().toString(), new validate.Event(["final"]));

        // Roll back
        var start_at = (recorded_events.length / 2) >> 0; // trick to get integer
        walker = recorded_states[start_at][0];
        exp_ix = recorded_states[start_at][1];
        ev_x = recorded_states[start_at][2];
        recorded_events.slice(start_at).forEach(function (ev) {
            issueEvent.apply(undefined, ev);
        });
        
        compare("possible events " + walker.possible().toString(), new validate.Event(["final"]));

    }
}

describe("Parser", function () {
    it("simple test", makeTest("simple"));

    it("choice matching", makeTest("choice_matching"));

    it("tei", makeTest("tei"));
});

describe("Misc", function () {
    it("Text singleton", function() {
        var t1 = new test.Text("a");
        var t2 = new test.Text("b");
        assert.equal(t1, t2);
    });
});


