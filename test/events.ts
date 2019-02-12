import { expect } from "chai";

import { AttributeNameEvent, AttributeValueEvent, EndTagEvent,
         EnterStartTagEvent, Event, LeaveStartTagEvent, Name,
         TextEvent } from "../build/dist";

interface MakeTestOptions<T, P> {
  name: string;
  builder(): T;
  makeSame(): T[];
  makeDiffClass(): Event;
  expected: {
    name: string;
    param(): P | null;
    params(): [string] | [string, P];
    isAttributeEvent: boolean;
  };
  moreTests(): void;
  moreEqualTests(): void;
}

function makeTest<T extends Event, P>(options: MakeTestOptions<T, P>): void {
  const { builder, expected } = options;
  describe(options.name, () => {
    it("#name has the right value", () => {
      expect(builder()).to.have.property("name").equal(expected.name);
    });

    it("#param has the right value", () => {
      expect(builder()).to.have.property("param").equal(expected.param());
    });

    it("#params has the right value", () => {
      expect(builder()).to.have.property("params").deep
        .equal(expected.params());
    });

    it("#isAttributeEvent has the right value", () => {
      expect(builder()).to.have.property("isAttributeEvent")
        .equal(expected.isAttributeEvent);
    });

    options.moreTests();

    describe("#equals()", () => {
      let orig: T;
      let same: T[];
      let otherClass: Event;

      before(() => {
        orig = builder();
        same = options.makeSame();
        otherClass = options.makeDiffClass();
      });

      it("returns true if compared to itself", () => {
        expect(orig.equals(orig)).to.be.true;
      });

      it("returns true if compared to equal event", () => {
        for (const s of same) {
          expect(orig.equals(s)).to.be.true;
        }
      });

      it("returns false if compared to an event of different class", () => {
        expect(orig.equals(otherClass)).to.be.false;
      });

      options.moreEqualTests();
    });
  });
}

describe("events", () => {
  let name: Name;

  before(() => {
    name = new Name("", "", "foo");
  });

  // tslint:disable-next-line:mocha-no-side-effect-code
  makeTest({
    name: "EnterStartTagEvent",
    builder: () => new EnterStartTagEvent(name),
    makeSame: () => [new EnterStartTagEvent(name),
                     new EnterStartTagEvent(new Name("", "", "foo"))],
    makeDiffClass: () => new AttributeNameEvent(name),
    expected: {
      name: "enterStartTag",
      param: () => name,
      params: () => ["enterStartTag", name],
      isAttributeEvent: false,
    },
    moreTests(): void {
      it("#namePattern has the value given in constructor", () => {
        expect(new EnterStartTagEvent(name)).to.have.property("namePattern")
          .equal(name);
      });
    },
    moreEqualTests(): void {
      it("returns false if compared to different event", () => {
        const diff = new EnterStartTagEvent(new Name("", "", "other"));
        // tslint:disable-next-line:no-invalid-this
        expect(this.builder().equals(diff)).to.be.false;
      });
    },
  });

  // tslint:disable-next-line:mocha-no-side-effect-code
  makeTest({
    name: "LeaveStartTagEvent",
    builder: () => new LeaveStartTagEvent(),
    makeSame: () => [new LeaveStartTagEvent()],
    makeDiffClass: () => new AttributeNameEvent(name),
    expected: {
      name: "leaveStartTag",
      param: () => null,
      params: () => ["leaveStartTag"],
      isAttributeEvent: false,
    },
    // tslint:disable-next-line:no-empty
    moreTests(): void {},
    // tslint:disable-next-line:no-empty
    moreEqualTests(): void {},
  });

  // tslint:disable-next-line:mocha-no-side-effect-code
  makeTest({
    name: "EndTagEvent",
    builder: () => new EndTagEvent(name),
    makeSame: () => [new EndTagEvent(name),
                     new EndTagEvent(new Name("", "", "foo"))],
    makeDiffClass: () => new AttributeNameEvent(name),
    expected: {
      name: "endTag",
      param: () => name,
      params: () => ["endTag", name],
      isAttributeEvent: false,
    },
    moreTests(): void {
      it("#namePattern has the value given in constructor", () => {
        expect(new EndTagEvent(name)).to.have.property("namePattern")
          .equal(name);
      });
    },
    moreEqualTests(): void {
      it("returns false if compared to different event", () => {
        const diff = new EndTagEvent(new Name("", "", "other"));
        // tslint:disable-next-line:no-invalid-this
        expect(this.builder().equals(diff)).to.be.false;
      });
    },
  });

  // tslint:disable-next-line:mocha-no-side-effect-code
  makeTest({
    name: "AttributeNameEvent",
    builder: () => new AttributeNameEvent(name),
    makeSame: () => [new AttributeNameEvent(name),
                     new AttributeNameEvent(new Name("", "", "foo"))],
    makeDiffClass: () => new EnterStartTagEvent(name),
    expected: {
      name: "attributeName",
      param: () => name,
      params: () => ["attributeName", name],
      isAttributeEvent: true,
    },
    moreTests(): void {
      it("#namePattern has the value given in constructor", () => {
        expect(new AttributeNameEvent(name)).to.have.property("namePattern")
          .equal(name);
      });
    },
    moreEqualTests(): void {
      it("returns false if compared to different event", () => {
        const diff = new AttributeNameEvent(new Name("", "", "other"));
        // tslint:disable-next-line:no-invalid-this
        expect(this.builder().equals(diff)).to.be.false;
      });
    },
  });

  // tslint:disable-next-line:mocha-no-side-effect-code
  makeTest({
    name: "AttributeValueEvent",
    builder: () => new AttributeValueEvent("foo"),
    makeSame: () => [new AttributeValueEvent("foo")],
    makeDiffClass: () => new TextEvent("foo"),
    expected: {
      name: "attributeValue",
      param: () => "foo",
      params: () => ["attributeValue", "foo"],
      isAttributeEvent: true,
    },
    moreTests(): void {
      it("#value has the value given in constructor", () => {
        expect(new AttributeValueEvent("foo")).to.have.property("value")
          .equal("foo");
      });
    },
    moreEqualTests(): void {
      it("returns false if compared to different event", () => {
        const diff = new AttributeValueEvent("other");
        // tslint:disable-next-line:no-invalid-this
        expect(this.builder().equals(diff)).to.be.false;
      });
    },
  });
});
