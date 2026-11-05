import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readZipPackage, writeZipPackage } from "../../dist/index.js";
import { readStagedAssetInfo } from "../../scripts/release-asset-info.mjs";

const { assetStem } = await readStagedAssetInfo();
const asset = await readFile(`release-assets/${assetStem}.mjs`);
const sourceMap = await readFile(`release-assets/${assetStem}.mjs.map`);
const nodeZip = await writeZipPackage([
  { path: "node-created.txt", data: "Node -> browser", compression: "deflate" },
  { path: "binary.bin", data: new Uint8Array([0, 1, 127, 128, 255]), compression: "deflate" }
], { compression: "deflate" });
const nodeRead = await readZipPackage(nodeZip);
if (nodeRead.diagnostics.length !== 0) throw new Error("Node fixture ZIP failed its own roundtrip.");

const server = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("X-Content-Type-Options", "nosniff");
  const path = new URL(request.url ?? "/", "http://127.0.0.1:4173").pathname;
  if (path === "/health") {
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end("ok");
    return;
  }
  if (path === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(`<!doctype html>
<meta charset="utf-8">
<title>core browser acceptance</title>
<script type="module">
  import * as core from "/assets/${assetStem}.mjs";
  window.core = core;
  window.coreReady = true;
</script>`);
    return;
  }
  if (path === `/assets/${assetStem}.mjs`) {
    response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" }).end(asset);
    return;
  }
  if (path === `/assets/${assetStem}.mjs.map`) {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(sourceMap);
    return;
  }
  if (path === "/node-generated.zip") {
    response.writeHead(200, { "content-type": "application/zip" }).end(nodeZip);
    return;
  }
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
});

server.listen(4173, "127.0.0.1");
process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
