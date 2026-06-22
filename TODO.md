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
- [x] Revisit the bundle-friendly runtime artifact policy and choose the
  versioned single-file ESM release asset as the standard consumer artifact.
- [x] Add focused real DOCX / XLSX package fixtures for package-level read
  coverage after the first migration targets are chosen.
- [x] Add a public API surface guard test and summarize the current API in
  `docs/api-reference.md`.
- [x] Record the current goal completion audit in
  `docs/completion-audit.md`.
- [x] Add a GitHub Actions CI baseline for branch pushes, `v*` tag pushes,
  pull requests, manual dispatch, install, test, audit, package build, library
  bundle build, bundle smoke, and package dry-run checks.
- [x] Add a GitHub Actions release workflow for uploading the single-file ESM
  library bundle to GitHub Releases from matching `v*` tags.
- [x] Refresh sibling proof patches to consume the versioned release `.mjs`
  asset instead of `file:../miku-ms-office-core`.
- [x] Remove top-level Node builtin imports from the next release `.mjs` build
  so the standard artifact is a better first candidate for browser-oriented
  products.
- [x] Add a core-side runtime-shape test proving the release ESM source can be
  wrapped into a browser-style IIFE global for stored ZIP package operations.
- [x] Apply and verify a local `miku-docx2md` wrapper proof using the
  post-`v0.5.0` core bundle candidate.
- [x] Record the `miku-docx2md` wrapper proof as
  `docs/patches/miku-docx2md-ms-office-core-wrapper-proof.patch`.
- [x] Run `npm audit fix` in `miku-docx2md` proof work and record the resulting
  package/lockfile updates in the wrapper proof patch.
- [x] Apply and verify a local `miku-xlsx2md` wrapper proof for `unzipEntries`
  using the post-`v0.5.0` core bundle candidate.
- [x] Record the `miku-xlsx2md` wrapper proof as
  `docs/patches/miku-xlsx2md-ms-office-core-wrapper-proof.patch`.
- [x] Run `npm audit fix` in `miku-xlsx2md` proof work and record the resulting
  package/lockfile updates in the wrapper proof patch.
- [x] Apply and verify a local `mikuproject` wrapper proof for async XLSX ZIP
  reads using the staged versioned `miku-ms-office-core-0.5.0.1.mjs`
  candidate.
- [x] Record the `mikuproject` wrapper proof as
  `docs/patches/mikuproject-ms-office-core-wrapper-proof.patch`.
- [x] Run `npm audit fix` in `mikuproject` proof work and record the resulting
  package/lockfile updates in the wrapper proof patch.
- [x] Add a local release asset staging script for versioned `.mjs` and
  `.mjs.map` files, and use it from the GitHub Release workflow.
- [x] Verify local staging for the next patch-suffix asset name
  `miku-ms-office-core-0.5.0.1.mjs`.
- [x] Add a release asset verification script that compares uploaded GitHub
  Release digests with the local staged versioned assets.
- [x] Add a consumer asset verification script that compares each sibling
  product's vendored asset with the local staged versioned assets.
- [x] Verify that `miku-docx2md`, `miku-xlsx2md`, and `mikuproject` vendored
  `miku-ms-office-core-0.5.0.1.mjs` / `.mjs.map` match the local staged
  release assets.
- [x] Replace the `miku-docx2md` proof vendor asset with the versioned
  `miku-ms-office-core-0.5.0.1.mjs` release asset.
- [x] Replace the `miku-xlsx2md` proof vendor asset with the versioned
  `miku-ms-office-core-0.5.0.1.mjs` release asset.
- [x] Replace the `mikuproject` proof vendor asset with the versioned
  `miku-ms-office-core-0.5.0.1.mjs` release asset.
- [x] Publish or consume the next versioned `.mjs` release asset after the
  top-level Node builtin import removal.
- [x] Confirm the staged `miku-ms-office-core-0.5.0.1.mjs` asset matches the
  GitHub Actions-published Release asset with
  `TAG_NAME=v0.5.0.1 npm run verify:release-assets`.
- [ ] Decide whether core ZIP writing needs an explicit UTF-8 flag policy before
  replacing `miku-xlsx2md` `createStoredZip` or `mikuproject` `packZip`.
- [ ] Add a focused PPTX package fixture when PPTX read/write candidates become
  active.

### Blockers

- Sibling `miku-md2docx` now has deliberate proof-of-use working tree changes;
  do not revert them unless explicitly requested.
- Temporary proof copies are under ignored `workplace/` directories.
- Sibling `miku-md2xlsx` now has deliberate proof-of-use working tree changes
  and a package-lock update from `npm install` / `npm audit fix`; do not revert
  them unless explicitly requested.
- Sibling `miku-docx2md` now has deliberate proof-of-use working tree changes
  for the `miku-ms-office-core` wrapper adapter plus package/lockfile audit
  updates; do not revert them unless explicitly requested.
- Sibling `miku-xlsx2md` now has deliberate proof-of-use working tree changes
  for the `miku-ms-office-core` wrapper adapter plus package/lockfile audit
  updates; do not revert them unless explicitly requested.
- Sibling `mikuproject` now has deliberate proof-of-use working tree changes
  for the `miku-ms-office-core` wrapper adapter plus package/lockfile audit
  updates; do not revert them unless explicitly requested.

### Retry Log

Use this section only when the same task or error is repeated.
If the same failure appears 3 times, stop and ask the user.

- なし
