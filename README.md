# miku-ms-office-core

`miku-ms-office-core` is an internal miku-soft foundation for shared low-level
Microsoft Office package input and output.

It is not a general Office library. It only contains the common plumbing that
miku-soft products need so each product can keep its own document meaning,
conversion policy, and output decisions.

## Initial Users

Initial expected users are:

- `miku-docx2md`
- `miku-xlsx2md`
- `miku-md2docx`
- `miku-md2xlsx`
- `mikuproject`
- possible future `miku-pptx2md`
- possible future `miku-md2pptx`

## Scope

This repository may contain shared low-level support for:

- ZIP containers
- ZIP entry timestamp normalization
- ZIP entry ordering
- ZIP compression policy
- OPC package paths
- relationships
- content types
- media parts
- XML helpers
- structured diagnostics

ZIP entry timestamp control is treated as a low-level reproducible package
generation policy, not as DOCX, XLSX, or PPTX document interpretation.

## Non-Goals

This repository does not implement:

- general OOXML
- complete Microsoft Office compatibility
- DOCX document interpretation
- XLSX sheet or cell interpretation
- PPTX slide interpretation
- MS Project meaning models
- Markdown conversion decisions
- Markdown-to-Office assembly decisions
- product-specific output policy

Those remain product value in the individual miku-soft repositories.

## Development

```sh
npm install
npm test
```

The initial package layer is TypeScript / Node.js and keeps runtime behavior
local-first.

## Current API Shape

The current foundation exposes low-level helpers for:

- reproducible ZIP package reading and writing
- async ZIP package reading for read-side runtime experiments
- OPC part path normalization and relationship target resolution
- relationship XML parsing and generation
- `[Content_Types].xml` parsing and generation
- Office package reading, media part listing, and part relationship lookup
- XML escaping, sanitization, entity decoding, and small attribute parsing
- structured diagnostics

Synchronous ZIP APIs are Node-oriented and use `node:zlib` for deflate
compression/decompression. Async read APIs try `DecompressionStream` for
`deflate-raw` first and fall back to Node zlib; callers can also inject their
own raw-deflate inflater.

Browser or IIFE runtime integration is not finalized yet. Product repositories
that already use ESM imports can consume the package more directly. Products
that embed IIFE runtime bundles, such as the current `miku-docx2md`, need an
explicit integration decision before sibling-side migration.

Package consumption details are recorded in `docs/package-consumption.md`.
The current public API surface is summarized in `docs/api-reference.md`.
The current completion audit is recorded in `docs/completion-audit.md`.

## Repository Notes

`workplace/` is for local scratch checkouts and generated verification material.
Only `workplace/.gitkeep` is tracked.

Shared miku-soft references are linked from `docs/miku-soft-reference.md`; they
are not copied into this repository.
