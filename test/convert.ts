/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

/* global it describe before */

"use strict";

import * as path from "path";

import { expect } from "chai";
import fileUrl from "file-url";

import { ConversionResult, convertRNGToPattern, makeResourceLoader,
         Resource, ResourceLoader } from "../build/dist";

class MyResource implements Resource {
  constructor(readonly delegate: Resource) {}

  get url(): URL {
    return this.delegate.url;
  }

  getText(): Promise<string> {
    return this.delegate.getText();
  }
}

class MyLoader implements ResourceLoader<MyResource> {
  private readonly delegate: ResourceLoader = makeResourceLoader();
  used: boolean = false;

  async load(url: URL): Promise<MyResource> {
    this.used = true;

    return new MyResource(await this.delegate.load(url));
  }
}

describe("convertRNGToPattern", () => {
  describe("with a manifest", () => {
    let result: ConversionResult;
    let resourceLoader: MyLoader;

    before(async () => {
      resourceLoader = new MyLoader();
      result = await convertRNGToPattern(new URL(fileUrl(
        path.join(__dirname, "inclusion/doc-unannotated.rng"))),
                                         {
          createManifest: true,
          manifestHashAlgorithm: "SHA-1",
          resourceLoader,
        });
    });

    it("converts", () => {
      expect(result).to.have.property("pattern");
    });

    it("has a simplified tree", () => {
      expect(result).to.have.property("simplified");
    });

    it("has no warnings", () => {
      expect(result).to.have.property("warnings").lengthOf(0);
    });

    it("has a manifest", () => {
      expect(result).to.have.property("manifest").deep.members([{
        filePath: `file://${__dirname}/inclusion/doc-unannotated.rng`,
        hash: "SHA-1-4abdf9d7531a342b88d2407f1077a6e96ce97476",
      }, {
        filePath: `file://${__dirname}/inclusion/doc-common.rng`,
        hash: "SHA-1-c4e57689cf2c39239f654eb9ae5cfaa07f858455",
      }]);
    });

    it("uses a custom loader", () => {
      expect(resourceLoader).to.have.property("used").true;
    });
  });

  describe("with a custom hash function", () => {
    let result: ConversionResult;
    let resourceLoader: MyLoader;
    let count = 1;

    before(async () => {
      resourceLoader = new MyLoader();
      result = await convertRNGToPattern(new URL(fileUrl(
        path.join(__dirname, "inclusion/doc-unannotated.rng"))),
                                         {
          createManifest: true,
          manifestHashAlgorithm: async (resource: MyResource):
          Promise<string> => {
            expect(resource).to.be.instanceOf(MyResource);

            return String(count++);
          },
          resourceLoader,
        });
    });

    it("converts", () => {
      expect(result).to.have.property("pattern");
    });

    it("has a simplified tree", () => {
      expect(result).to.have.property("simplified");
    });

    it("has no warnings", () => {
      expect(result).to.have.property("warnings").lengthOf(0);
    });

    it("has a manifest", () => {
      expect(result).to.have.property("manifest").deep.members([{
        filePath: `file://${__dirname}/inclusion/doc-unannotated.rng`,
        hash: "1",
      }, {
        filePath: `file://${__dirname}/inclusion/doc-common.rng`,
        hash: "2",
      }]);
    });

    it("uses a custom loader", () => {
      expect(resourceLoader).to.have.property("used").true;
    });
  });

  describe("without manifest", () => {
    let result: ConversionResult;

    before(async () => {
      result = await convertRNGToPattern(new URL(fileUrl(
        path.join(__dirname, "inclusion/doc-unannotated.rng"))));
    });

    it("converts", () => {
      expect(result).to.have.property("pattern");
    });

    it("has a simplified tree", () => {
      expect(result).to.have.property("simplified");
    });

    it("has no warnings", () => {
      expect(result).to.have.property("warnings").lengthOf(0);
    });

    it("has a manifest", () => {
      expect(result).to.have.property("manifest").lengthOf(0);
    });
  });
});
