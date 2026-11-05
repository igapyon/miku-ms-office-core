import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getReleaseAssetInfo } from "./release-asset-info.mjs";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const packageName = packageJson.name;
const { version } = getReleaseAssetInfo(packageJson, process.env.TAG_NAME ?? process.argv[2]);

const sourceMjsPath = `bundle/${packageName}.mjs`;
const sourceMapPath = `bundle/${packageName}.mjs.map`;
const sourceTypesPath = `bundle/${packageName}.d.mts`;
const assetMjsName = `${packageName}-${version}.mjs`;
const assetMapName = `${packageName}-${version}.mjs.map`;
const assetTypesName = `${packageName}-${version}.d.mts`;
const assetMjsPath = `release-assets/${assetMjsName}`;
const assetMapPath = `release-assets/${assetMapName}`;
const assetTypesPath = `release-assets/${assetTypesName}`;

const sourceMjs = await readFile(sourceMjsPath, "utf8");
const sourceMap = await readFile(sourceMapPath, "utf8");
const sourceTypes = await readFile(sourceTypesPath, "utf8");
const rewrittenMjs = sourceMjs.replace(
  /\/\/# sourceMappingURL=.*$/m,
  `//# sourceMappingURL=${assetMapName}`
);

if (!rewrittenMjs.includes(`//# sourceMappingURL=${assetMapName}`)) {
  throw new Error(`Failed to rewrite sourceMappingURL for ${assetMjsName}.`);
}

await rm("release-assets", { recursive: true, force: true });
await mkdir("release-assets", { recursive: true });
await writeFile(assetMjsPath, rewrittenMjs);
await writeFile(assetMapPath, sourceMap);
await writeFile(assetTypesPath, sourceTypes);

const assets = [
  [assetMjsName, rewrittenMjs],
  [assetMapName, sourceMap],
  [assetTypesName, sourceTypes]
];

for (const [name, content] of assets) {
  const digest = createHash("sha256").update(content).digest("hex");
  console.log(`${digest}  ${name}`);
}

