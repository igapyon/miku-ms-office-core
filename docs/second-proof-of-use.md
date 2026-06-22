# Second Proof of Use

Checked on 2026-06-22.

## Selected Repository

Use `miku-md2xlsx` as the second proof-of-use target.

## Reason

`miku-md2xlsx` is the closest write-side sibling after `miku-md2docx`:

- `src/ts/zip-io.ts` duplicates a stored ZIP writer shape.
- `src/ts/xlsx-writer.ts` hand-builds `[Content_Types].xml`.
- `src/ts/xlsx-writer.ts` hand-builds root and workbook `.rels` XML.
- `src/ts/xlsx-xml.ts` duplicates XML sanitization and escaping helpers.

The proof can replace package plumbing without moving XLSX workbook, worksheet,
drawing, image preview, Markdown parsing, or rich text semantics into
`miku-ms-office-core`.

## Proposed Proof Steps

1. Vendor `miku-ms-office-core-0.5.0.mjs` from the GitHub Release asset into
   `miku-md2xlsx`.
2. In `src/ts/xlsx-writer.ts`, replace `createZip(entries)` with
   `writeZipPackage(entries)`.
3. Replace local `ZipFileEntry` typing in `xlsx-writer.ts` with
   `ZipEntryInput` from `miku-ms-office-core`.
4. Replace `contentTypes` internals with `buildOpcContentTypesXml`.
5. Replace root package and workbook relationship XML internals with
   `buildOpcRelationshipsXml`.
6. Keep worksheet, drawing, image, style, hyperlink, merge, rich text, and
   workbook model logic in `miku-md2xlsx`.
7. Run `miku-md2xlsx` tests, audit, and smoke/bundle commands.

## Expected Import Shape

The sibling proof should only import low-level package helpers:

```ts
import {
  buildOpcContentTypesXml,
  buildOpcRelationshipsXml,
  writeZipPackage,
  type ZipEntryInput
} from "miku-ms-office-core";
```

In the landing proof, import from the vendored release asset path instead of a
package dependency:

```ts
import {
  buildOpcContentTypesXml,
  buildOpcRelationshipsXml,
  writeZipPackage,
  type ZipEntryInput
} from "../vendor/miku-ms-office-core-0.5.0.mjs";
```

Avoid imports from private `dist/*` paths and avoid keeping
`file:../miku-ms-office-core` as the final dependency shape.

## Expected Non-Goals

- Do not move `xlsx-writer.ts` wholesale into `miku-ms-office-core`.
- Do not move worksheet XML, drawing XML, style XML, image preview, rich text,
  hyperlink, merge, or Markdown parsing logic into core.
- Do not introduce workbook model types into core.
- Do not change XLSX output policy unless needed by the package boundary.

## Core-Side Proof

`miku-ms-office-core` contains
`tests/md2xlsx-proof-of-use.test.js`, which builds an XLSX-like package shell
with:

- `writeZipPackage`
- `buildOpcRelationshipsXml`
- `buildOpcContentTypesXml`
- `readZipPackage`
- `getZipTextEntry`
- `parseOpcRelationshipsXml`
- `parseOpcContentTypesXml`
- `resolveOpcContentType`

This test proves the core API can cover the package-plumbing portion of the
`miku-md2xlsx` migration without moving XLSX workbook semantics into the core.

## Patch Artifact

The concrete sibling-side patch is recorded at:

- `docs/patches/miku-md2xlsx-ms-office-core-proof.patch`

The patch was checked against a clean `workplace/` copy with:

```sh
git apply --check ../../docs/patches/miku-md2xlsx-ms-office-core-proof.patch
```

Temporary proof copies are kept under ignored `workplace/` directories in this
repository, such as:

- `workplace/miku-md2xlsx-proof-before`
- `workplace/miku-md2xlsx-proof-check`

Do not commit files under `workplace/` except `workplace/.gitkeep`.

## Current Proof Result

The proof was refreshed in the sibling `miku-md2xlsx` working tree on
2026-06-22 to use the versioned release `.mjs` asset. The sibling change uses
the vendored `miku-ms-office-core-0.5.0.mjs` for:

- reproducible ZIP package writing through `writeZipPackage`
- root package relationship XML through `buildOpcRelationshipsXml`
- workbook relationship XML through `buildOpcRelationshipsXml`
- content type XML through `buildOpcContentTypesXml`
- shared ZIP entry typing through `ZipEntryInput`

The sibling-side proof also required audit cleanup in `miku-md2xlsx`:

- update direct `esbuild` dev dependency to `^0.28.1`
- add an `overrides.esbuild` policy for nested Vite/Vitest use
- update `package-lock.json` through `npm install` and `npm audit fix`

Verified sibling commands:

```sh
npm audit
npm test
npm run test:semantic-roundtrip
npm run build:all
npm run smoke:bundle
```

All of the above passed after the audit cleanup. The sibling working tree now
has deliberate proof changes in `package.json`, `package-lock.json`,
`src/ts/xlsx-writer.ts`, and `src/vendor/`. The earlier local
`file:../miku-ms-office-core` dependency was removed from the refreshed proof;
the product imports from `src/vendor/miku-ms-office-core-0.5.0.mjs`, and the
CLI release bundle includes the vendored helper code.

## Verification Commands

Core-side:

```sh
npm test
npm audit
```

Sibling-side after applying the proof patch:

```sh
git apply ../miku-ms-office-core/docs/patches/miku-md2xlsx-ms-office-core-proof.patch
npm audit
npm test
npm run test:semantic-roundtrip
```

If bundle behavior is touched:

```sh
npm run build:all
npm run smoke:bundle
```

## Follow-Up Targets

After `miku-md2xlsx`, choose the next target based on what the proof reveals:

- `miku-docx2md` if required-part reads and relationship target resolution need
  stronger read-side helpers.
- `miku-xlsx2md` if XLSX read-side package helpers should be proven before
  adding real fixtures.
- `mikuproject` after runtime support for browser-compatible ZIP deflate reads
  is decided.
