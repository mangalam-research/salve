Only major changes are reported here. Releases that only bump the patch part of
the version number (i.e. the number after the 2nd dot) are generally not listed
here unless they include a fix to a specific issue reported on github.

* 7.0.0:

  - This version is a major reworking of the internals of salve with an aim
    to optimize and simplify the code.

  - Breaking change: ``Event`` object no longer participate in the ad-hoc
    hashability protocol that this library uses.

  - Breaking change: salve no longer guarantees the uniqueness of
    events. Removing this feature made a significant difference in overall
    performance. This entails that the methods that return sets of possible
    events may return the "same" event more than once. For instance, if "text"
    is allowed in multiple contexts, then the an event for "text" may show up
    more than once in the set returned.

  - Breaking change: ``EventSet`` are now implemented using ``Set`` so they only
    have the methods defined by set.

  - Breaking change: fireEvent no longer takes ``Event`` objects.

  - Breaking change: enterContext/leaveContext/definePrefix are now methods
    rather than events.

  - Breaking change: The ``Walker`` class is no longer exported. The only walker
    ever visible to client code is ``GrammarWalker`` and this is the class that
    should be used in variable declarations rather than ``Walker``.

  - Breaking change: this is probably not going to be an issue generally because
    there usually no need for *client code* to create ``NameChoice`` objects but
    the constructor has changed and now takes two individual pattern parameters
    for the choices instead of a two-element array.

  - New feature: introduce a pair of "compact" events named
    ``attributeNameAndValue`` and ``startTagAndAttributes`` which allow passing
    a smaller number of events to salve.

  - Fix: the internal simplifier applied the constraints from section 7.3 and
    7.4 were too strictly.

  - Fix: ``bin/parse.js`` you can actually pass a RNG file to it, as suggested
    by the documentation.

  - HashMap had clearly be marked as private for a long time and so you should
    not have depended on it for your own code. It has now been removed, and the
    internals that depended on it have been rewritten to no longer depend on it.

* 6.0.0:

  - New feature: salve now has its own native logic for validating and
    simplifying the schemas passed to it. Previous versions of ``salve``
    required using the command line tool ``salve-convert``, which relied on
    external processing for validation and simplification of the schema, which
    had two consequences. First, the validation and simplification of the schema
    was slower that it should be, due to the cost of launching external
    processes. Second, although salve was able since day one to validate XML in
    the browser, the schemas it used had to be pre-converted to a JSON
    representation first, and this conversion could not be done *in the
    browser*. Now it can.

  - New feature: associated with the change above, salve now provides a function
    (``convertRNGToPattern``) that takes a schema and converts it to a pattern
    object suitable for validation. This function performs the schema
    simplification and validation using the native functionality described
    above. Using this functionality for the test suite has reduced the suite
    running time from about 10 minutes to 1 minute! (Yes, the old XSLT-based
    conversion was slow as sin to start with, and using it in the suite also
    required unnecessary repeated disk accesses, which added to the
    slowness. The 786 tests that check salve against the Relax NG specification
    were especially hit hard by this.)

  - Fixed a bug in validation logic. There was a bug which caused salve to
    erroneously miss some validation errors. Fortunately, the bug was not often
    triggered as it required the use of <interleave> with a rather specific
    pattern inside. (Salve has been in production for *many* years without ever
    triggering this bug.)

  - Fix a couple of bugs in ``bin/parse.js``. That example code is not used
    much. Some issues went unnoticed.

  - Bug fix: the XML parser that reads the Relax NG schema for conversion to
    salve's internal representation would omit text nodes consisting entirely of
    white space because they are *usually* insignificant. Omitting such nodes
    is helpful for simplifying the conversion code. However, the parser also
    erroneously omitted significant nodes. Text nodes that are entirely white
    space are potentially significant in ``value`` and ``param``. This version
    fixes the problem and preserves the potentially significant text nodes. (I
    write "potentially" because Relax NG cannot know a priori whether the spaces
    are significant: it depends on the type library in use.)

    Schemas that were converted in earlier versions of salve *and* that use
    ``value`` or ``param`` with text entirely consisting of white space should be
    reprocessed with this version.

    The likelihood of running into this problem in practice is remote. Among the
    type parameters (``param``) supported by salve, the only one that can make
    meaningful usage of a value consisting of white spaces is
    ``pattern``. However, specifying through ``pattern`` that an attribute or
    element content can contain **only** *a specific number of white spaces* is
    definitely bizarre. The usefulness of ``value`` consisting entirely of
    white space is similarly unlikely. (Not *impossible*, but *rare*.)

  - The main entry point of the package (``main`` field in ``package.json``)
    used to be the bundle created with Webpack. It is no longer the case. For
    most usages, this change should be transparent.

  - Deprecation notice: ``salve-convert`` and the validation/simplification
    methods that depend on external processes are deprecated. They will be
    absent (or relegated to the status of debugging tools, not for general use)
    in the next major release of salve. In the short term this means that:

    + Code that depends on ``salve-convert`` should instead be redesigned to
      depend on ``convertRNGToPattern``.

    + Issues in the facilities hereby being deprecated won't be fixed quickly,
      if at all.

  - ``constructTree`` has been renamed ``readTreeFromJSON``. The old name is
    deprecated and will be removed in the next major version.

  - There is a function named ``writeTreeToJSON`` which does the reverse of
    ``readTreeFromJSON``. When you move away from ``salve-convert``, you should
    be using the ``writeTreeToJSON`` and ``readTreeFromJSON`` to serialize and
    deserialize a converted schema. Schema conversion is much faster now than it
    was but it is still a costly process. When at all possible, it is
    recommended to cache the results of the conversion instead of converting
    over and over.

* 5.0.0:

  - Salve no longer officially supports Node 4.x. This is enough by itself to
    justify the major version bump. Support for Node 4.x has become too onerous.

  - Spring cleaning (so to speak):

    + updated some obsolete dependencies,

    + linting,

    + some code cleanups.

* 4.3.0:

  - ``ValidationError`` objects now have an ``equals`` method that allows
    comparing two such objects.

  - The default implementation of ``toString`` on ``ValidationError`` and its
    derived classes has changed. This is not considered a breaking change since
    ``ValidationError`` and its derived classes are not meant to be further
    derived by users of salve.

* 4.2.0:

  - Salve no longer warns on usage of ``float`` and ``double``.

  - Improved handling of ``float`` and ``double`` types.

  - ``salve-convert`` has been reworked to clean the old code and now avoids
    using intermediary files on disk to perform its transformation.

* 4.1.1:

  - Export BaseName.

* 4.1.0:

  - The logic for reporting attribute errors has been improved. In previous
    iterations a missing attribute could have let to an error saying that the
    first child element of the element lacking the attribute was incorrect:
    salve was reporting the presence of an erroneous element, rather than the
    absence of the attribute. It makes sense if you think in computational terms
    but is confusing to end users.

* 4.0.7:

  - The fix for the attribute problem that was meant to be fixed in 4.0.6 was
    not complete.

* 4.0.6:

  - Fixed an error whereby if an element had multiple attribute errors, only
    the first error was reported.

  - Reverted the sourcemap generation to what it was before 4.0.5. The change
    introduced in 4.0.5 used a method not suitable for production and thus was
    erroneous.

* 4.0.5:

  - Fixed an error whereby if an RNG file processed with ``salve-convert``
    included another RNG file, and the other file had a ``datatypeLibrary`` set
    on the top ``grammar`` element, this attribute would be lost during the
    schema simplification process. One symptom would be to cause any reference
    to types that are not in the default library to fail during conversion.

* 4.0.4:

  - Allow passing an object to ``constructTree``.

* 4.0.3:

  - Fixed an obscure bug revealed through linting the code more stringently.

  - Added an export for ``GrammarWalker``. This is the walker you'll be dealing
    with most often, and it has some methods not present on other walkers.

  - Added an export for ``EventSet``, which is useful for client code obtaining
    sets of possible events.

  - Fixed ``Grammar#newWalker()``'s signature to return ``GrammarWalker``. This
    is needed to take advantage of ``GrammarWalker``'s methods.

* 4.0.0:

  - Move to TypeScript. Immediate advantages:

    + Fixed a few bugs in the code that were revealed by TypeScript. The bugs
      what were found were in the following categories: dead code (in particular
      an experimental type was left over), errors cancelling each other.

    + Fixed mistakes in the documentation. JSDoc3 allows for the code and the
      documentation to be a complete odds with each other. typedoc narrows the
      opportunities for divergence considerably.

  - Renamed ``ReferenceError`` to ``RefError``. This is to avoid a name clash
    with the built-in ``ReferenceError`` provided by JavaScript engines. The
    clash did not make the code fail but it had unfortunate side-effects.

  - Renamed ``Set`` in ``set.ts`` to ``NaiveSet`` to avoid clashing with
    possible ``Set`` classes provided by the JavaScript runtime. (This was a
    private part of salve, so it should not break anything.)

* 3.0.0:

  - General restructuring of salve. This could consitute a breaking change
    depending on how you've used salve in the past.

    Natively, salve used to be implemented as a series of AMD modules, and then
    you'd have to use something like the ``amd-loader`` package to load it in
    Node.js. Also, although salve's documentation said you should use only the
    ``validate`` module, it was possible to directly load other modules of salve
    as needed. This was an unsupported way to use salve, but you could *easily*
    do it. Moreover, the benefits of using AMD were minuscule. This, in great
    part because salve is not designed to be partially loaded.

    Using AMD as the native module format for the code-base created some
    annoyances: needing one extra level of indentation due to ``define`` (or
    having to use custom indentation code to avoid this level), poor support for
    AMD from ``jsdoc`` (on paper it is supposed to be easy but in practice it
    requires some workarounds to be copied in every module), the necessity of
    using ``amd-loader`` in Node.js, etc.

    So the code-base has been converted to the CommonJS format and the modules
    are now built into a UMD file that exports only the ``validate`` module to
    the world. See ``Deploying`` in the ``README.rst`` file for details.

  - Bug fix: salve converts XML Schema regular expressions to expressions that
    can be used in JavaScript. Depending on what the original expression does,
    the conversion may require the use of XRegExp. Salve sometimes failed to
    identify cases where XRegExp was needed rather than native RegExp
    objects. This has been fixed.

  - Upgrade to XRegExp version 3. This can be a breaking change for libraries
    using salve. For instance, it was a breaking change for wed because it as
    using the version of XRegExp bundled with salve, and this version exports
    itself differently from version 2.

  - Lodash is no longer a regular dependency. Removing the dependency reduced
    the size of a build by 30%. It remains a development dependency because it
    is used in tests.

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

..  LocalWords:  rng js xsl README xsltproc JSON API fireEvent param NG
..  LocalWords:  boolean
