import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const tagName = process.env.TAG_NAME ?? process.argv[2] ?? "";

if (!tagName.startsWith("v")) {
  throw new Error("TAG_NAME must start with v, for example v0.5.0.");
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

const sourceMjsPath = `bundle/${packageName}.mjs`;
const sourceMapPath = `bundle/${packageName}.mjs.map`;
const assetMjsName = `${packageName}-${version}.mjs`;
const assetMapName = `${packageName}-${version}.mjs.map`;
const assetMjsPath = `release-assets/${assetMjsName}`;
const assetMapPath = `release-assets/${assetMapName}`;

const sourceMjs = await readFile(sourceMjsPath, "utf8");
const sourceMap = await readFile(sourceMapPath, "utf8");
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

const assets = [
  [assetMjsName, rewrittenMjs],
  [assetMapName, sourceMap]
];

for (const [name, content] of assets) {
  const digest = createHash("sha256").update(content).digest("hex");
  console.log(`${digest}  ${name}`);
}

