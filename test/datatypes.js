/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */

/* global it, describe, before */
import "amd-loader";
import { assert } from "chai";
import _ from "lodash";
import datatypes from "../build/dist/lib/salve/datatypes";
import nameResolver from "../build/dist/lib/salve/name_resolver";

const decimalProgram = {
  equal: {
    // Tests that return true.
    true:
    [
      // title, first value, second value
      ["for two identical values", "1.23", "1.23"],
      ["for two equal values, represented differently (1)",
       "1.23", " 01.230"],
      ["for two equal values, represented differently (2)",
       "1.23", " +01.230"],
      ["for two equal values, represented differently (3)",
       "-1.23", " -01.230"],
      ["for two equal values, represented differently (4)",
       "-.23", " -00.230"],
      ["for two equal values, represented differently (5)",
       "+12", " +12."],
    ],
    // Tests that return false.
    false: [
      ["for two unequal values", "1", "2"],
    ],
  },
  parseParams: [
    // title, array to parse, expected object
    [
      "all except minInclusive and maxInclusive",
      [
        { name: "totalDigits", value: "10" },
        { name: "fractionDigits", value: "1" },
        { name: "pattern", value: "abc" },
        { name: "minExclusive", value: "1" },
        { name: "maxExclusive", value: "10" },
      ],
      {
        totalDigits: 10,
        fractionDigits: 1,
        pattern: { rng: "abc", internal: new RegExp("^abc$") },
        minExclusive: 1,
        maxExclusive: 10,
      },
    ],
    [
      "minInclusive and maxInclusive",
      [
        { name: "minInclusive", value: "1" },
        { name: "maxInclusive", value: "10" },
      ],
      {
        minInclusive: 1,
        maxInclusive: 10,
      },
    ],
  ],

  disallows: {
    pattern: {
      false: [
        ["the pattern", "12", "[12]+"],
      ],
      true: [
        ["disallows what does not match the pattern", "3",
         "[12]+", ["value does not match the pattern [12]+"]],
      ],
    },
    totalDigits: {
      false: [
        // [title, value, parameter value]
        ["what is within spec", "  +001.23456000  ", "6"],
      ],
      true: [
        // [title, value, parameter value, error]
        ["too many digits (1)", "   +011.23456000   ", "6",
         ["value must have at most 6 digits"],
        ],
        ["too many digits (2)", "   +001.23456700   ", "6",
         ["value must have at most 6 digits"],
        ],
      ],
    },
    fractionDigits: {
      false: [
        ["what is within spec (1)", "  +124.123456000  ", "6"],
        ["what is within spec (2)", "  +124.003456000  ", "6"],
      ],
      true: [
        ["too many fraction digits (1)", "   -011.1234567000   ",
         "6", ["value must have at most 6 fraction digits"],
        ],
        ["too many faction digits (2)", "   +001.123456700   ",
         "6", ["value must have at most 6 fraction digits"],
        ],
      ],
    },
    maxInclusive: {
      false: [
        ["what is within spec", "  +1.234  ", "01.23400"],
      ],
      true: [
        ["a value greater than maxInclusive", "   +1.2340001   ",
         "01.23400", ["value must be less than or equal to 1.234"],
        ],
      ],
    },
    minInclusive: {
      false: [
        ["what is within spec", "  +1.234  ", "01.23400"],
      ],
      true: [
        ["a value lower than minInclusive",
         "   +1.2339999   ", "01.23400",
         ["value must be greater than or equal to 1.234"],
        ],
      ],
    },
    maxExclusive: {
      false: [
        ["what is within spec", "  +1.233999  ", "01.23400"],
      ],
      true: [
        ["a value equal to maxExclusive", "   +1.234   ", "01.23400",
         ["value must be less than 1.234"],
        ],
      ],
    },
    minExclusive: {
      false: [
        ["what is within spec", "  +1.23400001  ", "01.23400"],
      ],
      true: [
        ["a value equal to minExclusive", "   +1.234   ", "01.23400",
         ["value must be greater than 1.234"],
        ],
      ],
    },
  },
};

const integerProgram = {
  equal: {
    true:
    [
      ["for two identical values", "10", "10"],
      ["for two equal values, represented differently (1)",
       "123", " 0123"],
      ["for two equal values, represented differently (2)",
       "+123", " 0123 "],
    ],
    false: [
      ["for two unequal values", "1", "2"],
    ],
  },
  parseParams: [
    // title, array to parse, expected object
    [
      "all except minInclusive and maxInclusive",
      [
        { name: "totalDigits", value: "10" },
        { name: "pattern", value: "abc" },
        { name: "minExclusive", value: "1" },
        { name: "maxExclusive", value: "10" },
      ],
      {
        totalDigits: 10,
        pattern: { rng: "abc", internal: new RegExp("^abc$") },
        minExclusive: 1,
        maxExclusive: 10,
      },
    ],
    [
      "minInclusive and maxInclusive",
      [
        { name: "minInclusive", value: "1" },
        { name: "maxInclusive", value: "10" },
      ],
      {
        minInclusive: 1,
        maxInclusive: 10,
      },
    ],
  ],
  disallows: {
    NONE: {
      false: [
        ["what is within spec", " 1234"],
      ],
      true: [
        ["a value with a fraction part", "1.2",
         ["value is not an integer"],
        ],
      ],
    },
    totalDigits: {
      false: [
        // [title, value, parameter value]
        ["what is within spec", "  +0012 ", "2"],
      ],
      true: [
        // [title, value, parameter value, error]
        ["a value with too many digits", "   +0123   ", "2",
         ["value must have at most 2 digits"],
        ],
      ],
    },
    maxInclusive: {
      false: [
        ["what is within spec", "  +1  ", "01"],
      ],
      true: [
        ["a value greater than maxInclusive", "   +2   ",
         "01", ["value must be less than or equal to 1"],
        ],
      ],
    },
    minInclusive: {
      false: [
        ["what is within spec", "  +1  ", "01"],
      ],
      true: [
        ["a value lower than minInclusive", "   +0   ", "01",
         ["value must be greater than or equal to 1"],
        ],
      ],
    },
    maxExclusive: {
      false: [
        ["what is within spec", "  +0  ", "1"],
      ],
      true: [
        ["a value greater than maxExclusive", "   +1   ", "1",
         ["value must be less than 1"],
        ],
      ],
    },
    minExclusive: {
      false: [
        ["what is within spec", "  +1  ", "0"],
      ],
      true: [
        ["a value lower than minExclusive", "   +0   ", "-0",
         ["value must be greater than 0"],
        ],
      ],
    },
  },

};

const nonPositiveIntegerProgram = {
  equal: {
    true:
    [
      ["for two identical values", "-10", "-10"],
      ["for two equal values, represented differently",
       "-123", " -0123"],
    ],
    false: [
      ["for two unequal values", "-1", "-2"],
    ],
  },
  parseParams: [
    // title, array to parse, expected object
    [
      "all except minInclusive and maxInclusive",
      [
        { name: "totalDigits", value: "10" },
        { name: "pattern", value: "abc" },
        { name: "minExclusive", value: "-10" },
        { name: "maxExclusive", value: "-1" },
      ],
      {
        totalDigits: 10,
        pattern: { rng: "abc", internal: new RegExp("^abc$") },
        minExclusive: -10,
        maxExclusive: -1,
      },
    ],
    [
      "minInclusive and maxInclusive",
      [
        { name: "minInclusive", value: "-10" },
        { name: "maxInclusive", value: "-1" },
      ],
      {
        minInclusive: -10,
        maxInclusive: -1,
      },
    ],
  ],
  disallows: {
    NONE: {
      false: [
        ["what is within spec", "-1234"],
        ["what is within spec", "0"],
        ["what is within spec", "+0"],
        ["what is within spec", "+0000"],
      ],
      true: [
        ["a value with a fraction part", "-1.2",
         ["value is not a nonPositiveInteger"],
        ],
        ["a positive value", "1.2",
         ["value is not a nonPositiveInteger"],
        ],
      ],
    },
    totalDigits: {
      false: [
        // [title, value, parameter value]
        ["what is within spec", "  -00123456 ", "6"],
      ],
      true: [
        // [title, value, parameter value, error]
        ["a value with too many digits", "   -01234567   ", "6",
         ["value must have at most 6 digits"],
        ],
      ],
    },
    maxInclusive: {
      false: [
        ["what is within spec", "  -1  ", "-1"],
      ],
      true: [
        ["a value greater than maxInclusive", "   -9   ",
         "-10", ["value must be less than or equal to -10"],
        ],
      ],
    },
    minInclusive: {
      false: [
        ["what is within spec", "  -10  ", "-10"],
      ],
      true: [
        ["a value lower than minInclusive", "   -11   ", "-10",
         ["value must be greater than or equal to -10"],
        ],
      ],
    },
    maxExclusive: {
      false: [
        ["what is within spec", "  -2  ", "-1"],
      ],
      true: [
        ["a value greater than maxExclusive", "   -1   ", "-1",
         ["value must be less than -1"],
        ],
      ],
    },
    minExclusive: {
      false: [
        ["what is within spec", "  -9  ", "-10"],
      ],
      true: [
        ["a value lower than minExclusive", "   -10   ", "-010",
         ["value must be greater than -10"],
        ],
      ],
    },
  },
};

const negativeIntegerProgram = _.clone(nonPositiveIntegerProgram);

negativeIntegerProgram.disallows = _.clone(negativeIntegerProgram.disallows);
negativeIntegerProgram.disallows.NONE = {
  false: [
    ["what is within spec", "-1234"],
    ["what is within spec", "-001234"],
  ],
  true: [
    ["a value with a fraction part", "-1.2",
     ["value is not a negativeInteger"],
    ],
    ["a positive value", "1.2",
     ["value is not a negativeInteger"],
    ],
    ["zero", "0", ["value is not a negativeInteger"],
    ],
  ],
};

const nonNegativeIntegerProgram = {
  equal: {
    true:
    [
      ["for two identical values", "10", "10"],
      ["for two equal values, represented differently",
       "123", " 0123"],
    ],
    false: [
      ["for two unequal values", "1", "2"],
    ],
  },
  parseParams: [
    // title, array to parse, expected object
    [
      "all except minInclusive and maxInclusive",
      [
        { name: "totalDigits", value: "10" },
        { name: "pattern", value: "abc" },
        { name: "minExclusive", value: "1" },
        { name: "maxExclusive", value: "10" },
      ],
      {
        totalDigits: 10,
        pattern: { rng: "abc", internal: new RegExp("^abc$") },
        minExclusive: 1,
        maxExclusive: 10,
      },
    ],
    [
      "minInclusive and maxInclusive",
      [
        { name: "minInclusive", value: "1" },
        { name: "maxInclusive", value: "10" },
      ],
      {
        minInclusive: 1,
        maxInclusive: 10,
      },
    ],
  ],
  disallows: {
    NONE: {
      false: [
        ["what is within spec", "0"],
        ["what is within spec", "+0"],
        ["what is within spec", "+0000"],
        ["what is within spec", "+00123"],
      ],
      true: [
        ["a value with a fraction part", "1.2",
         ["value is not a nonNegativeInteger"],
        ],
        ["a positive value", "-1.2",
         ["value is not a nonNegativeInteger"],
        ],
      ],
    },
    totalDigits: {
      false: [
        // [title, value, parameter value]
        ["what is within spec", "  00123456 ", "6"],
      ],
      true: [
        // [title, value, parameter value, error]
        ["a value with too many digits", "   01234567   ", "6",
         ["value must have at most 6 digits"],
        ],
      ],
    },
    maxInclusive: {
      false: [
        ["what is within spec", "  1  ", "1"],
      ],
      true: [
        ["a value greater than maxInclusive", "   11   ",
         "10", ["value must be less than or equal to 10"],
        ],
      ],
    },
    minInclusive: {
      false: [
        ["what is within spec", "  1  ", "1"],
      ],
      true: [
        ["a value lower than minInclusive", "   0   ", "1",
         ["value must be greater than or equal to 1"],
        ],
      ],
    },
    maxExclusive: {
      false: [
        ["what is within spec", "  1  ", "2"],
      ],
      true: [
        ["a value greater than maxExclusive", "   2   ", "2",
         ["value must be less than 2"],
        ],
      ],
    },
    minExclusive: {
      false: [
        ["what is within spec", "  2  ", "1"],
      ],
      true: [
        ["a value lower than minExclusive", "   2   ", "02",
         ["value must be greater than 2"],
        ],
      ],
    },
  },
};

const positiveIntegerProgram = _.clone(nonNegativeIntegerProgram);

positiveIntegerProgram.disallows = _.clone(positiveIntegerProgram.disallows);
positiveIntegerProgram.disallows.NONE = {
  false: [
    ["what is within spec", "1234"],
    ["what is within spec", "+001234"],
  ],
  true: [
    ["a value with a fraction part", "1.2",
     ["value is not a positiveInteger"],
    ],
    ["a negative value", "-1.2",
     ["value is not a positiveInteger"],
    ],
    ["zero", "0", ["value must be greater than or equal to 1"],
    ],
  ],
};


const longProgram = _.clone(integerProgram);
longProgram.disallows = _.clone(longProgram.disallows);
longProgram.disallows.NONE = {
  false: [
    ["what is within spec", " 1234"],
  ],
  true: [
    ["a value with a fraction part", "1.2",
     ["value is not a long"],
    ],
  ],
};

const intProgram = _.clone(longProgram);
intProgram.disallows = _.clone(intProgram.disallows);
intProgram.disallows.NONE = {
  false: [
    ["what is within spec", " 1234"],
  ],
  true: [
    ["a value with a fraction part", "1.2",
     ["value is not an int"],
    ],
    ["too high a value", "999999999999999",
     ["value must be less than or equal to 2147483647"],
    ],
    ["too low a value", "-999999999999999",
     ["value must be greater than or equal to -2147483648"],
    ],
  ],
};

const shortProgram = _.clone(longProgram);
shortProgram.disallows = _.clone(shortProgram.disallows);
shortProgram.disallows.NONE = {
  false: [
    ["what is within spec", " 1234"],
  ],
  true: [
    ["a value with a fraction part", "1.2",
     ["value is not a short"],
    ],
    ["too high a value", "999999999999999",
     ["value must be less than or equal to 32767"],
    ],
    ["too low a value", "-999999999999999",
     ["value must be greater than or equal to -32768"],
    ],
  ],
};

const byteProgram = _.clone(longProgram);
byteProgram.disallows = _.clone(byteProgram.disallows);
byteProgram.disallows.NONE = {
  false: [
    ["what is within spec", " 123"],
  ],
  true: [
    ["a value with a fraction part", "1.2",
     ["value is not a byte"],
    ],
    ["too high a value", "999999999999999",
     ["value must be less than or equal to 127"],
    ],
    ["too low a value", "-999999999999999",
     ["value must be greater than or equal to -128"],
    ],
  ],
};


const unsignedLongProgram = _.clone(integerProgram);
unsignedLongProgram.disallows = _.clone(unsignedLongProgram.disallows);
unsignedLongProgram.disallows.NONE = {
  false: [
    ["what is within spec", " 1234"],
  ],
  true: [
    ["a value with a fraction part", "1.2",
     ["value is not an unsignedLong"],
    ],
  ],
};

const unsignedIntProgram = _.clone(integerProgram);
unsignedIntProgram.disallows = _.clone(unsignedIntProgram.disallows);
unsignedIntProgram.disallows.NONE = {
  false: [
    ["what is within spec", " 1234"],
  ],
  true: [
    ["a value with a fraction part", "1.2",
     ["value is not an unsignedInt"],
    ],
    ["value to high", "4294967296",
     ["value must be less than or equal to 4294967295"],
    ],
  ],
};

const unsignedShortProgram = _.clone(integerProgram);
unsignedShortProgram.disallows = _.clone(unsignedShortProgram.disallows);
unsignedShortProgram.disallows.NONE = {
  false: [
    ["what is within spec", " 1234"],
  ],
  true: [
    ["a value with a fraction part", "1.2",
     ["value is not an unsignedShort"],
    ],
    ["value to high", "4294967296",
     ["value must be less than or equal to 65535"],
    ],
  ],
};


const unsignedByteProgram = _.clone(integerProgram);
unsignedByteProgram.disallows = _.clone(unsignedByteProgram.disallows);
unsignedByteProgram.disallows.NONE = {
  false: [
    ["what is within spec", " 123"],
  ],
  true: [
    ["a value with a fraction part", "1.2",
     ["value is not an unsignedByte"],
    ],
    ["value to high", "4294967296",
     ["value must be less than or equal to 255"],
    ],
  ],
};

const floatProgram = _.clone(decimalProgram);
floatProgram.parseParams = [
  // title, array to parse, expected object
  [
    "all except minInclusive and maxInclusive",
    [
      { name: "pattern", value: "abc" },
      { name: "minExclusive", value: "1" },
      { name: "maxExclusive", value: "10" },
    ],
    {
      pattern: { rng: "abc", internal: new RegExp("^abc$") },
      minExclusive: 1,
      maxExclusive: 10,
    },
  ],
  [
    "minInclusive and maxInclusive",
    [
      { name: "minInclusive", value: "1" },
      { name: "maxInclusive", value: "10" },
    ],
    {
      minInclusive: 1,
      maxInclusive: 10,
    },
  ],
];
floatProgram.disallows = _.clone(floatProgram.disallows);
floatProgram.disallows.NONE = {
  false: [
    ["number with mantissa and exponent", "-1E10"],
    ["negative infinity", "-INF"],
    ["infinity", "INF"],
    ["number NaN", "NaN"],
  ],
  true: [
    ["random stuff", "ABC",
     ["not a valid float"],
    ],
  ],
};
delete floatProgram.disallows.totalDigits;
delete floatProgram.disallows.fractionDigits;

const doubleProgram = _.clone(floatProgram);
doubleProgram.disallows = _.clone(doubleProgram.disallows);
doubleProgram.disallows.NONE = _.clone(doubleProgram.disallows.NONE);
doubleProgram.disallows.NONE.true = [
  ["random stuff", "ABC",
   ["not a valid double"],
  ],
];

const dateTimeProgram = {
  equal: {
    true: [
      ["for two equal values",
       "1901-01-01T10:10:10.111-01:30",
       "1901-01-01T10:10:10.111-01:30"],
    ],
    false: [
      ["for two unequal values", "1901-01-01T10:10:10.111-01:30",
       "1901-01-01T10:10:10.111-01:31"],
    ],
  },
  parseParams: [
    [
      "all supported", [
        { name: "pattern", value: "abc" },
      ],
      {
        pattern: { rng: "abc",
                   internal: new RegExp("^abc$") },
      },
    ],
  ],
  disallows: {
    NONE: {
      false: [
        ["'1901-01-01T10:10:10.111-01:30'",
         "1901-01-01T10:10:10.111-01:30"],
        ["'11901-01-01T10:10:10.111-01:30'",
         "11901-01-01T10:10:10.111-01:30"],
      ],
      true: [
        ["'1901-01-01T99:10:10.111-01:30'",
         "1901-01-01T99:10:10.111-01:30",
         ["not a valid dateTime"],
        ],
      ],
    },
  },
};

const timeProgram = {
  equal: {
    true: [
      ["for two equal values", "10:10:10.111-01:30",
       "10:10:10.111-01:30"],
    ],
    false: [
      ["for two unequal values",
       "10:10:10.111-01:30", "10:10:10.111-01:31"],
    ],
  },
  parseParams: [
    ["all supported", [{ name: "pattern", value: "abc" }],
     { pattern: { rng: "abc", internal: new RegExp("^abc$") } },
    ],
  ],
  disallows: {
    NONE: {
      false: [
        ["'10:10:10.111-01:30'", "10:10:10.111-01:30"],
      ],
      true: [
        ["'99:10:10.111-01:30'", "99:10:10.111-01:30",
         ["not a valid time"]],
      ],
    },
  },
};

const dateProgram = {
  equal: {
    true: [
      ["for two equal values", "1901-01-01-01:30", "1901-01-01-01:30"],
    ],
    false: [
      ["for two unequal values", "1901-01-02-01:30",
       "1901-01-01-01:31"],
    ],
  },
  parseParams: [
    [
      "all supported",
      [{ name: "pattern", value: "abc" }],
      {
        pattern: { rng: "abc", internal: new RegExp("^abc$") },
      },
    ],
  ],
  disallows: {
    NONE: {
      false: [
        ["'1901-01-01-01:30'", "1901-01-01-01:30"],
      ],
      true: [
        ["'1901-99-01-01:30'", "1901-99-01-01:30",
         ["not a valid date"],
        ],
      ],
    },
  },
};

const gYearMonthProgram = {
  equal: {
    true: [
      ["for two equal values", "1901-01-01:30", "1901-01-01:30"],
    ],
    false: [
      ["for two unequal values", "1901-01-01:30",
       "1901-02-01:31"],
    ],
  },
  parseParams: [
    [
      "all supported",
      [{ name: "pattern", value: "abc" }],
      {
        pattern: { rng: "abc", internal: new RegExp("^abc$") },
      },
    ],
  ],
  disallows: {
    NONE: {
      false: [
        ["'1901-01'", "1901-01"],
      ],
      true: [
        ["'1901-99-01:30'", "1901-99-01:30",
         ["not a valid gYearMonth"],
        ],
      ],
    },
  },
};

const gYearProgram = {
  equal: {
    true: [
      ["for two equal values", "1901-01:30", "1901-01:30"],
    ],
    false: [
      ["for two unequal values", "1901-01:30",
       "1901-01:31"],
    ],
  },
  parseParams: [
    [
      "all supported",
      [{ name: "pattern", value: "abc" }],
      {
        pattern: { rng: "abc", internal: new RegExp("^abc$") },
      },
    ],
  ],
  disallows: {
    NONE: {
      false: [
        ["'1901'", "1901"],
      ],
      true: [
        ["'01901'", "01901",
         ["not a valid gYear"],
        ],
      ],
    },
  },
};

const gMonthDayProgram = {
  equal: {
    true: [
      ["for two equal values", "01-01-01:30", "01-01-01:30"],
    ],
    false: [
      ["for two unequal values", "01-02-01:30",
       "01-02-01:31"],
    ],
  },
  parseParams: [
    [
      "all supported",
      [{ name: "pattern", value: "abc" }],
      {
        pattern: { rng: "abc", internal: new RegExp("^abc$") },
      },
    ],
  ],
  disallows: {
    NONE: {
      false: [
        ["'12-31'", "12-31"],
      ],
      true: [
        ["'02-30'", "02-30",
         ["not a valid gMonthDay"],
        ],
      ],
    },
  },
};

const gDayProgram = {
  equal: {
    true: [
      ["for two equal values", "31-01:30", "31-01:30"],
    ],
    false: [
      ["for two unequal values", "31-01:30",
       "02-01:31"],
    ],
  },
  parseParams: [
    [
      "all supported",
      [{ name: "pattern", value: "abc" }],
      {
        pattern: { rng: "abc", internal: new RegExp("^abc$") },
      },
    ],
  ],
  disallows: {
    NONE: {
      false: [
        ["'01'", "01"],
      ],
      true: [
        ["'32'", "32",
         ["not a valid gDay"],
        ],
      ],
    },
  },
};

const gMonthProgram = {
  equal: {
    true: [
      ["for two equal values", "01-01:30", "01-01:30"],
    ],
    false: [
      ["for two unequal values", "01-01:30",
       "01-01:31"],
    ],
  },
  parseParams: [
    [
      "all supported",
      [{ name: "pattern", value: "abc" }],
      {
        pattern: { rng: "abc", internal: new RegExp("^abc$") },
      },
    ],
  ],
  disallows: {
    NONE: {
      false: [
        ["'12'", "12"],
      ],
      true: [
        ["'13'", "13",
         ["not a valid gMonth"],
        ],
      ],
    },
  },
};

const anyURIProgram = {
  equal: {
    true: [
      ["for two equal values", "a:b", "a:b"],
    ],
    false: [
      ["for two unequal values", "a:f",
       "a:b"],
    ],
  },
  parseParams: [
    [
      "all except maxLength and minLength",
      [
        { name: "length", value: "1" },
        { name: "pattern", value: "abc" },
      ],
      {
        length: 1,
        pattern: { rng: "abc", internal: new RegExp("^abc$") },
      },
    ],
    [
      "minLength and maxLength",
      [
        { name: "maxLength", value: "1" },
        { name: "minLength", value: "1" },
      ],
      {
        maxLength: 1,
        minLength: 1,
      },
    ],
  ],
  disallows: {
    NONE: {
      false: [
        ["simple", "a:b"],
        ["fragment", "a:/b#gaga"],
        ["relative URI", "aaa"],
      ],
      true: [
        [":", ":",
         ["not a valid anyURI"],
        ],
      ],
    },
  },
};


const docNr = new nameResolver.NameResolver();
docNr.definePrefix("a", "http://aaaaa.com");
docNr.definePrefix("", "http://qqqqqq.com");

const schemaNr = new nameResolver.NameResolver();
schemaNr.definePrefix("aaa", "http://aaaaa.com");
schemaNr.definePrefix("z", "http://qqqqqq.com");

const QNameProgram = {
  docContext: { resolver: docNr },
  schemaContext: { resolver: schemaNr },
  // Reminder: in equal tests the first parameter is from the
  // document, the 2nd parameter is from the schema.
  equal: {
    true: [
      ["for two equal values (1) ", "a:b", "aaa:b"],
      ["for two equal values (2)", "foo", "z:foo"],
    ],
    false: [
      ["for equal URIs, unequal local names", "a:f",
       "aaa:b"],
      ["for unequal URIs", "a:f",
       "z:b"],
    ],
  },
  parseParams: [
    [
      "all except maxLength and minLength",
      [
        { name: "length", value: "1" },
        { name: "pattern", value: "abc" },
      ],
      {
        length: 1,
        pattern: { rng: "abc", internal: new RegExp("^abc$") },
      },
    ],
    [
      "minLength and maxLength",
      [
        { name: "maxLength", value: "1" },
        { name: "minLength", value: "1" },
      ],
      {
        maxLength: 1,
        minLength: 1,
      },
    ],
  ],
  disallows: {
    NONE: {
      false: [
        ["'foo'", "foo"],
        ["colons", "a:zh"],
        ["tabs", "foo\t"],
        ["newlines", "foo\n"],
        ["carriage returns", "foo\r"],
      ],
      true: [
        ["spaces", "foo zh",
         ["not a valid QName"],
        ],
        ["curly braces", "{foo} zh",
         ["not a valid QName"],
        ],
        ["colons appearing twice", "foo:zh:zh",
         ["not a valid QName"],
        ],
        ["unresovable names", "foo:zh",
         ["cannot resolve the name foo:zh"],
        ],

      ],
    },
  },
};

const NOTATIONProgram = _.clone(QNameProgram);
NOTATIONProgram.disallows = _.clone(NOTATIONProgram.disallows);
NOTATIONProgram.disallows.NONE = _.clone(NOTATIONProgram.disallows.NONE);
NOTATIONProgram.disallows.NONE.true = [
  ["spaces", "foo zh",
   ["not a valid NOTATION"],
  ],
  ["curly braces", "{foo} zh",
   ["not a valid NOTATION"],
  ],
  ["colons appearing twice", "foo:zh:zh",
   ["not a valid NOTATION"],
  ],
  ["unresovable names", "foo:zh",
   ["cannot resolve the name foo:zh"],
  ],
];

function testProgram(name, lib, program, disallows) {
  const type = lib.types[name];
  const schemaContext = program.schemaContext;
  const docContext = program.docContext;
  describe(name, () => {
    describe("equal", () => {
      for (const x of program.equal.true) {
        it(`returns true ${x[0]}`, () => {
          assert.isTrue(type.equal(x[1],
                                   type.parseValue(x[2], schemaContext),
                                   docContext));
        });
      }

      for (const x of program.equal.false) {
        it(`returns false ${x[0]}`, () => {
          assert.isFalse(type.equal(x[1],
                                    type.parseValue(x[2], schemaContext),
                                    docContext));
        });
      }
    });

    describe("parseParams", () => {
      for (const x of program.parseParams) {
        it(x[0], () =>
           assert.deepEqual(type.parseParams(undefined, x[1]), x[2]));
      }
    });

    describe("disallows", () => {
      const none = program.disallows && program.disallows.NONE;
      if (disallows || none) {
        describe("without parameters", () => {
          if (disallows) {
            disallows(type);
          }
          if (!none) {
            return;
          }

          for (const x of none.false) {
            it(`allows ${x[0]}`, () =>
               assert.isFalse(type.disallows(x[1], {}, docContext)));
          }

          for (const x of none.true) {
            it(`disallows ${x[0]}`, () => {
              const ret = type.disallows(x[1], {}, docContext);
              assert.equal(ret.length, x[2].length);
              assert.equal(ret[0].toString(), x[2][0]);
            });
          }
        });
      }

      function makeParameterTest(i, param) {
        return function test() {
          for (const x of param.false) {
            it(`allows ${x[0]}`, () => {
              const params = type.parseParams(undefined,
                                              [{ name: i, value: x[2] }]);
              assert.isFalse(type.disallows(x[1], params, docContext));
            });
          }

          for (const x of param.true) {
            it(`disallows ${x[0]}`, () => {
              const params = type.parseParams(undefined,
                                              [{ name: i, value: x[2] }]);
              const ret = type.disallows(x[1], params, docContext);
              assert.equal(ret.length, x[3].length);
              assert.equal(ret[0].toString(), x[3][0]);
            });
          }
        };
      }

      const programDisallows = program.disallows;
      for (const i in programDisallows) {
        if (i === "NONE" || !programDisallows.hasOwnProperty(i)) {
          continue;
        }
        describe(`with a ${i} parameter`,
                 makeParameterTest(i, programDisallows[i]));
      }
    });
  });
}

function testString(name, lib, disallowsNoparams, disallowsParams) {
  const type = lib.types[name];
  describe(name, () => {
    before(() => assert.isFalse(type.needs_context));

    describe("equal", () => {
      it("returns true for two equal values", () =>
         assert.isTrue(type.equal("foo", { value: "foo" })));

      it("returns false for two unequal values", () =>
         assert.isFalse(type.equal("foo", { value: "bar" })));
    });

    describe("parseParams", () => {
      it("empty array", () =>
         assert.deepEqual(type.parseParams(undefined, []), {}));

      it("all, except minLength and maxLength", () => {
        assert.deepEqual(
          type.parseParams(undefined, [
            { name: "length", value: "1" },
            { name: "pattern", value: "abc" },
          ]),
          {
            length: 1,
            pattern: { rng: "abc", internal: new RegExp("^abc$") },
          });
      });


      it("minLength and maxLength", () => {
        assert.deepEqual(
          type.parseParams(undefined, [
            { name: "maxLength", value: "1" },
            { name: "minLength", value: "1" },
          ]),
          {
            maxLength: 1,
            minLength: 1,
          });
      });

      it("repeatables", () => {
        const parsed = type.parseParams(undefined, [
          { name: "pattern", value: "abc" },
          { name: "pattern", value: "def" },
        ]);

        assert.deepEqual(_.sortBy(parsed.pattern, "rng"),
                         _.sortBy(
                           [{ rng: "abc", internal: new RegExp("^abc$") },
                            { rng: "def", internal: new RegExp("^def$") }],
                           "rng"));
      });

      it("non-repeatables", () => {
        assert.throws(
          type.parseParams.bind(type, undefined, [
            { name: "length", value: "1" },
            { name: "maxLength", value: "1" },
            { name: "minLength", value: "1" },
            { name: "length", value: "1" },
            { name: "maxLength", value: "1" },
            { name: "minLength", value: "1" },
          ]),
          datatypes.ParameterParsingError,
          "cannot repeat parameter length\n" +
            "cannot repeat parameter maxLength\n" +
            "cannot repeat parameter minLength");
      });
    });

    describe("disallows", () => {
      describe("without parameters", () => {
        it("allows 'foo'", () => assert.isFalse(type.disallows("foo")));

        disallowsNoparams(type);
      });

      describe("with a length parameter", () => {
        it("allows the length", () =>
           assert.isFalse(type.disallows("foo", { length: 3 })));

        it("disallows other lengths", () => {
          const ret = type.disallows("foobar", { length: 3 });
          assert.equal(ret.length, 1);
          assert.equal(ret[0].toString(), "length of value should be 3");
        });
      });

      describe("with a minLength parameter", () => {
        it("allows the length", () =>
           assert.isFalse(type.disallows("foo", { minLength: 3 })));

        it("allows more than the length", () =>
           assert.isFalse(type.disallows("foobar", { minLength: 3 })));

        it("disallows less than the length", () => {
          const ret = type.disallows("f", { minLength: 3 });
          assert.equal(ret.length, 1);
          assert.equal(ret[0].toString(),
                       "length of value should be greater than or equal to 3");
        });
      });

      describe("with a maxLength parameter", () => {
        it("allows the length", () =>
          assert.isFalse(type.disallows("foo", { maxLength: 3 })));

        it("allows less than the length", () =>
          assert.isFalse(type.disallows("f", { maxLength: 3 })));

        it("disallows more than the length", () => {
          const ret = type.disallows("foobar", { maxLength: 3 });
          assert.equal(ret.length, 1);
          assert.equal(ret[0].toString(),
                       "length of value should be less than or equal to 3");
        });
      });

      describe("with a pattern parameter", () => {
        // Extract the pattern processor from the type.
        const pattern = type.param_name_to_obj.pattern;
        it("allows the pattern", () =>
           assert.isFalse(
             type.disallows("foo", { pattern: pattern.convert("[fb].*") })));
        it("disallows what does not match the pattern", () => {
          const ret = type.disallows("afoo",
                                     { pattern: pattern.convert("[fb].*") });
          assert.equal(ret.length, 1);
          assert.equal(ret[0].toString(),
                       "value does not match the pattern [fb].*");
        });

        it("disallows what does not match multiple patterns", () => {
          const parsed = type.parseParams(
            undefined,
            [{ name: "pattern", value: ".*" },
             { name: "pattern", value: "[fb].*" }]);
          const ret = type.disallows("afoo", parsed);
          assert.equal(ret.length, 1);
          assert.equal(ret[0].toString(),
                       "value does not match the pattern [fb].*");
        });
      });

      if (disallowsParams) {
        disallowsParams(type);
      }
    });
  });
}

describe("datatypes", () => {
  describe("Builtin library", () => {
    const lib = datatypes.registry.get("");

    describe("string", () => {
      const type = lib.types.string;

      describe("equal", () => {
        it("returns true for two equal values", () => {
          assert.isTrue(type.equal("foo", type.parseValue("foo")));
        });

        it("returns false for two unequal values", () => {
          assert.isFalse(type.equal("foo", type.parseValue("bar")));
        });
      });

      describe("disallows", () => {
        it("nothing", () => assert.isFalse(type.disallows("foo")));
      });
    });

    describe("token", () => {
      const type = lib.types.token;

      describe("equal", () => {
        it("returns true for two equal values", () => {
          assert.isTrue(type.equal("foo", type.parseValue("foo")));
        });

        it("returns true for string differing only regarding space (1)",
           () => assert.isTrue(type.equal("foo", type.parseValue(" foo "))));

        it("returns true for string differing only regarding space (2)",
           () => assert.isTrue(type.equal(
             "foo bar   fwip", type.parseValue(" foo   bar fwip"))));

        it("returns false for two unequal values", () =>
           assert.isFalse(type.equal("foobar", type.parseValue("foo bar"))));
      });

      describe("disallows", () => {
        it("anything", () => assert.isFalse(type.disallows("foo")));
      });
    });
  });

  describe("XMLSchema library", () => {
    const lib = datatypes.registry.get(
      "http://www.w3.org/2001/XMLSchema-datatypes");

    describe("disallowed combinations of parameters", () => {
      it("minLength must be <= maxLength", () => {
        const type = lib.types.string;

        assert.throws(
          type.parseParams.bind(type, undefined, [
            { name: "maxLength", value: "1" },
            { name: "minLength", value: "2" },
          ]),
          datatypes.ParameterParsingError,
          "minLength must be less than or equal to maxLength");
      });

      it("combining length and minLength is invalid", () => {
        const type = lib.types.string;
        assert.throws(
          type.parseParams.bind(type, undefined, [
            { name: "length", value: "1" },
            { name: "minLength", value: "2" },
          ]),
          datatypes.ParameterParsingError,
          "length and minLength cannot appear together");
      });

      it("combining length and maxLength is invalid", () => {
        const type = lib.types.string;
        assert.throws(
          type.parseParams.bind(type, undefined, [
            { name: "length", value: "1" },
            { name: "maxLength", value: "2" },
          ]),
          datatypes.ParameterParsingError,
          "length and maxLength cannot appear together");
      });

      it("combining maxInclusive and maxExclusive is invalid", () => {
        const type = lib.types.decimal;
        assert.throws(
          type.parseParams.bind(type, undefined, [
            { name: "maxInclusive", value: "1" },
            { name: "maxExclusive", value: "2" },
          ]),
          datatypes.ParameterParsingError,
          "maxInclusive and maxExclusive cannot appear together");
      });

      it("combining minInclusive and minExclusive is invalid", () => {
        const type = lib.types.decimal;
        assert.throws(
          type.parseParams.bind(type, undefined, [
            { name: "minInclusive", value: "1" },
            { name: "minExclusive", value: "2" },
          ]),
          datatypes.ParameterParsingError,
          "minInclusive and minExclusive cannot appear together");
      });

      it("minInclusive must be <= maxInclusive", () => {
        const type = lib.types.decimal;

        assert.throws(
          type.parseParams.bind(type, undefined, [
            { name: "minInclusive", value: "2" },
            { name: "maxInclusive", value: "1" },
          ]),
          datatypes.ParameterParsingError,
          "minInclusive must be less than or equal to maxInclusive");
      });

      it("minExclusive must be < maxInclusive", () => {
        const type = lib.types.decimal;

        assert.throws(
          type.parseParams.bind(type, undefined, [
            { name: "minExclusive", value: "1" },
            { name: "maxInclusive", value: "1" },
          ]),
          datatypes.ParameterParsingError,
          "minExclusive must be less than maxInclusive");
      });

      it("minInclusive must be < maxExclusive", () => {
        const type = lib.types.decimal;

        assert.throws(
          type.parseParams.bind(type, undefined, [
            { name: "minInclusive", value: "1" },
            { name: "maxExclusive", value: "1" },
          ]),
          datatypes.ParameterParsingError,
          "minInclusive must be less than maxExclusive");
      });

      it("minExclusive must be <= maxExclusive", () => {
        const type = lib.types.decimal;

        assert.throws(
          type.parseParams.bind(type, undefined, [
            { name: "minExclusive", value: "1.1" },
            { name: "maxExclusive", value: "1" },
          ]),
          datatypes.ParameterParsingError,
          "minExclusive must be less than or equal to maxExclusive");
      });
    });

    testString("string", lib, (type) => {
      it("allows anything", () => assert.isFalse(type.disallows("foo")));
    });

    testString("normalizedString", lib, (type) => {
      it("allows simple text", () => assert.isFalse(type.disallows("foo")));

      it("disallows tabs", () => {
        const ret = type.disallows("foo\tbar");
        assert.equal(ret.length, 1);
        assert.equal(ret[0].toString(),
                     "string contains a tab, carriage return or newline");
      });

      it("disallows newlines", () => {
        const ret = type.disallows("foo\nbar");
        assert.equal(ret.length, 1);
        assert.equal(ret[0].toString(),
                     "string contains a tab, carriage return or newline");
      });

      it("disallows carriage returns", () => {
        const ret = type.disallows("foo\rbar");
        assert.equal(ret.length, 1);
        assert.equal(ret[0].toString(),
                     "string contains a tab, carriage return or newline");
      });
    });

    testString("token", lib, (type) => {
      it("allows simple text", () => {
        assert.isFalse(type.disallows("foo"));
      });

      it("allows tabs", () => {
        assert.isFalse(type.disallows("en\t"));
      });

      it("disallows newlines", () => {
        const ret = type.disallows("foo\nbar");
        assert.equal(ret.length, 1);
        assert.equal(ret[0].toString(), "not a valid token");
      });

      it("disallows carriage returns", () => {
        const ret = type.disallows("foo\rbar");
        assert.equal(ret.length, 1);
        assert.equal(ret[0].toString(), "not a valid token");
      });

      it("allows spaces", () => {
        assert.isFalse(type.disallows("foo  bar"));
      });
    });

    testString("language", lib, (type) => {
      it("allows simple text", () => assert.isFalse(type.disallows("en")));

      it("allows tabs", () => assert.isFalse(type.disallows("en\t")));

      it("allows newlines", () => assert.isFalse(type.disallows("en\n")));

      it("allows carriage returns",
         () => assert.isFalse(type.disallows("en\r")));

      it("allows spaces", () => assert.isFalse(type.disallows("en ")));
    });

    testString("Name", lib, (type) => {
      it("allows simple text", () => assert.isFalse(type.disallows("en")));

      it("allows tabs", () => assert.isFalse(type.disallows("en\t")));

      it("allows newlines", () => assert.isFalse(type.disallows("en\n")));

      it("allows carriage returns",
         () => assert.isFalse(type.disallows("en\r")));

      it("allows spaces", () => assert.isFalse(type.disallows("en ")));

      it("disallows spaces between letters", () => {
        const ret = type.disallows("en zh");
        assert.equal(ret.length, 1);
        assert.equal(ret[0].toString(), "not a valid Name");
      });
    });

    testString("NCName", lib, (type) => {
      it("allows simple text", () => assert.isFalse(type.disallows("en")));

      it("allows tabs", () => assert.isFalse(type.disallows("en\t")));

      it("allows newlines", () => assert.isFalse(type.disallows("en\n")));

      it("allows carriage returns",
         () => assert.isFalse(type.disallows("en\r")));

      it("allows spaces", () => assert.isFalse(type.disallows("en ")));

      it("disallows colons", () => {
        const ret = type.disallows("en:zh");
        assert.equal(ret.length, 1);
        assert.equal(ret[0].toString(), "not a valid NCName");
      });
    });

    testString("NMTOKEN", lib, (type) => {
      it("allows simple text", () => assert.isFalse(type.disallows(":en")));

      it("allows tabs", () => assert.isFalse(type.disallows("en\t")));

      it("allows newlines", () => assert.isFalse(type.disallows("en\n")));

      it("allows carriage returns",
         () => assert.isFalse(type.disallows("en\r")));

      it("disallows spaces", () => {
        const ret = type.disallows("en zh");
        assert.equal(ret.length, 1);
        assert.equal(ret[0].toString(), "not a valid NMTOKEN");
      });
    });

    testString("NMTOKENS", lib, (type) => {
      it("allows simple text", () => assert.isFalse(type.disallows(":en")));

      it("allows spaces", () => assert.isFalse(type.disallows("en zh")));

      it("allows tabs", () => assert.isFalse(type.disallows("en\t")));

      it("allows newlines", () => assert.isFalse(type.disallows("en\n")));

      it("allows carriage returns",
         () => assert.isFalse(type.disallows("en\r")));
    });

    testString("ID", lib, (type) => {
      it("allows simple text", () => assert.isFalse(type.disallows("en")));

      it("allows tabs", () => assert.isFalse(type.disallows("en\t")));

      it("allows newlines", () => assert.isFalse(type.disallows("en\n")));

      it("allows carriage returns",
         () => assert.isFalse(type.disallows("en\r")));

      it("disallows spaces", () => {
        const ret = type.disallows("en zh");
        assert.equal(ret.length, 1);
        assert.equal(ret[0].toString(),
                     "not a valid ID");
      });

      it("disallows colons", () => {
        const ret = type.disallows("en:zh");
        assert.equal(ret.length, 1);
        assert.equal(ret[0].toString(), "not a valid ID");
      });
    });

    testString("IDREF", lib, (type) => {
      it("allows simple text", () => assert.isFalse(type.disallows("en")));

      it("allows tabs", () => assert.isFalse(type.disallows("en\t")));

      it("allows newlines", () => assert.isFalse(type.disallows("en\n")));

      it("allows carriage returns",
         () => assert.isFalse(type.disallows("en\r")));

      it("disallows spaces", () => {
        const ret = type.disallows("en zh");
        assert.equal(ret.length, 1);
        assert.equal(ret[0].toString(), "not a valid IDREF");
      });

      it("disallows colons", () => {
        const ret = type.disallows("en:zh");
        assert.equal(ret.length, 1);
        assert.equal(ret[0].toString(), "not a valid IDREF");
      });
    });

    testString("IDREFS", lib, (type) => {
      it("allows simple text", () => assert.isFalse(type.disallows("en")));

      it("allows spaces", () => assert.isFalse(type.disallows("en zh")));

      it("allows tabs", () => assert.isFalse(type.disallows("en\t")));

      it("allows newlines", () => assert.isFalse(type.disallows("en\n")));

      it("allows carriage returns",
         () => assert.isFalse(type.disallows("en\r")));

      it("disallows colons", () => {
        const ret = type.disallows("en:zh");
        assert.equal(ret.length, 1);
        assert.equal(ret[0].toString(), "not a valid IDREFS");
      });
    });

    testProgram("QName", lib, QNameProgram);
    testProgram("NOTATION", lib, NOTATIONProgram);

    testProgram("decimal", lib, decimalProgram);
    testProgram("integer", lib, integerProgram);
    testProgram("nonPositiveInteger", lib,
                nonPositiveIntegerProgram);
    testProgram("negativeInteger", lib,
                negativeIntegerProgram);
    testProgram("nonNegativeInteger", lib,
                nonNegativeIntegerProgram);
    testProgram("positiveInteger", lib,
                positiveIntegerProgram);
    testProgram("long", lib, longProgram);
    testProgram("int", lib, intProgram);
    testProgram("short", lib, shortProgram);
    testProgram("byte", lib, byteProgram);
    testProgram("unsignedLong", lib, unsignedLongProgram);
    testProgram("unsignedInt", lib, unsignedIntProgram);
    testProgram("unsignedShort", lib, unsignedShortProgram);
    testProgram("unsignedByte", lib, unsignedByteProgram);
    testProgram("float", lib, floatProgram);
    testProgram("double", lib, doubleProgram);

    describe("boolean", () => {
      const type = lib.types.boolean;
      describe("equal", () => {
        it("returns true for two equal values",
           () => assert.isTrue(type.equal("1", type.parseValue("1"))));

        it("returns true for two equal values",
           () => assert.isTrue(type.equal("0", type.parseValue("0"))));

        it("returns true for two equal values",
           () => assert.isTrue(type.equal("true", type.parseValue("true"))));

        it("returns true for two equal values",
           () => assert.isTrue(type.equal("false", type.parseValue("false"))));

        it("returns true for two equal values",
           () => assert.isTrue(type.equal("true", type.parseValue("1"))));

        it("returns true for two equal values",
           () => assert.isTrue(type.equal("false", type.parseValue("0"))));

        it("returns false for two unequal values",
           () => assert.isFalse(type.equal("false", type.parseValue("1"))));

        it("returns false for two unequal values",
           () => assert.isFalse(type.equal("true", type.parseValue("0"))));
      });

      describe("parseParams", () => {
        it("all, except minLength and maxLength", () => {
          assert.deepEqual(
            type.parseParams(undefined, [
              { name: "pattern", value: "abc" },
            ]),
            {
              pattern: { rng: "abc", internal: new RegExp("^abc$") },
            });
        });
      });

      describe("disallows", () => {
        describe("without parameters", () => {
          it("allows 'true'", () => assert.isFalse(type.disallows("true")));

          it("allows 'false'", () => assert.isFalse(type.disallows("false")));

          it("allows 1", () => assert.isFalse(type.disallows("1")));

          it("allows 0", () => assert.isFalse(type.disallows("0")));

          it("disallows 'yes'", () => {
            const ret = type.disallows("yes");
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(), "not a valid boolean");
          });
        });
      });
    });

    describe("base64Binary", () => {
      const type = lib.types.base64Binary;
      describe("equal", () => {
        it("returns true for two equal values",
           () => assert.isTrue(type.equal("AAAA", type.parseValue("A A A A"))));

        it("returns false for two unequal values",
           () => assert.isFalse(type.equal("AAAA", type.parseValue("BBBB"))));
      });

      describe("parseParams", () => {
        it("all, except minLength and maxLength", () => {
          assert.deepEqual(
            type.parseParams(undefined, [
              { name: "length", value: "1" },
              { name: "pattern", value: "abc" },
            ]),
            {
              length: 1,
              pattern: { rng: "abc", internal: new RegExp("^abc$") },
            });
        });


        it("minLength and maxLength", () => {
          assert.deepEqual(
            type.parseParams(undefined, [
              { name: "maxLength", value: "1" },
              { name: "minLength", value: "1" },
            ]),
            {
              maxLength: 1,
              minLength: 1,
            });
        });
      });

      describe("disallows", () => {
        describe("without parameters", () => {
          it("allows 'AAAA'", () => assert.isFalse(type.disallows("AAAA")));

          it("allows 'A A A A'",
             () => assert.isFalse(type.disallows("A A A A")));

          it("allows an empty string",
             () => assert.isFalse(type.disallows("")));

          it("allows 'test' coded in base64",
             () => assert.isFalse(type.disallows("dGVzdA==")));

          it("disallows badly padded (1)", () => {
            const ret = type.disallows("AAA");
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(), "not a valid base64Binary");
          });

          it("disallows badly padded (2)", () => {
            const ret = type.disallows("AA");
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(), "not a valid base64Binary");
          });

          it("disallows badly padded (3)", () => {
            const ret = type.disallows("A");
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(), "not a valid base64Binary");
          });

          it("disallows badly padded (4)", () => {
            const ret = type.disallows("A=");
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(), "not a valid base64Binary");
          });
        });

        describe("with a length parameter", () => {
          it("allows the length", () => {
            assert.isFalse(type.disallows("dGVzdA==", { length: 4 }));
          });
          it("disallows other lengths", () => {
            const ret = type.disallows("dGVzdCttb3JlCg==", { length: 4 });
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(), "length of value should be 4");
          });
        });

        describe("with a minLength parameter", () => {
          it("allows the length", () => {
            assert.isFalse(type.disallows("dGVzdA==", { minLength: 4 }));
          });
          it("allows more than the length", () => {
            assert.isFalse(type.disallows("dGVzdCttb3JlCg==",
                                          { minLength: 4 }));
          });

          it("disallows less than the length", () => {
            const ret = type.disallows("Zm9v", { minLength: 4 });
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(),
                         "length of value should be greater than " +
                         "or equal to 4");
          });
        });

        describe("with a maxLength parameter", () => {
          it("allows the length", () => {
            assert.isFalse(type.disallows("dGVzdA==", { maxLength: 4 }));
          });
          it("allows less than the length", () => {
            assert.isFalse(type.disallows("Zm9v", { maxLength: 4 }));
          });
          it("disallows more than the length", () => {
            const ret = type.disallows("dGVzdHM=", { maxLength: 4 });
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(),
                         "length of value should be less than " +
                         "or equal to 4");
          });
        });
      });
    });

    describe("hexBinary", () => {
      const type = lib.types.hexBinary;
      describe("equal", () => {
        it("returns true for two equal values",
           () => assert.isTrue(type.equal("AAAA", type.parseValue("AAAA"))));

        it("returns false for two unequal values",
           () => assert.isFalse(type.equal("AAAA", type.parseValue("BBBB"))));
      });

      describe("parseParams", () => {
        it("all, except minLength and maxLength", () => {
          assert.deepEqual(
            type.parseParams(undefined, [
              { name: "length", value: "1" },
              { name: "pattern", value: "abc" },
            ]),
            {
              length: 1,
              pattern: { rng: "abc", internal: new RegExp("^abc$") },
            });
        });


        it("minLength and maxLength", () => {
          assert.deepEqual(
            type.parseParams(undefined, [
              { name: "maxLength", value: "1" },
              { name: "minLength", value: "1" },
            ]),
            {
              maxLength: 1,
              minLength: 1,
            });
        });
      });

      describe("disallows", () => {
        describe("without parameters", () => {
          it("allows 'AAAA'", () => assert.isFalse(type.disallows("AAAA")));

          it("allows an empty string",
             () => assert.isFalse(type.disallows("")));

          it("disallows 'A'", () => {
            const ret = type.disallows("A");
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(), "not a valid hexBinary");
          });

          it("disallows 'A A A A'", () => {
            const ret = type.disallows("A A A A");
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(), "not a valid hexBinary");
          });
        });

        describe("with a length parameter", () => {
          it("allows the length",
             () => assert.isFalse(type.disallows("AAAA", { length: 2 })));
          it("disallows other lengths", () => {
            const ret = type.disallows("AA", { length: 2 });
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(), "length of value should be 2");
          });
        });

        describe("with a minLength parameter", () => {
          it("allows the length", () => {
            assert.isFalse(type.disallows("AAAA", { minLength: 2 }));
          });
          it("allows more than the length", () => {
            assert.isFalse(type.disallows("AAAAAA", { minLength: 2 }));
          });

          it("disallows less than the length", () => {
            const ret = type.disallows("AA", { minLength: 2 });
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(),
                         "length of value should be greater than " +
                         "or equal to 2");
          });
        });

        describe("with a maxLength parameter", () => {
          it("allows the length",
             () => assert.isFalse(type.disallows("AAAA", { maxLength: 2 })));

          it("allows less than the length",
             () => assert.isFalse(type.disallows("AA", { maxLength: 2 })));

          it("disallows more than the length", () => {
            const ret = type.disallows("AAAAAA", { maxLength: 2 });
            assert.equal(ret.length, 1);
            assert.equal(ret[0].toString(),
                         "length of value should be less than " +
                         "or equal to 2");
          });
        });
      });
    });


    describe("duration", () => {
      const type = lib.types.duration;
      describe("equal", () => {
        it("returns true for two equal values",
           () => assert.isTrue(type.equal("P3Y", type.parseValue("P3Y"))));

        it("returns false for two unequal values",
           () => assert.isFalse(type.equal("P3Y", type.parseValue("P2Y"))));
      });

      describe("parseParams", () => {
        it("all supported", () => {
          assert.deepEqual(
            type.parseParams(undefined, [
              { name: "pattern", value: "abc" },
            ]),
            {
              pattern: { rng: "abc", internal: new RegExp("^abc$") },
            });
        });
      });

      describe("disallows", () => {
        describe("without parameters", () => {
          it("allows 'P2Y3M1DT12H3M23.123S'", () => {
            assert.isFalse(type.disallows("P2Y3M1DT12H3M23.123S"));
          });
        });
      });
    });

    testProgram("dateTime", lib, dateTimeProgram);
    testProgram("time", lib, timeProgram);
    testProgram("date", lib, dateProgram);
    testProgram("gYearMonth", lib, gYearMonthProgram);
    testProgram("gYear", lib, gYearProgram);
    testProgram("gMonthDay", lib, gMonthDayProgram);
    testProgram("gDay", lib, gDayProgram);
    testProgram("gMonth", lib, gMonthProgram);
    testProgram("anyURI", lib, anyURIProgram);
  });
});
