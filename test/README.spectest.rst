The ``spectest`` directory was generated from running::

    $ saxon -xsl:split-spectest.xsl -s:spectest.xml

We do not run this command as part of regular builds because
``spectest.xml`` is not expected to ever change.

Note that if there is ever a need to rerun this command, it will
probably affect the tests in ``spectest.js`` because test exclusion is
based on the ``<testCase>`` position among the list of all
``<testCase>`` elements in the document in document order.

..  LocalWords:  spectest saxon js testCase
