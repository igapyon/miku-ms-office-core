import { describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import { getZipTextEntry, readZipPackage, readZipPackageAsync, writeZipPackage } from "../dist/index.js";

describe("ZIP reproducibility", () => {
  it("writes stable entry order and fixed timestamps by default", () => {
    const first = writeZipPackage([
      { path: "word/document.xml", data: "<doc/>" },
      { path: "[Content_Types].xml", data: "<Types/>" },
      { path: "docProps/core.xml", data: "<core/>" }
    ]);
    const second = writeZipPackage([
      { path: "docProps/core.xml", data: "<core/>" },
      { path: "word/document.xml", data: "<doc/>" },
      { path: "[Content_Types].xml", data: "<Types/>" }
    ]);

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);

    const result = readZipPackage(first);
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

  it("roundtrips stored and deflated entries", () => {
    const zip = writeZipPackage(
      [
        { path: "a.txt", data: "alpha" },
        { path: "b.txt", data: "beta", compression: "store" }
      ],
      { compression: "deflate" }
    );
    const result = readZipPackage(zip);

    expect(result.diagnostics).toEqual([]);
    expect(getZipTextEntry(result.entries, "a.txt")).toBe("alpha");
    expect(getZipTextEntry(result.entries, "b.txt")).toBe("beta");
    expect(result.entries.map((entry) => entry.compression)).toEqual(["deflate", "store"]);
  });

  it("reads deflated entries through the async ZIP reader", async () => {
    const zip = writeZipPackage(
      [
        { path: "word/document.xml", data: "<doc>Hello</doc>" },
        { path: "word/styles.xml", data: "<styles/>" }
      ],
      { compression: "deflate" }
    );
    const calls = [];
    const result = await readZipPackageAsync(zip, {
      inflateRaw(data, expectedSize, path) {
        calls.push({ expectedSize, path });
        return new Uint8Array(inflateRawSync(data));
      }
    });

    expect(result.diagnostics).toEqual([]);
    expect(calls.map((call) => call.path)).toEqual(["word/document.xml", "word/styles.xml"]);
    expect(getZipTextEntry(result.entries, "word/document.xml")).toBe("<doc>Hello</doc>");
    expect(getZipTextEntry(result.entries, "word/styles.xml")).toBe("<styles/>");
  });
});
