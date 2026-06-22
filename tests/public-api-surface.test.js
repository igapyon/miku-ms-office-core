import { describe, expect, it } from "vitest";
import * as core from "../dist/index.js";

describe("public API surface", () => {
  it("exports the current low-level Office package helpers", () => {
    expect(Object.keys(core).sort()).toEqual([
      "asBytes",
      "buildOpcContentTypesXml",
      "buildOpcRelationshipsPath",
      "buildOpcRelationshipsXml",
      "compareOpcPartPaths",
      "concatBytes",
      "createDiagnostic",
      "decodeXmlEntities",
      "escapeXmlAttribute",
      "escapeXmlText",
      "getDefaultZipEntryTimestamp",
      "getZipEntry",
      "getZipTextEntry",
      "listOfficeMediaParts",
      "normalizeOpcPartPath",
      "parseOpcContentTypesXml",
      "parseOpcRelationshipsXml",
      "parseXmlAttributes",
      "readOfficePackage",
      "readOfficePackageAsync",
      "readOfficePartRelationships",
      "readUint16",
      "readUint32",
      "readZipPackage",
      "readZipPackageAsync",
      "relationshipArrayToMap",
      "resolveOpcContentType",
      "resolveOpcRelationshipTarget",
      "resolveOpcRelationships",
      "sanitizeXmlText",
      "textDecoder",
      "textEncoder",
      "upsertZipEntry",
      "writeUint16",
      "writeUint32",
      "writeZipPackage"
    ]);
  });

  it("does not expose pre-naming-pass helper names", () => {
    expect(core).not.toHaveProperty("createZip");
    expect(core).not.toHaveProperty("getTextEntry");
    expect(core).not.toHaveProperty("parseRelationshipsXml");
    expect(core).not.toHaveProperty("parseContentTypesXml");
    expect(core).not.toHaveProperty("normalizePartPath");
  });
});
