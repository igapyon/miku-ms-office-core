import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { readZipPackage } from "../../dist/index.js";
import { readStagedAssetInfo } from "../../scripts/release-asset-info.mjs";

const baseUrl = "http://127.0.0.1:4173";
const { assetStem } = await readStagedAssetInfo();
const moduleUrl = `${baseUrl}/assets/${assetStem}.mjs`;
const iifePath = fileURLToPath(new URL("../../workplace/browser-tests/iife-smoke.html", import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "blob:" || url.protocol === "file:" ||
        (url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port === "4173")) {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
  await page.goto(baseUrl);
  await page.waitForFunction(() => window.coreReady === true);
});

test("ESM reads Node DEFLATE and browser DEFLATE opens in Node and Python", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const core = window.core;
    const response = await fetch("/node-generated.zip");
    const nodeInput = new Uint8Array(await response.arrayBuffer());
    const nodeResult = await core.readZipPackage(nodeInput);
    const created = await core.writeZipPackage([
      { path: "日本語/data.txt", data: "browser-created", compression: "deflate" },
      { path: "binary.bin", data: new Uint8Array([0, 1, 127, 128, 255]), compression: "deflate" }
    ], { compression: "deflate" });
    return {
      nodeDiagnostics: nodeResult.diagnostics,
      nodeEntries: nodeResult.entries.map((entry) => ({ path: entry.path, data: Array.from(entry.data) })),
      browserZipBase64: btoa(String.fromCharCode(...created))
    };
  });
  expect(result.nodeDiagnostics).toEqual([]);
  expect(result.nodeEntries.map((entry) => entry.path)).toEqual(["binary.bin", "node-created.txt"]);
  expect(result.nodeEntries[1].data).toEqual(Array.from(new TextEncoder().encode("Node -> browser")));

  const browserZip = Buffer.from(result.browserZipBase64, "base64");
  const nodeRead = await readZipPackage(new Uint8Array(browserZip));
  expect(nodeRead.diagnostics).toEqual([]);
  expect(nodeRead.entries.map((entry) => entry.path)).toEqual(["binary.bin", "日本語/data.txt"]);

  const python = spawnSync("python3", ["-c", [
    "import base64, io, json, sys, zipfile",
    "archive = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))",
    "manifest = [{'path': item.filename, 'compression': item.compress_type, 'data': base64.b64encode(archive.read(item)).decode('ascii')} for item in archive.infolist()]",
    "print(json.dumps(manifest, ensure_ascii=False))"
  ].join("\n")], { input: browserZip, encoding: "utf8" });
  expect(python.status, python.stderr).toBe(0);
  const independent = JSON.parse(python.stdout);
  expect(independent.map((entry) => entry.path)).toEqual(["binary.bin", "日本語/data.txt"]);
  expect(independent.every((entry) => entry.compression === 8)).toBe(true);
  expect(Buffer.from(independent[1].data, "base64").toString("utf8")).toBe("browser-created");
});

test("a Blob Worker uses DEFLATE read and write from the staged ESM", async ({ page }) => {
  const result = await page.evaluate(async (importUrl) => new Promise((resolve, reject) => {
    const source = `import { readZipPackage, writeZipPackage } from ${JSON.stringify(importUrl)};
      self.onmessage = async () => {
        try {
          const zip = await writeZipPackage([{path: 'worker.txt', data: 'worker', compression: 'deflate'}], {compression: 'deflate'});
          const result = await readZipPackage(zip);
          self.postMessage({paths: result.entries.map((entry) => entry.path), text: new TextDecoder().decode(result.entries[0].data), diagnostics: result.diagnostics});
        } catch (error) { self.postMessage({error: {name: error.name, message: error.message, code: error.code}}); }
      };`;
    const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    const worker = new Worker(blobUrl, { type: "module" });
    worker.onmessage = (event) => { worker.terminate(); URL.revokeObjectURL(blobUrl); resolve(event.data); };
    worker.onerror = (event) => { worker.terminate(); URL.revokeObjectURL(blobUrl); reject(new Error(event.message)); };
    worker.postMessage("run");
  }), moduleUrl);
  expect(result).toEqual({ paths: ["worker.txt"], text: "worker", diagnostics: [] });
});

test("the staged IIFE reads and writes DEFLATE from an offline file URL", async ({ browser }) => {
  const context = await browser.newContext({ offline: true });
  try {
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === "file:") await route.continue();
      else await route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(iifePath).href);
    await page.waitForFunction(() => window.coreReady === true);
    const result = await page.evaluate(async () => {
      const zip = await window.core.writeZipPackage([
        { path: "iife.txt", data: "offline", compression: "deflate" }
      ], { compression: "deflate" });
      const read = await window.core.readZipPackage(zip);
      return {
        paths: read.entries.map((entry) => entry.path),
        text: new TextDecoder().decode(read.entries[0]?.data),
        diagnostics: read.diagnostics,
        aliasIsCanonical: window.core.readZipPackage === window.core.readZipPackageAsync
      };
    });
    expect(result).toEqual({ paths: ["iife.txt"], text: "offline", diagnostics: [], aliasIsCanonical: true });
  } finally {
    await context.close();
  }
});
