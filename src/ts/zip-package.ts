import { asBytes, concatBytes, readUint16, readUint32, textDecoder, textEncoder, writeUint16, writeUint32 } from "./binary-io.js";
import { crc32 } from "./crc32.js";
import { createDiagnostic, type OfficeDiagnostic } from "./diagnostics.js";
import { compareOpcPartPaths, normalizeOpcPartPath } from "./opc-part-path.js";

export type ZipCompressionMethod = "store" | "deflate";

export interface ZipEntryInput {
  path: string;
  data: Uint8Array | string;
  compression?: ZipCompressionMethod;
  modifiedAt?: Date;
}

export interface ZipEntry {
  path: string;
  data: Uint8Array;
  compression: ZipCompressionMethod;
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  modifiedAt: Date;
}

export interface ZipReadResult {
  entries: ZipEntry[];
  diagnostics: OfficeDiagnostic[];
}

export interface ZipReadOptions {
  inflateRaw?: (data: Uint8Array, expectedSize: number, path: string) => Uint8Array | Promise<Uint8Array>;
}

export interface ZipWriteOptions {
  timestamp?: Date;
  compression?: ZipCompressionMethod;
  order?: "stable" | "input";
  compressionLevel?: number;
}

interface CentralDirectoryEntry {
  path: string;
  method: number;
  flags: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  modifiedAt: Date;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const FIXED_TIMESTAMP = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

interface NodeZlibLike {
  deflateRawSync(data: Uint8Array, options?: { level?: number }): Uint8Array | Buffer;
  inflateRawSync(data: Uint8Array): Uint8Array | Buffer;
}

export function getDefaultZipEntryTimestamp(): Date {
  return new Date(FIXED_TIMESTAMP.getTime());
}

export function readZipPackage(data: Uint8Array): ZipReadResult {
  const diagnostics: OfficeDiagnostic[] = [];
  const entries: ZipEntry[] = [];
  const centralDirectory = readCentralDirectory(data, diagnostics);

  for (const central of centralDirectory) {
    try {
      const localNameLength = readUint16(data, central.localHeaderOffset + 26);
      const localExtraLength = readUint16(data, central.localHeaderOffset + 28);
      const dataStart = central.localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = data.slice(dataStart, dataStart + central.compressedSize);
      const entryData =
        central.method === 0 ? compressed : getNodeZlib().inflateRawSync(compressed);

      entries.push({
        path: central.path,
        data: new Uint8Array(entryData),
        compression: central.method === 0 ? "store" : "deflate",
        compressedSize: central.compressedSize,
        uncompressedSize: central.uncompressedSize,
        crc32: central.crc,
        modifiedAt: central.modifiedAt
      });
    } catch (error) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "zip.entry.read_failed",
          error instanceof Error ? error.message : String(error),
          central.path
        )
      );
    }
  }

  return { entries, diagnostics };
}

export async function readZipPackageAsync(
  data: Uint8Array,
  options: ZipReadOptions = {}
): Promise<ZipReadResult> {
  const diagnostics: OfficeDiagnostic[] = [];
  const entries: ZipEntry[] = [];
  const centralDirectory = readCentralDirectory(data, diagnostics);

  for (const central of centralDirectory) {
    try {
      const localNameLength = readUint16(data, central.localHeaderOffset + 26);
      const localExtraLength = readUint16(data, central.localHeaderOffset + 28);
      const dataStart = central.localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = data.slice(dataStart, dataStart + central.compressedSize);
      const entryData = central.method === 0
        ? compressed
        : await inflateZipRawAsync(compressed, central.uncompressedSize, central.path, options.inflateRaw);

      entries.push({
        path: central.path,
        data: new Uint8Array(entryData),
        compression: central.method === 0 ? "store" : "deflate",
        compressedSize: central.compressedSize,
        uncompressedSize: central.uncompressedSize,
        crc32: central.crc,
        modifiedAt: central.modifiedAt
      });
    } catch (error) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "zip.entry.read_failed",
          error instanceof Error ? error.message : String(error),
          central.path
        )
      );
    }
  }

  return { entries, diagnostics };
}

export function writeZipPackage(entries: ZipEntryInput[], options: ZipWriteOptions = {}): Uint8Array {
  const timestamp = options.timestamp ?? FIXED_TIMESTAMP;
  const compression = options.compression ?? "store";
  const order = options.order ?? "stable";
  const prepared = entries.map((entry) => ({
    path: normalizeOpcPartPath(entry.path),
    data: asBytes(entry.data),
    compression: entry.compression ?? compression,
    modifiedAt: entry.modifiedAt ?? timestamp
  }));

  if (order === "stable") {
    prepared.sort((a, b) => compareOpcPartPaths(a.path, b.path));
  }

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of prepared) {
    const nameBytes = textEncoder.encode(entry.path);
    const method = entry.compression === "store" ? 0 : 8;
    const compressed =
      entry.compression === "store"
        ? entry.data
        : new Uint8Array(getNodeZlib().deflateRawSync(entry.data, { level: options.compressionLevel ?? 9 }));
    const crc = crc32(entry.data);
    const dosTime = toDosTime(entry.modifiedAt);
    const dosDate = toDosDate(entry.modifiedAt);
    const localHeader = new Uint8Array(30 + nameBytes.length);

    writeUint32(localHeader, 0, LOCAL_FILE_SIGNATURE);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0x0800);
    writeUint16(localHeader, 8, method);
    writeUint16(localHeader, 10, dosTime);
    writeUint16(localHeader, 12, dosDate);
    writeUint32(localHeader, 14, crc);
    writeUint32(localHeader, 18, compressed.length);
    writeUint32(localHeader, 22, entry.data.length);
    writeUint16(localHeader, 26, nameBytes.length);
    writeUint16(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, compressed);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32(centralHeader, 0, CENTRAL_DIRECTORY_SIGNATURE);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, 0x0800);
    writeUint16(centralHeader, 10, method);
    writeUint16(centralHeader, 12, dosTime);
    writeUint16(centralHeader, 14, dosDate);
    writeUint32(centralHeader, 16, crc);
    writeUint32(centralHeader, 20, compressed.length);
    writeUint32(centralHeader, 24, entry.data.length);
    writeUint16(centralHeader, 28, nameBytes.length);
    writeUint16(centralHeader, 30, 0);
    writeUint16(centralHeader, 32, 0);
    writeUint16(centralHeader, 34, 0);
    writeUint16(centralHeader, 36, 0);
    writeUint32(centralHeader, 38, 0);
    writeUint32(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + compressed.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  writeUint32(end, 0, EOCD_SIGNATURE);
  writeUint16(end, 4, 0);
  writeUint16(end, 6, 0);
  writeUint16(end, 8, prepared.length);
  writeUint16(end, 10, prepared.length);
  writeUint32(end, 12, centralDirectory.length);
  writeUint32(end, 16, offset);
  writeUint16(end, 20, 0);

  return concatBytes([...localParts, centralDirectory, end]);
}

export function getZipEntry(entries: ZipEntry[], entryPath: string): ZipEntry | undefined {
  const normalized = normalizeOpcPartPath(entryPath);
  return entries.find((entry) => entry.path === normalized);
}

export function getZipTextEntry(entries: ZipEntry[], entryPath: string): string | undefined {
  const entry = getZipEntry(entries, entryPath);
  return entry === undefined ? undefined : textDecoder.decode(entry.data);
}

export function upsertZipEntry(
  entries: ZipEntryInput[],
  entry: ZipEntryInput
): ZipEntryInput[] {
  const normalized = normalizeOpcPartPath(entry.path);
  const next = entries.filter((item) => normalizeOpcPartPath(item.path) !== normalized);
  next.push({ ...entry, path: normalized });
  return next;
}

function readCentralDirectory(data: Uint8Array, diagnostics: OfficeDiagnostic[]): CentralDirectoryEntry[] {
  const eocdOffset = findEndOfCentralDirectory(data);
  if (eocdOffset < 0) {
    diagnostics.push(createDiagnostic("error", "zip.eocd.missing", "End of central directory was not found."));
    return [];
  }

  const entryCount = readUint16(data, eocdOffset + 10);
  const centralDirectoryOffset = readUint32(data, eocdOffset + 16);
  const entries: CentralDirectoryEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(data, offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      diagnostics.push(createDiagnostic("error", "zip.central_directory.invalid", "Central directory entry signature is invalid."));
      break;
    }

    const flags = readUint16(data, offset + 8);
    const method = readUint16(data, offset + 10);
    const time = readUint16(data, offset + 12);
    const date = readUint16(data, offset + 14);
    const crc = readUint32(data, offset + 16);
    const compressedSize = readUint32(data, offset + 20);
    const uncompressedSize = readUint32(data, offset + 24);
    const fileNameLength = readUint16(data, offset + 28);
    const extraLength = readUint16(data, offset + 30);
    const commentLength = readUint16(data, offset + 32);
    const localHeaderOffset = readUint32(data, offset + 42);
    const nameStart = offset + 46;
    const path = textDecoder.decode(data.slice(nameStart, nameStart + fileNameLength));

    if (method !== 0 && method !== 8) {
      diagnostics.push(createDiagnostic("error", "zip.compression.unsupported", `Unsupported ZIP compression method: ${method}`, path));
    } else {
      entries.push({
        path: normalizeOpcPartPath(path),
        method,
        flags,
        crc,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
        modifiedAt: fromDosDateTime(date, time)
      });
    }

    offset = nameStart + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(data: Uint8Array): number {
  const minOffset = Math.max(0, data.length - 0xffff - 22);
  for (let offset = data.length - 22; offset >= minOffset; offset -= 1) {
    if (readUint32(data, offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  return -1;
}

function toDosTime(date: Date): number {
  return (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
}

function toDosDate(date: Date): number {
  const year = Math.max(1980, date.getUTCFullYear());
  return ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
}

function fromDosDateTime(date: number, time: number): Date {
  const year = 1980 + ((date >>> 9) & 0x7f);
  const month = (date >>> 5) & 0x0f;
  const day = date & 0x1f;
  const hour = (time >>> 11) & 0x1f;
  const minute = (time >>> 5) & 0x3f;
  const second = (time & 0x1f) * 2;
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

async function inflateZipRawAsync(
  compressed: Uint8Array,
  expectedSize: number,
  path: string,
  customInflateRaw?: ZipReadOptions["inflateRaw"]
): Promise<Uint8Array> {
  const inflated = customInflateRaw === undefined
    ? await defaultInflateZipRawAsync(compressed)
    : await customInflateRaw(compressed, expectedSize, path);
  const bytes = new Uint8Array(inflated);
  if (bytes.length !== expectedSize) {
    throw new Error(`Deflated ZIP entry size mismatch: ${path}`);
  }
  return bytes;
}

async function defaultInflateZipRawAsync(compressed: Uint8Array): Promise<Uint8Array> {
  const runtime = globalThis as typeof globalThis & {
    DecompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array>;
  };

  if (typeof runtime.DecompressionStream === "function") {
    try {
      const stream = new Blob([compressed as unknown as BlobPart]).stream().pipeThrough(new runtime.DecompressionStream("deflate-raw"));
      const buffer = await new Response(stream).arrayBuffer();
      return new Uint8Array(buffer);
    } catch (_error) {
      // Fall through to the Node zlib path when a runtime exposes
      // DecompressionStream but does not support "deflate-raw".
    }
  }

  return new Uint8Array(getNodeZlib().inflateRawSync(compressed));
}

function getNodeZlib(): NodeZlibLike {
  const runtime = globalThis as typeof globalThis & {
    process?: {
      getBuiltinModule?: (specifier: string) => unknown;
    };
  };
  const getBuiltinModule = runtime.process?.getBuiltinModule;
  const zlib = typeof getBuiltinModule === "function"
    ? getBuiltinModule("node:zlib") ?? getBuiltinModule("zlib")
    : undefined;

  if (
    zlib !== undefined &&
    typeof (zlib as NodeZlibLike).deflateRawSync === "function" &&
    typeof (zlib as NodeZlibLike).inflateRawSync === "function"
  ) {
    return zlib as NodeZlibLike;
  }

  throw new Error("Node zlib is required for synchronous ZIP deflate operations. Use stored entries, readZipPackageAsync with DecompressionStream, or inject an async inflater.");
}
