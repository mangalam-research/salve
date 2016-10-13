.. image:: https://travis-ci.org/mangalam-research/salve.png

.. note:: Github currently does not implement all reStructuredText
          directives, so some links in this readme may not work
          correctly when viewed there.

.. note:: If you are reading this file from the set of files installed
          by ``npm install``, please keep in mind that the npm package
          only includes what is strictly necessary to *use* salve. For
          instance, the test suite is not included in the npm package.
          This documentation, however, covers *all* of salve.
          Consequently, it may refer to items you do not have.

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
limitations that salve has. We've also validated files that use the
DocBook v5.0 schema. We want to support as much Relax NG as reasonably
possible. For now salve has the following limitations:

* Support for XML Schema ``float`` and ``double`` types is not
  thorough. Simple value comparisons work but if you put ``NaN`` or
  ``INF`` or ``-INF`` in parameters like ``maxInclusive``, etc., it is
  likely that salve won't behave correctly. Salve furthermore does not
  verify that the numerical values fit within the limits of ``float``
  or ``double``.

* XML Schema types ``ENTITY`` and ``ENTITIES`` are treated as a ``string``.

* None of the XML Schema types that deal with time allow the
  parameters ``minInclusive``, ``minExclusive``, ``maxInclusive`` and
  ``maxExclusive``.

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
added. Submit an issue on GitHub for it. If you do submit an issue to
add a feature, please make a case for it. Even better, if someone
wishes for a feature to be added, they can contribute code to salve
that will add the feature they want. A solid contribution is more
likely to result in the feature being speedily added to salve than
asking for us to add the feature, and waiting until we have time for
it.

A full validation solution has the following components:

* A tokenizer: responsible for recognizing XML tokens, tag names, tag
  delimiters, attribute names, attribute values, etc.

* A parser: responsible for converting tokens to validation events
  (see below).

* A well-formedness checker. Please check the `Events`_ section for
  more information about what this concretely means.

* A validator: responsible for checking that validation events are
  valid against a schema, telling the parser what is possible at the
  current point in validation, and telling the parser what is possible
  in general (e.g., what namespace uris are used in the
  schema). **This is what salve offers, and only this!**

A good example of this division of labor can be found in
`<bin/parse.js>`_ and in the test suite. In both cases the tokenizer
function is performed by ``sax``, and the parser function is performed
by a parser object that ``sax`` creates, customized to call salve's
``Walker.fireEvent()``. Developers should keep in mind that ``sax`` is
a bit limited in the kind of validation it performs. In particular,
given the string ``<foo></bar></foo>``, ``sax`` will detect the
problem with ``</bar>`` but will *also* pass it as text to the code
that uses the ``sax`` parser.

.. note:: If you are looking at the source tree of salve as cloned
          from GitHub, know that executables cannot be executed from
          `<bin>`__. They can be executed after a build, from the
          `<build/dist/bin>`_ directory.

          If you are looking at the files installed by ``npm`` when
          you install salve as a *package*, the files in `<bin>`__
          *are* those you want to execute.

Basic Usage
===========

A Relax NG schema must be prepared before it can be used by salve. The
``bin/`` subdirectory contains a JavaScript script which can be used to
convert a Relax NG schema to the format salve wants. You can use the
``--help`` option to see the entire list of options available. Typical
usage is::

    $ salve-convert [input] [output]

The ``[input]`` parameter should be the Relax NG schema to
convert. The ``[output]`` parameter should be where to save the schema
once it is converted to JavaScript. (Actually, the simplified RNG is
converted to JSON. Generally speaking JSON is not a subset of
JavaScript but in this instance, the JSON produced is a subset, so
calling it JavaScript is correct.)

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
to salve the events emitted from a document that is malformed will
cause salve to behave in an undefined manner. (It may crash. It may
generate misleading errors. It may not report any errors.) This
situation is due to the fact that salve is currently developed in a
context where the documents it validates cannot be malformed (because
they are represented as DOM trees). So salve contains no functionality
to handle problems with well-formedness. Salve **can be used on
malformed documents**, provided you take care of reporting
malformedness issues yourself and strategize how you will pass events
to salve.

Multiple strategies are possible for using salve in a context where
well-formedness is not guaranteed. There is no one-size-fits-all
solution here. A primitive parser could abort as soon as evidence
surfaces that the document is malformed. A more sophisticated parser
could process the problematic structure so as to generate an error but
give salve something well-formed. For instance if parsing
``<foo></baz>``, such parser could emit an error on encountering
``</baz>`` and replace the event that would be emitted for ``</baz>``
with the event that would be emitted for ``</foo>``, and salve will
happily validate it. The user will still get the error produced by the
parser, and the parser will still be able to continue validating the
document with salve.

The parser is responsible for calling ``fireEvent()`` on the walker
returned by the tree created from the RNG. (See above.) The events
currently supported by ``fireEvent()`` are defined below:

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
  all instances of text, **including white space.**

``Event("enterContext")``
  Emitted when entering a new namespace context.

``Event("leaveContext")``
  Emitted when leaving a namespace context.

``Event("definePrefix", prefix, uri)``
  Emitted when defining a namespace prefix.

The reason for the set of events supported is that salve is designed
to handle **not only** XML modeled as a DOM tree but also XML parsed
as a text string being dynamically edited. The best and closest
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

Presumably, after firing the events above, your code would call
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
the walker has seen so far.  If the user is editing a document which
contains only the text::

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
only ``Event`` objects.

Editors that would depend on salve for guided editing would most
likely need to use the ``clone()`` method on the walker to record the
state of parsing at strategic points in the document being
edited. This is to avoid needless reparsing. How frequently this
should happen depends on the structure of the editor. The ``clone()``
method and the code it depends on has been optimized since early
versions of salve, but it is possible to call it too often, resulting
in a slower validation speed than could be attained with less
aggressive cloning.

Overbroad Possibilities
-----------------------

``possible()`` may at times report possibilities that allow for a
document structure that is ultimately invalid. This could happen, for
instance, where the Relax NG schema uses ``data`` to specify that the
document should contain a ``positiveInteger`` between 1 and 10. The
``possible()`` method will report that a string matching the regular
expression ``/^\+?\d+$/`` is possible, when in fact the number ``11``
would match the expression but be invalid. The software that uses
salve should be prepared to handle such a situation.

Name Classes
------------

.. note:: The symbol ``ns`` used in this section corresponds to
          ``uri`` elsewhere in this document and ``name`` corresponds
          to ``local-name`` elsewhere. We find the ``uri``,
          ``local-name`` pair to be clearer than ``ns``, ``name``. Is
          ``ns`` meant to be a namespace prefix? A URI? Is ``name`` a
          qualified name, a local name, something else? So for the
          purpose of documentation, we use ``uri``, ``local-name``
          wherever we can. However, the Relax NG specification uses
          the ``ns``, ``name`` nomenclature, which salve also follows
          internally. The name class support is designed to be a close
          representation of what is described in the Relax NG
          specification. Hence the choice of nomenclature in this
          section.

The term "name class" is defined in the Relax NG specification, please
refer to the specification for details.

Support for Relax NG's name classes introduces a few peculiarities in
how possibilities are reported to clients using salve. The three
events that accept names are affected: ``enterStartTag``, ``endTag``,
and ``attributeName``. When salve returns these events as
possibilities, their lone parameter is an instance of
``name_patterns.Base`` class. This object has a ``.match`` method that
takes a namespace and a name and will return ``true`` if the namespace
and name match the pattern, or ``false`` if not.

Client code that wants to provide a sophisticated analysis of what a
name class does could use the ``.toObject()`` method to get a plain
JavaScript object from such an object. The returned object is
essentially a syntax tree representing the name class. Each pattern
has a unique structure. The possible patterns are:

* ``Name``, a pattern with fields ``ns`` and ``name`` which
  respectively record the namespace URL and local name that this
  object matches. (Corresponds to the ``<name>`` element in the
  simplified Relax NG syntax.)

* ``NameChoice``, a pattern with fields ``a`` and ``b`` which are two
  name classes. (Corresponds to a ``<choice>`` element appearing
  inside a name class in the simplified Relax NG syntax.)

* ``NsName``, a pattern with the field ``ns`` which is the namespace
  that this object would match. The object matches any name. It may have
  an optional ``except`` field that contains a name class for patterns
  that it should not match. The lack of ``name`` field distinguishes
  it from ``Name``.  (Corresponds to an ``<nsName>`` element in the
  simplified Relax NG syntax.)

* ``AnyName``, a pattern. It has the ``pattern`` field set to
  ``AnyName``. We use this ``pattern`` field because ``AnyName`` does
  not require any other fields so ``{}`` would be its
  representation. This representation would too easily mask possible
  coding errors. ``AnyName`` matches any combination of namespace and
  name. May have an optional ``except`` field that contains a name
  class for patterns it should not match. It corresponds to an
  ``<anyName>`` element in the simplified Relax NG syntax.

.. note:: We do not use the ``pattern`` field for all patterns above
          because the only reason to do so would be to distinguish
          ambiguous structures. For instance, if Relax NG were to
          introduce a ``<superName>`` element that also needs ``ns``
          and ``name`` fields then it would look the same as
          ``<name>`` and we would not be able to distinguish one from
          the other. However, Relax NG is stable. In the unlikely
          event a new version of Relax NG is released, we'll cross
          whatever bridge needs to be crossed.

Note that the ``<except>`` element from Relax NG does not have a
corresponding object because the presence of ``<except>`` in a name
class is recorded in the ``except`` field of the patterns above.

Here are a couple of examples. The name class for::

    element (foo | bar | foo:foo) { ... }

would be recorded as (after partial beautification)::

    {
        a: {
            a: {ns: "", name: "foo"},
            b: {ns: "", name: "bar"}
        },
        b: {ns: "foo:foo", name: "foo"}
    }

The name class for::

    element * - (foo:* - foo:a) { ... }

would be recorded as (after partial beautification)::

    {
        pattern: "AnyName",
        except: {
            ns: "foo:foo",
            except: {ns: "foo:foo", name: "a"}
        }
    }

Clients may want to call the ``.simple()`` method on a name pattern to
determine whether it is simple or not. A pattern is deemed "simple" if
it is composed only of ``Name`` and ``NameChoice`` objects. Such a
pattern could be presented to a user as a finite list of
possibilities. Otherwise, if the pattern is not simple, then either
the number of choices is unbounded or it not a discrete list of
items. In such a case, the client code may instead present to the user a
field in which to enter the name of the element or attribute to be
created and validate the name against the pattern. The method
``.toArray()`` can be used to reduce a pattern which is simple to an
array of ``Name`` objects.

Event Asymmetry
---------------

**Note that the events returned by ``possible()`` are *not identical*
to the events that ``fireEvent()`` expects.** While most events returned are
exactly those that would be passed to ``fireEvent()``, there
are three exceptions: the ``enterStartTag``, ``endTag`` and
``attributeName`` events returned by ``possible()`` will have a single
parameter after the event name which is an object of
``name_patterns.Base`` class. However, when passing a corresponding
event to ``fireEvent()``, the same events take two string parameters
after the event name: a namespace URL and a local name. To spell it out, they
are of this form::

    Event(event_name, uri, local-name)

where ``event_name`` is the string which is the name of the event to
fire, ``uri`` is the namespace URI and ``local-name`` is the local
name of the element or attribute.

Error Messages
--------------

Error messages that report attribute or element names use the
``name_patterns.Name`` class to record names, even in cases where
``patterns.EName`` would do. This is for consistency purposes, because
some error messages **must** use ``name_patterns`` objects to report
their errors. Rather than have some error messages use ``EName`` and
some use the object in ``name_patterns`` they all use the objects in
``name_patterns``, with the simple cases using ``name_patterns.Name``.

In most cases, in order to present the end user of your application
with error messages that make sense *to the user*, you will need to
process error messages. This is because error messages generated by
salve provide in the error object ``(ns, local name)`` pairs. A user
would most likely like to see a namespace prefix rather than URI
(``ns``). However, since namespace prefixes are a matter of user
preference, and there may be many ways to decide how to associate a
namespace prefix with a URI, salve does not take a position in this
matter and lets the application that uses it decide how it wants to
present URIs to users. The application also has to determine what
strategy to use to present complex (i.e., non-simple) name patterns to
the user. Again, there is no one-size-fits-all solution.

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
appear inside a ``person`` element and another ``name`` element which
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

    $ gulp doc

You may need to create a ``gulp.local`` module to tell ``gulp`` where
to get ``jsdoc`` and ``rst2html``. (Defaults are such that ``gulp``
will use your ``PATH`` to locate them.) The formatted jsdoc3 will
appear in the `<build/api/>`_ subdirectory, and the `<README.html>`_
in the root of the source tree.

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
          RNG. It would hang on run-of-the-mill TEI files. This is
          unacceptable, and debugging ``xmllint`` is just not an option
          right now. (If you think that debugging ``xmllint`` *is* an
          option, you are welcome to debug it. We're sure the folks
          responsible for ``xmllint`` will appreciate your
          contribution.)

Running salve's tests **additionally** requires that the development
dependencies be installed. Please see the `<package.json>`_ file for
details regarding these dependencies. Note that ``gulp`` should be
installed so that its executable is in your path.  Either this, or you
will have to execute ``./node_modules/.bin/gulp``

If you want to contribute to salve, your code will have to pass the
checks listed in `<.glerbl/repo_conf.py>`_. So you either have to
install glerbl to get those checks done for you or run the checks
through other means. See Contributing_.

Build System
============

Salve uses gulp. Salve's `<gulpfile.babel.js>`_ gets the values for its
configuration variables from three sources:

* Internal default values.

* From an optional ``gulp.local.js`` module that can override the
  internal defaults.

* From command line options that can override everything above.

The variables that can be set are:

+-----------------------+------------------------------------------------------+
|Name                   | Meaning                                              |
+=======================+======================================================+
|jsdoc                  | jsdoc command to run                                 |
+-----------------------+------------------------------------------------------+
|jsdoc_private          | jsdoc should produce documentation for private       |
|                       | entities. True by default. Set jsdoc_private to      |
|                       | false using no_jsdoc_private.                        |
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

The ``gulp.local.js`` file is a module. You must export values
like this::

    exports.jsdoc3 = "/usr/local/blah/jsdoc"

Building
========

Run::

    $ gulp

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

    $ gulp test

Running ``mocha`` directly also works, but this may run the test against
stale code, whereas ``gulp test`` always runs a build first.

JavaScript
==========

Take note that as of version 2.0.0, the code of the library itself is
coded using ES5. However, auxiliary files are coded using ES6. These
are files that are not part of the library proper. Examples of the
latter: the files that contain build code, and the test files.

Eventually the entire code base will be moved to ES6 but constraints
prevent this from happening now.

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
version 3 of this file format. Versions 0 to 2 are now obsolete. The
structure is::

    {"v":<version>,"o":<options>,"d":[...]}

The ``v`` field gives the version number of the data. The ``o`` field
is a bit field of options indicating how the file was created. Right
now the only thing it records is whether or not element paths are
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
<http://www.mozilla.org/MPL/2.0/>`_. Copyright 2013-2016 Mangalam
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
..  LocalWords:  github jison NaN baz emph lodash xregexp XRegExp ns
..  LocalWords:  init positiveInteger NCName NameChoice superName
..  LocalWords:  EName
