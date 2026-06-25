# API Reference

Checked on 2026-06-22.

This is the current public API surface for the initial low-level foundation.
It is intentionally package plumbing, not DOCX/XLSX/PPTX/MS Project semantics.

## ZIP Package

- `readZipPackage(data)`
- `readZipPackageAsync(data, options)`
- `writeZipPackage(entries, options)`
- `getZipEntry(entries, entryPath)`
- `getZipTextEntry(entries, entryPath)`
- `upsertZipEntry(entries, entry)`
- `getDefaultZipEntryTimestamp()`

Synchronous ZIP APIs are Node-oriented and use `node:zlib` for deflate.
Async ZIP reading can use `DecompressionStream`, Node zlib fallback, or an
injected `inflateRaw` function.

ZIP writing encodes entry names as UTF-8 and sets the ZIP general purpose
UTF-8 flag in both local file headers and central directory headers. This is
the package-level filename policy used before replacing sibling write-side ZIP
helpers.

## OPC Paths

- `normalizeOpcPartPath(partPath)`
- `resolveOpcRelationshipTarget(sourcePartPath, target, targetMode?)`
- `compareOpcPartPaths(a, b)`
- `buildOpcRelationshipsPath(sourcePartPath)`

These helpers operate on OPC package paths only. They do not validate whether a
path is meaningful for DOCX, XLSX, PPTX, or MS Project.

## Relationships

- `parseOpcRelationshipsXml(xml)`
- `buildOpcRelationshipsXml(relationships)`
- `resolveOpcRelationships(relationships, sourcePartPath)`
- `relationshipArrayToMap(relationships)`

Relationship type constants remain product-side for now because products own
their DOCX/XLSX/PPTX semantics.

## Content Types

- `parseOpcContentTypesXml(xml)`
- `resolveOpcContentType(contentTypes, partPath)`
- `buildOpcContentTypesXml(contentTypes)`

Default and override selection is provided as generic OPC data. Product-specific
content type policy remains product-side.

## Office Package

- `readOfficePackage(data)`
- `readOfficePackageAsync(data, options)`
- `listOfficeMediaParts(entries)`
- `readOfficePartRelationships(entries, sourcePartPath, options?)`

These helpers assemble ZIP, content type, media, and relationship plumbing.
They do not require `word/document.xml`, parse workbooks, parse slides, or
interpret MS Project data.

## XML Helpers

- `escapeXmlText(value)`
- `escapeXmlAttribute(value)`
- `sanitizeXmlText(value)`
- `parseXmlAttributes(source)`
- `decodeXmlEntities(value)`

These are small string-level helpers. DOM traversal and product XML semantics
remain product-side unless repeated package-level needs appear.

## Binary Helpers

- `textEncoder`
- `textDecoder`
- `readUint16(data, offset)`
- `readUint32(data, offset)`
- `writeUint16(buffer, offset, value)`
- `writeUint32(buffer, offset, value)`
- `concatBytes(parts)`
- `asBytes(data)`

These are exported because the current ZIP package layer and sibling proofs may
need small byte helpers. Keep them low-level and product-neutral.

## Diagnostics

- `createDiagnostic(severity, code, message, path?)`

Diagnostics are structured at the package plumbing layer. Product-specific
warnings and conversion decisions remain product-side.
