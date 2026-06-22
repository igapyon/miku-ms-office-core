import { describe, expect, it } from "vitest";
import {
  buildOpcContentTypesXml,
  buildOpcRelationshipsXml,
  listOfficeMediaParts,
  readOfficePackage,
  readOfficePackageAsync,
  readOfficePartRelationships,
  relationshipArrayToMap,
  resolveOpcContentType,
  writeZipPackage
} from "../dist/index.js";

const REL_IMAGE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const REL_WORKSHEET = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet";
const REL_STYLES = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles";
const REL_HYPERLINK = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";

describe("read-side proof-of-use package plumbing", () => {
  it("loads package parts, content types, media, and resolved part relationships", async () => {
    const packageBytes = writeZipPackage([
      {
        path: "[Content_Types].xml",
        data: buildOpcContentTypesXml({
          defaults: [
            { extension: "rels", contentType: "application/vnd.openxmlformats-package.relationships+xml" },
            { extension: "xml", contentType: "application/xml" },
            { extension: "png", contentType: "image/png" }
          ],
          overrides: [
            {
              partName: "word/document.xml",
              contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
            },
            {
              partName: "xl/workbook.xml",
              contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
            },
            {
              partName: "xl/worksheets/sheet1.xml",
              contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"
            }
          ]
        })
      },
      {
        path: "word/_rels/document.xml.rels",
        data: buildOpcRelationshipsXml([
          { id: "rIdImage", type: REL_IMAGE, target: "media/image1.png" },
          {
            id: "rIdExternal",
            type: REL_HYPERLINK,
            target: "https://example.com/read-side",
            targetMode: "External"
          }
        ])
      },
      {
        path: "xl/_rels/workbook.xml.rels",
        data: buildOpcRelationshipsXml([
          { id: "rIdSheet1", type: REL_WORKSHEET, target: "worksheets/sheet1.xml" },
          { id: "rIdStyles", type: REL_STYLES, target: "styles.xml" }
        ])
      },
      { path: "word/document.xml", data: "<w:document/>" },
      { path: "word/media/image1.png", data: new Uint8Array([1, 2, 3]) },
      { path: "xl/workbook.xml", data: "<workbook/>" },
      { path: "xl/worksheets/sheet1.xml", data: "<worksheet/>" },
      { path: "xl/styles.xml", data: "<styleSheet/>" }
    ]);

    const officePackage = await readOfficePackageAsync(packageBytes);
    const syncOfficePackage = readOfficePackage(packageBytes);

    expect(officePackage.diagnostics).toEqual([]);
    expect(syncOfficePackage.diagnostics).toEqual([]);
    expect(resolveOpcContentType(officePackage.contentTypes, "word/media/image1.png")).toBe("image/png");
    expect(listOfficeMediaParts(officePackage.entries).map((entry) => entry.path)).toEqual([
      "word/media/image1.png"
    ]);

    const docRelationships = relationshipArrayToMap(
      readOfficePartRelationships(officePackage.entries, "word/document.xml")
    );
    expect(docRelationships.get("rIdImage")).toEqual({
      id: "rIdImage",
      type: REL_IMAGE,
      target: "word/media/image1.png"
    });
    expect(docRelationships.get("rIdExternal")).toEqual({
      id: "rIdExternal",
      type: REL_HYPERLINK,
      target: "https://example.com/read-side",
      targetMode: "External"
    });

    const workbookRelationships = relationshipArrayToMap(
      readOfficePartRelationships(officePackage.entries, "xl/workbook.xml")
    );
    expect(workbookRelationships.get("rIdSheet1")).toEqual({
      id: "rIdSheet1",
      type: REL_WORKSHEET,
      target: "xl/worksheets/sheet1.xml"
    });
    expect(workbookRelationships.get("rIdStyles")).toEqual({
      id: "rIdStyles",
      type: REL_STYLES,
      target: "xl/styles.xml"
    });

    expect(readOfficePartRelationships(officePackage.entries, "xl/worksheets/sheet1.xml")).toEqual([]);
  });
});
