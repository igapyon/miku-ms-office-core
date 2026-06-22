# Completion Audit

Checked on 2026-06-22.

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

There is also a read-side `miku-docx2md` wrapper proof using the locally staged
`miku-ms-office-core-0.5.0.1.mjs` release asset candidate. It proves that the
product can generate a module-registry adapter from a vendored `.mjs` and
replace its local ZIP reader with `readZipPackageAsync`. The proof patch also
includes `miku-docx2md` dependency hygiene updates so `npm audit` reports zero
vulnerabilities.

`miku-xlsx2md` has the same wrapper proof pattern for its read-side
`unzipEntries` path and the same locally staged
`miku-ms-office-core-0.5.0.1.mjs` release asset candidate. Its product-owned
`createStoredZip` remains in place because the current product tests protect
ASCII versus non-ASCII UTF-8 flag behavior that the core writer does not yet
expose as policy.

`mikuproject` has the same versioned `.mjs` vendor pattern with a generated
global adapter and the same locally staged
`miku-ms-office-core-0.5.0.1.mjs` release asset candidate. Its async XLSX ZIP
read path consumes `readZipPackageAsync`. Its sync `packZip` / `unpackZip`
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
- GitHub Release asset `miku-ms-office-core-0.5.0.mjs`

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
- `TAG_NAME=v0.5.0.1 npm run verify:release-assets` after `v0.5.0.1` is
  published
- `TAG_NAME=v0.5.0.1 npm run verify:consumer-assets`
- `node --input-type=module -e "const core = await import('./release-assets/miku-ms-office-core-0.5.0.1.mjs'); console.log(Object.keys(core).length);"`
- `node --input-type=module -e "await import('./bundle/miku-ms-office-core.mjs')"`
- `rg -n "^import |node:zlib|getBuiltinModule|deflateRawSync|inflateRawSync" bundle/miku-ms-office-core.mjs dist/zip-package.js`

## Remaining Follow-Ups

These are still required before the broader product-application goal can be
called complete:

- Publish or consume the next versioned `.mjs` release asset after the top-level
  Node builtin import removal. The latest GitHub Release checked on
  2026-06-22 is still `v0.5.0`; the locally staged next candidate is
  `miku-ms-office-core-0.5.0.1.mjs`.
- Confirm the staged `miku-ms-office-core-0.5.0.1.mjs` candidate used by
  `miku-docx2md`, `miku-xlsx2md`, and `mikuproject` proof patches matches the
  uploaded GitHub Release asset after publication. This is now script-backed by
  `TAG_NAME=v0.5.0.1 npm run verify:release-assets`.
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
