import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { transform } from "esbuild";

const expectedExports = [
  "asBytes",
  "buildOpcContentTypesXml",
  "buildOpcRelationshipsPath",
  "buildOpcRelationshipsXml",
  "compareOpcPartPaths",
  "concatBytes",
  "createDiagnostic",
  "decodeXmlEntities",
  "escapeXmlAttribute",
  "escapeXmlText",
  "getDefaultZipEntryTimestamp",
  "getZipEntry",
  "getZipTextEntry",
  "listOfficeMediaParts",
  "normalizeOpcPartPath",
  "parseOpcContentTypesXml",
  "parseOpcRelationshipsXml",
  "parseXmlAttributes",
  "readOfficePackage",
  "readOfficePackageAsync",
  "readOfficePartRelationships",
  "readUint16",
  "readUint32",
  "readZipPackage",
  "readZipPackageAsync",
  "relationshipArrayToMap",
  "resolveOpcContentType",
  "resolveOpcRelationshipTarget",
  "resolveOpcRelationships",
  "sanitizeXmlText",
  "textDecoder",
  "textEncoder",
  "upsertZipEntry",
  "writeUint16",
  "writeUint32",
  "writeZipPackage"
];

const bundleUrl = pathToFileURL("bundle/miku-ms-office-core.mjs").href;
const core = await import(`${bundleUrl}?smoke=${Date.now()}`);
const actualExports = Object.keys(core).sort();
const missingExports = expectedExports.filter((name) => !(name in core));

if (missingExports.length > 0) {
  throw new Error(`Missing bundle exports: ${missingExports.join(", ")}`);
}

if (actualExports.join("\n") !== expectedExports.join("\n")) {
  throw new Error(
    `Unexpected bundle exports:\n${actualExports.join("\n")}`
  );
}

const bundleCode = await readFile("bundle/miku-ms-office-core.mjs", "utf8");

if (/^import\s/m.test(bundleCode)) {
  throw new Error("Bundle must not contain top-level static imports.");
}

const iifeBuild = await transform(bundleCode, {
  format: "iife",
  globalName: "MikuMsOfficeCore",
  target: "es2020"
});
const context = {
  TextDecoder,
  TextEncoder,
  Uint8Array
};
const browserLikeCore = vm.runInNewContext(`${iifeBuild.code}; MikuMsOfficeCore;`, context);
const zip = browserLikeCore.writeZipPackage([
  {
    path: "word/document.xml",
    data: new TextEncoder().encode("<w:document/>"),
    compression: "store"
  }
]);
const result = browserLikeCore.readZipPackage(zip);

if (result.diagnostics.length > 0 || result.entries[0]?.path !== "word/document.xml") {
  throw new Error("Browser-style IIFE smoke failed for stored ZIP read/write.");
}

console.log(`OK: bundle/miku-ms-office-core.mjs exports ${actualExports.length} APIs and can be IIFE-wrapped.`);
