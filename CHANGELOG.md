<a name="9.0.1"></a>
## [9.0.1](https://github.com/mangalam-research/salve/compare/v9.0.0...v9.0.1) (2018-12-05)


### Bug Fixes

* handling of datatypeLibrary on include ([29db3d2](https://github.com/mangalam-research/salve/commit/29db3d2))



<a name="9.0.0"></a>
# [9.0.0](https://github.com/mangalam-research/salve/compare/v8.0.0...v9.0.0) (2018-08-28)


### Code Refactoring

* remove constructTree ([eb1f43a](https://github.com/mangalam-research/salve/commit/eb1f43a))


### Documentation

* drop salve-convert from the public API ([17a26c3](https://github.com/mangalam-research/salve/commit/17a26c3))


### Features

* add enterContextWithMapping to Grammar and NameResolver ([54d5eb9](https://github.com/mangalam-research/salve/commit/54d5eb9))
* GrammarWalker now takes an external name resolver ([190ee13](https://github.com/mangalam-research/salve/commit/190ee13))
* support custom hash functions for making a manifest ([677dfc2](https://github.com/mangalam-research/salve/commit/677dfc2))
* support custom resource loaders for conversion ([ed7f4ed](https://github.com/mangalam-research/salve/commit/ed7f4ed))


### Performance Improvements

* build the parameter list without extra objects ([42cb1db](https://github.com/mangalam-research/salve/commit/42cb1db))
* don't go through this.el to get relevant fields ([7262da4](https://github.com/mangalam-research/salve/commit/7262da4))
* immediately fill the array ([48156a6](https://github.com/mangalam-research/salve/commit/48156a6))
* optimize how builtin types normalize spaces ([2daee97](https://github.com/mangalam-research/salve/commit/2daee97))
* optimize whitespace cleanup among xmlschema types ([7c091a5](https://github.com/mangalam-research/salve/commit/7c091a5))
* replace Jison with a custom regexp parser ([1638978](https://github.com/mangalam-research/salve/commit/1638978))
* use the namespace mapping produced by saxes ([ec251a7](https://github.com/mangalam-research/salve/commit/ec251a7))


### BREAKING CHANGES

* ``salve-convert`` had been deprecated for a while. It is now formally no longer
part of the public API of salve. It is still distributed with salve but only for
debugging purposes. **DO NOT RELY ON IT FOR PRODUCTION.**
* ``constructTree`` had been deprecated for a while. It has now formally been
removed.
* ``GrammarWalker`` now takes an external name resolver. Prior to this change,
``GrammarWalker`` would instantiate an instance of ``NameResolver``. This was
disadvantageous in cases where the code using salve already maintained its own
name resolving machinery. It would essentially have to duplicate information
with salve and suffer the performance consequences.

 ``NameResolver`` has been renamed to ``DefaultNameResolver`` and
 ``NameResolver`` is now an interface. When calling ``newWalker`` on ``Grammar``
 you now need to pass a ``NameResolver`` instance. For cases where the old
 behavior was as good as it gets, the way to get your code working with a minimum
 of changes is to: a) replace ``const walker = grammar.newWalker()`` with ``const
 walker = grammar.newWalker(new DefaultNameResolver())``, b) instead of calling
 the ``DefaultNameResolver`` methods ``enterContext``, ``definePrefix``,
 etc. directly on the ``walker``, call them on ``walker.nameResolver``.

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
