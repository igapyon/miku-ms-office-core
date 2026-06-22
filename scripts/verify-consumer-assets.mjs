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

const assetNames = [
  `${packageName}-${version}.mjs`,
  `${packageName}-${version}.mjs.map`
];
const consumers = [
  "../miku-docx2md",
  "../miku-xlsx2md",
  "../mikuproject"
];

for (const assetName of assetNames) {
  const sourcePath = `release-assets/${assetName}`;
  const sourceDigest = await sha256File(sourcePath);

  for (const consumer of consumers) {
    const vendorPath = `${consumer}/src/vendor/${assetName}`;
    const vendorDigest = await sha256File(vendorPath);

    if (vendorDigest !== sourceDigest) {
      throw new Error(
        `Digest mismatch for ${vendorPath}: consumer=${vendorDigest} staged=${sourceDigest}`
      );
    }

    console.log(`${sourceDigest}  ${vendorPath}`);
  }
}

async function sha256File(path) {
  const content = await readFile(path);
  return createHash("sha256").update(content).digest("hex");
}

