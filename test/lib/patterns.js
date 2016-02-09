import { Event } from "../../build/dist/lib/salve/patterns";
import name_patterns from "../../build/dist/lib/salve/name_patterns";
import { assert } from "chai";

describe("Event objects are cached", function () {
    it("simple case", function () {
        var a = new Event("a");
        var a2 = new Event("a");
        assert.equal(a, a2);
    });

    it("name pattern case", function () {
        var a = new Event("enterStartTag",
                          name_patterns.Name("", "foo", "bar"));
        var a2 = new Event("enterStartTag",
                           name_patterns.Name("", "foo", "bar"));
        assert.equal(a, a2);
    });
});
