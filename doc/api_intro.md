#API Documentation

Welcome to documentation for the salve project's JavaScript API.

##Note

By default, this documentation generated for salve includes only the
public API. You should consider any function at the top level of a
module that is marked `<inner>` to be public. These functions appear
as `<inner>` due to a limitation of jsdoc3.

#Salve's Internals

## Context Cheats

Salve cheats when it comes to handling context for &lt;value>. Only
two types known to salve require a context: QName and NOTATION from
the XML Schema library. The ``salve-convert`` command does not
incorporate a context for them but instead uses the context in the
schema to transform the &lt;value> element so that @ns is set to the
URI under which the local-name in the &lt;value> element should be
interpreted, and the contents of &lt;value> is turned in to a local
name.

## Attributes vs Elements

There's a bit of a disconnect between how Relax NG specifies
attributes and elements and how these are represented in XML. In Relax
NG, it is perfectly doable and normal to mix attributes and elements
in patterns. In XML, however, attributes appear within an opening tag
and elements appear between opening and closing tags, outside of any
tags. This complicates validation somewhat. ``Pattern`` objects have
two methods that take an ``attribute`` argument telling them whether
they've been called in a context where only attributes are valid, or
not. These are ``canEnd`` and ``end``.

##Events

If you ever look at salve's internals be aware that as an
implementation convenience, patterns that accept ``text`` events also
accept ``attributeValue`` events. That is, ``fireEvent`` will accept
both. However, these elements will only return ``text`` as a possible
event. ``AttributeWalker`` is responsible to convert it to
``attributeValue``.

#Getting salve

Please see the project
[README](https://github.com/mangalam-research/salve/tree/develop#readme)
for the latest information, or visit the Github
[page](https://github.com/mangalam-research/salve/tree/develop).

Download a [zip](https://github.com/mangalam-research/salve/zipball/master)
or a [tarball](https://github.com/mangalam-research/salve/tarball/master)
of the project's source.

#License

Salve is released under the [Mozilla Public License version
2.0](http://www.mozilla.org/MPL/2.0/). Copyright 2013, 2014 Mangalam
Research Center for Buddhist Languages, Berkeley, CA.

#Credits

Wed is designed and developed by Louis-Dominique Dubeau
([@lddubeau](https://github.com/lddubeau)), Director of Software
Development for the Buddhist Translators Workbench project,
[Mangalam Research Center for Buddhist Languages](
    http://www.mangalamresearch.org/).

Jesse Bethel maintains salve's documentation, and migrated salve's
build system from Make to Grunt.

[![Mangalam Research Center for Buddhist Languages][1]][2]

[1]: https://secure.gravatar.com/avatar/7fc4e7a64d9f789a90057e7737e39b2a
[2]: http://www.mangalamresearch.org/

This software has been made possible in part by a Level I Digital
Humanities Start-up Grant and a Level II Digital Humanities Start-up
Grant from the
[National Endowment for the Humanities](http://www.neh.gov) (grant
numbers HD-51383-11 and HD-51772-13). Any views, findings,
conclusions, or recommendations expressed in this software do not
necessarily represent those of the National Endowment for the
Humanities.

[![Mangalam Research Center for Buddhist Languages][3]][4]

[3]: http://www.neh.gov/files/neh_logo_horizontal_rgb.jpg
[4]: http://www.neh.gov/

<!---  LocalWords:  API jsdoc Github Mangalam Dubeau LocalWords
 -->
