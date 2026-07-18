import { describe, expect, it } from "vitest";
import {
  buildOpcContentTypesXml,
  buildOpcRelationshipsPath,
  buildOpcRelationshipsXml,
  escapeXmlAttribute,
  escapeXmlText,
  listOfficeMediaParts,
  normalizeOpcPartPath,
  parseOpcContentTypesXml,
  parseOpcRelationshipsXml,
  readOfficePackage,
  resolveOpcContentType,
  resolveOpcRelationshipTarget,
  sanitizeXmlText,
  writeZipPackage
} from "../dist/index.js";

describe("OPC helpers", () => {
  it("normalizes part paths and resolves relationship targets", () => {
    expect(normalizeOpcPartPath("/word/./media/../document.xml")).toBe("word/document.xml");
    expect(resolveOpcRelationshipTarget("word/document.xml", "media/image1.png")).toBe("word/media/image1.png");
    expect(resolveOpcRelationshipTarget("word/document.xml", "/docProps/core.xml")).toBe("docProps/core.xml");
    expect(resolveOpcRelationshipTarget("word/document.xml", "https://example.invalid/file")).toBe("https://example.invalid/file");
    expect(resolveOpcRelationshipTarget("word/document.xml", "https://example.invalid/file", "External")).toBe("https://example.invalid/file");
    expect(buildOpcRelationshipsPath("xl/workbook.xml")).toBe("xl/_rels/workbook.xml.rels");
  });

  it("parses relationship and content type XML at the low-level package layer", () => {
    const relationships = parseOpcRelationshipsXml(`
      <Relationships>
        <Relationship Id="rId1" Type="image" Target="media/image1.png"/>
        <Relationship Id="rId2" Type="external" Target="https://example.invalid" TargetMode="External"/>
      </Relationships>
    `);
    expect(relationships).toEqual([
      { id: "rId1", type: "image", target: "media/image1.png" },
      { id: "rId2", type: "external", target: "https://example.invalid", targetMode: "External" }
    ]);

    const contentTypes = parseOpcContentTypesXml(`
      <Types>
        <Default Extension="png" ContentType="image/png"/>
        <Override PartName="/word/document.xml" ContentType="application/doc+xml"/>
      </Types>
    `);
    expect(resolveOpcContentType(contentTypes, "word/document.xml")).toBe("application/doc+xml");
    expect(resolveOpcContentType(contentTypes, "word/media/image1.png")).toBe("image/png");
  });

  it("builds package XML helpers without product semantics", () => {
    const relationshipsXml = buildOpcRelationshipsXml([
      { id: "rId1", type: "officeDocument", target: "xl/workbook.xml" },
      { id: "rId2", type: "external", target: "https://example.invalid/?a=1&b=2", targetMode: "External" }
    ]);
    expect(parseOpcRelationshipsXml(relationshipsXml)).toEqual([
      { id: "rId1", type: "officeDocument", target: "xl/workbook.xml" },
      { id: "rId2", type: "external", target: "https://example.invalid/?a=1&b=2", targetMode: "External" }
    ]);

    const contentTypesXml = buildOpcContentTypesXml({
      defaults: [{ extension: "xml", contentType: "application/xml" }],
      overrides: [{ partName: "xl/workbook.xml", contentType: "application/workbook+xml" }]
    });
    const parsed = parseOpcContentTypesXml(contentTypesXml);
    expect(resolveOpcContentType(parsed, "xl/workbook.xml")).toBe("application/workbook+xml");
  });

  it("reads an Office package without interpreting document meaning", () => {
    const zip = writeZipPackage([
      {
        path: "[Content_Types].xml",
        data: `<Types><Default Extension="png" ContentType="image/png"/></Types>`
      },
      { path: "word/media/image1.png", data: new Uint8Array([1, 2, 3]) }
    ]);
    const officePackage = readOfficePackage(zip);

    expect(officePackage.diagnostics).toEqual([]);
    expect(officePackage.contentTypes?.defaults).toEqual([
      { extension: "png", contentType: "image/png" }
    ]);
    expect(listOfficeMediaParts(officePackage.entries).map((entry) => entry.path)).toEqual([
      "word/media/image1.png"
    ]);
  });

  it("sanitizes XML text before escaping", () => {
    expect(sanitizeXmlText("ok\u0000text")).toBe("oktext");
    expect(sanitizeXmlText("😀 🐇 𠮷野家")).toBe("😀 🐇 𠮷野家");
    expect(escapeXmlText("a\u0000<&>")).toBe("a&lt;&amp;&gt;");
    expect(escapeXmlText("😀 🐇 𠮷野家<&>")).toBe("😀 🐇 𠮷野家&lt;&amp;&gt;");
    expect(escapeXmlAttribute("😀 🐇 𠮷野家\"'&<>")).toBe(
      "😀 🐇 𠮷野家&quot;&apos;&amp;&lt;&gt;"
    );
  });

  it("keeps only XML 1.0 character ranges", () => {
    const validBoundaries = "\uD7FF\uE000\uFFFD\u{10000}\u{10FFFF}";
    expect(sanitizeXmlText(validBoundaries)).toBe(validBoundaries);
    expect(sanitizeXmlText("before\uD800after")).toBe("beforeafter");
    expect(sanitizeXmlText("before\uDC00after")).toBe("beforeafter");
    expect(sanitizeXmlText("before\uFFFE\uFFFFafter")).toBe("beforeafter");
  });
});
