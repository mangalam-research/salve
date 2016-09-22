/* global it, describe */
import { assert } from "chai";
import { Event } from "../../build/dist/lib/salve/patterns";
import namePatterns from "../../build/dist/lib/salve/name_patterns";

describe("Event objects are cached", () => {
  it("simple case", () => {
    const a = new Event("a");
    const a2 = new Event("a");
    assert.equal(a, a2);
  });

  it("name pattern case", () => {
    const a = new Event("enterStartTag",
                        new namePatterns.Name("", "foo", "bar"));
    const a2 = new Event("enterStartTag",
                         new namePatterns.Name("", "foo", "bar"));
    assert.equal(a, a2);
  });
});
