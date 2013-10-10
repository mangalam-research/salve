.. image:: https://travis-ci.org/mangalam-research/salve.png

Please note that Github currently does not implement all
reStructuredText directives, so some links in this readme
may not work correctly when viewed there.

Release History
===============

This section covers only salient changes.

* 0.14.0 changes how rng-to-js.xsl generates its output. See the
  section on `rng-to-js.xsl`__. Although salve still supports the old
  output, I strongly recommend running ``salve-simplify`` and
  ``xsltproc`` with ``rng-to-js.xsl`` to regenerate the JSON that
  encodes your schema. You can easily get a file which is one order of
  magnitude smaller than those produced by earlier versions of salve.

  __ rng_to_xsl_

* 0.13.0 adds name-resolving facilities to salve. See the
  documentation on ``enterContext`` and `associated events`__ below.

__ Events_

* 0.12.0 introduces a major API change. Whereas ``Walker.fireEvent()``
  and ``Walker.end()`` used to return ``true`` when there was no
  validation error, they now return ``false`` instead. This makes
  differentiating between error conditions and an absence of errors
  easier. (If the return value is interpreted as the boolean ``true``
  then there is an error, otherwise there is no error. Previously, one
  would have to test the return value for identity with the value
  ``true``, which is more verbose.)

Introduction
============

Salve (Schema-Aware Library for Validation and Edition) is a
JavaScript library which implements a validator able to validate an
XML document on the basis of a subset of Relax NG (RNG). It is developed
as part of the Buddhist Translators Workbench. It can be seen in
action in `wed <https://github.com/mangalam-research/wed>`_.

Plans are to support as much Relax NG as possible but for now salve
has, by conscious design, the following limitations:

* Does not support ``<interleave>``.
* Does not support ``<anyName>``.
* Does not support ``<except>``.
* Does not support ``<nsName>``.
* Treats all attributes as if they were specified to contain text of
  any length, format, etc. (All attributes accept any text
  whatsoever.)

At the moment the library is able to know that a document is valid
according to the schema it has received. (But keep in mind the
provision above regarding attributes.)

A full validation solution has the following components:

* A tokenizer: responsible for recognizing XML tokens, tag names, tag
  delimiters, attribute names, attribute values, etc.

* A parser: responsible for converting tokens to validation events
  (see below) and optionally managing the mapping between namespace
  prefixes and namespace URIs.

* A validator: responsible for checking that validation events are
  valid against a schema, telling the parser what is possible at the
  current point in validation, and telling the parser what is possible
  generally speaking (e.g., what namespace uris are used in the
  schema). This is what salve offers, **and only this!**

A good example of this division of labor can be found in
`<lib/salve/parse.js>`_ and in the test suite. In both cases the
tokenizer function is performed by ``sax``, and the parser function is
performed by a parser object that ``sax`` creates, customized to call
salve's ``Walker.fireEvent()``.

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
* semver-sync (installed so that the ``semver-sync`` executable
  is in your path).

Please see the `<package.json>`_ file for details regarding these
dependencies. The ``salve-simplify`` script requires that ``xmllint``
and ``xsltproc`` be installed on your system.

If you want to contribute to salve, your code will have to pass the
checks listed in `<.glerbl/repo_conf.py>`_. So you either have to
install glerbl to get those checks done for you or run the checks
through other means. See Contributing_.

Testing
=======

Running the following command from the root of salve will install the
dependencies required for testing and will run the tests::

    $ npm test

Or you may bypass npm with this command::

    $ make test

Running ``mocha`` directly also works but you may run the test against
stale code whereas ``make test`` always runs a build first.

Building
========

Run::

    $ npm build

Or::

    $ make

This will create a `<build>`_ subdirectory in which the JavaScript
necessary to validate XML files against a prepared Relax NG schema. (See
below for how preparation happens.) You could copy what is in `<build>`_
to a server to serve these files to a client that would then perform
validation. Future releases will include automatic support for
minified versions of salve.

Contributing
============

Contributions must pass the commit checks turned on in
`<.glerbl/repo_conf.py>`_. Use ``glerbl install`` to install the
hooks. Glerbl itself can be found at
https://github.com/lddubeau/glerbl. It will eventually make its way to
the Python package repository so that ``pip install glerbl`` will
work.

Basic Usage
===========

An RNG schema must be prepared before it can be used by salve. The
first step is to simplify the schema. The ``bin`` subdirectory
contains a rudimentary shell script. (If you are using Windows you are
on your own; contributions welcome.) It can be used like this::

    $ bin/salve-simplify [input] [output]

.. _rng_to_xsl:

The ``[input]`` parameter should be the RNG to simplify. The ``[output]``
parameter should be where to save the simplification. The output must
then be converted to JavaScript code::

    $ xsltproc lib/salve/rng-to-js.xsl [simplified rng] > [js]

This example uses ``xsltproc`` but any XSLT processor able to process
XSLT 1.0 would work. The ``[simplified rng]`` parameter is the result
of the earlier simplify pass. The ``[js]`` parameter is where you want
to save the resulting JavaScript. (Actually, the simplified RNG is
converted to JSON. Generally speaking JSON is not a subset of
JavaScript but in this instance, the JSON produced is a subset, so
calling it JavaScript is not wrong.)

.. _element paths:

Before version 0.14 ``rng-to-js.xsl`` by default included information
which made it easy to determine where each JavaScript object
modeling the original RNG came from. (Each object had path information
pointing to the location of the corresponding element in the
simplified RNG.) However, this information is useful only for
debugging salve and its associated software. Starting with version
0.14 ``rng-to-js.xsl`` no longer outputs this information by
default. It has to be turned on by passing ``--param output-paths
true()`` to ``xsltproc``. (Most likely the string ``true()`` must be
quoted to avoid shell interpretation. Or you could pass anything that
XSLT considers to be "true".) This change reduces the size of a
JavaScript file created for a vanilla TEI schema by a factor of more
than 4.

Version 0.14 also changes the structure of the output of
``rng-to-js.xsl``. See `File Format`_ for more details.

Turning to actual code, a typical usage scenario would be as follows::

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
``fireEvent()`` on the ``walker``.

The file `<lib/salve/parse.js>`_ contains an example of a rudimentary
parser runnable in Node.js::

    $ node parse.js [rng as js] [xml to validate]

The ``[rng as js]`` parameter is the RNG, simplified and converted to
JavaScript. The ``[xml to validate]`` parameter is the XML file to
validate against the RNG.

Remember to call the ``end()`` method on your walker at the end of
validation to make sure that there are no unclosed tags, etc.

Events
======

The parser is responsible for calling ``fireEvent()`` on the walker returned
by the tree created from the RNG. (See above.) The events currently
supported are defined below:

``Event("enterStartTag", uri, local-name)``
  Emitted when encountering the beginning of a start tag (the string
  "<tag", where "tag" is the applicable tag name) or the equivalent. The
  qualified name should be resolved to its uri and local-name
  components.

``Event("leaveStartTag")``
  Emitted when encountering the end of a start tag (the string ">") or
  equivalent.

``Event("endTag", uri, local-name)``
  Emitted when encountering an end tag.

``Event("attributeName", uri, local-name)``
  Emitted when encountering an attribute name.

``Event("attributeValue", value)``
  Emitted when encountering an attribute value

``Event("text")``
  Emitted when encountering text.

``Event("enterContext")``
  Emitted when entering a new namespace context.

``Event("leaveContext")``
  Emitted when leaving a namespace context.

``Event("definePrefix", prefix, uri)``
  Emitted when defining a namespace prefix.

Looking at an XML document as a set of DOM nodes, the set of events
supported by salve might seem strange. Why would one need an
``enterStartTag`` event and a ``leaveStartTag`` event given that if the
document **can** be modeled using DOM there cannot ever be an
``enterStartTag`` event without a corresponding ``leaveStartTag``
event? The reason for the set of events supported is that salve is
designed to handle not only XML modeled as a DOM tree but also XML
parsed as a text string being dynamically edited. The best and closest
example of this would be what nxml-mode does in Emacs. If the user
starts a new document and types only the following into their editing
buffer::

    <html

then what the parser has seen by the time it gets to the end of the
buffer is an ``enterStartTag`` event with an empty uri and the
local-name "html". The parser will not see a ``leaveStartTag`` event
until the user enters the greater-than symbol ending the start tag.

If there is already functionality allowing the resolution of namespace
prefixes that allows you to resolve names to their uri/local-name
parts, you can use salve without ever emitting ``enterContext``,
``leaveContext`` and ``definePrefix``. However, if you want to have
salve keep track of namespace prefixes, you must first call
``useNameResolver()`` on the walker you get from ``newWalker()``. Then
you must issue an ``enterContext`` each time you encounter a start tag
that defines namespaces and issue ``leaveContext`` when you encounter
its corresponding end tag. You must also issue ``definePrefix`` for
each prefix defined by the element. Example::

    <p xmlns="q" xmlns:foo="foons">...

would require issuing::

    Event("enterContext")
    Event("definePrefix", "", "q")
    Event("definePrefix", "foo", "foons")
    (Presumably, your code here would call resolveName("p") to determine
     what namespace p is in, which would yield the result "q".)
    Event("enterStartTag", "q", "p")

Note the order of the events. The new context must start before salve
sees the ``enterStartTag`` event because the way namespace works, a
start tag can declare its own namespace. So by the time
``enterStartTag`` is issued, salve must know what namespaces are
declared by the tag. If the events were not issued this way, then the
start tag ``p`` in the example would be interpreted to be in the
default namespace in effect **before** it started, which could be
other than ``q``. Similarly, ``leaveContext`` must be issued after the
corresponding ``endTag`` event.

For the lazy: it is possible to issue ``enterContext`` for each start
tag and ``leaveContext`` for each end tag irrespective of whether or
not the start tag declares new namespaces. The test suite does it this way.
Note, however, that performance will be affected somewhat because name
resolution will have to potentially search a deeper stack of contexts than
would be strictly necessary.

What determines whether or not you want to use the name resolver
included with salve is whether or not you need to use salve's cloning
facilities to record validation state. The namespaces that are in
effect at the point a walker is cloned are also part of the validation
state. If you have to use a name resolver that does not allow for
recording validation state, you can call ``useNameResolver`` on your walker
and use the facilities described here, or provide such functionality yourself.

Support for Guided Editing
==========================

Calling the ``possible()`` method on a walker will return the list of
valid ``Event`` objects that could be fired on the walker, given what
the walker has seen so far. Again, if the user is editing a document
which contains only the text::

    <html

and hits a function key which makes the editor call ``possible()``, then
the editor can tell the user what attributes would be possible to add
to this element. In editing facilities like nxml-mode in Emacs this is
called completion. Similarly, once the start tag is ended by adding
the greater-than symbol::

   <html>

and the user again asks for possibilities, calling ``possible()`` will
return the list of ``Event`` objects that could be fired. Note here that
it is the responsibility of the editor to translate what salve returns
into something the user can use. The ``possible()`` function returns
only ``Event`` objects, in the exact same form as what must be passed to
``fireEvent()``.

Editors that would depend on salve for guided editing would most
likely need to use the ``clone()`` method on the walker to record the
state of parsing at strategic points in the document being
edited. This is to avoid needless reparsing. How frequently this
should happen depends on the structure of the editor. The ``clone()``
method and the code it depends on has been optimized since early
versions of salve, but it is possible to call it too often, resulting
in a slower validation speed than could be attainable with less
aggressive cloning.

Documentation
=============

The code is documented using jsdoc3. The following command will
generate the documentation::

    $ make doc

Create a ``local.mk`` file that sets the variable ``JSDOC3`` to the
location of the jsdoc3 executable in your setup and ``RST2HTML``
points to the location of the rst2html executable. (Defaults are such
that Makefile will use your ``PATH`` to execute them.) The formatted
jsdoc3 will appear in the `<build/doc>`_ subdirectory, and the
`<README.html>`_ in the root of the source tree.

File Format
===========

When you simplify your RNG schema and pass it to ``rng-to-js.xsl`` for
conversion to JSON, you get a file which salve will use to create a
run-time representation of your schema when you call
``constructTree``. The file instructs salve on how to create this
memory representation.

Before 0.14 ``rng-to-js.xsl`` would generate a file with the following
structure::

    { "type": <object type>, "args": [...]}

The ``<object type>`` would be a string like ``"Choice"`` or
``"Group"`` indicating which constructor to use to build the
object. The ``args`` field would be a list of arguments to pass to the
constructor. These arguments were either primitive JSON objects
(integers, strings, arrays, etc.) or objects of the same format as
described above, with a ``type`` and ``args`` field. The problem with
this format is that it wastes a lot of space. We could call this
version 0 of salve's schema format.

Version 0.14 introduces a new format. This format has version
number 1. The new structure is::

    {"v":<version>,"o":<options>,"d":[...]}

The ``v`` field gives the version number of the data. Only version 1
exists for now. The ``o`` field is a bit field of options indicating
how the file was created. Right now the only thing it records is
whether or not `element paths`_ are present in the generated
file. More on this later. The ``d`` field contains the actual
schema. Each item in it is of the form::

   [<array type>, ...]

The first element ``<array type>`` determines how to interpret the
array. The array type could indicate that the array should be
interpreted as an actual array or that it should be interpreted as an
object of type ``Group`` or ``Choice``, etc. If it is an array, then
``<array type>`` is discarded and the rest of the array is the
converted array. If it is another type of object then again the
``<array type>`` is discarded and an object is created with the rest
of the array as its constructor's parameters. All the array's elements
after ``<array type>`` can be JSON primitive types, or arrays to be
interpreted as actual arrays or as objects as described above.

It is likely that salve will always support version 0 of the format
because it is useful for debugging.

License
=======

Original Code
-------------

Code completely original to salve is released under the `Mozilla Public
License version 2.0 <http://www.mozilla.org/MPL/2.0/>`_. Copyright Mangalam
Research Center for Buddhist Languages, Berkeley, CA.

RNG Simplification Code
-----------------------

The RNG simplification transformation files are adapted from `Nicolas
Debeissat's code
<https://code.google.com/p/jsrelaxngvalidator/>`_. They are covered by
the `CeCILL license <http://www.cecill.info/index.en.html>`_. Some bugs have
been corrected and some changes made for salve. For the sake of simplicity,
these changes are also covered by the CeCILL license.

Credits
=======

Salve is designed and developed by Louis-Dominique Dubeau, Director of
Software Development for the Buddhist Translators Workbench project,
Mangalam Research Center for Buddhist Languages.

.. image:: https://secure.gravatar.com/avatar/7fc4e7a64d9f789a90057e7737e39b2a
   :target: http://www.mangalamresearch.org/

This software has been made possible in part by a Level I Digital Humanities
Start-up Grant and a Level II Digital Humanities Start-up Grant from the
National Endowment for the Humanities (grant numbers HD-51383-11 and
HD-51772-13). Any views, findings, conclusions, or recommendations expressed in
this software do not necessarily represent those of the National Endowment for
the Humanities.

.. image:: http://www.neh.gov/files/neh_logo_horizontal_rgb.jpg
   :target: http://www.neh.gov/

..  LocalWords:  fireEvent js chai semver json xmllint xsltproc npm
..  LocalWords:  RNG minified rng XSLT xsl constructTree newWalker mk
..  LocalWords:  xml enterStartTag uri leaveStartTag endTag nxml html
..  LocalWords:  attributeName attributeValue jsdoc Debeissat's API
..  LocalWords:  CeCILL tokenizer Makefile README boolean anyName RST
..  LocalWords:  nsName URIs uris enterContext leaveContext xmlns rst
..  LocalWords:  definePrefix useNameResolver foons resolveName HD
..  LocalWords:  args param TEI glerbl Github reStructuredText readme
..  LocalWords:  validator namespace RequireJS subdirectory DOM
..  LocalWords:  Dubeau Mangalam
