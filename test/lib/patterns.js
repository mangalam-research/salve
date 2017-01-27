/* global it, describe */
import { assert } from "chai";
import { Event, Name } from "../../salve";

describe("Event objects are cached", () => {
  it("simple case", () => {
    const a = new Event("a");
    const a2 = new Event("a");
    assert.equal(a, a2);
  });

  it("name pattern case", () => {
    const a = new Event("enterStartTag", new Name("", "foo", "bar"));
    const a2 = new Event("enterStartTag", new Name("", "foo", "bar"));
    assert.equal(a, a2);
  });
});
