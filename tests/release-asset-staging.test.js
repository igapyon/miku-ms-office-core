import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { build } from "esbuild";
import { generateDtsBundle } from "dts-bundle-generator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const run = promisify(execFile);
const root = resolve(".");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const env = { ...process.env };
delete env.TAG_NAME;
let taskDir;

async function script(name, args = [], overrides = {}) {
  return run(process.execPath, [join(root, "scripts", name), ...args], {
    cwd: taskDir, env: { ...env, ...overrides }
  });
}

describe("versioned release staging", () => {
  beforeAll(async () => {
    taskDir = await mkdtemp(join(tmpdir(), "office-core-stage-test-"));
    await mkdir(join(taskDir, "bundle"));
    await writeFile(join(taskDir, "package.json"), JSON.stringify(packageJson));
    await build({
      entryPoints: ["src/ts/index.ts"],
      outfile: join(taskDir, "bundle", `${packageJson.name}.mjs`),
      bundle: true, format: "esm", platform: "neutral", target: "es2022", sourcemap: true
    });
    const declarations = generateDtsBundle([{ filePath: "src/ts/index.ts", output: { noBanner: true } }], {
      preferredConfigPath: "tsconfig.json"
    });
    await writeFile(join(taskDir, "bundle", `${packageJson.name}.d.mts`), declarations.join("\n"));
  }, 30_000);

  afterAll(async () => {
    if (taskDir !== undefined) await rm(taskDir, { recursive: true, force: true });
  });

  it.each(["", ".1"])("verifies the staged package version with suffix '%s' and generates its IIFE", async (suffix) => {
    const tag = `v${packageJson.version}${suffix}`;
    const stem = `${packageJson.name}-${packageJson.version}${suffix}`;
    await script("prepare-release-assets.mjs", [tag]);
    // No TAG_NAME: each consumer must discover the version actually staged.
    const verified = await script("verify-staged-assets.mjs");
    expect(verified.stdout).toContain(`${stem}.mjs`);
    expect(verified.stdout).toContain(`${stem}.d.mts`);
    const harness = await script("build-browser-harness.mjs");
    expect(harness.stdout).toContain(`release-assets/${stem}.mjs`);
    expect(await readFile(join(taskDir, "workplace/browser-tests/iife-smoke.html"), "utf8"))
      .toContain("MikuMsOfficeCore");
  }, 30_000);

  it("requires the explicitly requested tag instead of accepting a different staged version", async () => {
    await script("prepare-release-assets.mjs", [`v${packageJson.version}.1`]);
    await expect(script("verify-staged-assets.mjs", [], { TAG_NAME: `v${packageJson.version}` }))
      .rejects.toMatchObject({ code: 1, stderr: expect.stringContaining(`${packageJson.name}-${packageJson.version}.mjs`) });
  });
});
