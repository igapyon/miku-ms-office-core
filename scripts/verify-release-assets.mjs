import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const tagName = process.env.TAG_NAME ?? process.argv[2] ?? "";

if (!tagName.startsWith("v")) {
  throw new Error("TAG_NAME must start with v, for example v0.5.0.1.");
}

const version = tagName.slice(1);
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const packageName = packageJson.name;
const packageVersion = packageJson.version;

if (
  version !== packageVersion &&
  !version.startsWith(`${packageVersion}.`)
) {
  throw new Error(
    `Release tag version (${version}) must match package.json version (${packageVersion}) or add a dot suffix such as ${packageVersion}.1.`
  );
}

const expectedAssets = [
  `${packageName}-${version}.mjs`,
  `${packageName}-${version}.mjs.map`
];
const localAssetPaths = new Map(
  expectedAssets.map((name) => [name, `release-assets/${name}`])
);

const localDigests = new Map();
for (const [name, path] of localAssetPaths) {
  const content = await readFile(path);
  localDigests.set(name, `sha256:${sha256(content)}`);
}

const releaseUrl = `https://api.github.com/repos/igapyon/${packageName}/releases/tags/${encodeURIComponent(tagName)}`;
const response = await fetch(releaseUrl, {
  headers: {
    Accept: "application/vnd.github+json",
    "User-Agent": `${packageName}-release-asset-verifier`
  }
});

if (response.status === 404) {
  throw new Error(`GitHub Release ${tagName} was not found.`);
}

if (!response.ok) {
  throw new Error(`GitHub Release lookup failed: ${response.status} ${response.statusText}`);
}

const release = await response.json();
const assets = new Map((release.assets ?? []).map((asset) => [asset.name, asset]));

for (const name of expectedAssets) {
  const asset = assets.get(name);
  if (asset === undefined) {
    throw new Error(`Missing GitHub Release asset: ${name}`);
  }

  const expectedDigest = localDigests.get(name);
  if (asset.digest !== expectedDigest) {
    throw new Error(
      `Digest mismatch for ${name}: GitHub=${asset.digest} local=${expectedDigest}`
    );
  }

  console.log(`${asset.digest}  ${name}`);
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

