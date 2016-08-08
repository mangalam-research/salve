/* global it, describe */
import { Event } from "../../build/dist/lib/salve/patterns";
import namePatterns from "../../build/dist/lib/salve/name_patterns";
import { assert } from "chai";

describe("Event objects are cached", function () {
  it("simple case", function () {
    const a = new Event("a");
    const a2 = new Event("a");
    assert.equal(a, a2);
  });

  it("name pattern case", function () {
    const a = new Event("enterStartTag",
                      namePatterns.Name("", "foo", "bar"));
    const a2 = new Event("enterStartTag",
                       namePatterns.Name("", "foo", "bar"));
    assert.equal(a, a2);
  });
});
