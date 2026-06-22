# Completion Audit

Checked on 2026-06-22.

This audit checks the active goal in `GOAL.md` against the current repository
state.

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
- `tests/read-side-proof-of-use.test.js`
- `tests/real-fixtures-package-read.test.js`

## Sibling Proofs

At least one sibling repository has a proof-of-use showing how it consumes
`miku-ms-office-core`. There are two write-side sibling proofs:

- `miku-md2docx`
- `miku-md2xlsx`

Evidence:

- `docs/patches/miku-md2docx-ms-office-core-proof.patch`
- `docs/patches/miku-md2xlsx-ms-office-core-proof.patch`
- `docs/first-proof-of-use.md`
- `docs/second-proof-of-use.md`
- sibling working tree changes in `../miku-md2docx`
- sibling working tree changes in `../miku-md2xlsx`

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

Initial package consumption is local, private, and ESM-based.

Evidence:

- `package.json`
- `docs/package-consumption.md`
- `npm_config_cache=workplace/.npm-cache npm pack --dry-run`

## Remaining Follow-Ups

These are not required for the current foundation goal:

- Revisit a bundle-friendly runtime artifact only after repeated read-side need
  is proven.
- Add a focused PPTX package fixture when PPTX read/write candidates become
  active.
- Choose how and when to land sibling working tree proof changes in their own
  repositories.

## Verification

Current verification commands:

```sh
npm test
npm audit
npm run build
npm_config_cache=workplace/.npm-cache npm pack --dry-run
```

Do not run `npm pack --dry-run` in parallel with `npm test` or `npm run build`,
because `prebuild` intentionally cleans `dist`.
