/* global it, describe */
"use strict";
const expect = require("chai").expect;
const salve = require("../../salve");

const ValidationError = salve.ValidationError;
const ElementNameError = salve.ElementNameError;
const Name = salve.Name;

describe("ValidationError", () => {
  describe("#equals", () => {
    it("returns true for the same object", () => {
      const err = new ValidationError("");
      expect(err.equals(err)).to.be.true;
    });

    it("returns true if the errors are the same", () => {
      const err = new ElementNameError("something", new Name("", "a", "b"));
      const err2 = new ElementNameError("something", new Name("", "a", "b"));
      expect(err.equals(err2)).to.be.true;
      expect(err2.equals(err)).to.be.true;
    });

    it("returns false if the names differ", () => {
      const err = new ElementNameError("something", new Name("", "a", "b"));
      const err2 = new ElementNameError("something", new Name("", "a", "c"));
      expect(err.equals(err2)).to.be.false;
      expect(err2.equals(err)).to.be.false;
    });

    it("returns false if the messages differ", () => {
      const err = new ElementNameError("something", new Name("", "a", "b"));
      const err2 = new ElementNameError("else", new Name("", "a", "b"));
      expect(err.equals(err2)).to.be.false;
      expect(err2.equals(err)).to.be.false;
    });
  });
});
