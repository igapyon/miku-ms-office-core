import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  readOfficePackage,
  readOfficePartRelationships,
  relationshipArrayToMap,
  resolveOpcContentType
} from "../dist/index.js";

const FIXTURE_DIR = "tests/fixtures/office";
const REL_NUMBERING = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering";
const REL_STYLES = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles";
const REL_WORKSHEET = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet";

async function readFixturePackage(name) {
  const bytes = new Uint8Array(await readFile(`${FIXTURE_DIR}/${name}`));
  return readOfficePackage(bytes);
}

describe("real Office package fixtures", () => {
  it("reads a real DOCX fixture at the package plumbing layer", async () => {
    const officePackage = await readFixturePackage("word-headings-basic.docx");

    expect(officePackage.diagnostics).toEqual([]);
    expect(officePackage.entries.some((entry) => entry.path === "word/document.xml")).toBe(true);
    expect(resolveOpcContentType(officePackage.contentTypes, "word/document.xml")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
    );

    const relationships = relationshipArrayToMap(
      readOfficePartRelationships(officePackage.entries, "word/document.xml")
    );

    expect(relationships.get("rId1")).toEqual({
      id: "rId1",
      type: REL_NUMBERING,
      target: "word/numbering.xml"
    });
    expect(relationships.get("rId2")).toEqual({
      id: "rId2",
      type: REL_STYLES,
      target: "word/styles.xml"
    });
  });

  it("reads a real XLSX fixture from miku-xlsx2md at the package plumbing layer", async () => {
    const officePackage = await readFixturePackage("xlsx2md-basic-sample01.xlsx");

    expect(officePackage.diagnostics).toEqual([]);
    expect(resolveOpcContentType(officePackage.contentTypes, "xl/workbook.xml")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
    );
    expect(resolveOpcContentType(officePackage.contentTypes, "xl/worksheets/sheet1.xml")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"
    );

    const relationships = relationshipArrayToMap(
      readOfficePartRelationships(officePackage.entries, "xl/workbook.xml")
    );

    expect(relationships.get("rId1")).toEqual({
      id: "rId1",
      type: REL_WORKSHEET,
      target: "xl/worksheets/sheet1.xml"
    });
  });

  it("reads a real mikuproject XLSX fixture at the package plumbing layer", async () => {
    const officePackage = await readFixturePackage("mikuproject-sample.xlsx");

    expect(officePackage.diagnostics).toEqual([]);
    expect(resolveOpcContentType(officePackage.contentTypes, "xl/workbook.xml")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
    );

    const relationships = readOfficePartRelationships(officePackage.entries, "xl/workbook.xml");
    expect(relationships.filter((relationship) => relationship.type === REL_WORKSHEET).map((relationship) => relationship.target)).toEqual([
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
      "xl/worksheets/sheet3.xml",
      "xl/worksheets/sheet4.xml",
      "xl/worksheets/sheet5.xml",
      "xl/worksheets/sheet6.xml",
      "xl/worksheets/sheet7.xml"
    ]);
  });
});
