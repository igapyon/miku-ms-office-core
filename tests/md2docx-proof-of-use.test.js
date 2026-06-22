import { describe, expect, it } from "vitest";
import {
  buildOpcContentTypesXml,
  buildOpcRelationshipsXml,
  getZipTextEntry,
  parseOpcRelationshipsXml,
  readZipPackage,
  writeZipPackage
} from "../dist/index.js";

const REL_OFFICE_DOCUMENT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";
const REL_HYPERLINK = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";
const REL_IMAGE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const REL_STYLES = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles";
const REL_NUMBERING = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering";

function imageContentType(extension) {
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

function buildMd2DocxLikeContentTypes(imageEntries) {
  const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
  for (const image of imageEntries) {
    const extension = image.path.split(".").pop()?.toLowerCase();
    if (extension) {
      imageExtensions.add(extension);
    }
  }

  return buildOpcContentTypesXml({
    defaults: [
      { extension: "rels", contentType: "application/vnd.openxmlformats-package.relationships+xml" },
      { extension: "xml", contentType: "application/xml" },
      ...Array.from(imageExtensions).map((extension) => ({
        extension,
        contentType: imageContentType(extension)
      }))
    ],
    overrides: [
      {
        partName: "word/document.xml",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
      },
      {
        partName: "word/styles.xml",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"
      },
      {
        partName: "word/numbering.xml",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"
      },
      {
        partName: "docProps/core.xml",
        contentType: "application/vnd.openxmlformats-package.core-properties+xml"
      },
      {
        partName: "docProps/app.xml",
        contentType: "application/vnd.openxmlformats-officedocument.extended-properties+xml"
      }
    ]
  });
}

function buildMd2DocxLikeDocumentRelationships(productRelationships) {
  return buildOpcRelationshipsXml([
    { id: "rIdStyles", type: REL_STYLES, target: "styles.xml" },
    { id: "rIdNumbering", type: REL_NUMBERING, target: "numbering.xml" },
    ...productRelationships
  ]);
}

describe("miku-md2docx proof-of-use package plumbing", () => {
  it("builds a DOCX-like package shell without DOCX document semantics in core", () => {
    const imageEntries = [
      { path: "word/media/image1.gif", data: new Uint8Array([1, 2, 3]) },
      { path: "word/media/image2.bin", data: new Uint8Array([4, 5, 6]) }
    ];
    const documentRelationships = buildMd2DocxLikeDocumentRelationships([
      {
        id: "rId1",
        type: REL_HYPERLINK,
        target: "https://example.com/path?a=1&b=2",
        targetMode: "External"
      },
      { id: "rId2", type: REL_IMAGE, target: "media/image1.gif" }
    ]);

    const packageBytes = writeZipPackage([
      { path: "[Content_Types].xml", data: buildMd2DocxLikeContentTypes(imageEntries) },
      {
        path: "_rels/.rels",
        data: buildOpcRelationshipsXml([
          { id: "rId1", type: REL_OFFICE_DOCUMENT, target: "word/document.xml" }
        ])
      },
      { path: "docProps/app.xml", data: "<Properties/>" },
      { path: "docProps/core.xml", data: "<cp:coreProperties/>" },
      { path: "word/document.xml", data: "<w:document/>" },
      { path: "word/_rels/document.xml.rels", data: documentRelationships },
      { path: "word/styles.xml", data: "<w:styles/>" },
      { path: "word/numbering.xml", data: "<w:numbering/>" },
      ...imageEntries
    ]);

    const readResult = readZipPackage(packageBytes);

    expect(readResult.diagnostics).toEqual([]);
    expect(readResult.entries.map((entry) => entry.path)).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "docProps/app.xml",
      "docProps/core.xml",
      "word/_rels/document.xml.rels",
      "word/document.xml",
      "word/media/image1.gif",
      "word/media/image2.bin",
      "word/numbering.xml",
      "word/styles.xml"
    ]);

    const contentTypesXml = getZipTextEntry(readResult.entries, "[Content_Types].xml");
    expect(contentTypesXml).toContain('Default Extension="gif" ContentType="image/gif"');
    expect(contentTypesXml).toContain('Default Extension="bin" ContentType="application/octet-stream"');
    expect(contentTypesXml).toContain('Override PartName="/word/document.xml"');

    const relsXml = getZipTextEntry(readResult.entries, "word/_rels/document.xml.rels");
    expect(relsXml).toContain("a=1&amp;b=2");
    expect(parseOpcRelationshipsXml(relsXml)).toEqual([
      { id: "rIdStyles", type: REL_STYLES, target: "styles.xml" },
      { id: "rIdNumbering", type: REL_NUMBERING, target: "numbering.xml" },
      {
        id: "rId1",
        type: REL_HYPERLINK,
        target: "https://example.com/path?a=1&b=2",
        targetMode: "External"
      },
      { id: "rId2", type: REL_IMAGE, target: "media/image1.gif" }
    ]);
  });
});
