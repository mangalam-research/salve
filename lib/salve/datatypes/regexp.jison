%{var xmlcharacters = require("./xmlcharacters");
var XRegExp = require("xregexp").XRegExp;
%}
//
// Terminology:
//
// - Character class: a square bracket construct in a regexp.
//
// - Positive character class: [...] without a leading caret.
//
// - Negative character class: [^...].
//
// - Positive match: a single character or range that a character must
//   match. (Negative character classes also contain positive
//   matches. In [^abc], "a", "b" and "c" are positive matches. The
//   character classe is negative but the individual characters are
//   positive.) The only thing this excludes are multi-char escapes
//   that match negatively like \S and \D.
//
// - Positive version of a multi-char escape: defined only for
//   multi-char escapes that expand to a negative character class; the
//   same character class but with the negating caret removed. So the
//   positive version of \S is \s, etc.
//
// The main transformation performed by this code is to deal with XML
// Schema regexp's multi character classes that have no class
// equivalent in JavaScript.
//
// Some simple identities:
//
// - [xy]  <-> (?:[x]|[y])
// - [^xy] <-> (?:(?![y])[^x])
// - (?![^x]) <-> (?=[x])
//
// Positive multi-char escape in a positive character class:
//
// - [x\s] -> (?:[x]|[ \t\r\n]) -> [x \t\r\n]
//
// Just expand the character class to its constituents.
//
// Negative multi-char escape in a positive character class:
//
// - [x\S] -> (?:[x]|[^ \t\r\n])
//
// - [x\S\D] -> (?:[x\D]|[^ \t\r\n])
//           -> (?:[x]|[^\p{Nd}]|[^ \t\r\n])
//
// So we output the positive matches in the class in one positive
// character class, and ``or`` it with one negative character class
// per negative multi-char escape.
//
// Positive multi-char escape in negative character class:
//
// - [^x\s] -> (?:(?![ \t\r\n])[^x])
//          -> [^x \t\r\n]
//
// Just expand the multi-char escape to its constituents.
//
// Negative multi-char escape in negative character class:
//
// - [^x\S] -> (?:(?![^ \t\r\n])[^x])
//          -> (?:(?=[ \t\r\n])[^x])
//
// - [^x\S\D] -> (?:(?![\S\D])[^x])
//            -> (?:(?![\S]|[\D])[^x])
//            -> (?:(?=[ \t\r\n\p{Nd}])[^x])
//
// So we output the positive matches in the class in one negative
// character class, and put a positive lookahead in front with a
// positive character class that matches the positive version of the
// negative multi-char escapes.
//
// Subtractions:
//
// -  [abcd-[bc]] -> (?:(?![bc])[abcd])
// -  [ad-[bc]]   -> (?:(?![bc])[ad])
// -  [abcd-[bc-[c]] -> (?:(?![bc-[c]])[abcd])
//                   -> (?:(?!(?![c])[bc])[abcd])
// -  [abcd-[^a]] -> (?:(?![^a])[abcd])

%lex

%x QUANTITY
%x CHARCLASS
%%

<QUANTITY>[0-9]       return 'NUMBER';
<QUANTITY>","         return ',';
<QUANTITY>"}"         {this.popState(); return '}';}


<INITIAL,CHARCLASS>"[^"      {this.begin('CHARCLASS'); return '[^';}
<INITIAL,CHARCLASS>"["       {this.begin('CHARCLASS'); return '[';}
<INITIAL,CHARCLASS>\\[-nrt\|.?*+(){}[\]^] return 'SINGLECHARESC';
<INITIAL,CHARCLASS>\\[sSiIcCdDwW]         return 'MULTICHARESC';
<CHARCLASS>\-(?=\[)   return 'CLASSSUBTRACTION';
<CHARCLASS>"-"        return '-';
//<CHARCLASS>[^[\]]   return 'XMLCHARINCDASH';
<CHARCLASS>[^-[\]]    return 'XMLCHAR';
<CHARCLASS>"]"        {this.popState(); return ']';}

"("                   return '(';
"|"                   return '|';
")"                   return ')';
"*"                   return '*';
"+"                   return '+';
"?"                   return '?';
"{"                   {this.begin('QUANTITY'); return '{';}
"}"                   return '}';
"]"                   return ']';
"^"                   return '^';
\\p\{.*?\}            return 'CATESC';
\\P\{.*?\}            return 'COMPLESC';
"."                   return 'WILDCARDESC';
<<EOF>>               return 'EOF';
[^\\]                 return 'CHAR';

/lex

%{
// We use the name ``Salve`` to help avoid potential
// clashes. ``ParsingError`` seems too risky.
function SalveParsingError(msg) {
    // This is crap to work around the fact that Error is a terribly
    // designed class or prototype or whatever. Unfortunately the
    // stack trace contains an extra frame.
    var err = new Error(msg);
    this.name = "SalveParsingError";
    this.stack = err.stack;
    this.message = err.message;
}

SalveParsingError.prototype = new Error();

// This will serve as a replacement for the default parseError method on
// the parser.
function parseError(str, hash) {
    throw new SalveParsingError(str);
}

// Export this error.
if (typeof exports !== 'undefined')
    exports.SalveParsingError = SalveParsingError;
else
    parser.SalveParsingError = SalveParsingError;


var xml_Name_Char = xmlcharacters.xml_Name_Char;
var xml_Letter = xmlcharacters.xml_Letter;

// Maintain a group state.
var group_state = [];
var needs_xregexp = false;

function unshift_group_state(negative) {
     group_state.unshift({negative: negative,
                         captured_multi_char: []
                        });
}

var multi_char_escapes_in_group = {
    "\\s": " \\t\\n\\r",
    "\\S": "^ \\t\\n\\r",
    "\\i": "" + xml_Letter + "_:",
    "\\I": "^" + xml_Letter + "_:",
    "\\c": "" + xml_Name_Char,
    "\\C": "^" + xml_Name_Char,
    "\\d": "\\p{Nd}",
    "\\D": "^\\p{Nd}",
    "\\w": "^\\p{P}\\p{Z}\\p{C}",
    "\\W": "\\p{P}\\p{Z}\\p{C}"
};

var multi_char_escapes = [];
for(var i in multi_char_escapes_in_group) {
    if (!multi_char_escapes_in_group.hasOwnProperty(i))
       continue;
    multi_char_escapes[i] = "[" + multi_char_escapes_in_group[i] + "]";
}

%}

/* operator associations and precedence */

%left '|'

%start start
%parse-param output_type

%% /* language grammar */

start
    : input
    {
        // Overwrite the parseError method with our own. NOTE: Our own
        // method does not allow recovering from recoverable parsing
        // errors.
        this.parseError = parseError;
        output_type = output_type || "re";
        switch(output_type) {
        case "string":
            return $1;
        case "re":
            var constructor = (needs_xregexp ? XRegExp : RegExp);
            return new constructor($1);
        default:
            throw new Error("unsupported output type: " + output_type);
        }
    }
    ;

input
    : EOF -> '^$'
    | regexp EOF -> '^' + $1 + '$'
    ;

regexp
    : branch
    | branch '|' regexp -> $1.concat($2, $3)
    ;

branch
    : piece
    | branch piece -> $1 + $2
    ;

piece
    : atom
    | atom quantifier -> $1 + $2
    ;

quantifier
    : '?'
    | '*'
    | '+'
    | '{' quantity '}' -> $1.concat($2, $3)
    ;

quantity
    : NUMBER
    | NUMBER ',' NUMBER -> $1.concat(',', $3)
    | NUMBER ',' -> $1.concat($2)
    ;

atom
    : CHAR
    | charClass
    | '(' regexp ')' -> '(?:' + $2 + $3
    ;

charClass
    : charClassEsc | charClassExpr | WILDCARDESC
    ;

charClassExpr
    : charClassExprStart charGroup ']'
        {
            var state = group_state.shift();
            var captured_multi_char =
                    state.captured_multi_char;

            var subtraction = state.subtraction ?
                    ("(?!" +  state.subtraction + ")") : "";
            if (captured_multi_char.length !== 0) {
                var out = ["(?:", subtraction];
                if (state.negative) {
                    out.push("(?=[");
                    for(var i = 0; i < captured_multi_char.length; ++i)
                        out.push(multi_char_escapes_in_group[
                            captured_multi_char[i]].slice(1));
                    out.push("])");
                }
                else {
                    for(var i = 0; i < captured_multi_char.length; ++i)
                        out.push("[",
                                 multi_char_escapes_in_group[
                                     captured_multi_char[i]],
                                 "]|");
                }
                out.push($1, $2, $3, ")");
                $$ = out.join("");
            }
            else
                $$ = (subtraction !== "") ?
                   "(?:" + subtraction + $1.concat($2, $3) + ")":
                   $1.concat($2, $3);
        }
    ;

// We have to break it this way because Jison does not support actions
// in mid-rule.

charClassExprStart
    : '['
        {
            unshift_group_state(false);
            $$ = $1;
        }
    | '[^'
        {
            unshift_group_state(true);
            $$ = $1;
        }
    ;

charGroup
    : posCharGroups | charClassSub
    ;

posCharGroups
    : posCharGroup
    | posCharGroups posCharGroup -> $1 + $2
    ;

posCharGroup
    : charClassEsc
    | charRange
    ;

charClassSub
    : posCharGroups CLASSSUBTRACTION charClassExpr
        {
            $$ = $1;
            group_state[0].subtraction = $3;
        }
    ;

charRange
    : seRange | '-'
    ;

seRange
    : charOrEsc '-' charOrEsc -> $1.concat($2, $3)
    | charOrEsc
    ;

charOrEsc
    : XMLCHAR | SingleCharEsc
    ;

charClassEsc
    : SINGLECHARESC
    | MULTICHARESC
    {
        if (group_state.length) {
            var repl = multi_char_escapes_in_group[$1]
            if (repl.charAt(0) === "^") {
                group_state[0].captured_multi_char.push($1);
                $$ = "";
            }
            else
                $$ = repl;
        }
        else
            $$ = multi_char_escapes[$1]
    }
    | CATESC
    {
        needs_xregexp = true;
        $$ = $1;
    }
    | COMPLESC
    {
        needs_xregexp = true;
        $$ = $1;
    }
    ;
