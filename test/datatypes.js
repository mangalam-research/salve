/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */

'use strict';
require("amd-loader");
var datatypes = require("../build/dist/lib/salve/datatypes");
var name_resolver = require("../build/dist/lib/salve/name_resolver");
var chai = require("chai");
var assert = chai.assert;
var _ = require("lodash");

var decimal_program = {
    equal: {
        // Tests that return true.
        "true":
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
             "+12", " +12."]
        ],
        // Tests that return false.
        "false": [
            ["for two unequal values", "1", "2"]
        ]
    },
    parseParams: [
        // title, array to parse, expected object
        ["all except minInclusive and maxInclusive",
         [{name: "totalDigits", value: "10"},
          {name: "fractionDigits", value: "1"},
          {name: "pattern", value: "abc"},
          {name: "minExclusive", value: "1"},
          {name: "maxExclusive", value: "10"}
         ],
         {
             "totalDigits": 10,
             "fractionDigits": 1,
             "pattern": {rng: "abc", internal: new RegExp("^abc$")},
             "minExclusive": 1,
             "maxExclusive": 10
         }
        ],
        ["minInclusive and maxInclusive",
         [
             {name: "minInclusive", value: "1"},
             {name: "maxInclusive", value: "10"}
         ],
         {
             "minInclusive": 1,
             "maxInclusive": 10
         }
        ]
    ],

    disallows: {
        pattern: {
            "false": [
                ["the pattern", "12", "[12]+"]
                ],
            "true": [
                ["disallows what does not match the pattern", "3",
                 "[12]+", ["value does not match the pattern [12]+"]]
            ]
        },
        totalDigits: {
            "false": [
                // [title, value, parameter value]
                ["what is within spec", "  +001.23456000  ", "6"]
            ],
            "true": [
                // [title, value, parameter value, error]
                ["too many digits (1)", "   +011.23456000   ", "6",
                 ["value must have at most 6 digits"]
                ],
                ["too many digits (2)", "   +001.23456700   ", "6",
                 ["value must have at most 6 digits"]
                ]
            ]
        },
        fractionDigits: {
            "false": [
                ["what is within spec (1)", "  +124.123456000  ", "6"],
                ["what is within spec (2)", "  +124.003456000  ", "6"]
            ],
            "true": [
                ["too many fraction digits (1)", "   -011.1234567000   ",
                 "6", ["value must have at most 6 fraction digits"]
                ],
                ["too many faction digits (2)", "   +001.123456700   ",
                 "6", ["value must have at most 6 fraction digits"]
                ]
            ]
        },
        maxInclusive: {
            "false": [
                ["what is within spec", "  +1.234  ", "01.23400"]
            ],
            "true": [
                ["a value greater than maxInclusive", "   +1.2340001   ",
                 "01.23400", ["value must be less than or equal to 1.234"]
                ]
            ]
        },
        minInclusive: {
            "false": [
                ["what is within spec", "  +1.234  ", "01.23400"]
            ],
            "true": [
                ["a value lower than minInclusive",
                 "   +1.2339999   ", "01.23400",
                 ["value must be greater than or equal to 1.234"]
                ]
            ]
        },
        maxExclusive: {
            "false": [
                ["what is within spec", "  +1.233999  ", "01.23400"]
            ],
            "true": [
                ["a value equal to maxExclusive", "   +1.234   ", "01.23400",
                 ["value must be less than 1.234"]
                ]
            ]
        },
        minExclusive: {
            "false": [
                ["what is within spec", "  +1.23400001  ", "01.23400"]
            ],
            "true": [
                ["a value equal to minExclusive", "   +1.234   ", "01.23400",
                 ["value must be greater than 1.234"]
                ]
            ]
        }
    }
};

var integer_program = {
    equal: {
        "true":
        [
            ["for two identical values", "10", "10"],
            ["for two equal values, represented differently (1)",
             "123", " 0123"],
            ["for two equal values, represented differently (2)",
             "+123", " 0123 "]
        ],
        "false": [
            ["for two unequal values", "1", "2"]
        ]
    },
    parseParams: [
        // title, array to parse, expected object
        ["all except minInclusive and maxInclusive",
         [{name: "totalDigits", value: "10"},
          {name: "pattern", value: "abc"},
          {name: "minExclusive", value: "1"},
          {name: "maxExclusive", value: "10"}
         ],
         {
             "totalDigits": 10,
             "pattern": {rng: "abc", internal: new RegExp("^abc$")},
             "minExclusive": 1,
             "maxExclusive": 10
         }
        ],
        ["minInclusive and maxInclusive",
         [
             {name: "minInclusive", value: "1"},
             {name: "maxInclusive", value: "10"}
         ],
         {
             "minInclusive": 1,
             "maxInclusive": 10
         }
        ]
    ],
    disallows: {
        NONE: {
            "false": [
                ["what is within spec", " 1234"]
            ],
            "true": [
                ["a value with a fraction part", "1.2",
                 ["value is not an integer"]
                ]
            ]
        },
        totalDigits: {
            "false": [
                // [title, value, parameter value]
                ["what is within spec", "  +0012 ", "2"]
            ],
            "true": [
                // [title, value, parameter value, error]
                ["a value with too many digits", "   +0123   ", "2",
                 ["value must have at most 2 digits"]
                ]
            ]
        },
        maxInclusive: {
            "false": [
                ["what is within spec", "  +1  ", "01"]
            ],
            "true": [
                ["a value greater than maxInclusive", "   +2   ",
                 "01", ["value must be less than or equal to 1"]
                ]
            ]
        },
        minInclusive: {
            "false": [
                ["what is within spec", "  +1  ", "01"]
            ],
            "true": [
                ["a value lower than minInclusive", "   +0   ", "01",
                 ["value must be greater than or equal to 1"]
                ]
            ]
        },
        maxExclusive: {
            "false": [
                ["what is within spec", "  +0  ", "1"]
            ],
            "true": [
                ["a value greater than maxExclusive", "   +1   ", "1",
                 ["value must be less than 1"]
                ]
            ]
        },
        minExclusive: {
            "false": [
                ["what is within spec", "  +1  ", "0"]
            ],
            "true": [
                ["a value lower than minExclusive", "   +0   ", "-0",
                 ["value must be greater than 0"]
                ]
            ]
        }
    }

};

var nonPositiveInteger_program = {
    equal: {
        "true":
        [
            ["for two identical values", "-10", "-10"],
            ["for two equal values, represented differently",
             "-123", " -0123"]
        ],
        "false": [
            ["for two unequal values", "-1", "-2"]
        ]
    },
    parseParams: [
        // title, array to parse, expected object
        ["all except minInclusive and maxInclusive",
         [{name: "totalDigits", value: "10"},
          {name: "pattern", value: "abc"},
          {name: "minExclusive", value: "-10"},
          {name: "maxExclusive", value: "-1"}
         ],
         {
             "totalDigits": 10,
             "pattern": {rng: "abc", internal: new RegExp("^abc$")},
             "minExclusive": -10,
             "maxExclusive": -1
         }
        ],
        ["minInclusive and maxInclusive",
         [
             {name: "minInclusive", value: "-10"},
             {name: "maxInclusive", value: "-1"}
         ],
         {
             "minInclusive": -10,
             "maxInclusive": -1
         }
        ]
    ],
    disallows: {
        NONE: {
            "false": [
                ["what is within spec", "-1234"],
                ["what is within spec", "0"],
                ["what is within spec", "+0"],
                ["what is within spec", "+0000"]
            ],
            "true": [
                ["a value with a fraction part", "-1.2",
                 ["value is not a nonPositiveInteger"]
                ],
                ["a positive value", "1.2",
                 ["value is not a nonPositiveInteger"]
                ]
            ]
        },
        totalDigits: {
            "false": [
                // [title, value, parameter value]
                ["what is within spec", "  -00123456 ", "6"]
            ],
            "true": [
                // [title, value, parameter value, error]
                ["a value with too many digits", "   -01234567   ", "6",
                 ["value must have at most 6 digits"]
                ]
            ]
        },
        maxInclusive: {
            "false": [
                ["what is within spec", "  -1  ", "-1"]
            ],
            "true": [
                ["a value greater than maxInclusive", "   -9   ",
                 "-10", ["value must be less than or equal to -10"]
                ]
            ]
        },
        minInclusive: {
            "false": [
                ["what is within spec", "  -10  ", "-10"]
            ],
            "true": [
                ["a value lower than minInclusive", "   -11   ", "-10",
                 ["value must be greater than or equal to -10"]
                ]
            ]
        },
        maxExclusive: {
            "false": [
                ["what is within spec", "  -2  ", "-1"]
            ],
            "true": [
                ["a value greater than maxExclusive", "   -1   ", "-1",
                 ["value must be less than -1"]
                ]
            ]
        },
        minExclusive: {
            "false": [
                ["what is within spec", "  -9  ", "-10"]
            ],
            "true": [
                ["a value lower than minExclusive", "   -10   ", "-010",
                 ["value must be greater than -10"]
                ]
            ]
        }
    }
};

var negativeInteger_program = _.clone(nonPositiveInteger_program);

negativeInteger_program.disallows = _.clone(negativeInteger_program.disallows);
negativeInteger_program.disallows.NONE = {
    "false": [
        ["what is within spec", "-1234"],
        ["what is within spec", "-001234"]
    ],
    "true": [
        ["a value with a fraction part", "-1.2",
         ["value is not a negativeInteger"]
        ],
        ["a positive value", "1.2",
         ["value is not a negativeInteger"]
        ],
        ["zero", "0", ["value is not a negativeInteger"]
        ]
    ]
};

var nonNegativeInteger_program = {
    equal: {
        "true":
        [
            ["for two identical values", "10", "10"],
            ["for two equal values, represented differently",
             "123", " 0123"]
        ],
        "false": [
            ["for two unequal values", "1", "2"]
        ]
    },
    parseParams: [
        // title, array to parse, expected object
        ["all except minInclusive and maxInclusive",
         [{name: "totalDigits", value: "10"},
          {name: "pattern", value: "abc"},
          {name: "minExclusive", value: "1"},
          {name: "maxExclusive", value: "10"}
         ],
         {
             "totalDigits": 10,
             "pattern": {rng: "abc", internal: new RegExp("^abc$")},
             "minExclusive": 1,
             "maxExclusive": 10
         }
        ],
        ["minInclusive and maxInclusive",
         [
             {name: "minInclusive", value: "1"},
             {name: "maxInclusive", value: "10"}
         ],
         {
             "minInclusive": 1,
             "maxInclusive": 10
         }
        ]
    ],
    disallows: {
        NONE: {
            "false": [
                ["what is within spec", "0"],
                ["what is within spec", "+0"],
                ["what is within spec", "+0000"],
                ["what is within spec", "+00123"]
            ],
            "true": [
                ["a value with a fraction part", "1.2",
                 ["value is not a nonNegativeInteger"]
                ],
                ["a positive value", "-1.2",
                 ["value is not a nonNegativeInteger"]
                ]
            ]
        },
        totalDigits: {
            "false": [
                // [title, value, parameter value]
                ["what is within spec", "  00123456 ", "6"]
            ],
            "true": [
                // [title, value, parameter value, error]
                ["a value with too many digits", "   01234567   ", "6",
                 ["value must have at most 6 digits"]
                ]
            ]
        },
        maxInclusive: {
            "false": [
                ["what is within spec", "  1  ", "1"]
            ],
            "true": [
                ["a value greater than maxInclusive", "   11   ",
                 "10", ["value must be less than or equal to 10"]
                ]
            ]
        },
        minInclusive: {
            "false": [
                ["what is within spec", "  1  ", "1"]
            ],
            "true": [
                ["a value lower than minInclusive", "   0   ", "1",
                 ["value must be greater than or equal to 1"]
                ]
            ]
        },
        maxExclusive: {
            "false": [
                ["what is within spec", "  1  ", "2"]
            ],
            "true": [
                ["a value greater than maxExclusive", "   2   ", "2",
                 ["value must be less than 2"]
                ]
            ]
        },
        minExclusive: {
            "false": [
                ["what is within spec", "  2  ", "1"]
            ],
            "true": [
                ["a value lower than minExclusive", "   2   ", "02",
                 ["value must be greater than 2"]
                ]
            ]
        }
    }
};

var positiveInteger_program = _.clone(nonNegativeInteger_program);

positiveInteger_program.disallows =
    _.clone(positiveInteger_program.disallows);
positiveInteger_program.disallows.NONE = {
    "false": [
        ["what is within spec", "1234"],
        ["what is within spec", "+001234"]
    ],
    "true": [
        ["a value with a fraction part", "1.2",
         ["value is not a positiveInteger"]
        ],
        ["a negative value", "-1.2",
         ["value is not a positiveInteger"]
        ],
        ["zero", "0", ["value must be greater than or equal to 1"]
        ]
    ]
};


var long_program = _.clone(integer_program);
long_program.disallows = _.clone(long_program.disallows);
long_program.disallows.NONE = {
    "false": [
        ["what is within spec", " 1234"]
    ],
    "true": [
        ["a value with a fraction part", "1.2",
         ["value is not a long"]
        ]
    ]
};

var int_program = _.clone(long_program);
int_program.disallows = _.clone(int_program.disallows);
int_program.disallows.NONE = {
    "false": [
        ["what is within spec", " 1234"]
    ],
    "true": [
        ["a value with a fraction part", "1.2",
         ["value is not an int"]
        ],
        ["too high a value", "999999999999999",
         ["value must be less than or equal to 2147483647"]
        ],
        ["too low a value", "-999999999999999",
         ["value must be greater than or equal to -2147483648"]
        ]
    ]
};

var short_program = _.clone(long_program);
short_program.disallows = _.clone(short_program.disallows);
short_program.disallows.NONE = {
    "false": [
        ["what is within spec", " 1234"]
    ],
    "true": [
        ["a value with a fraction part", "1.2",
         ["value is not a short"]
        ],
        ["too high a value", "999999999999999",
         ["value must be less than or equal to 32767"]
        ],
        ["too low a value", "-999999999999999",
         ["value must be greater than or equal to -32768"]
        ]
    ]
};

var byte_program = _.clone(long_program);
byte_program.disallows = _.clone(byte_program.disallows);
byte_program.disallows.NONE = {
    "false": [
        ["what is within spec", " 123"]
    ],
    "true": [
        ["a value with a fraction part", "1.2",
         ["value is not a byte"]
        ],
        ["too high a value", "999999999999999",
         ["value must be less than or equal to 127"]
        ],
        ["too low a value", "-999999999999999",
         ["value must be greater than or equal to -128"]
        ]
    ]
};


var unsignedLong_program = _.clone(integer_program);
unsignedLong_program.disallows = _.clone(unsignedLong_program.disallows);
unsignedLong_program.disallows.NONE = {
    "false": [
        ["what is within spec", " 1234"]
    ],
    "true": [
        ["a value with a fraction part", "1.2",
         ["value is not an unsignedLong"]
        ]
    ]
};

var unsignedInt_program = _.clone(integer_program);
unsignedInt_program.disallows = _.clone(unsignedInt_program.disallows);
unsignedInt_program.disallows.NONE = {
    "false": [
        ["what is within spec", " 1234"]
    ],
    "true": [
        ["a value with a fraction part", "1.2",
         ["value is not an unsignedInt"]
        ],
        ["value to high", "4294967296",
         ["value must be less than or equal to 4294967295"]
        ]
    ]
};

var unsignedShort_program = _.clone(integer_program);
unsignedShort_program.disallows = _.clone(unsignedShort_program.disallows);
unsignedShort_program.disallows.NONE = {
    "false": [
        ["what is within spec", " 1234"]
    ],
    "true": [
        ["a value with a fraction part", "1.2",
         ["value is not an unsignedShort"]
        ],
        ["value to high", "4294967296",
         ["value must be less than or equal to 65535"]
        ]
    ]
};


var unsignedByte_program = _.clone(integer_program);
unsignedByte_program.disallows = _.clone(unsignedByte_program.disallows);
unsignedByte_program.disallows.NONE = {
    "false": [
        ["what is within spec", " 123"]
    ],
    "true": [
        ["a value with a fraction part", "1.2",
         ["value is not an unsignedByte"]
        ],
        ["value to high", "4294967296",
         ["value must be less than or equal to 255"]
        ]
    ]
};

var float_program = _.clone(decimal_program);
float_program.parseParams = [
    // title, array to parse, expected object
    ["all except minInclusive and maxInclusive",
     [{name: "pattern", value: "abc"},
      {name: "minExclusive", value: "1"},
      {name: "maxExclusive", value: "10"}
     ],
     {
         "pattern": {rng: "abc", internal: new RegExp("^abc$")},
         "minExclusive": 1,
         "maxExclusive": 10
     }
    ],
    ["minInclusive and maxInclusive",
     [
         {name: "minInclusive", value: "1"},
         {name: "maxInclusive", value: "10"}
     ],
     {
         "minInclusive": 1,
         "maxInclusive": 10
     }
    ]
];
float_program.disallows = _.clone(float_program.disallows);
float_program.disallows.NONE = {
    "false": [
        ["number with mantissa and exponent", "-1E10"],
        ["negative infinity", "-INF"],
        ["infinity", "INF"],
        ["number NaN", "NaN"]
    ],
    "true": [
        ["random stuff", "ABC",
         ["not a valid float"]
         ]
    ]
};
delete float_program.disallows.totalDigits;
delete float_program.disallows.fractionDigits;

var double_program = _.clone(float_program);
double_program.disallows = _.clone(double_program.disallows);
double_program.disallows.NONE = _.clone(double_program.disallows.NONE);
double_program.disallows.NONE["true"] = [
        ["random stuff", "ABC",
         ["not a valid double"]
         ]
];

var dateTime_program = {
    equal: {
        "true": [
            ["for two equal values",
             "1901-01-01T10:10:10.111-01:30",
             "1901-01-01T10:10:10.111-01:30"]
        ],
        "false": [
            ["for two unequal values", "1901-01-01T10:10:10.111-01:30",
             "1901-01-01T10:10:10.111-01:31"]
        ]
    },
    parseParams: [
        ["all supported", [
            {name: "pattern", value: "abc"}
        ],
         {
             "pattern": {rng: "abc",
                         internal: new RegExp("^abc$")}
         }
        ]
    ],
    disallows: {
        NONE: {
            "false": [
                ["'1901-01-01T10:10:10.111-01:30'",
                 "1901-01-01T10:10:10.111-01:30"],
                ["'11901-01-01T10:10:10.111-01:30'",
                 "11901-01-01T10:10:10.111-01:30"]
            ],
            "true": [
                ["'1901-01-01T99:10:10.111-01:30'",
                 "1901-01-01T99:10:10.111-01:30",
                 ["not a valid dateTime"]
                ]
            ]
        }
    }
};

var time_program = {
    equal: {
        "true": [
            ["for two equal values", "10:10:10.111-01:30",
             "10:10:10.111-01:30"]
        ],
        "false": [
            ["for two unequal values",
             "10:10:10.111-01:30", "10:10:10.111-01:31"]
        ]
    },
    parseParams: [
        ["all supported", [{name: "pattern", value: "abc"}],
         {"pattern": {rng: "abc", internal: new RegExp("^abc$")} }
        ]
    ],
    disallows: {
        NONE: {
            "false": [
                ["'10:10:10.111-01:30'", "10:10:10.111-01:30"]
            ],
            "true": [
                ["'99:10:10.111-01:30'", "99:10:10.111-01:30",
                 ["not a valid time"]]
            ]
        }
    }
};

var date_program = {
    equal: {
        "true": [
            ["for two equal values", "1901-01-01-01:30", "1901-01-01-01:30"]
        ],
        "false": [
            ["for two unequal values", "1901-01-02-01:30",
             "1901-01-01-01:31"]
        ]
    },
    parseParams: [
        ["all supported", [
            {name: "pattern", value: "abc"}
        ],
         {
             "pattern": {rng: "abc",
                         internal: new RegExp("^abc$")}
         }]
    ],
    disallows: {
        NONE: {
            "false": [
            ["'1901-01-01-01:30'", "1901-01-01-01:30"]
            ],
            "true": [
                ["'1901-99-01-01:30'", "1901-99-01-01:30",
                 ["not a valid date"]
                ]
            ]
        }
    }
};

var gYearMonth_program = {
    equal: {
        "true": [
            ["for two equal values", "1901-01-01:30", "1901-01-01:30"]
        ],
        "false": [
            ["for two unequal values", "1901-01-01:30",
             "1901-02-01:31"]
        ]
    },
    parseParams: [
        ["all supported", [
            {name: "pattern", value: "abc"}
        ],
         {
             "pattern": {rng: "abc",
                         internal: new RegExp("^abc$")}
         }]
    ],
    disallows: {
        NONE: {
            "false": [
            ["'1901-01'", "1901-01"]
            ],
            "true": [
                ["'1901-99-01:30'", "1901-99-01:30",
                 ["not a valid gYearMonth"]
                ]
            ]
        }
    }
};

var gYear_program = {
    equal: {
        "true": [
            ["for two equal values", "1901-01:30", "1901-01:30"]
        ],
        "false": [
            ["for two unequal values", "1901-01:30",
             "1901-01:31"]
        ]
    },
    parseParams: [
        ["all supported", [
            {name: "pattern", value: "abc"}
        ],
         {
             "pattern": {rng: "abc",
                         internal: new RegExp("^abc$")}
         }]
    ],
    disallows: {
        NONE: {
            "false": [
            ["'1901'", "1901"]
            ],
            "true": [
                ["'01901'", "01901",
                 ["not a valid gYear"]
                ]
            ]
        }
    }
};

var gMonthDay_program = {
    equal: {
        "true": [
            ["for two equal values", "01-01-01:30", "01-01-01:30"]
        ],
        "false": [
            ["for two unequal values", "01-02-01:30",
             "01-02-01:31"]
        ]
    },
    parseParams: [
        ["all supported", [
            {name: "pattern", value: "abc"}
        ],
         {
             "pattern": {rng: "abc",
                         internal: new RegExp("^abc$")}
         }]
    ],
    disallows: {
        NONE: {
            "false": [
            ["'12-31'", "12-31"]
            ],
            "true": [
                ["'02-30'", "02-30",
                 ["not a valid gMonthDay"]
                ]
            ]
        }
    }
};

var gDay_program = {
    equal: {
        "true": [
            ["for two equal values", "31-01:30", "31-01:30"]
        ],
        "false": [
            ["for two unequal values", "31-01:30",
             "02-01:31"]
        ]
    },
    parseParams: [
        ["all supported", [
            {name: "pattern", value: "abc"}
        ],
         {
             "pattern": {rng: "abc",
                         internal: new RegExp("^abc$")}
         }]
    ],
    disallows: {
        NONE: {
            "false": [
            ["'01'", "01"]
            ],
            "true": [
                ["'32'", "32",
                 ["not a valid gDay"]
                ]
            ]
        }
    }
};

var gMonth_program = {
    equal: {
        "true": [
            ["for two equal values", "01-01:30", "01-01:30"]
        ],
        "false": [
            ["for two unequal values", "01-01:30",
             "01-01:31"]
        ]
    },
    parseParams: [
        ["all supported", [
            {name: "pattern", value: "abc"}
        ],
         {
             "pattern": {rng: "abc",
                         internal: new RegExp("^abc$")}
         }]
    ],
    disallows: {
        NONE: {
            "false": [
            ["'12'", "12"]
            ],
            "true": [
                ["'13'", "13",
                 ["not a valid gMonth"]
                ]
            ]
        }
    }
};

var anyURI_program = {
    equal: {
        "true": [
            ["for two equal values", "a:b", "a:b"]
        ],
        "false": [
            ["for two unequal values", "a:f",
             "a:b"]
        ]
    },
    parseParams: [
        ["all except maxLength and minLength", [
            {name: "length", value: "1"},
            {name: "pattern", value: "abc"}
        ],
         {
             "length": 1,
             "pattern": {rng: "abc",
                         internal: new RegExp("^abc$")}
         }],
        ["minLength and maxLength", [
            {name: "maxLength", value: "1"},
            {name: "minLength", value: "1"}
        ],
         {
             "maxLength": 1,
             "minLength": 1
         }
        ]
    ],
    disallows: {
        NONE: {
            "false": [
                ["simple", "a:b"],
                ["fragment", "a:/b#gaga"],
                ["relative URI", "aaa"]
            ],
            "true": [
                [":", ":",
                 ["not a valid anyURI"]
                ]
            ]
        }
    }
};


var doc_nr = new name_resolver.NameResolver();
doc_nr.definePrefix("a", "http://aaaaa.com");
doc_nr.definePrefix("", "http://qqqqqq.com");

var schema_nr = new name_resolver.NameResolver();
schema_nr.definePrefix("aaa", "http://aaaaa.com");
schema_nr.definePrefix("z", "http://qqqqqq.com");

var QName_program = {
    doc_context: {resolver: doc_nr},
    schema_context: {resolver: schema_nr},
    // Reminder: in equal tests the first parameter is from the
    // document, the 2nd parameter is from the schema.
    equal: {
        "true": [
            ["for two equal values (1) ", "a:b", "aaa:b"],
            ["for two equal values (2)", "foo", "z:foo"]
        ],
        "false": [
            ["for equal URIs, unequal local names", "a:f",
             "aaa:b"],
            ["for unequal URIs", "a:f",
             "z:b"]
        ]
    },
    parseParams: [
        ["all except maxLength and minLength", [
            {name: "length", value: "1"},
            {name: "pattern", value: "abc"}
        ],
         {
             "length": 1,
             "pattern": {rng: "abc",
                         internal: new RegExp("^abc$")}
         }],
        ["minLength and maxLength", [
            {name: "maxLength", value: "1"},
            {name: "minLength", value: "1"}
        ],
         {
             "maxLength": 1,
             "minLength": 1
         }
        ]
    ],
    disallows: {
        NONE: {
            "false": [
                ["'foo'", "foo"],
                ["colons", "a:zh"],
                ["tabs", "foo\t"],
                ["newlines", "foo\n"],
                ["carriage returns", "foo\r"],
            ],
            "true": [
                ["spaces", "foo zh",
                 ["not a valid QName"]
                ],
                ["curly braces", "{foo} zh",
                 ["not a valid QName"]
                ],
                ["colons appearing twice", "foo:zh:zh",
                 ["not a valid QName"]
                ],
                ["unresovable names", "foo:zh",
                 ["cannot resolve the name foo:zh"]
                ]

            ]
        }
    }
};

var NOTATION_program = _.clone(QName_program);
NOTATION_program.disallows = _.clone(NOTATION_program.disallows);
NOTATION_program.disallows.NONE = _.clone(NOTATION_program.disallows.NONE);
NOTATION_program.disallows.NONE["true"] = [
    ["spaces", "foo zh",
     ["not a valid NOTATION"]
    ],
    ["curly braces", "{foo} zh",
     ["not a valid NOTATION"]
    ],
    ["colons appearing twice", "foo:zh:zh",
     ["not a valid NOTATION"]
    ],
    ["unresovable names", "foo:zh",
     ["cannot resolve the name foo:zh"]
    ]
];

function testProgram(name, lib, program, disallows) {
    var type = lib.types[name];
    var schema_context = program.schema_context;
    var doc_context = program.doc_context;
    describe(name, function () {
        describe("equal", function () {
            _.each(program.equal["true"], function (x) {
                it("returns true " + x[0], function () {
                    assert.isTrue(type.equal(x[1],
                                             type.parseValue(x[2],
                                                             schema_context),
                                             doc_context));
                });
            });

            _.each(program.equal["false"], function (x) {
                it("returns false " + x[0], function () {
                    assert.isFalse(type.equal(x[1],
                                              type.parseValue(x[2],
                                                              schema_context),
                                              doc_context));
                });
            });

        });

        describe("parseParams", function () {
            _.each(program.parseParams, function (x) {
                it(x[0], function () {
                    assert.deepEqual(type.parseParams(undefined, x[1]), x[2]);
                });
            });
        });

        describe("disallows", function () {
            var none = program.disallows && program.disallows.NONE;
            if (disallows || none) {
                describe("without parameters", function () {
                    if (disallows)
                        disallows(type);

                    if (!none)
                        return;

                    _.each(none["false"], function (x) {
                        it("allows " + x[0], function () {
                            assert.isFalse(type.disallows(x[1], {},
                                                         doc_context));
                        });
                    });

                    _.each(none["true"], function (x) {
                        it("disallows " + x[0], function () {
                            var ret = type.disallows(x[1], {},
                                                    doc_context);
                            assert.equal(ret.length, x[2].length);
                            assert.equal(ret[0].toString(), x[2][0]);
                        });
                    });
                });
            }

            function makeParameterTest(param) {
                return function () {
                    _.each(param["false"], function (x) {
                        it("allows " + x[0], (function (i) {
                            return function () {
                                var params = type.parseParams(undefined,
                                    [{name: i, value: x[2]}]);
                                assert.isFalse(type.disallows(x[1], params,
                                                             doc_context));
                            };
                        })(i));
                    });

                    _.each(param["true"], function (x) {
                        it("disallows " + x[0], (function (i) {
                            return function () {
                                var params = type.parseParams(undefined,
                                    [{name: i, value: x[2]}]);
                                var ret = type.disallows(x[1], params,
                                                        doc_context);
                                assert.equal(ret.length, x[3].length);
                                assert.equal(ret[0].toString(), x[3][0]);
                            };
                        })(i));

                    });
                };
            }

            var program_disallows = program.disallows;
            for(var i in program_disallows) {
                if (i === "NONE" || !program_disallows.hasOwnProperty(i))
                    continue;
                describe("with a " + i + " parameter",
                         makeParameterTest(program_disallows[i]));
            }
        });
    });
}

function testString(name, lib, disallows_noparams, disallows_params) {
    var type = lib.types[name];
    describe(name, function () {
        before(function () {
            assert.isFalse(type.needs_context);
        });
        describe("equal", function () {
            it("returns true for two equal values", function () {
                assert.isTrue(type.equal("foo", {value: "foo"}));
            });

            it("returns false for two unequal values", function () {
                assert.isFalse(type.equal("foo", {value: "bar"}));
            });
        });

        describe("parseParams", function () {
            it("empty array", function () {
                assert.deepEqual(type.parseParams(undefined, []), {});
                });

            it("all, except minLength and maxLength", function () {
                assert.deepEqual(
                    type.parseParams(undefined, [
                        {name: "length", value: "1"},
                        {name: "pattern", value: "abc"}
                    ]),
                    {
                        "length": 1,
                        "pattern": {rng: "abc", internal: new RegExp("^abc$")}
                    });
            });


            it("minLength and maxLength", function () {
                assert.deepEqual(
                    type.parseParams(undefined, [
                        {name: "maxLength", value: "1"},
                        {name: "minLength", value: "1"}
                    ]),
                    {
                        "maxLength": 1,
                        "minLength": 1
                    });
            });

            it("repeatables", function () {
                var parsed = type.parseParams(undefined, [
                    {name: "pattern", value: "abc"},
                    {name: "pattern", value: "def"}
                ]);

                assert.deepEqual(_.sortBy(parsed.pattern, "rng"),
                                 _.sortBy(
                                     [{rng: "abc",
                                       internal: new RegExp("^abc$")},
                                      {rng: "def",
                                       internal: new RegExp("^def$")}],
                                     "rng"));
            });

            it("non-repeatables", function () {
                assert.Throw(
                    type.parseParams.bind(type, undefined, [
                        {name: "length", value: "1"},
                        {name: "maxLength", value: "1"},
                        {name: "minLength", value: "1"},
                        {name: "length", value: "1"},
                        {name: "maxLength", value: "1"},
                        {name: "minLength", value: "1"}
                    ]),
                    datatypes.ParameterParsingError,
                    "cannot repeat parameter length\n" +
                        "cannot repeat parameter maxLength\n" +
                        "cannot repeat parameter minLength");
            });
        });

        describe("disallows", function () {
            describe("without parameters", function () {
                it("allows 'foo'", function () {
                    assert.isFalse(type.disallows("foo"));

                });

                disallows_noparams(type);
            });

            describe("with a length parameter", function () {
                it("allows the length", function () {
                    assert.isFalse(type.disallows("foo", {"length": 3}));

                });
                it("disallows other lengths", function () {
                    var ret = type.disallows("foobar", {"length": 3});
                    assert.equal(ret.length, 1);
                    assert.equal(ret[0].toString(),
                                 "length of value should be 3");
                });
            });

            describe("with a minLength parameter", function () {
                it("allows the length", function () {
                    assert.isFalse(type.disallows("foo", {"minLength": 3}));

                });
                it("allows more than the length", function () {
                    assert.isFalse(type.disallows("foobar", {"minLength": 3}));

                });
                it("disallows less than the length", function () {
                    var ret = type.disallows("f", {"minLength": 3});
                    assert.equal(ret.length, 1);
                    assert.equal(ret[0].toString(),
                                 "length of value should be greater than " +
                                 "or equal to 3");
                });
            });

            describe("with a maxLength parameter", function () {
                it("allows the length", function () {
                    assert.isFalse(type.disallows("foo", {"maxLength": 3}));

                });
                it("allows less than the length", function () {
                    assert.isFalse(type.disallows("f", {"maxLength": 3}));

                });
                it("disallows more than the length", function () {
                    var ret = type.disallows("foobar", {"maxLength": 3});
                    assert.equal(ret.length, 1);
                    assert.equal(ret[0].toString(),
                                 "length of value should be less than " +
                                 "or equal to 3");
                });
            });

            describe("with a pattern parameter", function () {
                // Extract the pattern processor from the type.
                var pattern = type.param_name_to_obj.pattern;
                it("allows the pattern", function () {
                    assert.isFalse(
                        type.disallows("foo",
                                       {"pattern": pattern.convert("[fb].*")}));

                });
                it("disallows what does not match the pattern",
                   function () {
                    var ret = type.disallows("afoo",
                                             {"pattern":
                                              pattern.convert("[fb].*")});
                    assert.equal(ret.length, 1);
                    assert.equal(ret[0].toString(),
                                 "value does not match the pattern [fb].*");
                });

                it("disallows what does not match multiple patterns",
                   function () {
                    var parsed = type.parseParams(undefined,
                        [{name: "pattern", value: ".*"},
                         {name: "pattern", value: "[fb].*"}]);
                    var ret = type.disallows("afoo", parsed);
                    assert.equal(ret.length, 1);
                    assert.equal(ret[0].toString(),
                                 "value does not match the pattern [fb].*");
                });

            });

            if (disallows_params)
                disallows_params(type);
        });
    });
}

describe("datatypes", function () {
    describe("Builtin library", function () {
        var lib = datatypes.registry.get("");

        describe("string", function () {
            var type = lib.types.string;

            describe("equal", function () {
                it("returns true for two equal values", function () {
                    assert.isTrue(type.equal("foo", type.parseValue("foo")));
                });

                it("returns false for two unequal values", function () {
                    assert.isFalse(type.equal("foo", type.parseValue("bar")));
                });
            });

            describe("disallows", function () {
                it("nothing", function () {
                    assert.isFalse(type.disallows("foo"));
                });
            });
        });

        describe("token", function () {
            var type = lib.types.token;

            describe("equal", function () {
                it("returns true for two equal values", function () {
                    assert.isTrue(type.equal("foo", type.parseValue("foo")));
                });

                it("returns true for string differing only regarding space (1)",
                   function () {
                    assert.isTrue(type.equal("foo", type.parseValue(" foo ")));
                });

                it("returns true for string differing only regarding space (2)",
                   function () {
                    assert.isTrue(type.equal(
                        "foo bar   fwip",
                        type.parseValue(" foo   bar fwip")));
                });

                it("returns false for two unequal values", function () {
                    assert.isFalse(type.equal("foobar",
                                              type.parseValue("foo bar")));
                });
            });

            describe("disallows", function () {
                it("anything", function () {
                    assert.isFalse(type.disallows("foo"));
                });
            });
        });
    });

    describe("XMLSchema library", function () {
        var lib = datatypes.registry.get(
            "http://www.w3.org/2001/XMLSchema-datatypes");

        describe("disallowed combinations of parameters",
                 function () {
            it("minLength must be <= maxLength", function () {
                var type = lib.types.string;

                assert.Throw(
                    type.parseParams.bind(type, undefined, [
                        {name: "maxLength", value: "1"},
                        {name: "minLength", value: "2"}
                    ]),
                    datatypes.ParameterParsingError,
                    "minLength must be less than or equal to maxLength");
            });

            it("combining length and minLength is invalid", function () {
                var type = lib.types.string;
                assert.Throw(
                    type.parseParams.bind(type, undefined, [
                        {name: "length", value: "1"},
                        {name: "minLength", value: "2"}
                    ]),
                    datatypes.ParameterParsingError,
                    "length and minLength cannot appear together");
            });

            it("combining length and maxLength is invalid", function () {
                var type = lib.types.string;
                assert.Throw(
                    type.parseParams.bind(type, undefined, [
                        {name: "length", value: "1"},
                        {name: "maxLength", value: "2"}
                    ]),
                    datatypes.ParameterParsingError,
                    "length and maxLength cannot appear together");
            });

            it("combining maxInclusive and maxExclusive is invalid",
               function () {
                var type = lib.types.decimal;
                assert.Throw(
                    type.parseParams.bind(type, undefined, [
                        {name: "maxInclusive", value: "1"},
                        {name: "maxExclusive", value: "2"}
                    ]),
                    datatypes.ParameterParsingError,
                    "maxInclusive and maxExclusive cannot appear together");
            });

            it("combining minInclusive and minExclusive is invalid",
               function () {
                var type = lib.types.decimal;
                assert.Throw(
                    type.parseParams.bind(type, undefined, [
                        {name: "minInclusive", value: "1"},
                        {name: "minExclusive", value: "2"}
                    ]),
                    datatypes.ParameterParsingError,
                    "minInclusive and minExclusive cannot appear together");
            });

            it("minInclusive must be <= maxInclusive", function () {
                var type = lib.types.decimal;

                assert.Throw(
                    type.parseParams.bind(type, undefined, [
                        {name: "minInclusive", value: "2"},
                        {name: "maxInclusive", value: "1"}
                    ]),
                    datatypes.ParameterParsingError,
                    "minInclusive must be less than or equal to maxInclusive");
            });

            it("minExclusive must be < maxInclusive", function () {
                var type = lib.types.decimal;

                assert.Throw(
                    type.parseParams.bind(type, undefined, [
                        {name: "minExclusive", value: "1"},
                        {name: "maxInclusive", value: "1"}
                    ]),
                    datatypes.ParameterParsingError,
                    "minExclusive must be less than maxInclusive");
            });

            it("minInclusive must be < maxExclusive", function () {
                var type = lib.types.decimal;

                assert.Throw(
                    type.parseParams.bind(type, undefined, [
                        {name: "minInclusive", value: "1"},
                        {name: "maxExclusive", value: "1"}
                    ]),
                    datatypes.ParameterParsingError,
                    "minInclusive must be less than maxExclusive");
            });

            it("minExclusive must be <= maxExclusive", function () {
                var type = lib.types.decimal;

                assert.Throw(
                    type.parseParams.bind(type, undefined, [
                        {name: "minExclusive", value: "1.1"},
                        {name: "maxExclusive", value: "1"}
                    ]),
                    datatypes.ParameterParsingError,
                    "minExclusive must be less than or equal to maxExclusive");
            });
        });

        testString("string", lib, function (type) {
            it("allows anything", function () {
                assert.isFalse(type.disallows("foo"));
            });
        });

        testString("normalizedString", lib,
                   function (type) {
            it("allows simple text", function () {
                assert.isFalse(type.disallows("foo"));
            });

            it("disallows tabs", function () {
                var ret = type.disallows("foo\tbar");
                assert.equal(ret.length, 1);
                assert.equal(ret[0].toString(),
                             "string contains a tab, carriage return "+
                             "or newline");
            });

            it("disallows newlines", function () {
                var ret = type.disallows("foo\nbar");
                assert.equal(ret.length, 1);
                assert.equal(ret[0].toString(),
                             "string contains a tab, carriage return "+
                             "or newline");
            });

            it("disallows carriage returns", function () {
                var ret = type.disallows("foo\rbar");
                assert.equal(ret.length, 1);
                assert.equal(ret[0].toString(),
                             "string contains a tab, carriage return "+
                             "or newline");
            });

        });

        testString("token", lib,
                   function (type) {
            it("allows simple text", function () {
                assert.isFalse(type.disallows("foo"));
            });

            it("allows tabs", function () {
                assert.isFalse(type.disallows("en\t"));
            });

            it("disallows newlines", function () {
                var ret = type.disallows("foo\nbar");
                assert.equal(ret.length, 1);
                assert.equal(ret[0].toString(),
                             "not a valid token");
            });

            it("disallows carriage returns", function () {
                var ret = type.disallows("foo\rbar");
                assert.equal(ret.length, 1);
                assert.equal(ret[0].toString(),
                             "not a valid token");
            });

            it("allows spaces", function () {
                assert.isFalse(type.disallows("foo  bar"));
            });

        });

        testString("language", lib,
                   function (type) {
            it("allows simple text", function () {
                assert.isFalse(type.disallows("en"));
            });

            it("allows tabs", function () {
                assert.isFalse(type.disallows("en\t"));
            });

            it("allows newlines", function () {
                assert.isFalse(type.disallows("en\n"));
            });

            it("allows carriage returns", function () {
                assert.isFalse(type.disallows("en\r"));
            });

            it("allows spaces", function () {
                assert.isFalse(type.disallows("en "));
            });

        });

        testString("Name", lib,
                   function (type) {
            it("allows simple text", function () {
                assert.isFalse(type.disallows("en"));
            });

            it("allows tabs", function () {
                assert.isFalse(type.disallows("en\t"));
            });

            it("allows newlines", function () {
                assert.isFalse(type.disallows("en\n"));
            });

            it("allows carriage returns", function () {
                assert.isFalse(type.disallows("en\r"));
            });

            it("allows spaces", function () {
                assert.isFalse(type.disallows("en "));
            });

            it("disallows spaces between letters", function () {
                var ret = type.disallows("en zh");
                assert.equal(ret.length, 1);
                assert.equal(ret[0].toString(),
                             "not a valid Name");
            });

        });

        testString("NCName", lib,
                   function (type) {
            it("allows simple text", function () {
                assert.isFalse(type.disallows("en"));
            });

            it("allows tabs", function () {
                assert.isFalse(type.disallows("en\t"));
            });

            it("allows newlines", function () {
                assert.isFalse(type.disallows("en\n"));
            });

            it("allows carriage returns", function () {
                assert.isFalse(type.disallows("en\r"));
            });

            it("allows spaces", function () {
                assert.isFalse(type.disallows("en "));
            });

            it("disallows colons", function () {
                var ret = type.disallows("en:zh");
                assert.equal(ret.length, 1);
                assert.equal(ret[0].toString(),
                             "not a valid NCName");
            });
        });

        testString("NMTOKEN", lib,
                   function (type) {
            it("allows simple text", function () {
                assert.isFalse(type.disallows(":en"));
            });

            it("allows tabs", function () {
                assert.isFalse(type.disallows("en\t"));
            });

            it("allows newlines", function () {
                assert.isFalse(type.disallows("en\n"));
            });

            it("allows carriage returns", function () {
                assert.isFalse(type.disallows("en\r"));
            });

            it("disallows spaces", function () {
                var ret = type.disallows("en zh");
                assert.equal(ret.length, 1);
                assert.equal(ret[0].toString(),
                             "not a valid NMTOKEN");
            });

        });

        testString("NMTOKENS", lib,
                   function (type) {
            it("allows simple text", function () {
                assert.isFalse(type.disallows(":en"));
            });

            it("allows spaces", function () {
                assert.isFalse(type.disallows("en zh"));

            });

            it("allows tabs", function () {
                assert.isFalse(type.disallows("en\t"));
            });

            it("allows newlines", function () {
                assert.isFalse(type.disallows("en\n"));
            });

            it("allows carriage returns", function () {
                assert.isFalse(type.disallows("en\r"));
            });
        });

        testString("ID", lib,
                   function (type) {
            it("allows simple text", function () {
                assert.isFalse(type.disallows("en"));
            });

            it("allows tabs", function () {
                assert.isFalse(type.disallows("en\t"));
            });

            it("allows newlines", function () {
                assert.isFalse(type.disallows("en\n"));
            });

            it("allows carriage returns", function () {
                assert.isFalse(type.disallows("en\r"));
            });

            it("disallows spaces", function () {
                var ret = type.disallows("en zh");
                assert.equal(ret.length, 1);
                assert.equal(ret[0].toString(),
                             "not a valid ID");
            });

            it("disallows colons", function () {
                var ret = type.disallows("en:zh");
                assert.equal(ret.length, 1);
                assert.equal(ret[0].toString(),
                             "not a valid ID");
            });
        });

        testString("IDREF", lib,
                   function (type) {
            it("allows simple text", function () {
                assert.isFalse(type.disallows("en"));
            });

            it("allows tabs", function () {
                assert.isFalse(type.disallows("en\t"));
            });

            it("allows newlines", function () {
                assert.isFalse(type.disallows("en\n"));
            });

            it("allows carriage returns", function () {
                assert.isFalse(type.disallows("en\r"));
            });

            it("disallows spaces", function () {
                var ret = type.disallows("en zh");
                assert.equal(ret.length, 1);
                assert.equal(ret[0].toString(),
                             "not a valid IDREF");
            });

            it("disallows colons", function () {
                var ret = type.disallows("en:zh");
                assert.equal(ret.length, 1);
                assert.equal(ret[0].toString(),
                             "not a valid IDREF");
            });
        });

        testString("IDREFS", lib,
                   function (type) {
            it("allows simple text", function () {
                assert.isFalse(type.disallows("en"));
            });

            it("allows spaces", function () {
                assert.isFalse(type.disallows("en zh"));
            });

            it("allows tabs", function () {
                assert.isFalse(type.disallows("en\t"));
            });

            it("allows newlines", function () {
                assert.isFalse(type.disallows("en\n"));
            });

            it("allows carriage returns", function () {
                assert.isFalse(type.disallows("en\r"));
            });

            it("disallows colons", function () {
                var ret = type.disallows("en:zh");
                assert.equal(ret.length, 1);
                assert.equal(ret[0].toString(),
                             "not a valid IDREFS");
            });
        });

        testProgram("QName", lib, QName_program);
        testProgram("NOTATION", lib, NOTATION_program);

        testProgram("decimal", lib, decimal_program);
        testProgram("integer", lib, integer_program);
        testProgram("nonPositiveInteger", lib,
                    nonPositiveInteger_program);
        testProgram("negativeInteger", lib,
                    negativeInteger_program);
        testProgram("nonNegativeInteger", lib,
                    nonNegativeInteger_program);
        testProgram("positiveInteger", lib,
                    positiveInteger_program);
        testProgram("long", lib, long_program);
        testProgram("int", lib, int_program);
        testProgram("short", lib, short_program);
        testProgram("byte", lib, byte_program);
        testProgram("unsignedLong", lib, unsignedLong_program);
        testProgram("unsignedInt", lib, unsignedInt_program);
        testProgram("unsignedShort", lib, unsignedShort_program);
        testProgram("unsignedByte", lib, unsignedByte_program);
        testProgram("float", lib, float_program);
        testProgram("double", lib, double_program);

        describe("boolean", function () {
            var type = lib.types["boolean"];
            describe("equal", function () {
                it("returns true for two equal values", function () {
                    assert.isTrue(type.equal("1",
                                             type.parseValue("1")));
                });

                it("returns true for two equal values", function () {
                    assert.isTrue(type.equal("0",
                                             type.parseValue("0")));
                });

                it("returns true for two equal values", function () {
                    assert.isTrue(type.equal("true",
                                             type.parseValue("true")));
                });


                it("returns true for two equal values", function () {
                    assert.isTrue(type.equal("false",
                                             type.parseValue("false")));
                });

                it("returns true for two equal values", function () {
                    assert.isTrue(type.equal("true",
                                             type.parseValue("1")));
                });

                it("returns true for two equal values", function () {
                    assert.isTrue(type.equal("false",
                                             type.parseValue("0")));
                });

                it("returns false for two unequal values", function () {
                    assert.isFalse(type.equal("false",
                                             type.parseValue("1")));

                });

                it("returns false for two unequal values", function () {
                    assert.isFalse(type.equal("true",
                                             type.parseValue("0")));

                });
            });

            describe("parseParams", function () {
                it("all, except minLength and maxLength", function () {
                    assert.deepEqual(
                        type.parseParams(undefined, [
                            {name: "pattern", value: "abc"}
                        ]),
                        {
                            "pattern": {rng: "abc",
                                        internal: new RegExp("^abc$")}
                        });
                });
            });

            describe("disallows", function () {
                describe("without parameters", function () {
                    it("allows 'true'", function () {
                        assert.isFalse(type.disallows("true"));

                    });

                    it("allows 'false'", function () {
                        assert.isFalse(type.disallows("false"));

                    });

                    it("allows 1", function () {
                        assert.isFalse(type.disallows("1"));

                    });

                    it("allows 0", function () {
                        assert.isFalse(type.disallows("0"));

                    });

                    it("disallows 'yes'", function () {
                        var ret = type.disallows("yes");
                        assert.equal(ret.length, 1);
                        assert.equal(ret[0].toString(),
                                     "not a valid boolean");

                    });

                });

            });
        });

        describe("base64Binary", function () {
            var type = lib.types.base64Binary;
            describe("equal", function () {
                it("returns true for two equal values", function () {
                    assert.isTrue(type.equal("AAAA",
                                             type.parseValue("A A A A")));
                });

                it("returns false for two unequal values", function () {
                    assert.isFalse(type.equal("AAAA",
                                              type.parseValue("BBBB")));
                });
            });

            describe("parseParams", function () {
                it("all, except minLength and maxLength", function () {
                    assert.deepEqual(
                        type.parseParams(undefined, [
                            {name: "length", value: "1"},
                            {name: "pattern", value: "abc"}
                        ]),
                        {
                            "length": 1,
                            "pattern": {rng: "abc",
                                        internal: new RegExp("^abc$")}
                        });
                });


                it("minLength and maxLength", function () {
                    assert.deepEqual(
                        type.parseParams(undefined, [
                            {name: "maxLength", value: "1"},
                            {name: "minLength", value: "1"}
                        ]),
                        {
                            "maxLength": 1,
                            "minLength": 1
                        });
                });
            });

            describe("disallows", function () {
                describe("without parameters", function () {
                    it("allows 'AAAA'", function () {
                        assert.isFalse(type.disallows("AAAA"));

                    });

                    it("allows 'A A A A'", function () {
                        assert.isFalse(type.disallows("A A A A"));

                    });

                    it("allows an empty string", function () {
                        assert.isFalse(type.disallows(""));

                    });

                    it("allows 'test' coded in base64", function () {
                        assert.isFalse(type.disallows("dGVzdA=="));

                    });

                    it("disallows badly padded (1)", function () {
                        var ret = type.disallows("AAA");
                        assert.equal(ret.length, 1);
                        assert.equal(ret[0].toString(),
                                     "not a valid base64Binary");
                    });

                    it("disallows badly padded (2)", function () {
                        var ret = type.disallows("AA");
                        assert.equal(ret.length, 1);
                        assert.equal(ret[0].toString(),
                                     "not a valid base64Binary");
                    });

                    it("disallows badly padded (3)", function () {
                        var ret = type.disallows("A");
                        assert.equal(ret.length, 1);
                        assert.equal(ret[0].toString(),
                                     "not a valid base64Binary");
                    });

                    it("disallows badly padded (4)", function () {
                        var ret = type.disallows("A=");
                        assert.equal(ret.length, 1);
                        assert.equal(ret[0].toString(),
                                     "not a valid base64Binary");
                    });
                });

                describe("with a length parameter", function () {
                    it("allows the length", function () {
                        assert.isFalse(type.disallows("dGVzdA==",
                                                      {"length": 4}));

                    });
                    it("disallows other lengths", function () {
                        var ret = type.disallows("dGVzdCttb3JlCg==",
                                                 {"length": 4});
                        assert.equal(ret.length, 1);
                        assert.equal(ret[0].toString(),
                                     "length of value should be 4");
                    });
                });

                describe("with a minLength parameter", function () {
                    it("allows the length", function () {
                        assert.isFalse(type.disallows("dGVzdA==",
                                                      {"minLength": 4}));

                    });
                    it("allows more than the length", function () {
                        assert.isFalse(type.disallows("dGVzdCttb3JlCg==",
                                                      {"minLength": 4}));

                    });

                    it("disallows less than the length", function () {
                        var ret = type.disallows("Zm9v", {"minLength": 4});
                        assert.equal(ret.length, 1);
                        assert.equal(ret[0].toString(),
                                     "length of value should be greater than " +
                                     "or equal to 4");
                    });
                });

                describe("with a maxLength parameter", function () {
                    it("allows the length", function () {
                        assert.isFalse(type.disallows("dGVzdA==",
                                                      {"maxLength": 4}));

                    });
                    it("allows less than the length", function () {
                        assert.isFalse(type.disallows("Zm9v",
                                                      {"maxLength": 4}));

                    });
                    it("disallows more than the length", function () {
                        var ret = type.disallows("dGVzdHM=", {"maxLength": 4});
                    assert.equal(ret.length, 1);
                        assert.equal(ret[0].toString(),
                                     "length of value should be less than " +
                                     "or equal to 4");
                    });
                });
            });
        });

        describe("hexBinary", function () {
            var type = lib.types.hexBinary;
            describe("equal", function () {
                it("returns true for two equal values", function () {
                    assert.isTrue(type.equal("AAAA",
                                             type.parseValue("AAAA")));
                });

                it("returns false for two unequal values", function () {
                    assert.isFalse(type.equal("AAAA",
                                              type.parseValue("BBBB")));
                });
            });

            describe("parseParams", function () {
                it("all, except minLength and maxLength", function () {
                    assert.deepEqual(
                        type.parseParams(undefined, [
                            {name: "length", value: "1"},
                            {name: "pattern", value: "abc"}
                        ]),
                        {
                            "length": 1,
                            "pattern": {rng: "abc",
                                        internal: new RegExp("^abc$")}
                        });
                });


                it("minLength and maxLength", function () {
                    assert.deepEqual(
                        type.parseParams(undefined, [
                            {name: "maxLength", value: "1"},
                            {name: "minLength", value: "1"}
                        ]),
                        {
                            "maxLength": 1,
                            "minLength": 1
                        });
                });
            });

            describe("disallows", function () {
                describe("without parameters", function () {
                    it("allows 'AAAA'", function () {
                        assert.isFalse(type.disallows("AAAA"));

                    });

                    it("allows an empty string", function () {
                        assert.isFalse(type.disallows(""));

                    });

                    it("disallows 'A'", function () {
                        var ret = type.disallows("A");
                        assert.equal(ret.length, 1);
                        assert.equal(ret[0].toString(),
                                     "not a valid hexBinary");
                    });

                    it("disallows 'A A A A'", function () {
                        var ret = type.disallows("A A A A");
                        assert.equal(ret.length, 1);
                        assert.equal(ret[0].toString(),
                                     "not a valid hexBinary");
                    });
                });

                describe("with a length parameter", function () {
                    it("allows the length", function () {
                        assert.isFalse(type.disallows("AAAA",
                                                      {"length": 2}));

                    });
                    it("disallows other lengths", function () {
                        var ret = type.disallows("AA",
                                                 {"length": 2});
                        assert.equal(ret.length, 1);
                        assert.equal(ret[0].toString(),
                                     "length of value should be 2");
                    });
                });

                describe("with a minLength parameter", function () {
                    it("allows the length", function () {
                        assert.isFalse(type.disallows("AAAA",
                                                      {"minLength": 2}));

                    });
                    it("allows more than the length", function () {
                        assert.isFalse(type.disallows("AAAAAA",
                                                      {"minLength": 2}));

                    });

                    it("disallows less than the length", function () {
                        var ret = type.disallows("AA", {"minLength": 2});
                        assert.equal(ret.length, 1);
                        assert.equal(ret[0].toString(),
                                     "length of value should be greater than " +
                                     "or equal to 2");
                    });
                });

                describe("with a maxLength parameter", function () {
                    it("allows the length", function () {
                        assert.isFalse(type.disallows("AAAA",
                                                      {"maxLength": 2}));

                    });
                    it("allows less than the length", function () {
                        assert.isFalse(type.disallows("AA",
                                                      {"maxLength": 2}));

                    });
                    it("disallows more than the length", function () {
                        var ret = type.disallows("AAAAAA", {"maxLength": 2});
                    assert.equal(ret.length, 1);
                        assert.equal(ret[0].toString(),
                                     "length of value should be less than " +
                                     "or equal to 2");
                    });
                });
            });
        });


        describe("duration", function () {
            var type = lib.types.duration;
            describe("equal", function () {
                it("returns true for two equal values", function () {
                    assert.isTrue(type.equal("P3Y",
                                             type.parseValue("P3Y")));
                });

                it("returns false for two unequal values", function () {
                    assert.isFalse(type.equal("P3Y",
                                              type.parseValue("P2Y")));
                });
            });

            describe("parseParams", function () {
                it("all supported", function () {
                    assert.deepEqual(
                        type.parseParams(undefined, [
                            {name: "pattern", value: "abc"}
                        ]),
                        {
                            "pattern": {rng: "abc",
                                        internal: new RegExp("^abc$")}
                        });
                });
            });

            describe("disallows", function () {
                describe("without parameters", function () {
                    it("allows 'P2Y3M1DT12H3M23.123S'", function () {
                        assert.isFalse(type.disallows("P2Y3M1DT12H3M23.123S"));

                    });
                });
            });
        });

        testProgram("dateTime", lib, dateTime_program);
        testProgram("time", lib, time_program);
        testProgram("date", lib, date_program);
        testProgram("gYearMonth", lib, gYearMonth_program);
        testProgram("gYear", lib, gYear_program);
        testProgram("gMonthDay", lib, gMonthDay_program);
        testProgram("gDay", lib, gDay_program);
        testProgram("gMonth", lib, gMonth_program);
        testProgram("anyURI", lib, anyURI_program);

    });
});
