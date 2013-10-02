-include local.mk

JSDOC3?=jsdoc
RST2HTML?=rst2html

all: build

LIB_FILES:=$(shell find lib -type f -not -name "*_flymake.*" -not -path "lib/salve/parse.js")
BUILD_LIB_FILES:=$(foreach f,$(LIB_FILES),build/$f)

.PHONY: build-dir
build-dir:
	-@[ -e build ] || mkdir build

.PHONY: build
build: $(BUILD_LIB_FILES) | build-dir

build/lib/%: lib/%
	-@[ -e $(dir $@) ] || mkdir -p $(dir $@)
	cp $< $@

.PHONY: test
test: build
	semver-sync -v
	mocha $(MOCHA_PARAMS)

.PHONY: doc
doc:
	$(JSDOC3) -d build/doc -r lib
# rst2html does not seem to support rewriting relative
# urls. So we produce the html in our root.
	$(RST2HTML) README.rst README.html

.PHONY: clean
clean:
	-rm -rf build
	-rm README.html
