# API Reference

Checked on 2026-11-05 for the 0.8.0 implementation.

This is the current public API surface for the initial low-level foundation.
It is intentionally package plumbing, not DOCX/XLSX/PPTX/MS Project semantics.

## ZIP Package

- `readZipPackage(data, options?)`: `Promise<ZipReadResult>`
- `readZipPackageAsync(data, options?)`: deprecated alias of `readZipPackage`
- `writeZipPackage(entries, options?)`: `Promise<Uint8Array>`
- `getZipEntry(entries, entryPath)`
- `getZipTextEntry(entries, entryPath)`
- `upsertZipEntry(entries, entry)`
- `getDefaultZipEntryTimestamp()`
- `DEFAULT_ZIP_READ_LIMITS`, `DEFAULT_ZIP_WRITE_LIMITS`
- `ZipError`

All three ZIP read/write operations are asynchronous, including STORE-only
work. The `readZipPackageAsync` alias is the same function reference as
`readZipPackage`; it remains deprecated for 1.x compatibility. Deflated input
and output use the standard raw `DecompressionStream` and `CompressionStream`
APIs. STORE remains the default writer method.

Writer defaults are `order: "stable"` and 1980-01-01 00:00:00 UTC. Stable
ordering compares normalized paths by UTF-16 code units. A per-entry
`compression` or `modifiedAt` overrides the writer-wide default. Timestamps
must be valid `Date` values from 1980 through 2107 and are encoded in UTC with
DOS two-second precision. Entry names are UTF-8 and set the UTF-8 flag in both
ZIP headers.

`ZipReadOptions` accepts `signal` and partial `ZipReadLimits`.
`ZipWriteOptions` accepts `timestamp`, `compression`, `order`, `signal`, and
partial `ZipWriteLimits`. Unknown keys, the removed `inflateRaw` and
`compressionLevel` options, invalid entry shapes, and invalid dates reject with
`ZipError` (`code: "zip.options.invalid"`). Abort rejects with `AbortError`.

The frozen default read limits are 64 MiB input, 10,000 entries, 64 MiB per
entry, and 256 MiB total uncompressed data. The frozen write limits are 10,000
entries, 64 MiB per entry, 256 MiB total input, and 256 MiB output. ZIP32
limits also apply. Limit overrides use non-negative safe integers.

ZIP32 structural failures, unsupported features, limit violations, size
mismatches, CRC mismatches, and entry decompression failures return an empty
`entries` array with an error diagnostic. Reader results never contain partial
entries after a failure. ZIP64, encryption, multi-disk archives, and methods
other than STORE and DEFLATE are unsupported. Directory entries are validated
but omitted from the returned file entries. The reader accepts ZIP32 data
descriptors with or without their optional signature.
`ZipError` exposes a `code` and optional `path`. Missing raw-stream support
rejects with `zip.runtime.unsupported` when the requested operation needs it;
STORE reads and writes do not require compression streams.

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

- `readOfficePackage(data, options?)`: `Promise<OfficePackage>`
- `readOfficePackageAsync(data, options?)`: deprecated alias of `readOfficePackage`
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
`sanitizeXmlText` follows the XML 1.0 `Char` production: it preserves valid
supplementary Unicode code points through `U+10FFFF`, while removing invalid
control characters, isolated UTF-16 surrogates, `U+FFFE`, and `U+FFFF`.

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
