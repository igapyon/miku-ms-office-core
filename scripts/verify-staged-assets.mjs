import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyLibraryTypes } from "./verify-library-types.mjs";
import { readStagedAssetInfo } from "./release-asset-info.mjs";

const { packageName, assetStem: baseName } = await readStagedAssetInfo();
const stagedMjs = `release-assets/${baseName}.mjs`;
const stagedMap = `release-assets/${baseName}.mjs.map`;
const stagedTypes = `release-assets/${baseName}.d.mts`;
const [bundleMjs, bundleMap, bundleTypes, actualMjs, actualMap, actualTypes] = await Promise.all([
  readFile(`bundle/${packageName}.mjs`, "utf8"),
  readFile(`bundle/${packageName}.mjs.map`),
  readFile(`bundle/${packageName}.d.mts`),
  readFile(stagedMjs, "utf8"),
  readFile(stagedMap),
  readFile(stagedTypes)
]);
const expectedMjs = bundleMjs.replace(/\/\/# sourceMappingURL=.*$/m, `//# sourceMappingURL=${baseName}.mjs.map`);
if (!expectedMjs.includes(`//# sourceMappingURL=${baseName}.mjs.map`) || actualMjs !== expectedMjs) {
  throw new Error(`Staged bundle differs from the version-adjusted generated bundle: ${stagedMjs}`);
}
if (!equalBytes(actualMap, bundleMap)) throw new Error(`Staged source map differs from the generated map: ${stagedMap}`);
if (!equalBytes(actualTypes, bundleTypes)) throw new Error(`Staged type declaration differs from the generated types: ${stagedTypes}`);
if (!actualMjs.includes(`//# sourceMappingURL=${baseName}.mjs.map`)) throw new Error("Staged sourceMappingURL does not reference the versioned map.");
if (/^import\s/m.test(actualMjs)) throw new Error("The staged ESM must not contain top-level imports.");

for (const [name, content] of [[`${baseName}.mjs`, actualMjs], [`${baseName}.mjs.map`, actualMap], [`${baseName}.d.mts`, actualTypes]]) {
  console.log(`${createHash("sha256").update(content).digest("hex")}  ${name}`);
}
await verifyLibraryTypes(resolve("release-assets"), baseName);

function equalBytes(left, right) {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}
