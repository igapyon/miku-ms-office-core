# Commonization Scope Check

Boundary policy updated on 2026-11-06. Repository findings below retain the
historical 2026-06-22 comparison; they are not a new consumer audit.

## Scope Decision

`miku-ms-office-core` should currently stay at the low-level Office package
plumbing layer.

### Strict Admission Policy

The core accepts only highly stable, product-neutral behavior. A new addition
must satisfy all of these conditions:

- Its behavior can be defined by ZIP, OPC, XML, or another established package
  specification without knowing a product name, model, or workflow.
- Multiple products have demonstrated the same need and contract in actual use.
- Inputs, outputs, errors, and compatibility are settled and protected by
  regression tests.
- It needs no product-specific exceptions, temporary fallback, or speculative
  extension points.

Being low-level or duplicated is insufficient. Reject additions that fail these
conditions and retain them product-side, allowing duplication while behavior
is still evolving. A consumer integration plan does not authorize core API
expansion. Existing generic-contract defects may be fixed with a reproducer and
regression coverage; product preferences are not defects in that contract.

In-scope areas, subject to this admission policy:

- ZIP read/write primitives
- ZIP timestamp normalization mechanisms
- ZIP entry ordering mechanisms
- ZIP compression mechanisms
- OPC part path normalization
- relationship parsing, target resolution, and relationship XML helpers
- `[Content_Types].xml` parsing and small generation helpers
- media part enumeration and media content type helpers
- XML escaping, XML text sanitization, and settled string-level XML helpers
- structured diagnostics for package-level failures

Not accepted into core:

- DOCX document structure and paragraph/run/table interpretation
- XLSX workbook, worksheet, cell, style, formula, merge, drawing, and validation
  semantics
- PPTX slide semantics
- MS Project project, WBS, task, resource, assignment, calendar, and workbook
  schema semantics
- Markdown conversion or Office assembly policy
- product-specific entry selection, order, timestamps, and compression choices
- product model codecs, templates, CLI/UI orchestration, and migration adapters
- special cases or default changes to reproduce one product's legacy ZIP bytes
- experimental abstractions or product-specific synchronous compatibility layers
- full OOXML compatibility

The core may expose generic options for order, timestamp, or compression; the
product owns the choice. Public product API Promise propagation and compatibility
decisions also remain product-side. Generic file-backed or streaming API
proposals require separate admission review and are not accepted merely because
a consumer migration requests them.

## Repository Findings

`miku-docx2md`:

- `zip-io.ts`, relationship target resolution, XML helper functions, package
  entry lookup, and media path handling are commonization candidates.
- `docx-package-loader.ts` should stay product-side once it requires
  `word/document.xml`, styles, numbering, and document-specific package parts.
- Document parser modules are out of scope.

`miku-xlsx2md`:

- ZIP, relationship target resolution, XML helpers, and some package entry
  lookup are commonization candidates.
- `workbook-loader.ts` crosses into workbook sheets, shared strings, styles,
  defined names, and worksheet parsing, so it should stay product-side.
- Sheet, formula, style, and Markdown modules are out of scope.

`miku-md2docx`:

- ZIP writer, XML escaping, relationship XML helpers, content type helper
  primitives, and media content type helpers are candidates.
- `docx-package.ts`, templates, and OOXML renderer modules know DOCX document
  structure and should stay product-side.

`miku-md2xlsx`:

- ZIP writer, XML escaping/sanitization, package-level relationship/content type
  helper primitives, and media content type helpers are candidates.
- `xlsx-writer.ts`, worksheet, styles, drawing, rich text, hyperlinks, merges,
  and image preview logic are workbook semantics and should stay product-side.

`mikuproject`:

- `excel-io-zip.ts` is a strong reference for ZIP read/write behavior,
  including browser-compatible deflate read support.
- `excel-io-package-xml.ts` contains package XML helper ideas that are useful,
  but the current helper shape is workbook-oriented and is not accepted into
  core. Generalizing its names alone would not satisfy the admission policy.
- `excel-io-workbook-*`, `excel-io-worksheet-*`, `excel-io-styles-*`,
  `project-xlsx-*`, and `wbs-xlsx-*` contain workbook, project, WBS, task,
  style, layout, and schema semantics and should stay in `mikuproject`.

## Current Core Fit

The current `miku-ms-office-core` foundation is mostly aligned with this scope:

- ZIP read/write with fixed timestamp and stable ordering is in scope.
- OPC path and relationship target helpers are in scope.
- Content type parsing is in scope.
- Basic XML escaping and attribute parsing are in scope.
- `readOfficePackage` and media listing are existing APIs. Their presence does
  not establish that additional Office conventions meet the admission policy.

## Detailed API Gap Notes

`miku-md2docx` proof result:

- The first sibling proof successfully replaces package writing with
  `writeZipPackage`.
- Relationship and content type XML generation are covered by
  `buildOpcRelationshipsXml` and `buildOpcContentTypesXml`.
- Core stable ordering sorts OPC part paths. Whether a product can adopt this
  default or must use the existing input-order option is a product compatibility
  decision. Do not change expectations alone to bypass a byte-compatibility contract.
- No DOCX document semantics needed to move into core.

`miku-md2xlsx` write-side comparison:

- `src/ts/zip-io.ts` is structurally equivalent to the old `miku-md2docx`
  stored ZIP writer and is a strong next proof target for `writeZipPackage`.
- `src/ts/xlsx-writer.ts` hand-builds `[Content_Types].xml`,
  package-level root relationships, and workbook relationships. These map to
  current core content type and relationship builders.
- `src/ts/xlsx-xml.ts` duplicates XML sanitization and escaping already present
  in core.
- `tests/md2xlsx-proof-of-use.test.js` now proves the current core API can
  build an XLSX-like package shell without moving workbook semantics into core.
- Worksheet, drawing, image preview, rich text, hyperlink, merge, and style
  generation remain XLSX workbook semantics and should stay in `miku-md2xlsx`.

`miku-xlsx2md` and `mikuproject` read-side comparison:

- Both have ZIP read paths that support stored entries and deflated entries.
- Core already supports stored and deflated ZIP entries in Node through
  `node:zlib`.
- `miku-docx2md` and `miku-xlsx2md` both duplicate the pattern of locating a
  part-specific `.rels` file, parsing relationships, and resolving internal
  targets relative to the source part. Core now covers that package-level
  pattern with `readOfficePartRelationships`.
- `mikuproject` also has browser-oriented `DecompressionStream` support in
  `excel-io-zip.ts`. Core now has `readZipPackageAsync` /
  `readOfficePackageAsync` with an injectable async raw-deflate inflater and a
  `DecompressionStream`-first default path, but the package still includes
  Node-oriented synchronous ZIP APIs. A read-side product integration shape is
  still needed before treating this as a complete browser/IIFE runtime surface.
- Workbook XML construction/parsing in `mikuproject` remains project/workbook
  schema logic. Only the generic ZIP, relationship, content type, and XML
  helper pieces are candidates.

Remaining gaps before broader migration:

- Keep initial sibling integration on public ESM imports. Revisit a
  browser/IIFE-compatible runtime subset only after repeated read-side need is
  proven.
- Keep focused real DOCX/XLSX package fixtures in core to protect read behavior
  without importing product semantics. Current fixtures are documented in
  `tests/fixtures/office/README.md`.
- Add a focused PPTX package fixture only when PPTX read/write candidates become
  active.
- Keep workbook/document loaders in product repositories. Only an independently
  specified, stable package-level primitive that meets every admission condition
  may be proposed separately; the loaders themselves remain out of scope.
