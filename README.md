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

GitHub Actions CI is defined in `.github/workflows/ci.yml`. It runs on branch
pushes, `v*` tag pushes, pull requests, and manual dispatch. Node tests run on
Node 22 and 24. A Node 24 browser job builds the module and declarations,
checks the staged assets, and runs Chromium, Firefox, and WebKit acceptance.

GitHub Release package upload is defined in
`.github/workflows/release-library-bundle.yml`. It runs on `v*` tag pushes, or
manual dispatch with an existing `v*` tag. Before upload it runs unit, type,
staged-asset, and three-browser checks, then uploads the versioned ESM, source
map, and declaration as GitHub Release assets. It does not publish to npm or
create a CLI runtime bundle.

## Current API Shape

The current foundation exposes low-level helpers for:

- reproducible ZIP package reading and writing
- Promise-based ZIP and Office package reading and ZIP writing
- bounded ZIP32 processing, CRC checks, and abort support
- OPC part path normalization and relationship target resolution
- relationship XML parsing and generation
- `[Content_Types].xml` parsing and generation
- Office package reading, media part listing, and part relationship lookup
- XML escaping, sanitization, entity decoding, and small attribute parsing
- structured diagnostics

ZIP read/write APIs always return Promises and use standard
`CompressionStream` / `DecompressionStream` with `deflate-raw` when DEFLATE is
requested. STORE remains the writer default. The core has no Node runtime
imports; the package requires Node 22 or newer and the same built module works
in browser ESM, IIFE, and Worker contexts that provide the raw compression
format.

Product repositories that already use ESM package imports can consume the
package directly. The versioned release asset set is
`miku-ms-office-core-<version>.mjs`, its `.mjs.map`, and `.d.mts` declaration.
The browser and IIFE implementation is verified in this core repository;
product migration remains a separate task.

Package consumption details are recorded in `docs/package-consumption.md`.
The current public API surface is summarized in `docs/api-reference.md`.
The current completion audit is recorded in `docs/completion-audit.md`.

## Repository Notes

`workplace/` is for local scratch checkouts and generated verification material.
Only `workplace/.gitkeep` is tracked.

Shared miku-soft references are linked from `docs/miku-soft-reference.md`; they
are not copied into this repository.
