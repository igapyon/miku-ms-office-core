import { deflateRawSync, inflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deflateRawBytes, inflateRawBytes } from "../dist/zip-streams.js";

afterEach(() => vi.unstubAllGlobals());

describe("standard raw ZIP streams", () => {
  it("compresses and inflates empty, text, and binary inputs", async () => {
    for (const input of [
      new Uint8Array(),
      new TextEncoder().encode("日本語 ZIP stream"),
      Uint8Array.from({ length: 150_000 }, (_value, index) => index % 251)
    ]) {
      const compressed = await deflateRawBytes(input, input.byteLength + 4096);
      expect(Buffer.from(inflateRawSync(compressed)).equals(Buffer.from(input))).toBe(true);
      expect(Buffer.from(await inflateRawBytes(compressed, input.byteLength, input.byteLength, "probe.bin"))
        .equals(Buffer.from(input))).toBe(true);
    }
  });

  it("reads raw DEFLATE produced by Node and rejects corrupt or oversized output", async () => {
    const input = new TextEncoder().encode("standard API interoperability");
    const compressed = new Uint8Array(deflateRawSync(input));
    expect(await inflateRawBytes(compressed, input.byteLength, input.byteLength, "interop.bin"))
      .toEqual(input);
    await expect(inflateRawBytes(compressed, input.byteLength - 1, input.byteLength, "interop.bin"))
      .rejects.toMatchObject({ code: "zip.limit.exceeded" });
    await expect(inflateRawBytes(compressed, input.byteLength, input.byteLength + 1, "interop.bin"))
      .rejects.toMatchObject({ code: "zip.entry.size_mismatch" });
    await expect(inflateRawBytes(new Uint8Array([1, 2, 3]), 100, 1, "broken.bin"))
      .rejects.toMatchObject({ code: "zip.entry.read_failed" });
  });

  it("aborts an in-flight operation with AbortError", async () => {
    const input = new Uint8Array(2 * 1024 * 1024).fill(7);
    const controller = new AbortController();
    const pending = deflateRawBytes(input, input.byteLength * 2, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("cancels at the first chunk exceeding the declaration, with limit errors taking priority", async () => {
    for (const [budget, code] of [[1000, "zip.entry.size_mismatch"], [1, "zip.limit.exceeded"]]) {
      let pulls = 0;
      let cancelled = false;
      vi.stubGlobal("DecompressionStream", class {
        writable = new WritableStream();
        readable = new ReadableStream({
          pull(controller) {
            pulls += 1;
            controller.enqueue(new Uint8Array(2));
            if (pulls === 50) controller.close();
          },
          cancel() { cancelled = true; }
        }, { highWaterMark: 0 });
      });
      await expect(inflateRawBytes(new Uint8Array(), budget, 1, "probe.bin"))
        .rejects.toMatchObject({ code });
      expect(pulls).toBe(1);
      expect(cancelled).toBe(true);
    }
  });

  it("reports an unavailable raw stream runtime without importing Node modules", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    await expect(deflateRawBytes(new Uint8Array([1]), 100))
      .rejects.toMatchObject({ code: "zip.runtime.unsupported" });
  });
});
