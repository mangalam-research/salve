<a name="8.0.0"></a>
# [8.0.0](https://github.com/mangalam-research/salve/compare/v7.0.3...v8.0.0) (2018-08-01)


### Bug Fixes

* don't try to enumerate methods ([1a0643e](https://github.com/mangalam-research/salve/commit/1a0643e))
* drop the hasEmptyPattern from BaseWalker ([28d2e3c](https://github.com/mangalam-research/salve/commit/28d2e3c))
* fix linting error ([7a570cc](https://github.com/mangalam-research/salve/commit/7a570cc))


### Code Refactoring

* improve rename performance ([c7c6fda](https://github.com/mangalam-research/salve/commit/c7c6fda))


### Features

* add a "none" option to --validator ([151e221](https://github.com/mangalam-research/salve/commit/151e221))
* don't load all XRegExp addons ([1460969](https://github.com/mangalam-research/salve/commit/1460969))
* move from sax to saxes ([1d70a08](https://github.com/mangalam-research/salve/commit/1d70a08))
* simplification can now produce a manifest ([09bef20](https://github.com/mangalam-research/salve/commit/09bef20))


### refact

* compile to ES6 ([754c687](https://github.com/mangalam-research/salve/commit/754c687))


### BREAKING CHANGES

* The support for manifests requires using Node functions that are only available
in Node 8 and higher. So this means Node 6 is no longer supported. If you need
Node 6 support, you can use salve 7.0.3 or earlier. Alternatively, we may
consider a PR to reintroduce support for Node 6. If you do produce a PR make
sure that your code does run in Node 6 and that the PR is polished. A PR that
does the job half-way won't be accepted. Just opening an issue asking for Node 6
support is unlikely to go anywhere.

* ``renameRefsDefines`` is no longer public.

* ``writeTreeToJSON`` takes a parameter to determine whether to rename define
and ref elements. You must use this parameter instead of calling
``renameRefsDefines``.

* This removes support for IE11 and Safari 9. The change is justified by the fact
that we get a 10% speed improvement "for free" by compiling to ES6 when running
the docbook.rng benchmark. Worth it. If there is demand for IE11 or Safari 9
support, we may add a build for those platforms. If there is demand.

* Though its existence was a mistake, it was possible in previous versions to call
``hasEmptyPattern`` on the ``GrammarWalker``. It is no longer possible to do so.

Entries for versions 0.x to 7.x are [here](./CHANGELOG.0.x-7.x.rst).
