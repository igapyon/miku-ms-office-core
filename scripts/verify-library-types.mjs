import { mkdtemp, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { readStagedAssetInfo } from "./release-asset-info.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

export async function verifyLibraryTypes(assetDir = "bundle", assetStem) {
  const assetPath = resolve(root, assetDir);
  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const stem = assetStem ?? (assetDir === "bundle" ? packageJson.name : (await readStagedAssetInfo(assetPath)).assetStem);
  const declarationPath = join(assetPath, `${stem}.d.mts`);
  const modulePath = join(assetPath, `${stem}.mjs`);
  const declaration = await readFile(declarationPath, "utf8");
  await readFile(modulePath);
  if (/\bBuffer\b|\bprocess\b|node:|reference types=/.test(declaration)) {
    throw new Error("The bundled declaration contains a Node-specific type or import.");
  }
  if (/\bfrom\s+["']\.\.?\//.test(declaration)) {
    throw new Error("The bundled declaration contains a relative import.");
  }

  const workRoot = await mkdtemp(join(root, "workplace", "core-types-"));
  try {
    await copyFile(declarationPath, join(workRoot, "miku-ms-office-core.d.mts"));
    await copyFile(modulePath, join(workRoot, "miku-ms-office-core.mjs"));
    await writeFile(join(workRoot, "consumer.mts"), consumerSource);
    for (const lib of [["ES2022", "DOM", "DOM.Iterable"], ["ES2022", "WebWorker"]]) {
      const options = {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        lib: lib.map((name) => `lib.${name.toLowerCase()}.d.ts`),
        types: [],
        strict: true,
        noEmit: true,
        skipLibCheck: false
      };
      const program = ts.createProgram([join(workRoot, "consumer.mts")], options);
      const diagnostics = ts.getPreEmitDiagnostics(program);
      if (diagnostics.length > 0) {
        const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
          getCurrentDirectory: () => workRoot,
          getCanonicalFileName: (fileName) => fileName,
          getNewLine: () => "\n"
        });
        throw new Error(`Type consumer failed with libs ${lib.join(", ")}:\n${formatted}`);
      }
    }
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
  console.log(`Type declaration verified for DOM and WebWorker consumers: ${assetPath}`);
}

const args = process.argv.slice(2);
let assetDir = "bundle";
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--asset-dir" && args[index + 1] !== undefined) {
    assetDir = args[index + 1];
    index += 1;
  } else {
    throw new Error(`Unknown argument: ${args[index]}`);
  }
}

const consumerSource = `
import {
  readOfficePackage,
  readOfficePackageAsync,
  readZipPackage,
  readZipPackageAsync,
  writeZipPackage,
  ZipError,
  DEFAULT_ZIP_READ_LIMITS,
  DEFAULT_ZIP_WRITE_LIMITS,
  type ZipReadLimits,
  type ZipReadOptions,
  type ZipWriteOptions
} from "./miku-ms-office-core.mjs";

declare const bytes: Uint8Array;
const readOptions: ZipReadOptions = { limits: { maxInputBytes: 0 }, signal: new AbortController().signal };
const writeOptions: ZipWriteOptions = { compression: "deflate", order: "stable", timestamp: new Date() };
const readResult: Promise<Awaited<ReturnType<typeof readZipPackage>>> = readZipPackage(bytes, readOptions);
const readAliasResult = readZipPackageAsync(bytes, readOptions);
const officeResult = readOfficePackage(bytes, readOptions);
const officeAliasResult = readOfficePackageAsync(bytes, readOptions);
const writeResult: Promise<Uint8Array> = writeZipPackage([{ path: "a.txt", data: "a", modifiedAt: new Date() }], writeOptions);
const readLimits: ZipReadLimits = DEFAULT_ZIP_READ_LIMITS;
const writeLimit = DEFAULT_ZIP_WRITE_LIMITS.maxOutputBytes;
const zipError = new ZipError("zip.options.invalid", "invalid");
void [readResult, readAliasResult, officeResult, officeAliasResult, writeResult, readLimits, writeLimit, zipError];

// @ts-expect-error the callback inflater option was removed in 1.0
readZipPackage(bytes, { inflateRaw: () => bytes });
// @ts-expect-error synchronous compression-level tuning was removed in 1.0
writeZipPackage([], { compressionLevel: 9 });
`;

if (process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await verifyLibraryTypes(assetDir);
}
