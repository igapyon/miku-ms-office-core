export type ZipErrorCode =
  | "zip.eocd.missing"
  | "zip.central_directory.invalid"
  | "zip.local_header.invalid"
  | "zip.compression.unsupported"
  | "zip.feature.unsupported"
  | "zip.path.invalid"
  | "zip.path.duplicate"
  | "zip.entry.read_failed"
  | "zip.entry.size_mismatch"
  | "zip.entry.crc_mismatch"
  | "zip.limit.exceeded"
  | "zip.runtime.unsupported"
  | "zip.options.invalid";

export class ZipError extends Error {
  readonly code: ZipErrorCode;
  readonly path?: string;

  constructor(code: ZipErrorCode, message: string, path?: string) {
    super(message);
    this.name = "ZipError";
    this.code = code;
    if (path !== undefined) {
      this.path = path;
    }
  }
}
