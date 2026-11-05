import { mkdir, readFile, writeFile } from "node:fs/promises";
import { transform } from "esbuild";
import { readStagedAssetInfo } from "./release-asset-info.mjs";

const { assetStem } = await readStagedAssetInfo();
const stagePath = `release-assets/${assetStem}.mjs`;
const stage = await readFile(stagePath, "utf8");
const iife = await transform(stage, {
  format: "iife",
  globalName: "MikuMsOfficeCore",
  target: "es2022"
});
const safeScript = iife.code.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html>
<meta charset="utf-8">
<title>offline IIFE ZIP acceptance</title>
<script>${safeScript}</script>
<script>window.core = MikuMsOfficeCore; window.coreReady = true;</script>`;
await mkdir("workplace/browser-tests", { recursive: true });
await writeFile("workplace/browser-tests/iife-smoke.html", html);
console.log(`Generated offline IIFE harness from ${stagePath}.`);
