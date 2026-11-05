import { readFile, readdir } from "node:fs/promises";

export function getReleaseAssetInfo(packageJson, tagName = process.env.TAG_NAME ?? `v${packageJson.version}`) {
  if (typeof tagName !== "string" || !tagName.startsWith("v")) {
    throw new Error(`TAG_NAME must start with v, for example v${packageJson.version}.`);
  }
  const version = tagName.slice(1);
  if (version !== packageJson.version && !version.startsWith(`${packageJson.version}.`)) {
    throw new Error(`Release tag version (${version}) must match package.json version (${packageJson.version}) or add a dot suffix such as ${packageJson.version}.1.`);
  }
  return { tagName, version, packageName: packageJson.name, assetStem: `${packageJson.name}-${version}` };
}

export async function readStagedAssetInfo(assetDir = "release-assets") {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  if (process.env.TAG_NAME !== undefined) return getReleaseAssetInfo(packageJson, process.env.TAG_NAME);

  const prefix = `${packageJson.name}-`;
  const candidates = (await readdir(assetDir)).filter((name) => name.startsWith(prefix) && name.endsWith(".mjs"));
  if (candidates.length !== 1) {
    throw new Error(`Expected exactly one staged ${packageJson.name} ESM in ${assetDir}; found ${candidates.length}.`);
  }
  return getReleaseAssetInfo(packageJson, `v${candidates[0].slice(prefix.length, -4)}`);
}
