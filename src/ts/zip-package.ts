import { concatBytes, textDecoder, textEncoder, writeUint16, writeUint32 } from "./binary-io.js";
import { crc32 } from "./crc32.js";
import { createDiagnostic, type OfficeDiagnostic } from "./diagnostics.js";
import { compareOpcPartPaths, normalizeOpcPartPath } from "./opc-part-path.js";
import { ZipError } from "./zip-errors.js";
import { deflateRawBytes, inflateRawBytes } from "./zip-streams.js";
import { readCentralDirectory, readZipEntryCompressedData, type CentralDirectoryEntry } from "./zip-validation.js";
import {
  DEFAULT_ZIP_READ_LIMITS,
  DEFAULT_ZIP_WRITE_LIMITS,
  cloneDate,
  entryByteLength,
  normalizeInputPath,
  resolveLimits,
  snapshotEntryBytes,
  validateEntryShape,
  validateReadArguments,
  validateWriteArguments,
  type ZipReadLimits,
  type ZipWriteLimits
} from "./zip-validation.js";

export { DEFAULT_ZIP_READ_LIMITS, DEFAULT_ZIP_WRITE_LIMITS } from "./zip-validation.js";
export type { ZipReadLimits, ZipWriteLimits } from "./zip-validation.js";

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
  limits?: Partial<ZipReadLimits>;
  signal?: AbortSignal;
}

export interface ZipWriteOptions {
  timestamp?: Date;
  compression?: ZipCompressionMethod;
  order?: "stable" | "input";
  limits?: Partial<ZipWriteLimits>;
  signal?: AbortSignal;
}

interface PreparedZipEntry {
  path: string;
  data: Uint8Array;
  compression: ZipCompressionMethod;
  modifiedAt: Date;
}

interface PendingZipEntry {
  path: string;
  data: Uint8Array | string;
  byteLength: number;
  compression: ZipCompressionMethod;
  modifiedAt: Date;
}

interface SerializedZipEntry {
  localHeader: Uint8Array;
  centralHeader: Uint8Array;
  compressed: Uint8Array;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP_GENERAL_PURPOSE_FLAG_UTF8 = 0x0800;
const FIXED_TIMESTAMP = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

export function getDefaultZipEntryTimestamp(): Date {
  return new Date(FIXED_TIMESTAMP.getTime());
}

export async function readZipPackage(data: Uint8Array, options: ZipReadOptions = {}): Promise<ZipReadResult> {
  validateReadArguments(data, options);
  const limits = resolveLimits(DEFAULT_ZIP_READ_LIMITS, options.limits);
  const signal = options.signal;
  throwIfAborted(signal);
  if (data.byteLength > limits.maxInputBytes) {
    return zipFailure("zip.limit.exceeded", "ZIP input exceeds the configured limit.");
  }
  const snapshot = new Uint8Array(data);
  const diagnostics: OfficeDiagnostic[] = [];
  const entries: ZipEntry[] = [];
  const centralDirectory = readCentralDirectory(snapshot, diagnostics, limits.maxEntries);
  if (diagnostics.length > 0) return { entries: [], diagnostics };
  if (centralDirectory.length > limits.maxEntries) return zipFailure("zip.limit.exceeded", "ZIP entry count exceeds the configured limit.");
  let declaredTotal = 0;
  for (const central of centralDirectory) {
    if (central.uncompressedSize > limits.maxEntryBytes) return zipFailure("zip.limit.exceeded", "ZIP entry exceeds the configured limit.", central.path);
    declaredTotal += central.uncompressedSize;
    if (!Number.isSafeInteger(declaredTotal) || declaredTotal > limits.maxTotalBytes) {
      return zipFailure("zip.limit.exceeded", "ZIP total uncompressed size exceeds the configured limit.", central.path);
    }
  }
  let actualTotal = 0;
  for (const central of centralDirectory) {
    throwIfAborted(signal);
    try {
      const compressed = readZipEntryCompressedData(snapshot, central);
      const entryData = central.method === 0
        ? new Uint8Array(compressed)
        : await inflateRawBytes(compressed, Math.min(limits.maxEntryBytes, limits.maxTotalBytes - actualTotal), central.uncompressedSize, central.path, signal);
      throwIfAborted(signal);
      if (entryData.byteLength !== central.uncompressedSize) {
        return zipFailure("zip.entry.size_mismatch", `ZIP entry size mismatch: ${central.path}`, central.path);
      }
      if (crc32(entryData) !== central.crc) {
        return zipFailure("zip.entry.crc_mismatch", `ZIP entry CRC mismatch: ${central.path}`, central.path);
      }
      actualTotal += entryData.byteLength;
      if (!central.isDirectory) entries.push(buildZipEntry(central, entryData));
    } catch (error) {
      if (isAbortError(error)) throw abortError();
      if (!(error instanceof ZipError)) throw error;
      if (error.code === "zip.runtime.unsupported") throw error;
      diagnostics.push(
        createDiagnostic(
          "error",
          error.code,
          error.message,
          central.path
        )
      );
      return { entries: [], diagnostics };
    }
  }

  return { entries, diagnostics };
}

/** @deprecated Use readZipPackage; retained as the same function reference for 1.x. */
export const readZipPackageAsync = readZipPackage;

export async function writeZipPackage(entries: ZipEntryInput[], options: ZipWriteOptions = {}): Promise<Uint8Array> {
  validateWriteArguments(entries, options);
  const limits = resolveLimits(DEFAULT_ZIP_WRITE_LIMITS, options.limits);
  const signal = options.signal;
  throwIfAborted(signal);
  const timestamp = options.timestamp === undefined ? FIXED_TIMESTAMP : cloneDate(options.timestamp, "timestamp");
  const order = options.order ?? "stable";
  const prepared = snapshotWriteEntries(entries, options, timestamp, limits);

  if (order === "stable") {
    prepared.sort((a, b) => compareOpcPartPaths(a.path, b.path));
  }

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  let centralSize = 0;

  for (const entry of prepared) {
    throwIfAborted(signal);
    const nameLength = textEncoder.encode(entry.path).byteLength;
    const remainingCompressedBudget = limits.maxOutputBytes - offset - centralSize - (30 + nameLength) - (46 + nameLength) - 22;
    if (remainingCompressedBudget < 0 || offset > 0xfffffffe) throw new ZipError("zip.limit.exceeded", "ZIP output exceeds the configured ZIP32/output limit.", entry.path);
    const serialized = await serializeZipEntry(entry, offset, remainingCompressedBudget, signal);
    throwIfAborted(signal);
    if (serialized.compressed.length > 0xfffffffe || entry.data.length > 0xfffffffe) throw new ZipError("zip.limit.exceeded", "ZIP entry exceeds ZIP32 size limits.", entry.path);
    localParts.push(serialized.localHeader, serialized.compressed);
    centralParts.push(serialized.centralHeader);
    offset += serialized.localHeader.length + serialized.compressed.length;
    centralSize += serialized.centralHeader.length;
    if (offset + centralSize + 22 > limits.maxOutputBytes) {
      throw new ZipError("zip.limit.exceeded", "ZIP output exceeds the configured limit.");
    }
  }

  if (offset + centralSize + 22 > limits.maxOutputBytes) throw new ZipError("zip.limit.exceeded", "ZIP output exceeds the configured limit.");
  const centralDirectory = concatBytes(centralParts);
  if (centralDirectory.length > 0xfffffffe || offset > 0xfffffffe) throw new ZipError("zip.limit.exceeded", "ZIP central directory exceeds ZIP32 limits.");
  const end = buildEndOfCentralDirectory(prepared.length, centralDirectory.length, offset);

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

function snapshotWriteEntries(entries: ZipEntryInput[], options: ZipWriteOptions, timestamp: Date, limits: ZipWriteLimits): PreparedZipEntry[] {
  const compression = options.compression ?? "store";
  if (entries.length > limits.maxEntries || entries.length > 0xfffe) throw new ZipError("zip.limit.exceeded", "ZIP entry count exceeds the configured ZIP32/output limit.");
  const pending: PendingZipEntry[] = [];
  const paths = new Set<string>();
  let total = 0;
  for (const input of entries) {
    validateEntryShape(input);
    if (entryByteLength(input.path) > 0xffff) throw new ZipError("zip.limit.exceeded", "ZIP entry name exceeds ZIP32 limits.", input.path);
    if (input.path.startsWith("/") || input.path.startsWith("\\")) {
      throw new ZipError("zip.path.invalid", "ZIP entry path must be relative.", input.path);
    }
    const path = normalizeInputPath(input.path);
    if (input.path.endsWith("/") || input.path.endsWith("\\")) throw new ZipError("zip.path.invalid", "The ZIP writer accepts file entries only.", input.path);
    const nameLength = entryByteLength(path);
    if (nameLength === 0 || nameLength > 0xffff) throw new ZipError("zip.limit.exceeded", "ZIP entry name exceeds ZIP32 limits.", path);
    if (paths.has(path)) throw new ZipError("zip.path.duplicate", `Duplicate ZIP entry path: ${path}`, path);
    paths.add(path);
    const entryCompression = input.compression ?? compression;
    if (entryCompression !== "store" && entryCompression !== "deflate") {
      throw new ZipError("zip.options.invalid", `Unsupported ZIP compression: ${String(entryCompression)}`, path);
    }
    const byteLength = entryByteLength(input.data);
    if (byteLength > 0xfffffffe) throw new ZipError("zip.limit.exceeded", "ZIP entry exceeds ZIP32 size limits.", path);
    if (byteLength > limits.maxEntryBytes) throw new ZipError("zip.limit.exceeded", "ZIP entry exceeds the configured limit.", path);
    total += byteLength;
    if (!Number.isSafeInteger(total) || total > limits.maxTotalBytes) throw new ZipError("zip.limit.exceeded", "ZIP total input size exceeds the configured limit.", path);
    const modifiedAt = input.modifiedAt === undefined ? new Date(timestamp.getTime()) : cloneDate(input.modifiedAt, "modifiedAt");
    pending.push({ path, data: input.data, byteLength, compression: entryCompression, modifiedAt });
  }
  return pending.map((entry) => {
    return {
      path: entry.path,
      data: snapshotEntryBytes(entry.data, entry.byteLength),
      compression: entry.compression,
      modifiedAt: entry.modifiedAt
    };
  });
}

async function serializeZipEntry(
  entry: PreparedZipEntry,
  localHeaderOffset: number,
  maxOutputBytes: number,
  signal?: AbortSignal
): Promise<SerializedZipEntry> {
  const nameBytes = textEncoder.encode(entry.path);
  const method = entry.compression === "store" ? 0 : 8;
  const compressed = entry.compression === "store"
    ? entry.data
    : await deflateRawBytes(entry.data, maxOutputBytes, signal);
  const crc = crc32(entry.data);
  const dosTime = toDosTime(entry.modifiedAt);
  const dosDate = toDosDate(entry.modifiedAt);
  return {
    localHeader: buildLocalFileHeader(entry, nameBytes, method, compressed.length, crc, dosTime, dosDate),
    centralHeader: buildCentralDirectoryHeader(
      entry,
      nameBytes,
      method,
      compressed.length,
      crc,
      dosTime,
      dosDate,
      localHeaderOffset
    ),
    compressed
  };
}

function buildLocalFileHeader(
  entry: PreparedZipEntry,
  nameBytes: Uint8Array,
  method: number,
  compressedSize: number,
  crc: number,
  dosTime: number,
  dosDate: number
): Uint8Array {
  const localHeader = new Uint8Array(30 + nameBytes.length);
  writeUint32(localHeader, 0, LOCAL_FILE_SIGNATURE);
  writeUint16(localHeader, 4, 20);
  writeUint16(localHeader, 6, ZIP_GENERAL_PURPOSE_FLAG_UTF8);
  writeUint16(localHeader, 8, method);
  writeUint16(localHeader, 10, dosTime);
  writeUint16(localHeader, 12, dosDate);
  writeUint32(localHeader, 14, crc);
  writeUint32(localHeader, 18, compressedSize);
  writeUint32(localHeader, 22, entry.data.length);
  writeUint16(localHeader, 26, nameBytes.length);
  writeUint16(localHeader, 28, 0);
  localHeader.set(nameBytes, 30);
  return localHeader;
}

function buildCentralDirectoryHeader(
  entry: PreparedZipEntry,
  nameBytes: Uint8Array,
  method: number,
  compressedSize: number,
  crc: number,
  dosTime: number,
  dosDate: number,
  localHeaderOffset: number
): Uint8Array {
  const centralHeader = new Uint8Array(46 + nameBytes.length);
  writeUint32(centralHeader, 0, CENTRAL_DIRECTORY_SIGNATURE);
  writeUint16(centralHeader, 4, 20);
  writeUint16(centralHeader, 6, 20);
  writeUint16(centralHeader, 8, ZIP_GENERAL_PURPOSE_FLAG_UTF8);
  writeUint16(centralHeader, 10, method);
  writeUint16(centralHeader, 12, dosTime);
  writeUint16(centralHeader, 14, dosDate);
  writeUint32(centralHeader, 16, crc);
  writeUint32(centralHeader, 20, compressedSize);
  writeUint32(centralHeader, 24, entry.data.length);
  writeUint16(centralHeader, 28, nameBytes.length);
  writeUint16(centralHeader, 30, 0);
  writeUint16(centralHeader, 32, 0);
  writeUint16(centralHeader, 34, 0);
  writeUint16(centralHeader, 36, 0);
  writeUint32(centralHeader, 38, 0);
  writeUint32(centralHeader, 42, localHeaderOffset);
  centralHeader.set(nameBytes, 46);
  return centralHeader;
}

function buildEndOfCentralDirectory(
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number
): Uint8Array {
  const end = new Uint8Array(22);
  writeUint32(end, 0, EOCD_SIGNATURE);
  writeUint16(end, 4, 0);
  writeUint16(end, 6, 0);
  writeUint16(end, 8, entryCount);
  writeUint16(end, 10, entryCount);
  writeUint32(end, 12, centralDirectorySize);
  writeUint32(end, 16, centralDirectoryOffset);
  writeUint16(end, 20, 0);
  return end;
}

function buildZipEntry(
  central: CentralDirectoryEntry,
  entryData: Uint8Array
): ZipEntry {
  return {
    path: central.path,
    data: new Uint8Array(entryData),
    compression: central.method === 0 ? "store" : "deflate",
    compressedSize: central.compressedSize,
    uncompressedSize: central.uncompressedSize,
    crc32: central.crc,
    modifiedAt: central.modifiedAt
  };
}

function toDosTime(date: Date): number {
  return (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
}

function toDosDate(date: Date): number {
  const year = Math.max(1980, date.getUTCFullYear());
  return ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function zipFailure(code: string, message: string, path?: string): ZipReadResult {
  return { entries: [], diagnostics: [createDiagnostic("error", code, message, path)] };
}
