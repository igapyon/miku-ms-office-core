---
purpose: ai-agent-decisions
read_when:
  - before_starting_work
  - when_making_decision
  - when_looping_or_repeating_work
update_when:
  - important_decision_is_made
  - option_is_rejected
  - work_is_deferred
---

# Decisions

This file records important decisions for the AI agent.
Read this before making or revisiting decisions, especially when the work seems to loop.

## 2026-06-22: Keep miku-ms-office-core Below Document Meaning

Reason:
`miku-ms-office-core` is intended as shared plumbing for miku-soft Office
package handling, not as a general OOXML or document interpretation library.
The sibling products keep their own conversion meaning and output policy.

Impact:
APIs may cover ZIP containers, reproducibility policy, OPC paths,
relationships, content types, media parts, XML helpers, and diagnostics. APIs
should not expose DOCX paragraph meaning, XLSX cell/table meaning, PPTX slide
meaning, Markdown conversion policy, or MS Project domain models.

## 2026-06-22: Start From the Node.js Main Application Foundation

Reason:
The first delivery surface is a TypeScript / Node.js library foundation for
miku-soft main applications. Existing sister repositories use Node.js /
TypeScript layouts with `src/ts`, tests, package scripts, and local-first
processing.

Impact:
The initial repository uses `package.json`, `tsconfig.json`, Vitest tests,
`src/ts`, and `dist` output. Java, Web App, Agent Skill, and MCP surfaces are
out of scope until the package boundary is proven.

## 2026-06-22: Protect Reproducibility First

Reason:
The initial cross-product value is reducing meaningless Office package diffs by
normalizing ZIP timestamps, entry ordering, and compression behavior.

Impact:
ZIP write behavior defaults to a fixed timestamp, stable UTF-16 path ordering,
and explicit compression policy. Tests must continue to protect these defaults
before higher-level package features are expanded.

## 2026-06-22: Include mikuproject XLSX Input and Output as a Reference

Reason:
`mikuproject` has its own XLSX import/export path through `excel-io-*`,
`project-xlsx-*`, and `wbs-xlsx-*` modules. That code is a practical reference
for low-level workbook package handling used by a miku-soft product, even
though its project and WBS semantics are product-specific.

Impact:
The common core should consider reusable ZIP, OPC, XML, content type,
relationship, media, and workbook package plumbing from `mikuproject` XLSX
input/output. It should not absorb `mikuproject` project model, WBS layout,
task/resource/assignment semantics, or workbook schema decisions.

## 2026-06-22: Keep the First Commonization Boundary at Package Plumbing

Reason:
The checked sibling repositories share clear low-level needs around ZIP, OPC
paths, relationships, content types, media parts, XML helpers, and diagnostics.
The next layer up quickly becomes document, workbook, worksheet, style,
drawing, WBS, or project semantics.

Impact:
`miku-ms-office-core` should first provide thin package primitives and small XML
builder/parser helpers. Product-side loaders such as DOCX document loaders,
XLSX workbook loaders/writers, worksheet/style parsers, WBS exporters, and
project workbook schema handlers remain in their product repositories for now.
The detailed checkpoint is recorded in `docs/commonization-scope-check.md`.

## 2026-06-22: Prefer OPC and Office Package Names Over Product Names

Reason:
The shared core should communicate that it owns low-level Office package
plumbing, not DOCX, XLSX, PPTX, or MS Project semantics. Names such as
`workbook-loader`, `docx-package`, or `xlsx-writer` make the boundary too easy
to blur.

Impact:
Future renames and new APIs should prefer names such as `opc-part-path`,
`opc-relationships`, `opc-content-types`, `office-package`, and `zip-package`.
The current naming proposal is recorded in `docs/api-naming-proposal.md`.

## 2026-06-22: Apply the First OPC/Office Naming Pass Before Proof-of-Use

Reason:
The first sibling proof-of-use will be easier to evaluate if the shared core
already exposes package-level names instead of temporary generic names such as
`path`, `relationships`, or `package`.

Impact:
Core source files now use names such as `opc-part-path.ts`,
`opc-relationships.ts`, `opc-content-types.ts`, `office-package.ts`, and
`zip-package.ts`. Public helper names use `Opc`, `Office`, or `Zip` where that
clarifies the boundary.

## 2026-06-22: Use miku-md2docx as the First Proof-of-Use Target

Reason:
`miku-md2docx` has a compact package-writing surface with duplicated ZIP,
relationship XML, content type XML, and XML escaping helpers. It can exercise
the core package plumbing without pulling in workbook, project, or read-side
document parsing complexity.

Impact:
The first sibling migration experiment should target `miku-md2docx` and keep
DOCX rendering semantics in that repository. The proof plan is recorded in
`docs/first-proof-of-use.md`.

## 2026-06-22: Prove miku-md2docx Package Plumbing in Core First

Reason:
The current workspace changes are scoped to `miku-ms-office-core`. A core-side
proof test can validate that the shared API covers the intended
`miku-md2docx` package-writing surface before editing the sibling repository.

Impact:
`tests/md2docx-proof-of-use.test.js` builds a DOCX-like package shell using
only core ZIP, OPC relationship, OPC content type, and package read helpers.
The sibling-side patch remains the next task.

## 2026-06-22: Use workplace for Local Proof Copies

Reason:
Repository-local proof copies are easier to inspect and keep aligned with the
repo convention than unrelated `/tmp` directories.

Impact:
Temporary proof copies should be created under ignored `workplace/`
directories. The repository tracks only `workplace/.gitkeep`.

## 2026-06-22: Keep the First Sibling Proof as a Working Tree Change

Reason:
The first `miku-md2docx` proof passed as a concrete sibling working tree change
using `miku-ms-office-core` for ZIP package writing, OPC relationship XML, OPC
content type XML, and shared ZIP entry typing. This is stronger evidence than a
core-only fixture, but it should not be treated as a finalized migration until
the sibling repository owner decides how to land it.

Impact:
The proof artifact and documentation should reflect the working dependency on
`file:../miku-ms-office-core`, the audit-related `esbuild` override, and the
verified sibling commands. The next decision is whether to keep these sibling
changes, turn them into a PR-ready patch, or reduce them to a documented
experiment before moving to the next repository.

## 2026-06-22: Use miku-md2xlsx as the Second Proof-of-Use Target

Reason:
`miku-md2xlsx` shares the same write-side package plumbing shape as the first
proof: stored ZIP package creation, `[Content_Types].xml`, root relationships,
workbook relationships, and XML escaping. It exercises the core helpers against
XLSX package structure while keeping worksheet, drawing, image preview, rich
text, hyperlink, merge, style, and Markdown semantics product-side.

Impact:
`tests/md2xlsx-proof-of-use.test.js` proves the core API can build an
XLSX-like package shell with the current ZIP, OPC relationship, OPC content
type, and package read helpers. The sibling-side patch artifact is recorded in
`docs/patches/miku-md2xlsx-ms-office-core-proof.patch`, and the real
`miku-md2xlsx` sibling working tree now has deliberate proof changes that pass
audit, tests, semantic roundtrip, bundle build, and bundled CLI smoke checks.

## 2026-06-22: Add a Thin Read-Side Part Relationship Helper

Reason:
`miku-docx2md` and `miku-xlsx2md` both repeat package-level relationship
plumbing: build the `.rels` path for a source part, parse relationship XML, and
resolve internal targets relative to that source part. This is below DOCX
document parsing and XLSX workbook parsing, so it belongs in the shared core.

Impact:
`readOfficePartRelationships` lives in `office-package.ts` and returns
part-level OPC relationships, resolved by default. It deliberately does not
enforce required DOCX or XLSX parts, parse workbook sheets, parse document
paragraphs, or choose Markdown conversion behavior. `tests/read-side-proof-of-use.test.js`
protects this shared package-plumbing behavior.

## 2026-06-22: Defer miku-docx2md Sibling Patch Until Runtime Shape Is Decided

Reason:
`miku-docx2md` is the best first read-side proof target by package scope, but
its current build emits `module: None` IIFE modules and runtime bundles evaluate
embedded JavaScript strings with `new Function(...)`. Directly importing
`miku-ms-office-core` as an ESM package would require a product build/runtime
architecture decision in addition to the package-plumbing migration.

Impact:
The read-side proof is currently core-side only and recorded in
`docs/third-proof-of-use.md`. No `miku-docx2md` sibling patch should be applied
until the integration shape is chosen: ESM imports in the product build, a
bundle-friendly runtime subset, or another explicit mechanism. DOCX parsing and
Markdown rendering remain product-side in all cases.

## 2026-06-22: Add Async ZIP Read as a Runtime Experiment Boundary

Reason:
Read-side products use asynchronous ZIP loading because browser runtimes expose
deflate through stream APIs, while Node runtimes can use `node:zlib`. The common
core needs to model that package-level read shape without forcing a product
module-system migration immediately.

Impact:
`readZipPackageAsync` and `readOfficePackageAsync` are now public helpers. They
support an injected raw-deflate inflater and a default path that tries
`DecompressionStream("deflate-raw")` before falling back to Node zlib. This
does not yet make `miku-ms-office-core` a complete browser/IIFE runtime package;
the read-side product integration shape remains an explicit follow-up decision.

## 2026-06-22: Prefer ESM Consumption for Initial Sibling Integration

Reason:
The initial core package is a TypeScript / Node.js ESM library with exported
helpers and generated declaration files. The write-side sibling proofs
(`miku-md2docx` and `miku-md2xlsx`) can consume this shape directly. Creating a
separate browser/IIFE runtime subset now would add another artifact surface
before the shared package boundary is fully proven.

Impact:
Initial sibling integration should use public ESM imports from
`miku-ms-office-core`. Read-side products that currently embed IIFE runtime
bundles should not be patched until their product build/runtime integration is
chosen. The core may later add a bundle-friendly runtime artifact, but only
after repeated need is proven by `miku-docx2md`, `miku-xlsx2md`, or
`mikuproject`.

## 2026-06-22: Keep Focused Real Fixtures at the Package Layer

Reason:
Generated proof packages protect intended API shape, but real sibling fixtures
catch package-level details such as existing Office entry layout, content type
defaults and overrides, relationship ordering, deflated entries, and real
workbook relationship counts.

Impact:
Core now tracks small DOCX/XLSX fixtures copied from `miku-docx2md`,
`miku-xlsx2md`, and `mikuproject`. Tests use them only for ZIP, OPC
relationship, content type, and part path behavior. They must not become a path
for moving DOCX document interpretation, XLSX workbook interpretation, Markdown
policy, or MS Project semantics into this repository.

## 2026-06-22: Keep Package Private and Use Local File Dependencies First

Reason:
The current sibling proofs are still deliberate working tree experiments. A
local `file:../miku-ms-office-core` dependency proves the ESM package boundary
without committing to npm publication or a separate internal registry path.

Impact:
`package.json` remains `"private": true`. Initial sibling proof branches should
consume the package through public ESM imports and a local file dependency. The
package artifact is limited to `dist`, `README.md`, and `LICENSE`; `npm pack
--dry-run` is used to verify the artifact. The build now cleans `dist` before
compilation so renamed stale modules are not packed.

## 2026-06-22: Guard the Public API Surface

Reason:
The first naming pass replaced temporary helper names with `zip-*`, `opc-*`,
and `office-*` names. Sibling proof patches now depend on the new public names,
so accidental reintroduction of old names or stale build exports would create
confusing migration paths.

Impact:
`tests/public-api-surface.test.js` snapshots the current runtime export names
and explicitly rejects pre-naming-pass helpers such as `createZip`,
`getTextEntry`, and generic relationship/content type parser names. The current
surface is summarized in `docs/api-reference.md`.

## 2026-06-22: Keep Sibling Proofs as Working Tree Evidence and Patch Artifacts

Reason:
The `miku-md2docx` and `miku-md2xlsx` sibling proofs have already passed their
local verification gates, but landing them is a sibling-repository decision.
Keeping both the live sibling working tree changes and the core-side patch
artifacts preserves strong evidence without turning this foundation task into a
cross-repository release or PR workflow.

Impact:
The current core task treats both write-side proofs as validated evidence.
`docs/patches/miku-md2docx-ms-office-core-proof.patch` and
`docs/patches/miku-md2xlsx-ms-office-core-proof.patch` remain the replayable
artifacts. The sibling working tree changes must not be reverted unless the
user explicitly asks for that.

## 2026-06-22: Add CI Baseline GitHub Actions Workflow

Reason:
The repository had no GitHub Actions workflow. For the current internal ESM
package foundation, the immediate need is push/PR verification, not release
asset upload or npm publishing.

Impact:
`.github/workflows/ci.yml` runs on branch pushes, `v*` tag pushes, pull
requests, and manual dispatch. It uses Node.js 20, installs dependencies with
`npm ci`, then runs `npm test`, `npm audit`, `npm run build`, and
`npm run build:bundle`, `npm run smoke:bundle`, and `npm pack --dry-run` in
order. A `v*` tag push verifies the package and library bundle builds only;
GitHub Release asset upload and npm publish workflows remain out of scope for
the CI baseline.

## 2026-06-22: Use Single-File ESM as the Library Release Asset

Reason:
`miku-ms-office-core` is an internal TypeScript / Node.js library package, not a
CLI runtime bundle. The repository has no `bundle/*.mjs` artifact or
CLI entrypoint. Other miku-soft products may still need to include a generated
library file directly, so the release asset should be a single-file ESM library
bundle rather than an npm package tarball.

Impact:
`.github/workflows/release-library-bundle.yml` runs on `v*` tag pushes and
manual dispatch for existing `v*` tags. It installs dependencies, runs tests,
audits dependencies, builds the package, creates
`bundle/miku-ms-office-core.mjs`, smoke-tests its public exports, and uploads
`miku-ms-office-core-<version>.mjs` plus its source map to the matching GitHub
Release. This workflow does not run `npm publish` and does not create a CLI
bundle asset.
