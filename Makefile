all: build

# This is admitedly primitive and wasteful. Settling on a better build method
# is part of the TODO.
.PHONY: build
build:
	-rm -rf build
	mkdir build
	ls lib/salve/*.js | grep -v parse.js | xargs -n1 -iXX cp --parents -rp XX build

.PHONY: test
test: build
	mocha

.PHONY: prepublish
prepublish:
	@semver-sync -v
	@[ "$$(git status --untracked-files=no --porcelain | head -n1)" = "" ] || echo "Uncommited changes!"
