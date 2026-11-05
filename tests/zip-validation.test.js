import { describe, expect, it } from "vitest";
import {
  readOfficePackage,
  readUint16,
  readUint32,
  readZipPackage,
  writeUint16,
  writeUint32,
  writeZipPackage
} from "../dist/index.js";

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;

function findSignature(bytes, signature, start = 0) {
  for (let offset = start; offset <= bytes.length - 4; offset += 1) {
    if (readUint32(bytes, offset) === signature) return offset;
  }
  throw new Error(`signature not found: ${signature.toString(16)}`);
}

function appendDescriptor(zip, withSignature) {
  const oldEocd = findSignature(zip, EOCD);
  const centralOffset = readUint32(zip, oldEocd + 16);
  const localNameLength = readUint16(zip, 26);
  const localExtraLength = readUint16(zip, 28);
  const payloadEnd = 30 + localNameLength + localExtraLength + readUint32(zip, 18);
  const descriptorBytes = withSignature ? 16 : 12;
  const output = new Uint8Array(zip.length + descriptorBytes);
  output.set(zip.subarray(0, payloadEnd));
  output.set(zip.subarray(payloadEnd, centralOffset), payloadEnd + descriptorBytes);
  output.set(zip.subarray(centralOffset), centralOffset + descriptorBytes);
  const central = centralOffset + descriptorBytes;
  const eocd = oldEocd + descriptorBytes;
  const flags = readUint16(output, central + 8) | 0x0008;
  writeUint16(output, 6, flags);
  writeUint32(output, 14, 0);
  writeUint32(output, 18, 0);
  writeUint32(output, 22, 0);
  writeUint16(output, central + 8, flags);
  let descriptorOffset = payloadEnd;
  if (withSignature) {
    writeUint32(output, descriptorOffset, 0x08074b50);
    descriptorOffset += 4;
  }
  writeUint32(output, descriptorOffset, readUint32(output, central + 16));
  writeUint32(output, descriptorOffset + 4, readUint32(output, central + 20));
  writeUint32(output, descriptorOffset + 8, readUint32(output, central + 24));
  writeUint32(output, eocd + 16, centralOffset + descriptorBytes);
  return output;
}

describe("ZIP structure validation", () => {
  it("accepts an empty ZIP and a correctly sized end-record comment", async () => {
    const empty = await writeZipPackage([]);
    expect(await readZipPackage(empty)).toEqual({ entries: [], diagnostics: [] });
    const comment = new TextEncoder().encode("core test comment");
    const withComment = new Uint8Array(empty.length + comment.length);
    withComment.set(empty);
    const eocd = findSignature(withComment, EOCD);
    writeUint16(withComment, eocd + 20, comment.length);
    withComment.set(comment, empty.length);
    expect(await readZipPackage(withComment)).toEqual({ entries: [], diagnostics: [] });
  });

  it("rejects a missing end record and does not add OPC warnings after a ZIP error", async () => {
    const result = await readZipPackage(new Uint8Array([1, 2, 3]));
    expect(result.entries).toEqual([]);
    expect(result.diagnostics.map((item) => item.code)).toEqual(["zip.eocd.missing"]);
    expect((await readOfficePackage(new Uint8Array([1, 2, 3]))).diagnostics.map((item) => item.code))
      .toEqual(["zip.eocd.missing"]);
  });

  it("checks local headers, CRCs, duplicate normalized names, and unsupported features", async () => {
    const source = await writeZipPackage([{ path: "a.txt", data: "data" }]);

    const badLocalName = new Uint8Array(source);
    badLocalName[30] = "b".charCodeAt(0);
    expect((await readZipPackage(badLocalName)).diagnostics[0]?.code).toBe("zip.local_header.invalid");

    const badCrc = new Uint8Array(source);
    const central = findSignature(badCrc, CENTRAL);
    writeUint32(badCrc, 14, 0);
    writeUint32(badCrc, central + 16, 0);
    expect((await readZipPackage(badCrc)).diagnostics[0]?.code).toBe("zip.entry.crc_mismatch");

    const pair = await writeZipPackage([{ path: "a.txt", data: "one" }, { path: "b.txt", data: "two" }]);
    const secondCentral = findSignature(pair, CENTRAL, findSignature(pair, CENTRAL) + 1);
    pair[secondCentral + 46] = "a".charCodeAt(0);
    expect((await readZipPackage(pair)).diagnostics[0]?.code).toBe("zip.path.duplicate");

    const encrypted = new Uint8Array(source);
    const encryptedCentral = findSignature(encrypted, CENTRAL);
    writeUint16(encrypted, encryptedCentral + 8, 1);
    expect((await readZipPackage(encrypted)).diagnostics[0]?.code).toBe("zip.feature.unsupported");

    const zip64 = new Uint8Array(source);
    writeUint16(zip64, findSignature(zip64, EOCD) + 10, 0xffff);
    expect((await readZipPackage(zip64)).diagnostics[0]?.code).toBe("zip.feature.unsupported");

    const unsupportedMethod = new Uint8Array(source);
    writeUint16(unsupportedMethod, findSignature(unsupportedMethod, CENTRAL) + 10, 12);
    expect((await readZipPackage(unsupportedMethod)).diagnostics[0]?.code).toBe("zip.compression.unsupported");

    const multiDisk = new Uint8Array(source);
    writeUint16(multiDisk, findSignature(multiDisk, EOCD) + 4, 1);
    expect((await readZipPackage(multiDisk)).diagnostics[0]?.code).toBe("zip.feature.unsupported");

    const invalidUtf8 = new Uint8Array(source);
    const invalidUtf8Central = findSignature(invalidUtf8, CENTRAL);
    invalidUtf8[30] = 0xff;
    invalidUtf8[invalidUtf8Central + 46] = 0xff;
    expect((await readZipPackage(invalidUtf8)).diagnostics[0]?.code).toBe("zip.path.invalid");

    const invalidOffset = new Uint8Array(source);
    writeUint32(invalidOffset, findSignature(invalidOffset, CENTRAL) + 42, 0xfffffffe);
    expect((await readZipPackage(invalidOffset)).diagnostics[0]?.code).toBe("zip.local_header.invalid");

    const badSize = new Uint8Array(source);
    const sizeCentral = findSignature(badSize, CENTRAL);
    writeUint32(badSize, 22, 3);
    writeUint32(badSize, sizeCentral + 24, 3);
    expect((await readZipPackage(badSize)).diagnostics[0]?.code).toBe("zip.entry.size_mismatch");

    const directory = new Uint8Array(source);
    const directoryCentral = findSignature(directory, CENTRAL);
    directory[34] = "/".charCodeAt(0);
    directory[directoryCentral + 50] = "/".charCodeAt(0);
    const directoryResult = await readZipPackage(directory);
    expect(directoryResult.diagnostics).toEqual([]);
    expect(directoryResult.entries).toEqual([]);
  });

  it("reads signed and unsigned ZIP32 data descriptors", async () => {
    const source = await writeZipPackage([{ path: "a.txt", data: "descriptor" }]);
    for (const signed of [false, true]) {
      const result = await readZipPackage(appendDescriptor(source, signed));
      expect(result.diagnostics).toEqual([]);
      expect(new TextDecoder().decode(result.entries[0]?.data)).toBe("descriptor");
    }
  });

  it("discards earlier successful entries when a later deflate stream is corrupt", async () => {
    const source = await writeZipPackage([
      { path: "a.txt", data: "valid stored entry" },
      { path: "z.txt", data: "this compressed stream is corrupted", compression: "deflate" }
    ]);
    const central = findSignature(source, CENTRAL, findSignature(source, CENTRAL) + 1);
    const localOffset = readUint32(source, central + 42);
    const payloadOffset = localOffset + 30 + readUint16(source, localOffset + 26) + readUint16(source, localOffset + 28);
    const compressedSize = readUint32(source, central + 20);
    source.fill(0xff, payloadOffset, payloadOffset + compressedSize);

    const result = await readZipPackage(source);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe("zip.entry.read_failed");
  });
});
