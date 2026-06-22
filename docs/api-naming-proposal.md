# API Naming Proposal

Checked on 2026-06-22.

This document records hindsight-based naming guidance before the first sibling
repository migration. The first core rename pass has been applied.

## Naming Principles

- Prefer `office-*` for repository-wide low-level Office package helpers.
- Prefer `opc-*` for Open Packaging Conventions concepts: parts,
  relationships, content types, and package-level paths.
- Prefer `zip-*` only for ZIP container mechanics.
- Avoid `docx-*`, `xlsx-*`, `workbook-*`, `sheet-*`, `document-*`, `project-*`,
  and `wbs-*` in this core unless the module is explicitly product-specific,
  which should normally stay outside this repository.
- Use `partPath` rather than `zipPath` when the path is an OPC package part.
- Use `entryName` or `entryPath` only when talking about raw ZIP entries.
- Use verbs that reveal direction: `read*`, `write*`, `parse*`, `build*`,
  `resolve*`, `normalize*`, `list*`, `get*`, `upsert*`.

## Proposed Source Files

Applied steady-state names:

- `zip.ts` -> `zip-package.ts`
- `path.ts` -> `opc-part-path.ts`
- `relationships.ts` -> `opc-relationships.ts`
- `content-types.ts` -> `opc-content-types.ts`
- `package.ts` -> `office-package.ts`
- `xml.ts` -> `xml-helper.ts`
- `binary.ts` -> `binary-io.ts`
- `crc32.ts` -> keep as `crc32.ts`
- `diagnostics.ts` -> keep as `diagnostics.ts`

Possible future files:

- `opc-package-builder.ts`: thin builder for package entry arrays, not DOCX or
  XLSX semantics
- `opc-content-types-builder.ts`: generate `[Content_Types].xml`
- `opc-relationships-builder.ts`: generate `.rels` XML
- `office-media.ts`: media extension/content type helpers and media part
  enumeration
- `xml-dom-helper.ts`: optional DOM-based helpers if browser/DOM parsing becomes
  a shared requirement
- `zip-runtime.ts`: runtime-specific ZIP compression/decompression adapters if
  Node and browser support diverge

## Proposed Public Types

ZIP layer:

- `ZipPackageEntryInput` -> `ZipEntryInput`
- `ZipPackageEntry` -> `ZipEntry`
- `ZipReadResult` -> `ZipReadResult`
- `ZipWriteOptions` -> `ZipWriteOptions`
- `ZipCompressionMethod` -> `ZipCompressionMethod`

OPC layer:

- `PackageRelationship` -> `OpcRelationship`
- `ContentTypes` -> `OpcContentTypes`
- `ContentTypeDefault` -> `OpcContentTypeDefault`
- `ContentTypeOverride` -> `OpcContentTypeOverride`
- new `OpcPartPath = string` type alias only if it improves readability without
  pretending to enforce validation at runtime

Office package layer:

- `OfficePackage` is acceptable.
- If a lower-level name is needed, use `OfficePackageParts` or
  `OfficePackageReadResult`.

Diagnostics:

- `OfficeDiagnostic` is acceptable because diagnostics are package-wide.
- `DiagnosticSeverity` is acceptable.

## Proposed Public Functions

ZIP layer:

- `readZipPackage(data)` is acceptable.
- `readZipPackageAsync(data, options)` is acceptable for read-side runtimes that
  need async deflate handling or injected runtime-specific decompression.
- `writeZipPackage(entries, options)` is acceptable.
- `getDefaultZipTimestamp()` -> `getDefaultZipEntryTimestamp()`
- `getEntry(entries, path)` -> `getZipEntry(entries, entryPath)`
- `getTextEntry(entries, path)` -> `getZipTextEntry(entries, entryPath)`
- `upsertEntry(entries, entry)` -> `upsertZipEntry(entries, entry)`

OPC part paths:

- `normalizePartPath(path)` -> `normalizeOpcPartPath(partPath)`
- `normalizeRelationshipTarget(sourcePartPath, target)` ->
  `resolveOpcRelationshipTarget(sourcePartPath, target, targetMode?)`
- `comparePartPaths(a, b)` -> `compareOpcPartPaths(a, b)`
- add `buildOpcRelationshipsPath(sourcePartPath)` for paths such as
  `xl/_rels/workbook.xml.rels`

Relationships:

- `parseRelationshipsXml(xml)` -> `parseOpcRelationshipsXml(xml)`
- add `buildOpcRelationshipsXml(relationships)`
- add `relationshipArrayToMap(relationships, key = "id")` only if migrations
  show that Map conversion is repeated in multiple products.

Content types:

- `parseContentTypesXml(xml)` -> `parseOpcContentTypesXml(xml)`
- `getContentTypeForPart(contentTypes, partPath)` ->
  `resolveOpcContentType(contentTypes, partPath)`
- add `buildOpcContentTypesXml(contentTypes)`
- add `createDefaultOfficeContentTypes()` only if repeated across multiple
  products; avoid DOCX/XLSX-specific defaults in the core.

Office package:

- `readOfficePackage(data)` is acceptable.
- `readOfficePackageAsync(data, options)` is acceptable when products need the
  async ZIP reader.
- `listMediaParts(entries)` -> `listOfficeMediaParts(entries)`
- `readOfficePartRelationships(entries, sourcePartPath)` is acceptable for
  locating a part-specific `.rels` file and resolving relationship targets at
  the package plumbing layer.
- add `readRequiredTextPart(package, partPath)` only if product migrations show
  repeated required-part error handling.

XML:

- `escapeXmlText(value)` is acceptable.
- `escapeXmlAttribute(value)` is acceptable.
- `getXmlAttributes(tag)` -> `parseXmlAttributes(tag)`
- `decodeXmlEntities(value)` is acceptable.
- add `sanitizeXmlText(value)` before moving writer code from products.
- avoid names such as `xml(value)` because they hide whether the function is
  escaping text, escaping attributes, or building markup.

## Names to Avoid

- `loader`: often implies product-specific required parts such as
  `word/document.xml` or `xl/workbook.xml`.
- `workbook`, `worksheet`, `sheet`, `cell`, `style`, `drawing`: these are XLSX
  semantics and should usually remain in product repositories.
- `document`, `paragraph`, `run`, `table`: these are DOCX semantics.
- `project`, `wbs`, `task`, `resource`, `assignment`, `calendar`: these are
  `mikuproject` semantics.
- `ooxml`: too broad for this repository; use narrower `opc` or `office-package`
  names.
- `utils`: too vague. Prefer `xml-helper`, `binary-io`, `opc-part-path`, or
  another concrete role.

## Recommended Migration Order

1. Keep current `opc-*`, `office-*`, and `zip-*` names as the public baseline.
2. Use the proposed names for new helper functions.
3. Add compatibility re-exports only if sibling migration would otherwise be
   noisy.
4. Revisit browser ZIP runtime naming only when Web/App runtime use becomes
   concrete.
