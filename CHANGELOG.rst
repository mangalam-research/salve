Only major changes are reported here.

* 0.17.0:

  - The ``rng-to-js.xsl`` stylesheet is gone. It's work has been taken
    over by ``salve-convert``. This change yields a speed improvement
    of an order of magnitude on large schemas.

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
