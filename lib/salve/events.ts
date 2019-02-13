/**
 * Classes that model possible events.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { ConcreteName } from "./name_patterns";

/**
 * This is the class that events **returned** by salve derive from. This class
 * is entirely abstract but it can still be use for instanceof tests.
 */
export abstract class Event {

  /**
   * The event name. All concrete classes deriving from this class must have a
   * unique name per class. That is, objects of two different classes have
   * different names, and all objects of the same class have the same name. The
   * logic below and elsewhere relies on this contract.
   */
  abstract readonly name: string;

  /** The event parameter. This is null if the event has no parameter. */
  abstract readonly param: string | ConcreteName | RegExp | null;

  /** Whether it is an attribute event. */
  abstract readonly isAttributeEvent: boolean;

  /**
   * The event parameters. This consists of the event name, followed by
   * the rest of the parameters making up the event.
   *
   * @deprecated This field will be removed in a future major release.
   */
  abstract readonly params: [string] | [string, string | ConcreteName | RegExp];

  // The codebase here does not use equals, but our companion library salve-dom
  // does.
  /**
   * Determine if this event is equal to another. Two events are deemed equal if
   * they are of the same class, and have equal [[param]].
   *
   *
   * @param other The other event.
   *
   * @returns Whether the events are equal.
   */
  abstract equals(other: Event): boolean;
}

/**
 * A class for events that take a name pattern as parameter.
 */
export abstract class NamePatternEvent<Name extends string> extends Event {
  protected constructor(readonly name: Name,
                        readonly namePattern: ConcreteName) {
    super();
  }

  get param(): ConcreteName {
    return this.namePattern;
  }

  get params(): [Name, ConcreteName] {
    return [this.name, this.namePattern];
  }

  equals(other: Event): boolean {
    return this.name === other.name && this.namePattern.toString() ===
      (other as NamePatternEvent<string>).namePattern.toString();
  }
}

export class EnterStartTagEvent extends NamePatternEvent<"enterStartTag"> {
  readonly isAttributeEvent: false = false;

  constructor(namePattern: ConcreteName) {
    super("enterStartTag", namePattern);
  }
}

export class LeaveStartTagEvent extends Event {
  readonly name: "leaveStartTag" = "leaveStartTag";
  readonly isAttributeEvent: false = false;
  readonly param: null = null;

  get params(): ["leaveStartTag"] {
    return ["leaveStartTag"];
  }

  equals(other: Event): boolean {
    return this.name === other.name;
  }
}

export class EndTagEvent extends NamePatternEvent<"endTag"> {
  readonly isAttributeEvent: false = false;

  constructor(namePattern: ConcreteName) {
    super("endTag", namePattern);
  }
}

export class AttributeNameEvent extends NamePatternEvent<"attributeName"> {
  readonly isAttributeEvent: true = true;

  constructor(namePattern: ConcreteName) {
    super("attributeName", namePattern);
  }
}

/**
 * A class for events that take a string or regexp value as parameter.
 */
export abstract class ValueEvent<Name extends string> extends Event {
  protected constructor(readonly name: Name,
                        readonly value: string | RegExp) {
    super();
  }

  get params(): [Name, string | RegExp] {
    return [this.name, this.value];
  }

  get param(): string | RegExp {
    return this.value;
  }

  equals(other: Event): boolean {
    return this.name === other.name && this.value.toString() ===
      (other as ValueEvent<string>).value.toString();
  }
}

export class AttributeValueEvent extends ValueEvent<"attributeValue"> {
  readonly isAttributeEvent: true = true;

  constructor(value: string | RegExp) {
    super("attributeValue", value);
  }
}

export class TextEvent extends ValueEvent<"text"> {
  readonly isAttributeEvent: false = false;

  constructor(value: string | RegExp) {
    super("text", value);
  }
}

export type Events = EnterStartTagEvent | LeaveStartTagEvent | EndTagEvent |
  AttributeNameEvent | AttributeValueEvent | TextEvent;
