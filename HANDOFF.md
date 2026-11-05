---
purpose: ai-agent-handoff
read_when:
  - before_resuming_work
  - before_handing_off_work
  - when_context_is_missing
update_when:
  - work_is_paused
  - handoff_summary_changes
  - verification_status_changes
---

# Handoff

This file summarizes the current working state for the next human or AI agent.
Keep it concise. Do not use this as a full work log or a replacement for `TODO.md` and `DECISIONS.md`.

## Current State

- `miku-ms-office-core` remains a low-level Office package plumbing core.
- Current package version is `0.8.0`; the #11 design baseline was 0.6.0 at
  HEAD `656c5e9`. The requested `0.7.0` version was initially superseded by
  the plan's 1.0.0 proposal, then corrected to the user's explicit `0.8.0`.
- The core-only #11 P1–P6 implementation and the user-directed 0.8.0 version
  correction are committed locally in the current PR history.
- Issue #11 also asks for a product-by-product version, API, runtime, and
  migration survey plus prioritized follow-up work. Those issue-wide items
  are not established as complete by the core implementation.
- #11 P1–P6 are implemented and locally verified. The detailed contracts,
  per-card changes, tests, browser versions, and hashes are in
  `docs/zip-browser-api-plan.md` and `docs/completion-audit.md`.
- ZIP and Office reads/writes return Promises; STORE remains the writer default.
  The core uses standard raw CompressionStreams, validates ZIP32 structure,
  enforces limits, and exposes deprecated async-name reader aliases.
- The four self-review findings are fixed: actual output budgets and early size
  checks, whole-archive declared-size preflight, abort checks after awaits, and
  shared staged-version selection including dot-suffix releases.

## Next Action

- The core P1–P6 cards are complete and committed locally. The product survey
  and follow-up prioritization named in Issue #11 remain to be completed.
- Product migration and #10's file-backed streaming implementation require
  separate instructions. No tag, Release upload, or Issue update was made.

## Relevant Files

- `docs/zip-browser-api-plan.md`: scope, API/errors/limits, implementation
  steps, artifact shape, and acceptance gates.
- `TODO.md`: P1–P6 status and existing follow-ups.
- `DECISIONS.md`: planned runtime direction, with current behavior distinguished.
- `src/ts/zip-package.ts`, `src/ts/office-package.ts`,
  `src/ts/zip-validation.ts`, `src/ts/zip-streams.ts`: current 0.8.0 source.

## Watch Outs

- Keep DOCX, XLSX, PPTX, Markdown, and MS Project semantics out of this core.
- Do not revert deliberate sibling proof working tree changes mentioned in
  `TODO.md` unless explicitly requested.
- `release-assets/`, `dist/`, and `bundle/` are generated or build outputs;
  verify intentionally before committing any generated output.

## Last Verification

- 2026-11-04 version increment: package.json and both root lockfile version
  fields agree on 0.7.0. `npm run build` and `npm pack --dry-run --json`
  passed; the package filename is `miku-ms-office-core-0.7.0.tgz`.
- 2026-11-05 implementation and self-review corrections: `npm test` passed
  (12 files / 43 tests);
  `npm run build:all`, `npm run test:types`, `npm run smoke:bundle`, staged
  asset verification, `npm audit`, `npm pack --dry-run`, and `git diff --check`
  passed. Playwright 1.64.1 passed 9 tests across Chromium 156.0.8078.4,
  Firefox 157.0, and WebKit 27.2 on Node 26.12.1 / macOS 27.0.1 arm64.
  At that verification point, the package version and local release stage were
  1.0.0; no release was published.
  The browser suite also passed all 9 tests on the temporary 1.0.0.1 stage,
  exercising automatic suffix-version selection. The final 1.0.0 browser run
  used explicit `TAG_NAME=v1.0.0` as in the release workflow.
- The user-directed version correction now aligns package.json and both root
  lockfile version fields on 0.8.0. The 0.8.0 build and stage checks passed;
  see `docs/completion-audit.md` for the current staged asset digests. No tag or
  release was created.
- 2026-11-04: design-only task. No implementation build, unit tests, browser
  tests, or version update was performed. See the plan for future gates.
- `npm test` passed on 2026-06-25 after the ZIP refactor, version bump, and
  UTF-8 flag policy update: 8 test files, 18 tests (historical result).
