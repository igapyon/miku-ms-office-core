# TODO

## Initial Foundation

- Compare real low-level ZIP, relationship, media, and content type code from
  `miku-docx2md`, `miku-xlsx2md`, `miku-md2docx`, `miku-md2xlsx`, and
  `mikuproject` before expanding the public API.
- Add focused fixtures from real DOCX, XLSX, and PPTX packages after the package
  layer stabilizes.
- Use local `file:` dependencies for initial sibling proof consumption; keep
  npm publication disabled until the internal distribution path is chosen.
- Keep DOCX, XLSX, PPTX, Markdown, and MS Project meaning models in the product
  repositories, not in this shared core.

## Project Record

- Main workflow used: `igapyon-miku-soft-developer` new project workflow with
  `10-node-app-workflow.md`.
- miku-soft references checked: 2026-06-22.
- Sister repositories checked locally: `miku-docx2md`, `miku-xlsx2md`,
  `miku-md2docx`, `miku-md2xlsx`, and `mikuproject`.

## AI Agent Current Tasks

This section tracks the current working state for AI agents.
Update this section while working. Do not rewrite unrelated TODO items.

### Tasks

- [x] Create the initial TypeScript / Node.js package foundation.
- [x] Add the first low-level ZIP / OPC / XML / diagnostics API surface.
- [x] Add reproducibility tests for ZIP timestamp normalization, ordering, and
  compression policy.
- [x] Compare the implementation in detail against sibling repository code and
  list the API gaps before broadening the public surface.
- [x] Include `mikuproject` XLSX input/output code in the comparison, especially
  `excel-io-*`, `project-xlsx-*`, and `wbs-xlsx-*` low-level package handling.
- [x] Record the `miku-md2xlsx` write-side API gap comparison against current
  ZIP, content type, relationship, and XML helpers.
- [x] Record the `miku-xlsx2md` / `mikuproject` read-side deflate ZIP runtime
  gap before changing core runtime support.
- [x] Add a core-side read proof for package entries, content types, media
  listing, and resolved part relationships shared by `miku-docx2md` and
  `miku-xlsx2md`.
- [x] Add async ZIP / Office package read APIs with injectable raw-deflate
  handling for read-side runtime experiments.
- [x] Record the first commonization scope check in
  `docs/commonization-scope-check.md`.
- [x] Record hindsight-based file, type, and function naming guidance in
  `docs/api-naming-proposal.md`.
- [x] Apply the first `opc-*`, `office-*`, and `zip-*` naming pass to core
  source files and public helper names.
- [x] Add first relationship/content type XML builder helpers and XML text
  sanitization.
- [x] Decide the first sibling repository to migrate or prove against
  `miku-ms-office-core`.
- [x] Add a core-side `miku-md2docx` package-plumbing proof test.
- [x] Prepare a sibling-side patch artifact for `miku-md2docx` and verify it
  with `git apply --check`.
- [x] Apply and run the first sibling-side proof against `miku-md2docx` using
  `docs/first-proof-of-use.md`.
- [x] Decide whether to keep the `miku-md2docx` proof as sibling working tree
  changes, convert it to a PR-ready patch, or reduce it to a documented
  experiment.
- [x] Add a core-side `miku-md2xlsx` package-plumbing proof test.
- [x] Prepare a sibling-side patch artifact for `miku-md2xlsx` and verify it
  with `git apply --check` against a clean `workplace/` copy.
- [x] Apply and run the second sibling-side proof against `miku-md2xlsx` using
  `docs/second-proof-of-use.md`.
- [x] Decide whether to keep the `miku-md2xlsx` proof as sibling working tree
  changes, convert it to a PR-ready patch, or reduce it to a documented
  experiment.
- [x] Choose the first read-side sibling proof target between `miku-docx2md`
  and `miku-xlsx2md`.
- [x] Record why `miku-docx2md` sibling patching is deferred until the
  IIFE/runtime-bundle module boundary is decided.
- [x] Decide whether read-side products should consume `miku-ms-office-core`
  through ESM imports, a bundle-friendly runtime subset, or another explicit
  integration shape.
- [x] Record the initial package consumption and artifact policy in
  `docs/package-consumption.md`.
- [ ] Revisit a bundle-friendly runtime artifact only after repeated need is
  proven by read-side products.
- [x] Add focused real DOCX / XLSX package fixtures for package-level read
  coverage after the first migration targets are chosen.
- [x] Add a public API surface guard test and summarize the current API in
  `docs/api-reference.md`.
- [x] Record the current goal completion audit in
  `docs/completion-audit.md`.
- [x] Add a GitHub Actions CI baseline for branch pushes, `v*` tag pushes,
  pull requests, manual dispatch, install, test, audit, build, and package
  dry-run checks.
- [ ] Add a focused PPTX package fixture when PPTX read/write candidates become
  active.

### Blockers

- Sibling `miku-md2docx` now has deliberate proof-of-use working tree changes;
  do not revert them unless explicitly requested.
- Temporary proof copies are under ignored `workplace/` directories.
- Sibling `miku-md2xlsx` now has deliberate proof-of-use working tree changes
  and a package-lock update from `npm install` / `npm audit fix`; do not revert
  them unless explicitly requested.

### Retry Log

Use this section only when the same task or error is repeated.
If the same failure appears 3 times, stop and ask the user.

- なし
