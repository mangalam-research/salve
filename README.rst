.. image:: https://travis-ci.org/mangalam-research/salve.png

.. note:: Github currently does not implement all reStructuredText
          directives, so some links in this readme may not work
          correctly when viewed there.

.. note:: If you are reading this file from the set of files installed
          by ``npm install``, please keep in mind that the npm package
          only includes what is strictly necessary to *use* salve. For
          instance, the test suite is not included in the npm package
          package. This documentation, however, covers *all* of
          salve. Consequently, it may refer to items you do not have.

Introduction
============

Salve (Schema-Aware Library for Validation and Edition) is a
JavaScript library which implements a validator able to validate an
XML document on the basis of a subset of Relax NG (RNG). It is developed
as part of the Buddhist Translators Workbench. It can be seen in
action in `wed <https://github.com/mangalam-research/wed>`_.

Salve is currently used to validate schemas generated from the `TEI
standard <http://www.tei-c.org/>`_ and schemas derived from this
standard. We've used salve with multiple different schemas generated
from the TEI standard and never ran into a problem caused by the
limitations that salve has. It is possible, however, that using a TEI
module that *we* do not use, could cause issues. Plans are to support
as much Relax NG as possible but for now salve has, by conscious
design, the following limitations:

* Support for XML Schema ``float`` and ``double`` types is not
  thorough. Simple value comparisons work but if you put ``NaN`` or
  ``INF`` or ``-INF`` in parameters like ``maxInclusive``, etc., it is
  likely that salve won't behave correctly. Salve furthermore does not
  verify that the numerical values fit within the limits of ``float``
  or ``double``.

* XML Schema types ``ENTITY`` and ``ENTITIES`` are treated as ``string``.

* None of the XML Schema types that deal with time allow the
  parameters ``minInclusive``, ``minExclusive``, ``maxInclusive`` and
  ``maxExclusive``.

* Does not support ``<anyName>``.

* Does not support ``<except>``.

* Does not support ``<nsName>``.

* Text meant to be contiguous must be passed to salve in one event. In
  particular, comments and processing instructions are invisible to
  salve. (There are no events for them.) Take for instance, this XML:

      ab&lt;!-- blah -->cd

  In a DOM interpretation, you'd have two text nodes separated by a
  comment node. For the purpose of Relax NG validation, this is a
  single string "abcd" and should be passed to salve as "abcd" and not
  as the two strings "ab" and "cd".

If someone wishes to use salve but needs support for any of the
features that are missing, they may ask for the feature to be
added. Submit an issue on github for it. If you do submit an issue to
add a feature please make a case for it.

Even better, if someone wishes for a feature to be added, they can
contribute code to salve that will add the feature they want. A solid
contribution is more likely to result in the feature being speedily
added to salve than asking for us to add the feature, and waiting
until we have time for it.

At the moment the library is able to know that a document is valid
according to the schema it has. A full validation solution has the
following components:

* A tokenizer: responsible for recognizing XML tokens, tag names, tag
  delimiters, attribute names, attribute values, etc.

* A parser: responsible for converting tokens to validation events
  (see below).

* A well-formedness checker. Please check the `Events`_ section for
  more information about what this concretely means.

* A validator: responsible for checking that validation events are
  valid against a schema, telling the parser what is possible at the
  current point in validation, and telling the parser what is possible
  generally speaking (e.g., what namespace uris are used in the
  schema). **This is what salve offers, and only this!**

.. note:: If you are looking at the source from github, executables
          cannot be executed from `<bin>`__. They can be executed
          after a build from `<build/dist/bin>`_. If you are looking
          at the npm installation, then the files in `<bin>`__ are
          those you want to execute.

A good example of this division of labor can be found in
`<bin/parse.js>`_ and in the test suite. In both cases the
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

The file `<bin/parse.js>`_ (included in salve's source but not in the
npm module) contains an example of a rudimentary parser runnable in
Node.js::

    $ node parse.js [rng as js] [xml to validate]

The ``[rng as js]`` parameter is the RNG, simplified and converted to
JavaScript. The ``[xml to validate]`` parameter is the XML file to
validate against the RNG.

Events
======

Salve expects that the events it receives are those that would be
emitted when validating a **well-formed document**. That is, passing
the events of a document that is malformed will cause salve to behave
in an undefined manner. (It may crash. It may generate misleading
errors. It may not report any errors.) This situation is due to the
fact that salve is currently developed in a context where the
documents it validates cannot be malformed (because they are
represented as DOM trees). So salve contains no functionality to
handle problems with well-formedness. Multiple strategies are possible
for using salve in a context where well-formedness is not
guaranteed. A primitive parser could abort as soon as evidence
surfaces that the document is malformed. A more sophisticated parser
could process the problematic structure so as to generate an error but
give salve something well-formed. For instance if parsing
``<foo></baz>``, such parser could emit an error on encountering
``</baz>`` and replace the event that would be emitted for ``</baz>``
with what would be emitted for ``</foo>``, and salve will happily
validate it.

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
  Emitted when encountering text. This event must be fired for
  all instances of text, **including** white space.

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
example of this would be what ``nxml-mode`` does in Emacs. If the user
starts a new document and types only the following into their editing
buffer::

    <html

then what the parser has seen by the time it gets to the end of the
buffer is an ``enterStartTag`` event with an empty uri and the
local-name "html". The parser will not see a ``leaveStartTag`` event
until the user enters the greater-than symbol ending the start tag.

You must issue an ``enterContext`` event each time you encounter a
start tag that defines namespaces and issue ``leaveContext`` when you
encounter its corresponding end tag. You must also issue
``definePrefix`` for each prefix defined by the element. Example::

    <p xmlns="q" xmlns:foo="foons">...

would require issuing::

    Event("enterContext")
    Event("definePrefix", "", "q")
    Event("definePrefix", "foo", "foons")

Presumably, after firing the events above your code would call
``resolveName("p")`` on your walker to determine what namespace ``p``
is in, which would yield the result ``"q"``. And then it would fire
the ``enterStartTag`` event with ``q`` as the namespace and ``p`` as
the local name of the tag::

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

Support for Guided Editing
==========================

Calling the ``possible()`` method on a walker will return the list of
valid ``Event`` objects that could be fired on the walker, given what
the walker has seen so far. Again, if the user is editing a document
which contains only the text::

    <html

and hits a function key which makes the editor call ``possible()``,
then the editor can tell the user what attributes would be possible to
add to this element. In editing facilities like ``nxml-mode`` in Emacs
this is called completion. Similarly, once the start tag is ended by
adding the greater-than symbol::

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

Misplaced Elements
==================

A problem occurs when validating an XML document that contains an
unexpected element. In such case, salve will issue an error but then
what should it do with the contents of the misplaced element? Salve
handles this in two ways:

1. If the unexpected element is known in the schema and has only one
   definition, then salve will assume that the user meant to use the
   element defined in the schema and will validate it as such.

2. Otherwise, salve will turn off validation until the element is
   closed.

Consider the following case::

    <p>Here we have a <name><first>John</first><last>Doe</last></name>
    because the <emph>person's name</emph> is not known.</p>

If ``name`` cannot appear in ``p`` but ``name`` has only one
definition in the schema, then salve will emit an error upon
encountering the ``enterStartTag`` event for ``name``, and then
validate ``name`` as if it had been found in a valid place. If it
turns out that the schema defines one ``name`` element which can
appear in side a ``person`` element and another ``name`` element which
can appear inside a ``location`` element (which would be possible with
Relax NG), then salve will emit an error but won't perform any
validation inside ``name``. Validation will resume after the
``endTag`` event for ``name``. (Future versions of salve may implement
logic to figure out ambiguous cases such as this one.) This latter
scenario also occurs if ``name`` is not defined at all by the schema.

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

Loading salve in a Node.js environment requires installing the modules
listed in the ``dependencies`` section of the `<package.json>`_ file.

Running ``salve-convert`` additionally requires that ``xmllint``,
``xsltproc`` and ``jing`` be installed on your system.

.. note:: Using ``jing`` makes the test suite take twice as long to
          complete. So why, oh why, use ``jing``? It is used to
          validate the RNG file before salve's conversion code gets to
          it. It helps keep salve small. A previous version of
          ``salve-convert`` used ``xmllint`` for this task but
          ``xmllint`` would sometimes hang while validating the
          RNG. It would hang on run-of-the-mill TEI files. Not
          acceptable, and debugging ``xmllint`` is just not an option
          right now. (If you think that debugging ``xmllint`` *is* an
          option, you are welcome to debug it. We're sure the folks
          responsible for ``xmllint`` will appreciate your
          contribution.)

Running salve's tests **additionally** requires that the development
dependencies be installed. Please see the `<package.json>`_ file for
details regarding these dependencies. Note that the following packages
must be installed so that their executables are in your path:

* grunt-cli (to launch grunt)
* semver-sync
* jison

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

+-----------------------+------------------------------------------------------+
|Name                   | Meaning                                              |
+=======================+======================================================+
|jsdoc                  | jsdoc command to run                                 |
+-----------------------+------------------------------------------------------+
|jsdoc_private          | jsdoc should produce documentation for private       |
|                       | entities. true by default.                           |
+-----------------------+------------------------------------------------------+
|jsdoc_required_version | The jsdoc version required by the project's docs     |
+-----------------------+------------------------------------------------------+
|jsdoc_template_dir     | Location of the jsdoc default template               |
+-----------------------+------------------------------------------------------+
|mocha_grep             | --grep parameter for Mocha                           |
+-----------------------+------------------------------------------------------+
|rst2html               | rst2html command to run                              |
+-----------------------+------------------------------------------------------+

Note that when used on the command line, underscores become dashes, thus
``--mocha-grep`` and ``--jsdoc-private``.

The ``local.grunt.js`` file is a module. You must export values
like this::

    exports.jsdoc3 = "/usr/local/blah/jsdoc"

Building
========

Run::

    $ grunt

This will create a `<build/dist/>`_ subdirectory in which the
JavaScript necessary to validate XML files against a prepared Relax NG
schema. You could copy what is in `<build/dist>`_ to a server to serve
these files to a client that would then perform validation. Future
releases will include automatic support for minified versions of
salve.

Deploying
=========

Node
----

Salve is ready to be used in an environment able to load AMD-style
modules. Node.js is one such environment, provided you include a
loader able to process AMD-style modules. When you install salve using
``npm``, everything is already installed for you.

RequireJS
---------

RequireJS can load salve in a browser. There are two external
libraries that salve must have available in the browser:

* lodash
* xregexp

Besides setting appropriate ``paths`` values for these libraries,
the following shim is required::

    shim: {
      xregexp: {
        exports: "XRegExp",
        init: function () { return {XRegExp: XRegExp}; }
      },
    }

The seemingly superfluous ``init`` for xregexp is to make it look
exactly the same when used with RequireJS as it does when used in
Node.js.

The shim configuration above is valid as of xregexp 2.0.0. Future
versions of this library might need different shim configurations or
no shim configuration at all.

Testing
=======

Running the following command from the root of salve will run the tests::

    $ grunt test

Running ``mocha`` directly also works, but this may run the test against
stale code, whereas ``grunt test`` always runs a build first.

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

``salve-convert`` converts a Relax NG file formatted in XML into a
more compact format used by salve at validation time. Salve supports
version 2 of this file format. Versions 0 and 1 are now obsolete. The
structure is::

    {"v":<version>,"o":<options>,"d":[...]}

The ``v`` field gives the version number of the data. The ``o`` field
is a bit field of options indicating how the file was created. Right
now the only thing it records is whether or not `element paths`_ are
present in the generated file. The ``d`` field contains the actual
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

Code completely original to salve is released under the `Mozilla
Public License version 2.0
<http://www.mozilla.org/MPL/2.0/>`_. Copyright 2013, 2014 Mangalam
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

Jesse Bethel has contributed to salve's documentation, and migrated salve's
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
..  LocalWords:  runnable namespaces reparsing amd executables usr lt
..  LocalWords:  deployable schemas LocalWords api dir maxInclusive
..  LocalWords:  minInclusive minExclusive maxExclusive cd abcd jing
..  LocalWords:  github jison NaN baz emph lodash xregexp XRegExp
..  LocalWords:  init
