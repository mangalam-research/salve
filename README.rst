Introduction
============

Salve (Schema-Aware Library for Validation and Edition) is a
JavaScript library which implements a validator able to validate an
XML document on the basis of a subset of RelaxNG. Plans are to support
as much RelaxNG as possible but for now salve has, by conscious
design, the following limitations:

* Does not support <interleave>.
* Does not support <anyName>.
* Does not support <except>.
* Treats all attributes as if they were specified to contain text of any length, format, etc. (All attributes accept any text whatsoever.)

At the moment the library is able to know that a document is valid
according to the schema it has received. (But keep in mind the
provision above regarding attributes.) However, right now is not very
good at reporting problems. It will emit errors but the errors might
not be anything that a regular person would find comprehensible.

A full validation solution has the following components:

* A tokenizer: responsible for recognizing XML tokens, tag names, tag
  delimiters, attribute names, attribute values, etc.

* A parser: responsible for converting tokens to validation events
  (see below) and managing the mapping between namespace prefixes and
  namespace URIs. Salve works with namespaces if there is logic
  outside of salve converting all qualified names to uri/local-name
  pairs.

* A validator: responsible for checking that validation events are
  valid against a schema and telling the parser what is possible at
  the current point in validation. This is what salve offers, **and
  only this!**

A good example of this division of labor can be found in
`lib/salve/parse.js` and in the test suite. In both cases the tokenizer
function is performed by `sax`, and the parser function is performed
by a parser object that `sax` creates, customized to call
`fireEvent()`.

Dependencies
============

Salve is packaged as a RequireJS module. So to use it in a browser
environment, you need to first load RequireJS and pass to it a
configuration that will allow it to find salve's code.

Loading salve in a Node.js environment requires installing the
following node package:

* node-amd-loader

Running salve's tests **additionally** requires the following node
packages:

* mocha
* chai
* sax

Please see the package.json file for details regarding these
dependencies. The `salve-simplify` script requires that `xmllint` and
`xsltproc` be installed on your system.

Testing
=======

Running the following command from the root of salve will install the
dependencies required for testing and will run the tests::

    $ npm test

Or you may bypass npm with this command::

    $ mocha 

Building
========

Run::

    $ npm build

Or::

    $ make

This will create a `build` subdirectory in which the JavaScript
necessary to validate XML files against a prepared RNG schema. (See
below for how preparation happens.) You could copy what is in build to
a server to serve these files to a client that would then perform
validation.

Basic Usage
===========

An RNG schema must be prepared before it can be used by salve. The
first step is to simplify the schema. The `bin` subdirectory
contains a rudimentary shell script. (If you are using Windows you are
on your own; contributions welcome.) It can be used like this::

    $ bin/salve-simplify [input] [output]

The `[input]` parameter should be the RNG to simplify. The `[output]`
parameter should be where to put the simplification. The output must
then be converted to JavaScript code::

    $ xsltproc tools/rng-to-js.xsl [simplified rng] > [js]

This example uses xsltproc but any XSLT processor able to process XSLT
1.0 would work. The `[simplified rng]` parameter is the result of the
earlier simplify pass. The `[js]` parameter is where you want to save
the resulting JavaScript.

**SECURITY NOTE**: The way salve currently works, the JavaScript
produced by rng-to-js.xsl is `eval`-ed by validate.js. It would be
trivial to include hostile code into that file. Use at your own risk.

Code-wise, a typical usage scenario would be as follows::

    // Import the validation module
    var validate = require("./lib/salve/validate");

    // Source should be a string which contains the entire
    // output of having simplified the original RNG and converted it to JS.
    // This would be read from [js] in the example of xsltproc invocation 
    // above.
    var tree = validate.constructTree(source);

    // Get a walker on which to fire events.
    var walker = tree.newWalker();

Then the code that parses the XML file to be validated should call
`fireEvent()` on the `walker`.

The file `lib/salve/parse.js` contains an example of a rudimentary parser
runnable in Node.js::

    $ node parse.js [rng as js] [xml to validate]

The `[rng as js]` parameter is the RNG, simplified and converted to
JavaScript. The `[xml to validate]` parameter is the XML file to
validate against the RNG.

Remember to call the `end()` method on your walker at the end of
validation to make sure that there are no unclosed tags, etc.

Events
======

Looking at an XML document as a set of DOM nodes, the set of events
supported by salve might seem strange. Why would one need an
`enterStartTag` event and a `leaveStartTag` event given that if the
document can be modeled using DOM there cannot ever be an
`enterStartTag` even without a corresponding `leaveStartTag`
event. The reason for the set of events supported is that salve is
designed to handle not only XML modeled as a DOM tree but also XML
parsed as text being dynamically edited. The best and closest example
of this would be what nxml-mode does in Emacs. If the user starts a
new document and types only the following into their editing buffer::

    <html

then what the parser has seen by the time it gets to the end of the
buffer is an `enterStartTag` event with an empty uri and the
local-name "html". The parser will not see a `leaveStartTag` event
until the user enters the greater-than symbol ending the start tag.

The events currently supported are defined below:

`Event("enterStartTag", uri, local-name)` 
  Emitted when encountering the beginning of a start tag (the string
  "<tag", where "tag" is whatever tag name) or the equivalent. The
  qualified name should be resolved to its uri and local-name
  components.

`Event("leaveStartTag")`
  Emitted when encountering the end of a start tag (the string ">") or
  equivalent.

`Event("endTag", uri, local-name)`
  Emitted when encountering an end tag.

`Event("attributeName", uri, local-name)`
  Emitted when encountering an attribute name.

`Event("attributeValue", value)`
  Emitted when encountering an attribute value

`Event("text")`
  Emitted when encountering text.

Support for Guided Editing
==========================

Calling the `possible()` method on a walker will return the list of
valid `Event` objects that could be fired on the walker, given what
the walker has seen so far. Again, if the user is editing a document
which contains only the text::

    <html

and hits a function key which makes the editor call `possible()`, then
the editor can tell the user what attributes would be possible to add
to this element. In editing facilities like nxml-mode in Emacs this is
called completion. Similarly, once the start tag is ended by adding
the greater-than symbol::

   <html>

and the user again asks for possibilities, calling `possible()` will
return the list of `Event` objects that could be fired. Note here that
it is the responsibility of the editor to translate what salve returns
into something the user can use. The `possible()` function returns
only `Event` objects in the exact same form as what must be passed to
`fireEvent()`.

Editors that would depend on salve for guided editing would most
likely need to use the `clone()` method on the walker to record the
state of parsing at strategic points in the document being
edited. This is to avoid reparsing a file needlessly. In an editor
like Ace for instance, it would be prudent to record the state of
parsing at the beginning of a new line. So if the user edits line 94
of a 100 line file, the parser can restart parsing at line 94 instead
of having to start from the first line.

There is currently no example code to nicely illustrate how this
works. However, the testing code in `test/validation.js` does call
`possible()` repeatedly to test this function and also simulates
restarting parsing in the middle of a document by means of cloning the
walker.

Documentation
=============

The code is documented using jsdoc3. The following command will
generate the documentation::

    $ jsdoc -r lib

The formatted documents will appear in the `out` subdirectory. 

License
=======

Original Code
-------------

Code completely original to salve is released under the Mozilla Public
License version 2.0. Copyright Mangalam Research Center for Buddhist
Languages, Berkeley, CA.

RNG Simplification Code
-----------------------

The rng simplification transformation files are adapted from Nicolas
Debeissat's code at:

https://code.google.com/p/jsrelaxngvalidator/

They are covered by the CeCILL license:

http://www.cecill.info

Some bugs have been corrected and some changes made for salve. For the
sake of simplicity, these changes are also covered by the CeCILL
license.

