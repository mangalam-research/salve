Only major changes are reported here. Releases that only bump the
patch part of the version number (i.e. the number after the 2nd dot)
are generally not listed here unless they include a fix to a specific
issue reported on github.

* 3.0.0:

  - Bug fix: salve converts XML Schema regular expressions to expressions that
    can be used in JavaScript. Depending on what the original expression does,
    the conversion may require the use of XRegExp. Salve sometimes failed to
    identify cases where XRegExp was needed rather than native RegExp
    objects. This has been fixed.

  - Upgrade to XRegExp version 3. This can be a breaking change for libraries
    using salve. For instance, it was a breaking change for wed because it as
    using the version of XRegExp bundled with salve, and this version exports
    itself differently from version 2.

  - XRegExp is a peer dependency rather than a regular dependency. This is a
    breaking change, as libraries that depend on salve need to list XRegExp as a
    dependency of their own to get it installed.

  - We no longer test on or support versions of Node less than version 4.

  - The code has been run through eslint, which has revealed a few bugs that
    have been fixed.

  - Some of the API has changed to conform to a camel case naming convension:

    + ``module:conversion/parser.Parser#saxParser`` property.
    + ``module:patterns.Grammar#elementsDefinitions`` property.


  - Use the jsdoc ``inferModule`` plugin to avoid having to specify ``@module``
    manually. Removed ``@module`` from all files.

  - Removed the years from the copyright notices. It was a pain to update and
    did not get updated consistently. Search the git history if you really care
    about years. (Copyright law does not require that the copyright notice
    include a year. A notice is not even required for copyright to apply. The
    notice is more a courtesy than anything else.)

* 2.0.0:

  - Upgraded to lodash 4. Salve won't work with an earlier version of
    lodash. This is enough of a disruption to warrant new major
    number. 2.0.0 is functionally equivalent to 1.1.0, so people who
    want to stay with lodash 3 can use 1.1.0. Note however that the
    1.x line won't receive any further updates.

* 1.1.0:

  - Name patterns now support a ``getNamespace`` method that allows
    getting the list of namespaces in the pattern.

  - Name patterns now support a ``wildcardMatch`` method.

  - Improved the documentation: removed some old stuff, rephrased some
    explanations, etc.

  - Moved the test suite to ES6.

* 1.0.0:

  - This version is a major departure from previous versions. Code
    that worked with older versions will **not** work with this
    version without being modified.

  - Added support for ``<nsName>`` and ``<anyName>``.

  - Added support for ``<except>``.

  - API change: the ``attributeName``, ``enterStartTag`` and
    ``endTag`` events returned by ``possible()`` now have a
    ``name_patterns.Base`` object as the parameter after the event
    name. When the object is an instance of ``name_patterns.Name``,
    this is a situation equivalent to the namespace and name that used
    to be in the same event after the event name in previous versions
    of salve. Other cases can represent really complex validation
    scenarios.

  - API change: validation errors now use objects of any subclass of
    ``name_patterns.Base`` to represent names. See the comment above
    regarding ``name_patterns.Name``.

  - API change: salve now requires the converted schema files to be
    version 3 of the format. This means you have to reconvert your old
    schemas with ``salve-convert`` for them to work with 1.0.

  - Bug fix and API change: previous versions of salve would indicate
    that ``<text/>`` was possible by returning an event with
    ``"text"`` as the first parameter and ``"*"`` as the second. This
    was ambiguous because a ``<value>`` that allows only an asterisk
    would also return the same event. ``<text/>`` is now indicated by
    the regular expression ``/^.*$/`` in the second position.

  - The build system now uses Gulp rather than Grunt.

* 0.23.0:

  - Added support for ``<interleave>``, and consequently ``<mixed>``.

* 0.22.0:

  - API change: export the ``Grammar`` and ``Walker`` classes so that
    they can be used by client code. (0.21.3 was released to export
    ``Walker`` but it should really have a) also included ``Grammar``
    and b) bumped the minor version rather than be a patch.)

* 0.21.0:

  - Salve is no longer tested on Node 0.8 and no attempt is made to
    support it anymore.
  - Bug fixes.

* 0.20.0:

  - Better handling of misplaced elements. See the README for details.

* 0.19.0:

  - Many performance improvements that are extensive enough that a new
    minor number is warranted.

* 0.18.0:

  - The dependency on underscore has been replaced by a dependency on
    lodash. This does not change any of salve's API but if you load
    salve in a RequireJS environment, you may have to change the
    configuration of RequireJS to load lodash. This is not a major
    change in salve but it is big enough to warrant a new minor
    release rather than a patch release.

* 0.17.0:

  - Feature: The ``rng-to-js.xsl`` stylesheet is gone. It's work has been taken
    over by ``salve-convert``. This change yields a speed improvement
    of an order of magnitude on large schemas.

  - Feature: salve now supports RNG's <value> and <data> elements. It
    supports the two types from RNG's builtin library and supports a
    great deal of XML Schema's
    http://www.w3.org/2001/XMLSchema-datatypes. See the README file
    for details about limitations. This means that salve no longer
    allows everything and anything in attributes.

  - To support this salve now requires the use of file format 2. This
    version of salve won't load any earlier file formats. (In general,
    we would like to support previous formats for at least a little
    while but in this case, there were problems with format 1 that
    would result in serious breakage so the safe thing to do is to
    upgrade.)

  - API change: if a file has namespaces, using namespace events is
    now **mandatory**. Previously, you could manage namespaces
    yourself, and not use namespace events. However, support for
    datatypes ``QName`` and ``NOTATION`` requires that salve know
    exactly the state of namespaces. So it has to use an internal
    resolver, which needs these events.

  - API change: the ``useNameResolver`` method is gone, for the same
    reasons as above.

  - API change: ``text`` events now require the actual text value to
    be passed.

  - API change: salve now expects all white space to be passed to
    it. Previous versions did not.

* 0.16.0:

  - Salve's build is now done with grunt rather than make.

  - A build is no longer automatically performed upon installation.

* 0.15.0: ``salve-simplify`` is gone and replaced by
  ``salve-convert``. ``salve-convert`` is more aggressive than
  ``salve-simplify`` + ``rng-to-js.xsl`` in optimizing file size.

* 0.14.1: in prior versions, ``<rng:group>`` would sometimes report an
  error later than the earliest event it could report it on. To
  illustrate, imagine the following content model for the ``em``
  element: ``(b | em), i``, and validating ``<em><i/></em>``. The
  validation would report an error only when ``</em>`` was
  processed. The bug fix makes it so that the error is reported as
  soon as ``<i>`` is processed.

* 0.14.0 changes how ``rng-to-js.xsl`` generates its output. See the
  section on ``rng-to-js.xsl`` in the README file. Although salve
  still supports the old output, I strongly recommend running
  ``salve-simplify`` and ``xsltproc`` with ``rng-to-js.xsl`` to
  regenerate the JSON that encodes your schema. You can easily get a
  file that is one order of magnitude smaller than those produced by
  earlier versions of salve.

* 0.13.0 adds name-resolving facilities to salve. See the
  documentation about events in the README file.

* 0.12.0 introduces a major API change. Whereas ``Walker.fireEvent()``
  and ``Walker.end()`` used to return ``true`` when there was no
  validation error, they now return ``false`` instead. This makes
  differentiating between error conditions and an absence of errors
  easier. (If the return value is interpreted as the boolean ``true``
  then there is an error, otherwise there is no error. Previously, one
  would have to test the return value for identity with the value
  ``true``, which is more verbose.)

..  LocalWords:  rng js xsl README xsltproc JSON API fireEvent
..  LocalWords:  boolean
