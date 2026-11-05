import { mkdir, writeFile } from "node:fs/promises";
import { generateDtsBundle } from "dts-bundle-generator";

const generated = generateDtsBundle([
  {
    filePath: "src/ts/index.ts",
    output: { noBanner: true, sortNodes: true }
  }
], { preferredConfigPath: "tsconfig.json" });

await mkdir("bundle", { recursive: true });
await writeFile("bundle/miku-ms-office-core.d.mts", `${generated.join("\n")}\n`);
console.log("Generated bundle/miku-ms-office-core.d.mts from src/ts/index.ts.");
