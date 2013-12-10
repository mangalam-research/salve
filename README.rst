.. image:: https://travis-ci.org/mangalam-research/salve.png

Please note that Github currently does not implement all
reStructuredText directives, so some links in this readme
may not work correctly when viewed there.

Introduction
============

Salve (Schema-Aware Library for Validation and Edition) is a
JavaScript library which implements a validator able to validate an
XML document on the basis of a subset of Relax NG (RNG). It is developed
as part of the Buddhist Translators Workbench. It can be seen in
action in `wed <https://github.com/mangalam-research/wed>`_.

Plans are to support as much Relax NG as possible but for now salve
has, by conscious design, the following limitations:

* Does not support ``<interleave>`` or ``<mixed>``.
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

Basic Usage
===========

A Relax NG schema must be prepared before it can be used by salve. The
``bin/`` subdirectory contains a shell script which can be used to
convert a Relax NG schema to the format salve wants. You can use the
``--help`` option to see the entire list of options available. Typical
usage is::

    $ salve-convert [input] [output]

The ``[input]`` parameter should be the Relax NG schema to
convert. The ``[output]`` parameter should be where to save the schema
once it is converted to JavaScript. (Actually, the simplified RNG is
converted to JSON. Generally speaking JSON is not a subset of
JavaScript but in this instance, the JSON produced is a subset, so
calling it JavaScript is not incorrect.)

.. note:: If you've ever used salve prior to version 0.15, know that
          ``salve-convert`` replaces both ``salve-simplify`` and the
          need to use ``rng-to-js.xsl`` manually.

.. _element paths:

Before version 0.14, the conversion process by default included
information which made it easy to determine where each JavaScript
object modeling the original RNG came from. (Each object had path
information pointing to the location of the corresponding element in
the simplified RNG.) However, this information is useful only for
debugging salve and its associated software. Starting with version
0.14 such information is no longer included by default. This change
reduces the size of a JavaScript file created for a vanilla TEI schema
by a factor of more than 4.

Version 0.14 also changes the structure of the file format that salve
uses by default. See `Schema File Format`_ for more details.

Version 0.15 further reduces the size of the generated files by
optimizing the size of the identifiers used by references and
definitions. With this optimization, the size of a run-of-the-mill TEI
schema used in testing was reduced by 35% compared to the same schema
in previous versions.

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
``fireEvent()`` on the ``walker``. Remember to call the ``end()``
method on your walker at the end of validation to make sure that there
are no unclosed tags, etc.

The file `<lib/salve/parse.js>`_ contains an example of a rudimentary
parser runnable in Node.js::

    $ node parse.js [rng as js] [xml to validate]

The ``[rng as js]`` parameter is the RNG, simplified and converted to
JavaScript. The ``[xml to validate]`` parameter is the XML file to
validate against the RNG.

Events
======

The parser is responsible for calling ``fireEvent()`` on the walker
returned by the tree created from the RNG. (See above.) The events
currently supported are defined below:

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

``Event("text", value)``
  Emitted when encountering text. This event must be fired **even** for
  all instances of text, including white space.

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
you must issue an ``enterContext`` event each time you encounter a
start tag that defines namespaces and issue ``leaveContext`` when you
encounter its corresponding end tag. You must also issue
``definePrefix`` for each prefix defined by the element. Example::

    <p xmlns="q" xmlns:foo="foons">...

would require issuing::

    Event("enterContext")
    Event("definePrefix", "", "q")
    Event("definePrefix", "foo", "foons")

Presumably, your code here would call resolveName("p") to determine
what namespace p is in, which would yield the result "q". ::

    Event("enterStartTag", "q", "p")

Note the order of the events. The new context must start before salve
sees the ``enterStartTag`` event because the way namespaces work, a
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

What determines whether or not you would want to use the name resolver
included with salve is whether or not you need to use salve's cloning
facilities to record validation state. The namespaces that are in
effect at the point a walker is cloned are also part of the validation
state. If you have to use a name resolver that does not allow for
recording validation state, you can call ``useNameResolver`` on your
walker and use the facilities described here, or provide such
functionality yourself.

Salve's Internals and Events
----------------------------

If you ever look at salve's internals be aware that as an
implementation convenience, patterns that accept ``text`` events also
accept ``attributeValue`` events. That is, ``fireEvent`` will accept
both. However, these elements will only return ``text`` as a possible
event. ``AttributeWalker`` is responsible to convert it to
``attributeValue``.

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

    $ grunt doc

You may need to create a ``local.grunt`` module to tell grunt where to
get jsdoc3 and rst2html. (Defaults are such that grunt will use a
jsdoc shipped with grunt-jsdoc, and will use your ``PATH`` to locate
rst2html.) The formatted jsdoc3 will appear in the `<build/api/>`_
subdirectory, and the `<README.html>`_ in the root of the source tree.

.. warning:: All the public interfaces of salve are available through
             the ``validate`` module. However, ``validate`` is a
             facade that exposes interfaces that are implemented in
             separate modules like ``patterns`` and ``formats``. The
             documentation documents interfaces where they are
             *implemented*. So if you look for
             ``validate.constructTree`` you will find it in
             ``formats``. There is currently no simple way to get
             jsdoc3 to expose these elements as being part of
             ``validate``.


Dependencies
============

Salve is packaged as a RequireJS module. So to use it in a browser
environment, you need to first load RequireJS and pass to RequireJS a
configuration that will allow it to find salve's code.

Loading salve in a Node.js environment requires installing the
following node package:

* node-amd-loader

Running ``salve-convert`` requires a Node.js environment and the
following node modules:

* argparse
* temp

This script also requires that ``xmllint`` and ``xsltproc`` be
installed on your system.

Running salve's tests **additionally** requires that the development
dependencies be installed. Please see the `<package.json>`_ file for
details regarding these dependencies. Note that the following packages
must be installed so that their executables are in your path:

* grunt-cli (to launch grunt)
* semver-sync

If you want to contribute to salve, your code will have to pass the
checks listed in `<.glerbl/repo_conf.py>`_. So you either have to
install glerbl to get those checks done for you or run the checks
through other means. See Contributing_.

Build System
============

Salve uses grunt. Salve's `<Gruntfile.js>`_ gets the values for its
configuration variables from three sources:

* Internal default values.

* From an optional ``local.grunt.js`` module that can override the
  internal defaults.

* From command line options that can override everything above.

The variables that can be set are:

+-------------------+----------------------------------------------------------+
|Name               | Meaning                                                  |
+===================+==========================================================+
|mocha_grep         | --grep parameter for Mocha                               |
+-------------------+----------------------------------------------------------+
|rst2html           | rst2html command to run                                  |
+-------------------+----------------------------------------------------------+
|jsdoc3             |jsdoc3 command to run                                     |
+-------------------+----------------------------------------------------------+
|jsdoc_private      |jsdoc should produce documentation for private entities.  |
|                   |true by default.                                          |
+-------------------+----------------------------------------------------------+
|jsdoc3_template_dir|Location of the jsdoc default template                    |
+-------------------+----------------------------------------------------------+

Note that when used on the command line, underscores become dashes, thus
``--mocha-grep`` and ``--jsdoc-private``.

The ``local.grunt.js`` file is a module. You must export values
like this::

    exports.jsdoc3 = "/usr/local/blah/jsdoc"

Testing
=======

Running the following command from the root of salve will install the
dependencies required for testing and will run the tests::

    $ npm test

Or you may bypass npm with this command::

    $ grunt test

Running ``mocha`` directly also works, but this may run the test against
stale code, whereas ``grunt test`` always runs a build first.

Building
========

If you are using salve in Node, there is no need to build. Building is
necessary only to create a deployable file tree, or if you want to run
tests.

Run::

    $ grunt

This will create a `<build/>`_ subdirectory in which the JavaScript
necessary to validate XML files against a prepared Relax NG
schema. You could copy what is in `<build/>`_ to a server to serve
these files to a client that would then perform validation. Future
releases will include automatic support for minified versions of
salve.

Contributing
============

Contributions must pass the commit checks turned on in
`<.glerbl/repo_conf.py>`_. Use ``glerbl install`` to install the
hooks. Glerbl itself can be found at
https://github.com/lddubeau/glerbl. It will eventually make its way to
the Python package repository so that ``pip install glerbl`` will
work.

Schema File Format
==================

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

The first element, ``<array type>``, determines how to interpret the
array. The array type could indicate that the array should be
interpreted as an actual array or that it should be interpreted as an
object of type ``Group`` or ``Choice``, etc. If it is an array, then
``<array type>`` is discarded and the rest of the array is the
converted array. If it is another type of object then again the
``<array type>`` is discarded and an object is created with the rest
of the array as its constructor's parameters. All the array's elements
after ``<array type>`` can be JSON primitive types, or arrays to be
interpreted as actual arrays or as objects as described above.

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
the `CeCILL license <http://www.cecill.info/index.en.html>`_. Multiple
bugs in them have been corrected, some minor and some major, and some
changes have been made for salve. For the sake of simplicity, these
changes are also covered by the CeCILL license.

Credits
=======

Salve is designed and developed by Louis-Dominique Dubeau, Director of
Software Development for the Buddhist Translators Workbench project,
Mangalam Research Center for Buddhist Languages.

Jesse Bethel maintains salve's documentation, and migrated salve's
build system from Make to Grunt.

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
..  LocalWords:  definePrefix useNameResolver foons resolveName HD NG
..  LocalWords:  args param TEI glerbl Github reStructuredText readme
..  LocalWords:  validator namespace RequireJS subdirectory DOM cli
..  LocalWords:  Dubeau Mangalam argparse Gruntfile Bethel unclosed
..  LocalWords:  runnable namespaces reparsing amd executables usr
..  LocalWords:  deployable schemas LocalWords api dir
