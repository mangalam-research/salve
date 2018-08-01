Here is a series of steps that should typically be used to release new
versions.

The following assumes that ``origin`` is **a private fork** and
``upstream`` is the main repository.

1. ``$ npm version [new version]``

2. Check the format of the generated changelog entries. Perform whatever other
changes must happen and commit.

3. Push the release to ``origin`` so that Travis is run. **THIS IS IMPORTANT.**
   The local test may run fine but you may still get a failure on Travis because
   the dependencies allow loading a newer package version that causes a
   failure. It *has* happened.

4. ``$ git flow release finish [version]``

5. ``$ gulp publish``

6. ``$ git push origin : --follow-tags``

7. ``$ git push upstream : --follow-tags``
