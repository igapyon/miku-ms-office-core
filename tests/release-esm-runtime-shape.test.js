import vm from "node:vm";
import { build, transform } from "esbuild";
import { describe, expect, it } from "vitest";

describe("release ESM runtime shape", () => {
  it("can be wrapped for browser-style IIFE consumers without a top-level Node import", async () => {
    const esmBuild = await build({
      entryPoints: ["src/ts/index.ts"],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      target: "es2020"
    });
    const esmCode = esmBuild.outputFiles[0].text;

    expect(esmCode).not.toMatch(/^import\s/m);

    const iifeBuild = await transform(esmCode, {
      format: "iife",
      globalName: "MikuMsOfficeCore",
      target: "es2020"
    });

    expect(iifeBuild.code).not.toMatch(/^import\s/m);

    const context = {
      TextDecoder,
      TextEncoder,
      Uint8Array
    };
    const api = vm.runInNewContext(`${iifeBuild.code}; MikuMsOfficeCore;`, context);

    const zip = api.writeZipPackage([
      {
        path: "word/document.xml",
        data: new TextEncoder().encode("<w:document/>"),
        compression: "store"
      }
    ]);
    const result = api.readZipPackage(zip);

    expect(result.diagnostics).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].path).toBe("word/document.xml");
  });
});
