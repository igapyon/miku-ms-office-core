import { ZipError } from "./zip-errors.js";

const STREAM_CHUNK_BYTES = 64 * 1024;

type RawCompressionFormat = "deflate-raw";
interface RawTransform {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<BufferSource>;
}
type RawTransformConstructor = new (format: RawCompressionFormat) => RawTransform;

export async function deflateRawBytes(
  data: Uint8Array,
  maxOutputBytes: number,
  signal?: AbortSignal
): Promise<Uint8Array> {
  return transformRawBytes(data, "compress", maxOutputBytes, signal);
}

export async function inflateRawBytes(
  data: Uint8Array,
  maxOutputBytes: number,
  expectedSize: number,
  path: string,
  signal?: AbortSignal
): Promise<Uint8Array> {
  return transformRawBytes(data, "decompress", maxOutputBytes, signal, path, expectedSize);
}

async function transformRawBytes(
  data: Uint8Array,
  direction: "compress" | "decompress",
  maxOutputBytes: number,
  signal?: AbortSignal,
  path?: string,
  expectedSize?: number
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 0) {
    throw new ZipError("zip.options.invalid", "The ZIP stream output limit must be a non-negative safe integer.");
  }
  throwIfAborted(signal);

  const runtime = globalThis as typeof globalThis & {
    CompressionStream?: RawTransformConstructor;
    DecompressionStream?: RawTransformConstructor;
  };
  const Constructor = direction === "compress" ? runtime.CompressionStream : runtime.DecompressionStream;
  if (typeof Constructor !== "function" || typeof globalThis.ReadableStream !== "function") {
    throw unsupportedRuntime(direction);
  }

  let transform: RawTransform;
  try {
    transform = new Constructor("deflate-raw");
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === "NotSupportedError")) {
      throw unsupportedRuntime(direction);
    }
    throw error;
  }

  const source = makeByteStream(data);
  const reader = transform.readable.getReader();
  const controller = new AbortController();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const onAbort = (): void => controller.abort(createAbortError());
  signal?.addEventListener("abort", onAbort, { once: true });

  const piping = source.pipeTo(
    transform.writable as unknown as WritableStream<Uint8Array>,
    { signal: controller.signal }
  );
  try {
    while (true) {
      throwIfAborted(signal);
      const result = await reader.read();
      throwIfAborted(signal);
      if (result.done) {
        break;
      }
      const nextTotal = total + result.value.byteLength;
      if (!Number.isSafeInteger(nextTotal) || nextTotal > maxOutputBytes) {
        throw new ZipError("zip.limit.exceeded", "ZIP stream output exceeds the configured limit.", path);
      }
      if (expectedSize !== undefined && nextTotal > expectedSize) {
        throw new ZipError("zip.entry.size_mismatch", `ZIP entry size mismatch: ${path}`, path);
      }
      total = nextTotal;
      chunks.push(new Uint8Array(result.value));
    }
    await piping;
    throwIfAborted(signal);
    if (expectedSize !== undefined && total !== expectedSize) {
      throw new ZipError("zip.entry.size_mismatch", `ZIP entry size mismatch: ${path}`, path);
    }
  } catch (error) {
    controller.abort(error);
    try {
      await reader.cancel(error);
    } catch (_cancelError) {
      // Keep the original stream, limit, or abort error.
    }
    await piping.catch(() => undefined);
    if (signal?.aborted) {
      throw createAbortError();
    }
    if (direction === "decompress" && !(error instanceof ZipError)) {
      throw new ZipError("zip.entry.read_failed", `Unable to inflate ZIP entry${path === undefined ? "" : `: ${path}`}`, path);
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    try {
      reader.releaseLock();
    } catch (_releaseError) {
      // The stream may already be errored or canceled.
    }
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function makeByteStream(data: Uint8Array): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= data.byteLength) {
        controller.close();
        return;
      }
      const end = Math.min(offset + STREAM_CHUNK_BYTES, data.byteLength);
      controller.enqueue(data.subarray(offset, end));
      offset = end;
    }
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function createAbortError(): Error {
  return new DOMException("The ZIP operation was aborted.", "AbortError");
}

function unsupportedRuntime(direction: "compress" | "decompress"): ZipError {
  const operation = direction === "compress" ? "CompressionStream" : "DecompressionStream";
  return new ZipError("zip.runtime.unsupported", `${operation}(\"deflate-raw\") is not available in this runtime.`);
}
