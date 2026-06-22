import { describe, expect, it } from "vitest";
import {
  buildOpcContentTypesXml,
  buildOpcRelationshipsXml,
  getZipTextEntry,
  parseOpcContentTypesXml,
  parseOpcRelationshipsXml,
  readZipPackage,
  resolveOpcContentType,
  writeZipPackage
} from "../dist/index.js";

const REL_OFFICE_DOCUMENT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";
const REL_CORE_PROPERTIES = "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties";
const REL_EXTENDED_PROPERTIES = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties";
const REL_WORKSHEET = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet";
const REL_STYLES = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles";
const REL_DRAWING = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
const REL_IMAGE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

function buildMd2XlsxLikeContentTypes(sheetCount, drawingCount, mediaExtensions) {
  return buildOpcContentTypesXml({
    defaults: [
      { extension: "rels", contentType: "application/vnd.openxmlformats-package.relationships+xml" },
      { extension: "xml", contentType: "application/xml" },
      ...mediaExtensions.map((extension) => ({
        extension,
        contentType: extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`
      }))
    ],
    overrides: [
      {
        partName: "xl/workbook.xml",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
      },
      {
        partName: "xl/styles.xml",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"
      },
      { partName: "docProps/core.xml", contentType: "application/vnd.openxmlformats-package.core-properties+xml" },
      { partName: "docProps/app.xml", contentType: "application/vnd.openxmlformats-officedocument.extended-properties+xml" },
      ...Array.from({ length: sheetCount }, (_unused, index) => ({
        partName: `xl/worksheets/sheet${index + 1}.xml`,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"
      })),
      ...Array.from({ length: drawingCount }, (_unused, index) => ({
        partName: `xl/drawings/drawing${index + 1}.xml`,
        contentType: "application/vnd.openxmlformats-officedocument.drawing+xml"
      }))
    ]
  });
}

describe("miku-md2xlsx proof-of-use package plumbing", () => {
  it("builds an XLSX-like package shell without workbook semantics in core", () => {
    const mediaEntries = [
      { path: "xl/media/image1.png", data: new Uint8Array([1, 2, 3]) },
      { path: "xl/media/image2.jpg", data: new Uint8Array([4, 5, 6]) }
    ];
    const packageBytes = writeZipPackage([
      {
        path: "[Content_Types].xml",
        data: buildMd2XlsxLikeContentTypes(2, 1, ["png", "jpg"])
      },
      {
        path: "_rels/.rels",
        data: buildOpcRelationshipsXml([
          { id: "rId1", type: REL_OFFICE_DOCUMENT, target: "xl/workbook.xml" },
          { id: "rId2", type: REL_CORE_PROPERTIES, target: "docProps/core.xml" },
          { id: "rId3", type: REL_EXTENDED_PROPERTIES, target: "docProps/app.xml" }
        ])
      },
      {
        path: "xl/_rels/workbook.xml.rels",
        data: buildOpcRelationshipsXml([
          { id: "rId1", type: REL_WORKSHEET, target: "worksheets/sheet1.xml" },
          { id: "rId2", type: REL_WORKSHEET, target: "worksheets/sheet2.xml" },
          { id: "rId3", type: REL_STYLES, target: "styles.xml" }
        ])
      },
      {
        path: "xl/worksheets/_rels/sheet1.xml.rels",
        data: buildOpcRelationshipsXml([
          { id: "rId1", type: REL_DRAWING, target: "../drawings/drawing1.xml" }
        ])
      },
      {
        path: "xl/drawings/_rels/drawing1.xml.rels",
        data: buildOpcRelationshipsXml([
          { id: "rId1", type: REL_IMAGE, target: "../media/image1.png" },
          { id: "rId2", type: REL_IMAGE, target: "../media/image2.jpg" }
        ])
      },
      { path: "xl/workbook.xml", data: "<workbook/>" },
      { path: "xl/styles.xml", data: "<styleSheet/>" },
      { path: "xl/worksheets/sheet1.xml", data: "<worksheet/>" },
      { path: "xl/worksheets/sheet2.xml", data: "<worksheet/>" },
      { path: "xl/drawings/drawing1.xml", data: "<xdr:wsDr/>" },
      { path: "docProps/core.xml", data: "<cp:coreProperties/>" },
      { path: "docProps/app.xml", data: "<Properties/>" },
      ...mediaEntries
    ]);

    const readResult = readZipPackage(packageBytes);

    expect(readResult.diagnostics).toEqual([]);
    expect(readResult.entries.map((entry) => entry.path)).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "docProps/app.xml",
      "docProps/core.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/drawings/_rels/drawing1.xml.rels",
      "xl/drawings/drawing1.xml",
      "xl/media/image1.png",
      "xl/media/image2.jpg",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/_rels/sheet1.xml.rels",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml"
    ]);

    const contentTypes = parseOpcContentTypesXml(getZipTextEntry(readResult.entries, "[Content_Types].xml"));
    expect(resolveOpcContentType(contentTypes, "xl/workbook.xml")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
    );
    expect(resolveOpcContentType(contentTypes, "xl/media/image1.png")).toBe("image/png");
    expect(resolveOpcContentType(contentTypes, "xl/media/image2.jpg")).toBe("image/jpeg");

    expect(parseOpcRelationshipsXml(getZipTextEntry(readResult.entries, "_rels/.rels"))).toEqual([
      { id: "rId1", type: REL_OFFICE_DOCUMENT, target: "xl/workbook.xml" },
      { id: "rId2", type: REL_CORE_PROPERTIES, target: "docProps/core.xml" },
      { id: "rId3", type: REL_EXTENDED_PROPERTIES, target: "docProps/app.xml" }
    ]);
    expect(parseOpcRelationshipsXml(getZipTextEntry(readResult.entries, "xl/drawings/_rels/drawing1.xml.rels"))).toEqual([
      { id: "rId1", type: REL_IMAGE, target: "../media/image1.png" },
      { id: "rId2", type: REL_IMAGE, target: "../media/image2.jpg" }
    ]);
  });
});
