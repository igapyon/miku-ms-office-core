# Third Proof of Use

Checked on 2026-06-22.

## Selected Repository

Use `miku-docx2md` as the first read-side proof-of-use target.

## Reason

`miku-docx2md` has a compact read-side package surface:

- `src/ts/zip-io.ts` reads ZIP entries, including stored and deflated entries.
- `src/ts/docx-package-loader.ts` loads package entries and required DOCX
  parts.
- `src/ts/rels-parser.ts` parses `.rels` XML and resolves targets relative to
  `word/document.xml`.

The package-level overlap is smaller than `miku-xlsx2md`, whose workbook,
worksheet, styles, shared strings, drawings, charts, tables, and formula paths
make a first read-side migration broader.

## Integration Constraint

`miku-docx2md` currently builds its TypeScript modules with `module: None`.
The product modules are IIFEs registered through `getDocx2mdModuleRegistry()`,
and runtime bundles embed generated JavaScript strings that are evaluated with
`new Function(...)`.

That architecture cannot directly consume a normal package import such as:

```ts
import { readOfficePackage } from "miku-ms-office-core";
```

without also changing the product build/runtime bundle architecture. That
would mix the package-plumbing proof with a separate module-system migration.

The core now exposes `readZipPackageAsync` and `readOfficePackageAsync` with an
injectable async raw-deflate inflater. This moves the shared ZIP read shape
closer to `miku-docx2md`, `miku-xlsx2md`, and `mikuproject`, but it does not by
itself solve the `miku-docx2md` IIFE/runtime-bundle import boundary.

The later consumer decision is to standardize on the versioned GitHub Release
asset `miku-ms-office-core-<version>.mjs` for product-side vendoring. A future
read-side proof should therefore try the vendored release `.mjs` path first,
then decide whether the product's IIFE/runtime bundle can include that ESM
artifact cleanly.

The published `v0.5.0` asset is suitable for the Node CLI proof bundles, but it
still has a static `node:zlib` import. A read-side or `mikuproject` proof should
use the next release asset after the top-level Node builtin import has been
removed from the bundle.

`tests/release-esm-runtime-shape.test.js` protects the next step: the same
release ESM source can be transformed into a browser-style IIFE global and used
for stored ZIP package read/write in a VM context without `process`. Product
patches still need to decide where that wrapper generation belongs in each build
pipeline.

## Sibling Wrapper Proof

A sibling-side proof has been applied locally to `../miku-docx2md` and recorded
as `docs/patches/miku-docx2md-ms-office-core-wrapper-proof.patch`.

The proof keeps the standard artifact shape: it vendors a single versioned
`.mjs` file from the `v0.5.0.1` GitHub Release asset and generates a
product-local `dist/js/ms-office-core.js` adapter during `npm run build`. That
adapter transforms the vendored ESM into an IIFE global, registers it in
`getDocx2mdModuleRegistry()` as `msOfficeCore`, and lets `zip-io.ts` call
`readZipPackageAsync`.

This proof intentionally changes only the ZIP package plumbing boundary.
`docx-package-loader.ts`, DOCX XML parsing, style parsing, numbering parsing,
asset policy, and Markdown rendering stay in `miku-docx2md`.

The proof now uses:

```text
src/vendor/miku-ms-office-core-0.5.0.1.mjs
src/vendor/miku-ms-office-core-0.5.0.1.mjs.map
```

These files match the `v0.5.0.1` GitHub Release assets verified by
`TAG_NAME=v0.5.0.1 npm run verify:release-assets` and
`TAG_NAME=v0.5.0.1 npm run verify:consumer-assets`.

The proof patch also includes `miku-docx2md` dependency hygiene updates from
`npm audit fix` plus an `esbuild` override to remove the transitive vulnerable
`esbuild@0.27.x` copy pulled by Vite.

## Core-Side Proof

`miku-ms-office-core` contains
`tests/read-side-proof-of-use.test.js`, which proves the shared read-side
package plumbing needed by `miku-docx2md` and `miku-xlsx2md`:

- ZIP package reading through `readOfficePackage`
- async ZIP package reading through `readOfficePackageAsync`
- `[Content_Types].xml` parsing through `parseOpcContentTypesXml`
- media part enumeration through `listOfficeMediaParts`
- part-specific relationship path lookup through `readOfficePartRelationships`
- internal relationship target resolution relative to the source part
- external relationship target preservation

This test intentionally does not require `word/document.xml`, parse DOCX
paragraphs, interpret XLSX workbooks, or choose Markdown output behavior.

## Remaining Migration Targets

The `miku-docx2md` wrapper proof chose the first of these approaches:

- update `miku-docx2md` to include the vendored
  `miku-ms-office-core-<version>.mjs` release asset in its core build
- expose an additional IIFE-specific core artifact only if repeated read-side
  need proves that the vendored ESM release asset cannot fit the product build
- keep the current product build architecture and copy only generated runtime
  primitives, which is not preferred for a shared package dependency

The current project decision is to prefer the versioned release `.mjs` artifact
for sibling integration and defer a separate IIFE runtime artifact. The local
`miku-docx2md` proof currently replaces duplicated ZIP reading with
`readZipPackageAsync`. A later, narrower migration can still replace:

- `rels-parser.ts` target resolution with `readOfficePartRelationships` or
  lower-level OPC helpers
- duplicated relationship XML parsing with `parseOpcRelationshipsXml`

DOCX required-part checks, document parsing, style parsing, numbering parsing,
asset trace policy, and Markdown rendering should remain in `miku-docx2md`.

## Verification Commands

Core-side:

```sh
npm test
npm audit
```

Sibling-side:

```sh
cd ../miku-docx2md
npm test
npm audit
npm run build:bundle
npm run build:runtime
npm run smoke:bundle
npm run smoke:runtime
git apply --check --reverse ../miku-ms-office-core/docs/patches/miku-docx2md-ms-office-core-wrapper-proof.patch
```

## Follow-Up Targets

- Decide whether read-side product builds can vendor and bundle
  `miku-ms-office-core-<version>.mjs` directly.
- After `miku-docx2md`, use the same read-side helpers to plan a broader
  `miku-xlsx2md` proof.
