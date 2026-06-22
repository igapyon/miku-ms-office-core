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

## Current Constraint

Do not apply a sibling patch yet.

`miku-docx2md` currently builds its TypeScript modules with `module: None`.
The product modules are IIFEs registered through `getDocx2mdModuleRegistry()`,
and runtime bundles embed generated JavaScript strings that are evaluated with
`new Function(...)`.

That architecture cannot directly consume an ESM package import such as:

```ts
import { readOfficePackage } from "miku-ms-office-core";
```

without also changing the product build/runtime bundle architecture. That
would mix the package-plumbing proof with a separate module-system migration.

The core now exposes `readZipPackageAsync` and `readOfficePackageAsync` with an
injectable async raw-deflate inflater. This moves the shared ZIP read shape
closer to `miku-docx2md`, `miku-xlsx2md`, and `mikuproject`, but it does not by
itself solve the `miku-docx2md` IIFE/runtime-bundle import boundary.

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

## Expected Future Proof Steps

A future sibling-side proof should first choose one of these approaches:

- update `miku-docx2md` to allow ESM imports in its core build
- expose a bundle-friendly core subset for IIFE/runtime-bundle products only if
  repeated read-side need proves it is worth maintaining
- keep the current product build architecture and copy only generated runtime
  primitives, which is not preferred for a shared package dependency

The current project decision is to prefer public ESM imports for initial sibling
integration and defer a separate IIFE runtime artifact. After the
`miku-docx2md` product build/runtime boundary is ready for that shape, the
package-plumbing migration can replace:

- `rels-parser.ts` target resolution with `readOfficePartRelationships` or
  lower-level OPC helpers
- duplicated relationship XML parsing with `parseOpcRelationshipsXml`
- duplicated ZIP reading with `readOfficePackage` or a runtime-compatible ZIP
  reader

DOCX required-part checks, document parsing, style parsing, numbering parsing,
asset trace policy, and Markdown rendering should remain in `miku-docx2md`.

## Verification Commands

Core-side:

```sh
npm test
npm audit
```

No sibling-side verification command is recorded yet because no sibling patch
has been applied.

## Follow-Up Targets

- Decide whether `miku-ms-office-core` needs a browser/IIFE-compatible runtime
  surface before read-side sibling patches.
- If ESM import support is accepted in read-side products, apply the first
  sibling proof to `miku-docx2md`.
- After `miku-docx2md`, use the same read-side helpers to plan a broader
  `miku-xlsx2md` proof.
