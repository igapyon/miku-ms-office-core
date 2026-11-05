import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ZIP_READ_LIMITS,
  DEFAULT_ZIP_WRITE_LIMITS,
  readUint16,
  readUint32,
  readZipPackage,
  writeUint32,
  writeZipPackage,
  ZipError
} from "../dist/index.js";

function changeDeclaredSize(zip, entryIndex, size) {
  let centralOffset = readUint32(zip, zip.length - 6);
  for (let index = 0; index < entryIndex; index += 1) {
    centralOffset += 46 + readUint16(zip, centralOffset + 28) + readUint16(zip, centralOffset + 30) + readUint16(zip, centralOffset + 32);
  }
  const localOffset = readUint32(zip, centralOffset + 42);
  writeUint32(zip, centralOffset + 24, size);
  writeUint32(zip, localOffset + 22, size);
}

describe("ZIP API limits and snapshots", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("exports frozen defaults and applies limits without large allocations", async () => {
    expect(Object.isFrozen(DEFAULT_ZIP_READ_LIMITS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_ZIP_WRITE_LIMITS)).toBe(true);
    const zip = await writeZipPackage([{ path: "a.txt", data: "abc" }]);
    expect((await readZipPackage(zip, { limits: { maxInputBytes: zip.length - 1 } })).diagnostics[0]?.code)
      .toBe("zip.limit.exceeded");
    expect((await readZipPackage(zip, { limits: { maxEntries: 0 } })).diagnostics[0]?.code)
      .toBe("zip.limit.exceeded");
    expect((await readZipPackage(zip, { limits: { maxEntryBytes: 2 } })).diagnostics[0]?.code)
      .toBe("zip.limit.exceeded");
    expect((await readZipPackage(zip, { limits: { maxTotalBytes: 2 } })).diagnostics[0]?.code)
      .toBe("zip.limit.exceeded");
    await expect(writeZipPackage([{ path: "a.txt", data: "abc" }], { limits: { maxTotalBytes: 2 } }))
      .rejects.toMatchObject({ code: "zip.limit.exceeded" });
    await expect(writeZipPackage([], { limits: { maxOutputBytes: 21 } }))
      .rejects.toMatchObject({ code: "zip.limit.exceeded" });
    await expect(writeZipPackage([{ path: "a.txt", data: "abc" }], { limits: { maxOutputBytes: 50 } }))
      .rejects.toMatchObject({ code: "zip.limit.exceeded" });
    expect((await writeZipPackage([], { limits: { maxEntries: 0, maxEntryBytes: 0, maxTotalBytes: 0, maxOutputBytes: 22 } })).length)
      .toBe(22);
  });

  it("rejects obsolete options and malformed limits or entries as ZipError", async () => {
    await expect(readZipPackage(new Uint8Array(), { inflateRaw: () => new Uint8Array() }))
      .rejects.toBeInstanceOf(ZipError);
    await expect(writeZipPackage([], { compressionLevel: 9 }))
      .rejects.toMatchObject({ code: "zip.options.invalid" });
    await expect(writeZipPackage([{ path: "a.txt", data: "x", date: new Date() }]))
      .rejects.toMatchObject({ code: "zip.options.invalid" });
    await expect(writeZipPackage([], { limits: { maxEntries: -1 } }))
      .rejects.toMatchObject({ code: "zip.options.invalid" });
  });

  it("checks every declared size and the total before starting decompression", async () => {
    const zip = await writeZipPackage([
      { path: "a.txt", data: "a", compression: "deflate" },
      { path: "b.txt", data: "bbb", compression: "deflate" }
    ]);
    let started = 0;
    vi.stubGlobal("DecompressionStream", class {
      constructor() {
        started += 1;
        throw new Error("Decompression must not start for an over-budget archive.");
      }
    });
    for (const limits of [{ maxTotalBytes: 3 }, { maxEntryBytes: 2 }]) {
      const result = await readZipPackage(zip, { limits });
      expect(result.entries).toEqual([]);
      expect(result.diagnostics).toMatchObject([{ code: "zip.limit.exceeded", path: "b.txt" }]);
    }
    expect(started).toBe(0);
  });

  it("enforces the remaining total on actual DEFLATE output and prioritizes limits over declared size", async () => {
    const zip = await writeZipPackage([
      { path: "a.txt", data: "aaa" },
      { path: "b.txt", data: "x".repeat(4096), compression: "deflate" }
    ]);
    changeDeclaredSize(zip, 1, 1);
    const overBudget = await readZipPackage(zip, { limits: { maxTotalBytes: 4, maxEntryBytes: 8192 } });
    expect(overBudget.entries).toEqual([]);
    expect(overBudget.diagnostics).toMatchObject([{ code: "zip.limit.exceeded", path: "b.txt" }]);

    const overDeclaration = await readZipPackage(zip, { limits: { maxTotalBytes: 8192, maxEntryBytes: 8192 } });
    expect(overDeclaration.entries).toEqual([]);
    expect(overDeclaration.diagnostics).toMatchObject([{ code: "zip.entry.size_mismatch", path: "b.txt" }]);
  });

  it("accepts exact total budgets and empty DEFLATE output with zero budgets", async () => {
    const zip = await writeZipPackage([
      { path: "a.txt", data: "aaa", compression: "deflate" },
      { path: "b.txt", data: "b", compression: "deflate" }
    ]);
    const result = await readZipPackage(zip, { limits: { maxEntryBytes: 3, maxTotalBytes: 4 } });
    expect(result.diagnostics).toEqual([]);
    expect(result.entries.map((entry) => entry.data.length)).toEqual([3, 1]);
    const empty = await writeZipPackage([{ path: "empty", data: "", compression: "deflate" }]);
    expect((await readZipPackage(empty, { limits: { maxEntryBytes: 0, maxTotalBytes: 0 } })).diagnostics).toEqual([]);
  });

  it.each(["store", "deflate"])("rejects an abort immediately after starting a %s write", async (compression) => {
    const controller = new AbortController();
    const pending = writeZipPackage([{ path: "a.txt", data: "abc", compression }], { signal: controller.signal });
    controller.abort("caller cancelled");
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("checks pre-aborted read signals before input limits", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(readZipPackage(new Uint8Array([1]), { signal: controller.signal, limits: { maxInputBytes: 0 } }))
      .rejects.toMatchObject({ name: "AbortError" });
  });

  it("snapshots mutable bytes and timestamp before asynchronous work", async () => {
    const input = new Uint8Array([65, 66, 67]);
    const timestamp = new Date(Date.UTC(2000, 0, 2, 3, 4, 6));
    const write = writeZipPackage([{ path: "a.txt", data: input }], { timestamp });
    input.fill(0);
    timestamp.setUTCFullYear(2020);
    const zip = await write;
    const read = await readZipPackage(zip);
    expect(new TextDecoder().decode(read.entries[0]?.data)).toBe("ABC");
    expect(read.entries[0]?.modifiedAt.toISOString()).toBe("2000-01-02T03:04:06.000Z");

    const source = await writeZipPackage([{ path: "a.txt", data: "snapshot", compression: "deflate" }]);
    const pending = readZipPackage(source);
    source.fill(0);
    expect((await pending).entries.map((entry) => new TextDecoder().decode(entry.data))).toEqual(["snapshot"]);
  });

  it("reports missing compression or decompression streams only when the operation needs them", async () => {
    const compressionStream = globalThis.CompressionStream;
    vi.stubGlobal("CompressionStream", undefined);
    await expect(writeZipPackage([{ path: "a.txt", data: "x", compression: "deflate" }]))
      .rejects.toMatchObject({ code: "zip.runtime.unsupported" });
    const stored = await writeZipPackage([{ path: "a.txt", data: "x" }]);
    expect((await readZipPackage(stored)).diagnostics).toEqual([]);
    vi.stubGlobal("CompressionStream", compressionStream);
    vi.stubGlobal("DecompressionStream", undefined);
    const deflated = await writeZipPackage([{ path: "a.txt", data: "x", compression: "deflate" }]);
    await expect(readZipPackage(deflated)).rejects.toMatchObject({ code: "zip.runtime.unsupported" });
  });
});
