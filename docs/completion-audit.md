# Completion Audit

Checked on 2026-06-23.

This audit checks the active goal against the current repository state.

## Objective Boundary

`miku-ms-office-core` is a shared low-level Microsoft Office package foundation
for miku-soft products. It stays below DOCX, XLSX, PPTX, Markdown, and MS
Project meaning.

Evidence:

- `README.md`
- `docs/commonization-scope-check.md`
- `docs/api-reference.md`
- `DECISIONS.md`

## Foundation

The repository has a TypeScript / Node.js package foundation.

Evidence:

- `package.json`
- `tsconfig.json`
- `src/ts`
- `npm test`
- `npm_config_cache=workplace/.npm-cache npm pack --dry-run`

## Low-Level APIs

The current public API covers the first useful package plumbing layer:

- ZIP package read/write
- reproducible ZIP output policy
- async read-side ZIP package support
- OPC part paths
- relationships
- content types
- office package read helpers
- media part listing
- XML helpers
- diagnostics

Evidence:

- `src/ts/zip-package.ts`
- `src/ts/opc-part-path.ts`
- `src/ts/opc-relationships.ts`
- `src/ts/opc-content-types.ts`
- `src/ts/office-package.ts`
- `src/ts/xml-helper.ts`
- `src/ts/diagnostics.ts`
- `tests/public-api-surface.test.js`
- `docs/api-reference.md`

## Reproducibility

ZIP timestamp normalization, stable ordering, and compression policy are tested.

Evidence:

- `tests/zip-reproducibility.test.js`

## Sibling Repository Comparison

The implementation has been compared against practical low-level code from:

- `miku-docx2md`
- `miku-xlsx2md`
- `miku-md2docx`
- `miku-md2xlsx`
- `mikuproject` XLSX input/output

Evidence:

- `docs/commonization-scope-check.md`
- `docs/first-proof-of-use.md`
- `docs/second-proof-of-use.md`
- `docs/third-proof-of-use.md`
- `docs/fourth-proof-of-use.md`
- `docs/fifth-proof-of-use.md`
- `tests/read-side-proof-of-use.test.js`
- `tests/real-fixtures-package-read.test.js`

## Sibling Proofs

At least one sibling repository has a proof-of-use showing how it consumes
`miku-ms-office-core`. There are two write-side sibling proofs:

- `miku-md2docx`
- `miku-md2xlsx`

There is also a read-side `miku-docx2md` wrapper proof using the versioned
GitHub Release asset `miku-ms-office-core-0.5.0.1.mjs`. It proves that the
product can generate a module-registry adapter from a vendored `.mjs` and
replace its local ZIP reader with `readZipPackageAsync`. The proof patch also
includes `miku-docx2md` dependency hygiene updates so `npm audit` reports zero
vulnerabilities.

`miku-xlsx2md` has the same wrapper proof pattern for its read-side
`unzipEntries` path and the same versioned GitHub Release asset
`miku-ms-office-core-0.5.0.1.mjs`. Its product-owned
`createStoredZip` remains in place because the current product tests protect
ASCII versus non-ASCII UTF-8 flag behavior that the core writer does not yet
expose as policy.

`mikuproject` has the same versioned `.mjs` vendor pattern with a generated
global adapter and the same versioned GitHub Release asset
`miku-ms-office-core-0.5.0.1.mjs`. Its async XLSX ZIP read path consumes
`readZipPackageAsync`. Its sync `packZip` / `unpackZip`
paths remain product-owned because they are part of the current workbook
output/runtime contract.

Evidence:

- `docs/patches/miku-md2docx-ms-office-core-proof.patch`
- `docs/patches/miku-md2xlsx-ms-office-core-proof.patch`
- `docs/patches/miku-docx2md-ms-office-core-wrapper-proof.patch`
- `docs/patches/miku-xlsx2md-ms-office-core-wrapper-proof.patch`
- `docs/patches/mikuproject-ms-office-core-wrapper-proof.patch`
- `docs/first-proof-of-use.md`
- `docs/second-proof-of-use.md`
- `docs/third-proof-of-use.md`
- `docs/fourth-proof-of-use.md`
- `docs/fifth-proof-of-use.md`
- sibling working tree changes in `../miku-md2docx`
- sibling working tree changes in `../miku-md2xlsx`
- sibling working tree changes in `../miku-docx2md`
- sibling working tree changes in `../miku-xlsx2md`
- sibling working tree changes in `../mikuproject`
- `../miku-docx2md`: `npm test`, `npm audit`, `npm run build:bundle`,
  `npm run smoke:bundle`
- `../miku-xlsx2md`: `npm test`, `npm audit`, `npm run build:runtime`,
  `npm run smoke:runtime`
- `../mikuproject`: `npm run build:js`, `npm run test:fast`, `npm audit`,
  `npm run build:web`, `npm run build:cli-bundle`

## Real Package Fixtures

Focused real Office package fixtures protect read behavior without importing
product semantics.

Evidence:

- `tests/fixtures/office/README.md`
- `tests/fixtures/office/word-headings-basic.docx`
- `tests/fixtures/office/xlsx2md-basic-sample01.xlsx`
- `tests/fixtures/office/mikuproject-sample.xlsx`
- `tests/real-fixtures-package-read.test.js`

## Package Consumption

The standard consumer shape is now the versioned single-file release ESM asset,
not a local `file:../miku-ms-office-core` dependency. The package itself remains
private and is not published to npm.

Evidence:

- `package.json`
- `docs/package-consumption.md`
- `DECISIONS.md`
- `npm_config_cache=workplace/.npm-cache npm pack --dry-run`
- GitHub Release assets `miku-ms-office-core-0.5.0.mjs` and
  `miku-ms-office-core-0.5.0.1.mjs`

## Release ESM Runtime Shape

The next release ESM build avoids top-level Node builtin imports. The bundle
still resolves Node zlib lazily for synchronous deflated ZIP operations, but it
can be imported without a static `node:zlib` import. The bundle smoke also
verifies that the generated `.mjs` can be transformed into a browser-style IIFE
global and used for stored ZIP read/write in a VM context without `process`.
Release asset staging is now script-backed and rewrites `sourceMappingURL` to
the versioned `.mjs.map` asset name.

Evidence:

- `src/ts/zip-package.ts`
- `bundle/miku-ms-office-core.mjs`
- `scripts/prepare-release-assets.mjs`
- `scripts/verify-release-assets.mjs`
- `scripts/verify-consumer-assets.mjs`
- `tests/release-esm-runtime-shape.test.js`
- `npm run build:all`
- `npm run smoke:bundle`, including the browser-style IIFE wrapping check
- `TAG_NAME=v0.5.0.1 npm run prepare:release-assets`
- `TAG_NAME=v0.5.0.1 npm run verify:release-assets`
- `TAG_NAME=v0.5.0.1 npm run verify:consumer-assets`
- `node --input-type=module -e "const core = await import('./release-assets/miku-ms-office-core-0.5.0.1.mjs'); console.log(Object.keys(core).length);"`
- `node --input-type=module -e "await import('./bundle/miku-ms-office-core.mjs')"`
- `rg -n "^import |node:zlib|getBuiltinModule|deflateRawSync|inflateRawSync" bundle/miku-ms-office-core.mjs dist/zip-package.js`

## Remaining Follow-Ups

These are outside the completed release-asset consumption goal and remain as
later follow-ups:

- Decide whether core ZIP writing needs an explicit UTF-8 flag policy before
  replacing `miku-xlsx2md` `createStoredZip` or `mikuproject` `packZip`.
- Add a focused PPTX package fixture when PPTX read/write candidates become
  active.
- Choose how and when to land sibling working tree proof changes in their own
  repositories.

## Verification

Current verification commands:

```sh
npm test
npm audit
npm run build:all
npm run smoke:bundle
npm_config_cache=workplace/.npm-cache npm pack --dry-run
```

Do not run `npm pack --dry-run` in parallel with `npm test` or `npm run build:all`,
because `prebuild` intentionally cleans `dist`.

## #11 Browser / IIFE ZIP API (2026-11-05)

P1–P6 of `docs/zip-browser-api-plan.md` are implemented in this repository.
ZIP and Office package read/write APIs now return Promises and use standard raw
Compression Streams. ZIP32 validation, configurable processing limits,
cancellation, and all-or-nothing read results are included. The writer keeps
STORE as its default. No sibling product migration or #10 file-backed streaming
API was included. The core implementation is committed locally in the current
PR history; no push, tag, Release upload, or Issue update was made.

This completes the core P1–P6 scope. It does not establish completion of every
condition in Issue #11: the Issue also asks for a product-by-product inventory
of core versions, APIs, runtimes, representative paths and constraints, and
prioritized follow-up work. That product survey remains outstanding, so PR
text should reference #11 without claiming to close it.

Verification on the local Node 26.12.1 / macOS 27.0.1 arm64 environment:

- `npm test`: Vitest 4.1.12, 12 files / 43 tests passed after the self-review fixes.
- `npm run build:all`, `npm run test:types` (DOM and WebWorker consumers),
  `npm run smoke:bundle`, `npm run verify:staged-assets`, `npm audit`,
  `npm pack --dry-run`, and `git diff --check` passed.
- `npm run test:browser`: 9 tests passed across Chromium 156.0.8078.4,
  Firefox 157.0, and WebKit 27.2 with Playwright 1.64.1. Coverage includes
  browser ESM, offline IIFE, Blob Worker, Node interoperability, and Python
  `zipfile` interoperability.
- The suite passed on both the temporary `v1.0.0.1` stage without `TAG_NAME`
  and the final `v1.0.0` stage with explicit `TAG_NAME=v1.0.0` (9 tests each).
- Node 22 and 24 are configured in CI; they were not the local verification
  runtimes for this audit.

At the pre-correction `v1.0.0` verification point, these generated assets had
been staged locally and not published:

| Asset | SHA-256 |
| --- | --- |
| `miku-ms-office-core-1.0.0.mjs` | `1537966dfbffa0a914ee3c023c9d049a22baba6689e40b06ae240eec7a4bf075` |
| `miku-ms-office-core-1.0.0.mjs.map` | `b36240dd3a17c13a93c93124fafb0a77d3ea145233ca56c074177c981ec8b265` |
| `miku-ms-office-core-1.0.0.d.mts` | `3c67737ff84c1eda496bc3b421d828b04c4aaba7de38e21e94e0988fdc7c734d` |

The self-review corrections enforce actual remaining total budgets, stop at
the first chunk exceeding a declared size, preflight all declared entry sizes,
and check cancellation after the final write await. Regressions also exercise
normal and dot-suffix staging, standalone types, IIFE generation, and explicit
tag mismatch rejection. The temporary browser-tested `1.0.0.1.mjs` digest was
`cffe3a87c3d088f20a7b21b61565f9ab9db3554c863ca89403e0f5b6a909a337`;
its map and declaration digests were the same as the final stage above.

## User-Directed Version Correction (2026-11-05)

The initial P6 implementation used the plan's proposed 1.0.0. The user then
explicitly selected 0.8.0. `npm version 0.8.0 --no-git-tag-version` updated
`package.json`, the lockfile root, and `packages[""].version`; generated output
was rebuilt and restaged at 0.8.0. The version correction is committed locally
in the current PR history and has not been tagged or released.

- `npm run build:all` passed.
- `npm run verify:staged-assets` passed, including DOM and WebWorker declaration
  consumers.
- `npm pack --dry-run --json` passed as `miku-ms-office-core-0.8.0.tgz` (42
  files, 29,012 bytes).
- The earlier 43-test suite and both 9-test browser runs covered the same source
  code; this version-only correction was checked through build, stage, and pack.

Current local `v0.8.0` stage digests:

| Asset | SHA-256 |
| --- | --- |
| `miku-ms-office-core-0.8.0.mjs` | `82bdc9fb46726eef62946d4992041ce9d35c927452646cec5bd4e83ada11377c` |
| `miku-ms-office-core-0.8.0.mjs.map` | `b36240dd3a17c13a93c93124fafb0a77d3ea145233ca56c074177c981ec8b265` |
| `miku-ms-office-core-0.8.0.d.mts` | `3c67737ff84c1eda496bc3b421d828b04c4aaba7de38e21e94e0988fdc7c734d` |
