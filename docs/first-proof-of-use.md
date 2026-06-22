# First Proof of Use

Checked on 2026-06-22.

## Selected Repository

Use `miku-md2docx` as the first proof-of-use target.

## Reason

`miku-md2docx` is the smallest low-risk first target because its shared needs
are concentrated in package writing:

- `src/ts/zip-io.ts` duplicates the lightweight ZIP writer shape.
- `src/ts/relationships.ts` hand-builds `.rels` XML.
- `src/ts/docx-package.ts` hand-builds `[Content_Types].xml`.
- `src/ts/xml-utils.ts` contains XML escaping helpers.

The proof can replace package plumbing without moving DOCX paragraph, run,
table, image rendering, or Markdown conversion semantics into
`miku-ms-office-core`.

## Proposed Proof Steps

1. Vendor `miku-ms-office-core-0.5.0.mjs` from the GitHub Release asset into
   `miku-md2docx`.
2. In `src/ts/core.ts`, replace `createZip(entries)` with
   `writeZipPackage(entries)`.
3. In `src/ts/types.ts` and `src/ts/docx-package.ts`, replace local
   `ZipFileEntry` typing with `ZipEntryInput` from `miku-ms-office-core`.
4. In `src/ts/relationships.ts`, keep relationship constants and
   `addRelationship` product-side, but replace `documentRelsXml` internals with
   `buildOpcRelationshipsXml`.
5. In `src/ts/docx-package.ts`, keep `buildDocxEntries` and `buildDocumentXml`
   product-side, but replace `contentTypesXml` internals with
   `buildOpcContentTypesXml`.
6. Keep `docx-templates.ts`, renderers, image rendering, Markdown parsing, and
   `RenderContext` in `miku-md2docx`.
7. Run `miku-md2docx` tests and smoke commands.

## Expected Import Shape

The sibling proof should only import low-level package helpers:

```ts
import {
  buildOpcContentTypesXml,
  buildOpcRelationshipsXml,
  writeZipPackage,
  type OpcRelationship,
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
  type OpcRelationship,
  type ZipEntryInput
} from "../vendor/miku-ms-office-core-0.5.0.mjs";
```

Avoid imports from private `dist/*` paths and avoid keeping
`file:../miku-ms-office-core` as the final dependency shape.

## Expected Code Shape

`src/ts/core.ts`:

```ts
import { writeZipPackage } from "../vendor/miku-ms-office-core-0.5.0.mjs";

// ...
return { docx: writeZipPackage(entries), summary };
```

`src/ts/relationships.ts`:

```ts
import { buildOpcRelationshipsXml, type OpcRelationship } from "../vendor/miku-ms-office-core-0.5.0.mjs";

const REQUIRED_DOCUMENT_RELATIONSHIPS: OpcRelationship[] = [
  { id: "rIdStyles", type: REL_STYLES, target: "styles.xml" },
  { id: "rIdNumbering", type: REL_NUMBERING, target: "numbering.xml" }
];

export function documentRelsXml(relationships: Relationship[]): string {
  return buildOpcRelationshipsXml([...REQUIRED_DOCUMENT_RELATIONSHIPS, ...relationships]);
}
```

`src/ts/docx-package.ts`:

```ts
import { buildOpcContentTypesXml, type ZipEntryInput } from "../vendor/miku-ms-office-core-0.5.0.mjs";

function contentTypesXml(images: ZipEntryInput[]): string {
  return buildOpcContentTypesXml({
    defaults: [
      { extension: "rels", contentType: "application/vnd.openxmlformats-package.relationships+xml" },
      { extension: "xml", contentType: "application/xml" },
      // image defaults remain product-side because miku-md2docx owns image policy
    ],
    overrides: [
      // DOCX part overrides remain product-side because miku-md2docx owns the DOCX package shell
    ]
  });
}
```

## Expected Non-Goals

- Do not move `docx-package.ts` wholesale into `miku-ms-office-core`.
- Do not move `docx-templates.ts`, OOXML renderers, or document body generation.
- Do not rename product-side DOCX concepts during the proof unless required by
  the dependency boundary.
- Do not make `miku-ms-office-core` depend on Markdown parsing or DOCX render
  context types.

## Success Criteria

- `miku-md2docx` can generate the same meaningful DOCX package using
  `miku-ms-office-core` for package plumbing.
- ZIP output remains reproducible through core timestamp, ordering, and
  compression policy.
- The proof identifies any missing core API without broadening into DOCX
  semantics.
- `miku-md2docx` local tests and smoke commands pass.

## Core-Side Proof

`miku-ms-office-core` contains
`tests/md2docx-proof-of-use.test.js`, which builds a DOCX-like package shell
with:

- `writeZipPackage`
- `buildOpcRelationshipsXml`
- `buildOpcContentTypesXml`
- `readZipPackage`
- `getZipTextEntry`
- `parseOpcRelationshipsXml`

This test proves the core API can cover the package-plumbing portion of the
`miku-md2docx` migration without moving DOCX document semantics into the core.

## Patch Artifact

The concrete sibling-side patch is recorded at:

- `docs/patches/miku-md2docx-ms-office-core-proof.patch`

The patch was checked with:

```sh
git -C ../miku-md2docx apply --check ../miku-ms-office-core/docs/patches/miku-md2docx-ms-office-core-proof.patch
```

Temporary proof copies are kept under ignored `workplace/` directories in this
repository, such as:

- `workplace/miku-md2docx-proof-before`
- `workplace/miku-md2docx-proof-after`

Do not commit files under `workplace/` except `workplace/.gitkeep`.

## Current Proof Result

The proof was refreshed in the sibling `miku-md2docx` working tree on
2026-06-22 to use the versioned release `.mjs` asset. The sibling change uses
the vendored `miku-ms-office-core-0.5.0.mjs` for:

- reproducible ZIP package writing through `writeZipPackage`
- relationship XML through `buildOpcRelationshipsXml`
- content type XML through `buildOpcContentTypesXml`
- shared ZIP entry typing through `ZipEntryInput`

The sibling-side proof also required audit cleanup in `miku-md2docx`:

- update direct `esbuild` dev dependency to `^0.28.1`
- add an `overrides.esbuild` policy for nested Vite/Vitest use

Verified sibling commands:

```sh
npm audit
npm test
npm run smoke:docx
npm run build:all
npm run smoke:bundle
```

All of the above passed after the audit cleanup. The earlier local
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
git apply ../miku-ms-office-core/docs/patches/miku-md2docx-ms-office-core-proof.patch
npm audit
npm test
npm run smoke:docx
```

If bundle behavior is touched:

```sh
npm run build:all
npm run smoke:bundle
```

## Follow-Up Targets

After `miku-md2docx`, choose the next target based on what the proof reveals:

- `miku-md2xlsx` if package writing helper needs are similar.
- `miku-docx2md` if required-part reads and relationship target resolution need
  stronger read-side helpers.
- `mikuproject` only after the core package layer is stable enough to handle
  its XLSX input/output without absorbing workbook/project semantics.
