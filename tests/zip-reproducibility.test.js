import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  getZipTextEntry,
  readUint16,
  readUint32,
  readZipPackage,
  readZipPackageAsync,
  writeZipPackage
} from "../dist/index.js";

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_GENERAL_PURPOSE_FLAG_UTF8 = 0x0800;
const STORE_GOLDEN = JSON.parse(await readFile("tests/fixtures/zip/store-v0.6.0.json", "utf8"));

describe("ZIP reproducibility", () => {
  it("keeps STORE output byte-compatible with the 0.6.0 golden", async () => {
    expect(STORE_GOLDEN.generatedFromHead).toBe("656c5e9");
    for (const item of STORE_GOLDEN.cases) {
      const entries = item.entries.map((entry) => ({
        path: entry.path,
        data: entry.dataHex === undefined ? entry.data : Uint8Array.from(Buffer.from(entry.dataHex, "hex"))
      }));
      const bytes = await writeZipPackage(entries, item.options);
      expect(bytes.byteLength, item.name).toBe(item.length);
      expect(createHash("sha256").update(bytes).digest("hex"), item.name).toBe(item.sha256);
    }
  });

  it("writes stable entry order and fixed timestamps by default", async () => {
    const first = await writeZipPackage([
      { path: "word/document.xml", data: "<doc/>" },
      { path: "[Content_Types].xml", data: "<Types/>" },
      { path: "docProps/core.xml", data: "<core/>" }
    ]);
    const second = await writeZipPackage([
      { path: "docProps/core.xml", data: "<core/>" },
      { path: "word/document.xml", data: "<doc/>" },
      { path: "[Content_Types].xml", data: "<Types/>" }
    ]);

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);

    const result = await readZipPackage(first);
    expect(result.diagnostics).toEqual([]);
    expect(result.entries.map((entry) => entry.path)).toEqual([
      "[Content_Types].xml",
      "docProps/core.xml",
      "word/document.xml"
    ]);
    expect(result.entries.map((entry) => entry.modifiedAt.toISOString())).toEqual([
      "1980-01-01T00:00:00.000Z",
      "1980-01-01T00:00:00.000Z",
      "1980-01-01T00:00:00.000Z"
    ]);
  });

  it("roundtrips stored and deflated entries", async () => {
    const zip = await writeZipPackage(
      [
        { path: "a.txt", data: "alpha" },
        { path: "b.txt", data: "beta", compression: "store" }
      ],
      { compression: "deflate" }
    );
    const result = await readZipPackage(zip);

    expect(result.diagnostics).toEqual([]);
    expect(getZipTextEntry(result.entries, "a.txt")).toBe("alpha");
    expect(getZipTextEntry(result.entries, "b.txt")).toBe("beta");
    expect(result.entries.map((entry) => entry.compression)).toEqual(["deflate", "store"]);
  });

  it("marks written entry names as UTF-8 in local and central headers", async () => {
    const zip = await writeZipPackage([
      { path: "xl/worksheets/表.xml", data: "<worksheet/>" }
    ]);
    const centralDirectoryOffset = findSignature(zip, CENTRAL_DIRECTORY_SIGNATURE);

    expect(readUint16(zip, 6)).toBe(ZIP_GENERAL_PURPOSE_FLAG_UTF8);
    expect(readUint16(zip, centralDirectoryOffset + 8)).toBe(ZIP_GENERAL_PURPOSE_FLAG_UTF8);

    const result = await readZipPackage(zip);
    expect(result.diagnostics).toEqual([]);
    expect(result.entries[0].path).toBe("xl/worksheets/表.xml");
  });

  it("reads deflated entries through the canonical ZIP reader", async () => {
    const zip = await writeZipPackage(
      [
        { path: "word/document.xml", data: "<doc>Hello</doc>" },
        { path: "word/styles.xml", data: "<styles/>" }
      ],
      { compression: "deflate" }
    );
    const result = await readZipPackage(zip);

    expect(result.diagnostics).toEqual([]);
    expect(getZipTextEntry(result.entries, "word/document.xml")).toBe("<doc>Hello</doc>");
    expect(getZipTextEntry(result.entries, "word/styles.xml")).toBe("<styles/>");
    expect(readZipPackageAsync).toBe(readZipPackage);
  });
});

function findSignature(data, signature) {
  for (let offset = 0; offset <= data.length - 4; offset += 1) {
    if (readUint32(data, offset) === signature) {
      return offset;
    }
  }
  throw new Error(`ZIP signature was not found: ${signature.toString(16)}`);
}
