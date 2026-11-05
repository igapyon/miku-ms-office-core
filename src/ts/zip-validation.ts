import { ZipError } from "./zip-errors.js";
import { readUint16, readUint32, textEncoder } from "./binary-io.js";
import { createDiagnostic, type OfficeDiagnostic } from "./diagnostics.js";
import { normalizeOpcPartPath } from "./opc-part-path.js";
import type {
  ZipEntryInput,
  ZipReadOptions,
  ZipWriteOptions
} from "./zip-package.js";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP_GENERAL_PURPOSE_FLAG_UTF8 = 0x0800;

export interface CentralDirectoryEntry {
  path: string;
  fileNameBytes: Uint8Array;
  method: number;
  flags: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  centralDirectoryOffset: number;
  payloadStart: number;
  payloadEnd: number;
  localRecordEnd: number;
  modifiedAt: Date;
  isDirectory: boolean;
}

export function readCentralDirectory(data: Uint8Array, diagnostics: OfficeDiagnostic[], maxEntries: number): CentralDirectoryEntry[] {
  const eocdOffset = findEndOfCentralDirectory(data);
  if (eocdOffset < 0) {
    diagnostics.push(createDiagnostic("error", "zip.eocd.missing", "End of central directory was not found."));
    return [];
  }
  if (!rangeFits(data, eocdOffset, 22)) return centralFailure(diagnostics, "zip.central_directory.invalid", "End of central directory is truncated.");
  if (eocdOffset >= 20 && readUint32(data, eocdOffset - 20) === ZIP64_EOCD_LOCATOR_SIGNATURE) {
    return centralFailure(diagnostics, "zip.feature.unsupported", "ZIP64 archives are not supported.");
  }
  const diskNumber = readUint16(data, eocdOffset + 4);
  const centralDiskNumber = readUint16(data, eocdOffset + 6);
  const entriesOnDisk = readUint16(data, eocdOffset + 8);
  const entryCount = readUint16(data, eocdOffset + 10);
  const centralDirectorySize = readUint32(data, eocdOffset + 12);
  const centralDirectoryOffset = readUint32(data, eocdOffset + 16);
  if (diskNumber !== 0 || centralDiskNumber !== 0 || entriesOnDisk !== entryCount) {
    return centralFailure(diagnostics, "zip.feature.unsupported", "Multi-disk ZIP archives are not supported.");
  }
  if (entryCount === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    return centralFailure(diagnostics, "zip.feature.unsupported", "ZIP64 archives are not supported.");
  }
  if (entryCount > maxEntries) return centralFailure(diagnostics, "zip.limit.exceeded", "ZIP entry count exceeds the configured limit.");
  if (centralDirectoryOffset + centralDirectorySize !== eocdOffset || !rangeFits(data, centralDirectoryOffset, centralDirectorySize)) {
    return centralFailure(diagnostics, "zip.central_directory.invalid", "Central directory bounds do not match the end record.");
  }
  const entries: CentralDirectoryEntry[] = [];
  const seenPaths = new Set<string>();
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (!rangeFits(data, offset, 46) || offset + 46 > eocdOffset || readUint32(data, offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      return centralFailure(diagnostics, "zip.central_directory.invalid", "Central directory entry is missing or truncated.");
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
    const diskStart = readUint16(data, offset + 34);
    const localHeaderOffset = readUint32(data, offset + 42);
    const nameStart = offset + 46;
    const variableLength = fileNameLength + extraLength + commentLength;
    if (!rangeFits(data, nameStart, variableLength) || nameStart + variableLength > eocdOffset) {
      return centralFailure(diagnostics, "zip.central_directory.invalid", "Central directory variable fields are truncated.");
    }
    if (diskStart === 0xffff || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      return centralFailure(diagnostics, "zip.feature.unsupported", "ZIP64 central directory values are not supported.");
    }
    if (diskStart !== 0) return centralFailure(diagnostics, "zip.feature.unsupported", "Multi-disk ZIP entries are not supported.");
    if ((flags & 0x0001) !== 0 || (flags & 0x0040) !== 0) return centralFailure(diagnostics, "zip.feature.unsupported", "Encrypted ZIP entries are not supported.");
    const allowedFlags = ZIP_GENERAL_PURPOSE_FLAG_UTF8 | 0x0008 | (method === 8 ? 0x0006 : 0);
    if ((flags & ~allowedFlags) !== 0) return centralFailure(diagnostics, "zip.feature.unsupported", "ZIP entry uses unsupported general purpose flags.");
    if (method !== 0 && method !== 8) return centralFailure(diagnostics, "zip.compression.unsupported", `Unsupported ZIP compression method: ${method}`);
    const fileNameBytes = data.slice(nameStart, nameStart + fileNameLength);
    let decodedPath: string;
    try {
      decodedPath = decodeZipPath(fileNameBytes, (flags & ZIP_GENERAL_PURPOSE_FLAG_UTF8) !== 0);
      inspectExtraFields(data.subarray(nameStart + fileNameLength, nameStart + fileNameLength + extraLength), undefined, "zip.central_directory.invalid");
    } catch (error) {
      const code = error instanceof ZipError ? error.code : "zip.path.invalid";
      return centralFailure(diagnostics, code, error instanceof Error ? error.message : String(error));
    }
    const isDirectory = decodedPath.endsWith("/");
    let path: string;
    try {
      if (decodedPath.startsWith("/") || decodedPath.startsWith("\\")) throw new Error("ZIP entry path must be relative.");
      path = normalizeOpcPartPath(decodedPath);
    } catch (error) {
      return centralFailure(diagnostics, "zip.path.invalid", error instanceof Error ? error.message : String(error));
    }
    const duplicateKey = `${isDirectory ? "directory" : "file"}:${path}`;
    if (seenPaths.has(duplicateKey)) return centralFailure(diagnostics, "zip.path.duplicate", `Duplicate ZIP entry path: ${path}`, path);
    seenPaths.add(duplicateKey);
    if (method === 0 && compressedSize !== uncompressedSize) return centralFailure(diagnostics, "zip.entry.size_mismatch", `Stored ZIP entry sizes disagree: ${path}`, path);
    entries.push({
      path,
      fileNameBytes,
      method,
      flags,
      crc,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      centralDirectoryOffset,
      payloadStart: 0,
      payloadEnd: 0,
      localRecordEnd: 0,
      modifiedAt: fromDosDateTime(date, time),
      isDirectory
    });
    offset = nameStart + variableLength;
  }
  if (offset !== eocdOffset) return centralFailure(diagnostics, "zip.central_directory.invalid", "Central directory contains trailing records or bytes.");
  try {
    const ranges: Array<{ start: number; end: number; path: string }> = [];
    for (const entry of entries) {
      readZipEntryCompressedData(data, entry);
      ranges.push({ start: entry.localHeaderOffset, end: entry.localRecordEnd, path: entry.path });
    }
    ranges.sort((a, b) => a.start - b.start);
    for (let index = 1; index < ranges.length; index += 1) {
      if (ranges[index - 1]!.end > ranges[index]!.start) {
        return centralFailure(diagnostics, "zip.local_header.invalid", `ZIP local records overlap: ${ranges[index]!.path}`, ranges[index]!.path);
      }
    }
  } catch (error) {
    const code = error instanceof ZipError ? error.code : "zip.local_header.invalid";
    return centralFailure(diagnostics, code, error instanceof Error ? error.message : String(error), error instanceof ZipError ? error.path : undefined);
  }
  return entries;
}

export function readZipEntryCompressedData(data: Uint8Array, central: CentralDirectoryEntry): Uint8Array {
  const offset = central.localHeaderOffset;
  if (!rangeFits(data, offset, 30) || readUint32(data, offset) !== LOCAL_FILE_SIGNATURE) {
    throw new ZipError("zip.local_header.invalid", "ZIP local file header is missing or truncated.", central.path);
  }
  const flags = readUint16(data, offset + 6);
  const method = readUint16(data, offset + 8);
  const localCrc = readUint32(data, offset + 14);
  const localCompressedSize = readUint32(data, offset + 18);
  const localUncompressedSize = readUint32(data, offset + 22);
  const nameLength = readUint16(data, offset + 26);
  const extraLength = readUint16(data, offset + 28);
  const nameStart = offset + 30;
  const extraStart = nameStart + nameLength;
  const payloadStart = extraStart + extraLength;
  const payloadEnd = payloadStart + central.compressedSize;
  if (localCompressedSize === 0xffffffff || localUncompressedSize === 0xffffffff) throw new ZipError("zip.feature.unsupported", "ZIP64 local header values are not supported.", central.path);
  if (!rangeFits(data, nameStart, nameLength + extraLength) || !rangeFits(data, payloadStart, central.compressedSize)) {
    throw new ZipError("zip.local_header.invalid", "ZIP local header or entry data is outside the input range.", central.path);
  }
  const localName = data.subarray(nameStart, extraStart);
  const descriptor = (central.flags & 0x0008) !== 0;
  if (flags !== central.flags || method !== central.method || !bytesEqual(localName, central.fileNameBytes)) {
    throw new ZipError("zip.local_header.invalid", "ZIP local and central headers disagree.", central.path);
  }
  inspectExtraFields(data.subarray(extraStart, payloadStart), central.path);
  if (descriptor) {
    if ((localCrc !== 0 && localCrc !== central.crc) || (localCompressedSize !== 0 && localCompressedSize !== central.compressedSize) ||
        (localUncompressedSize !== 0 && localUncompressedSize !== central.uncompressedSize)) {
      throw new ZipError("zip.local_header.invalid", "ZIP descriptor local header has conflicting values.", central.path);
    }
  } else if (localCrc !== central.crc || localCompressedSize !== central.compressedSize || localUncompressedSize !== central.uncompressedSize) {
    throw new ZipError("zip.local_header.invalid", "ZIP local and central sizes or CRC disagree.", central.path);
  }
  if (payloadEnd > central.centralDirectoryOffset) throw new ZipError("zip.local_header.invalid", "ZIP entry data overlaps the central directory.", central.path);
  let recordEnd = payloadEnd;
  if (descriptor) recordEnd += validateDataDescriptor(data, payloadEnd, central);
  central.payloadStart = payloadStart;
  central.payloadEnd = payloadEnd;
  central.localRecordEnd = recordEnd;
  if (recordEnd > central.centralDirectoryOffset) throw new ZipError("zip.local_header.invalid", "ZIP data descriptor overlaps the central directory.", central.path);
  return data.subarray(payloadStart, payloadEnd);
}

function findEndOfCentralDirectory(data: Uint8Array): number {
  const minOffset = Math.max(0, data.length - 0xffff - 22);
  for (let offset = data.length - 22; offset >= minOffset; offset -= 1) {
    if (rangeFits(data, offset, 22) && readUint32(data, offset) === EOCD_SIGNATURE) {
      const commentLength = readUint16(data, offset + 20);
      if (offset + 22 + commentLength !== data.length) continue;
      const directorySize = readUint32(data, offset + 12);
      const directoryOffset = readUint32(data, offset + 16);
      if (directorySize !== 0xffffffff && directoryOffset !== 0xffffffff && directoryOffset + directorySize !== offset) continue;
      return offset;
    }
  }
  return -1;
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

function centralFailure(diagnostics: OfficeDiagnostic[], code: string, message: string, path?: string): CentralDirectoryEntry[] {
  diagnostics.push(createDiagnostic("error", code, message, path));
  return [];
}

function rangeFits(data: Uint8Array, offset: number, length: number): boolean {
  return Number.isSafeInteger(offset) && Number.isSafeInteger(length) && offset >= 0 && length >= 0 && offset + length <= data.byteLength;
}

function decodeZipPath(bytes: Uint8Array, utf8: boolean): string {
  if (!utf8 && bytes.some((value) => value > 0x7f)) throw new ZipError("zip.feature.unsupported", "ZIP filename is not flagged as UTF-8 and contains non-ASCII bytes.");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (_error) {
    throw new ZipError("zip.path.invalid", "ZIP filename is not valid UTF-8.");
  }
}

function inspectExtraFields(bytes: Uint8Array, path?: string, malformedCode: "zip.local_header.invalid" | "zip.central_directory.invalid" = "zip.local_header.invalid"): void {
  let offset = 0;
  while (offset < bytes.length) {
    if (!rangeFits(bytes, offset, 4)) throw new ZipError(malformedCode, "ZIP extra field header is truncated.", path);
    const id = readUint16(bytes, offset);
    const length = readUint16(bytes, offset + 2);
    offset += 4;
    if (!rangeFits(bytes, offset, length)) throw new ZipError(malformedCode, "ZIP extra field data is truncated.", path);
    if (id === 0x0001) throw new ZipError("zip.feature.unsupported", "ZIP64 extra fields are not supported.", path);
    offset += length;
  }
}

function validateDataDescriptor(data: Uint8Array, offset: number, central: CentralDirectoryEntry): number {
  if (!rangeFits(data, offset, 12)) throw new ZipError("zip.local_header.invalid", "ZIP data descriptor is truncated.", central.path);
  const matches = (valueOffset: number): boolean => rangeFits(data, valueOffset, 12) &&
    readUint32(data, valueOffset) === central.crc && readUint32(data, valueOffset + 4) === central.compressedSize &&
    readUint32(data, valueOffset + 8) === central.uncompressedSize;
  if (readUint32(data, offset) === 0x08074b50 && rangeFits(data, offset, 16) && matches(offset + 4)) return 16;
  if (matches(offset)) return 12;
  if (!rangeFits(data, offset, 16)) throw new ZipError("zip.local_header.invalid", "ZIP data descriptor is truncated.", central.path);
  throw new ZipError("zip.local_header.invalid", "ZIP data descriptor values disagree with the central directory.", central.path);
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false;
  return true;
}

export interface ZipReadLimits {
  maxInputBytes: number;
  maxEntries: number;
  maxEntryBytes: number;
  maxTotalBytes: number;
}

export interface ZipWriteLimits {
  maxEntries: number;
  maxEntryBytes: number;
  maxTotalBytes: number;
  maxOutputBytes: number;
}

const MiB = 1024 * 1024;
export const DEFAULT_ZIP_READ_LIMITS: Readonly<ZipReadLimits> = Object.freeze({
  maxInputBytes: 64 * MiB,
  maxEntries: 10_000,
  maxEntryBytes: 64 * MiB,
  maxTotalBytes: 256 * MiB
});
export const DEFAULT_ZIP_WRITE_LIMITS: Readonly<ZipWriteLimits> = Object.freeze({
  maxEntries: 10_000,
  maxEntryBytes: 64 * MiB,
  maxTotalBytes: 256 * MiB,
  maxOutputBytes: 256 * MiB
});

export function validateReadArguments(data: Uint8Array, options: ZipReadOptions): void {
  if (!(data instanceof Uint8Array)) throw invalidOptions("ZIP input must be a Uint8Array.");
  validateObjectKeys(options, ["limits", "signal"], "read options");
  if (options.limits !== undefined) validateLimits(options.limits, Object.keys(DEFAULT_ZIP_READ_LIMITS), "read limits");
  validateSignal(options.signal);
}

export function validateWriteArguments(entries: ZipEntryInput[], options: ZipWriteOptions): void {
  if (!Array.isArray(entries)) throw invalidOptions("ZIP entries must be an array.");
  validateObjectKeys(options, ["timestamp", "compression", "order", "limits", "signal"], "write options");
  if (options.limits !== undefined) validateLimits(options.limits, Object.keys(DEFAULT_ZIP_WRITE_LIMITS), "write limits");
  if (options.timestamp !== undefined) cloneDate(options.timestamp, "timestamp");
  if (options.compression !== undefined && options.compression !== "store" && options.compression !== "deflate") {
    throw invalidOptions("compression must be 'store' or 'deflate'.");
  }
  if (options.order !== undefined && options.order !== "stable" && options.order !== "input") {
    throw invalidOptions("order must be 'stable' or 'input'.");
  }
  validateSignal(options.signal);
  for (const entry of entries) validateEntryShape(entry);
}

export function validateEntryShape(entry: ZipEntryInput): void {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) throw invalidOptions("Each ZIP entry must be an object.");
  validateObjectKeys(entry, ["path", "data", "compression", "modifiedAt"], "ZIP entry");
  if (typeof entry.path !== "string" || entry.path.length === 0) throw invalidOptions("Each ZIP entry path must be a non-empty string.");
  if (!(typeof entry.data === "string" || entry.data instanceof Uint8Array)) throw invalidOptions(`ZIP entry data must be a string or Uint8Array: ${entry.path}`);
  if (entry.compression !== undefined && entry.compression !== "store" && entry.compression !== "deflate") throw invalidOptions(`Invalid ZIP compression: ${String(entry.compression)}`);
  if (entry.modifiedAt !== undefined) cloneDate(entry.modifiedAt, "modifiedAt");
}

export function resolveLimits<T extends object>(defaults: T, partial: Partial<T> | undefined): T {
  const resolved = { ...defaults } as Record<string, number>;
  if (partial !== undefined) {
    for (const [key, value] of Object.entries(partial)) {
      if (value !== undefined) resolved[key] = value as number;
    }
  }
  return resolved as T;
}

export function cloneDate(value: Date, label: string): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw invalidOptions(`${label} must be a valid Date.`);
  const date = new Date(value.getTime());
  if (date.getUTCFullYear() < 1980 || date.getUTCFullYear() > 2107) throw invalidOptions(`${label} must be within ZIP's 1980–2107 timestamp range.`);
  return date;
}

export function normalizeInputPath(path: string): string {
  try {
    return normalizeOpcPartPath(path);
  } catch (error) {
    throw new ZipError("zip.path.invalid", error instanceof Error ? error.message : String(error), path);
  }
}

export function entryByteLength(data: Uint8Array | string): number {
  if (data instanceof Uint8Array) return data.byteLength;
  let size = 0;
  for (let index = 0; index < data.length; index += 1) {
    const code = data.charCodeAt(index);
    if (code <= 0x7f) size += 1;
    else if (code <= 0x7ff) size += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < data.length && data.charCodeAt(index + 1) >= 0xdc00 && data.charCodeAt(index + 1) <= 0xdfff) {
      size += 4;
      index += 1;
    } else size += 3;
  }
  return size;
}

export function snapshotEntryBytes(data: Uint8Array | string, byteLength: number): Uint8Array {
  if (typeof data !== "string") return new Uint8Array(data);
  const output = new Uint8Array(byteLength);
  const result = textEncoder.encodeInto(data, output);
  if (result.read !== data.length || result.written !== byteLength) throw invalidOptions("Unable to encode ZIP entry data.");
  return output;
}

function validateObjectKeys(value: unknown, allowedKeys: string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw invalidOptions(`${label} must be an object.`);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowedKeys.includes(key)) throw invalidOptions(`Unknown ${label} key: ${String(key)}`);
  }
}

function validateLimits(limits: unknown, allowedKeys: string[], label: string): void {
  validateObjectKeys(limits, allowedKeys, label);
  for (const [key, value] of Object.entries(limits as Record<string, unknown>)) {
    if (value === undefined) continue;
    if (!Number.isSafeInteger(value) || (value as number) < 0) throw invalidOptions(`${label}.${key} must be a non-negative safe integer.`);
  }
}

function validateSignal(signal: AbortSignal | undefined): void {
  if (signal === undefined) return;
  if (signal === null || typeof signal !== "object" || typeof signal.aborted !== "boolean" || typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function") {
    throw invalidOptions("signal must be an AbortSignal.");
  }
}

function invalidOptions(message: string): ZipError {
  return new ZipError("zip.options.invalid", message);
}

