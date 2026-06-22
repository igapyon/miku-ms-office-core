import { pathToFileURL } from "node:url";

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

console.log(`OK: bundle/miku-ms-office-core.mjs exports ${actualExports.length} APIs.`);
