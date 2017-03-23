Here is a series of steps that should typically be used to release new
versions.

The following assumes that ``origin`` is **a private fork** and
``upstream`` is the main repository.

1. ``$ git flow release start [new version, **without** the `v`]``

2. ``$ versync -b [new version]``

3. Perform whatever other changes must happen and commit.

4. ``$ gulp test``

5. ``$ gulp install_test`` This performs a package installation test.

6. Push the release to ``origin`` so that Travis is run. **THIS IS IMPORTANT.**
   The local test may run fine but you may still get a failure on Travis because
   the dependencies allow loading a newer package version that causes a
   failure. It *has* happened.

7. ``$ git flow release finish [version]``

8. ``$ gulp publish``

9. ``$ git push origin : --follow-tags``

10. ``$ git push upstream : --follow-tags``
