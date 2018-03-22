/* global describe it salve */

describe("convertRNGToPattern", function testConvertRNGToPattern() {
  "use strict";

  // These functions also exercise the validation machinery of salve
  // because converting the schemas require first to validate them.

  this.timeout(0);
  it("works", function test() {
    return salve.convertRNGToPattern(
      new URL("/base/lib/salve/schemas/relaxng.rng", window.location));
  });

  it("handles external references", function test() {
    // This schema contains an external reference.
    return salve.convertRNGToPattern(
      new URL("/base/test/salve-convert/basename.rng",
              window.location));
  });
});
