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
- ZIP read/write internals in `src/ts/zip-package.ts` were refactored into
  private helpers without changing public exports.
- Package metadata was bumped from `0.5.0` to `0.5.1`.
- ZIP writing now has an explicit UTF-8 filename flag policy, documented and
  covered by tests.

## Next Action

- If continuing feature work, the next open TODO is adding a focused PPTX
  package fixture when PPTX read/write candidates become active.
- If preparing a commit or release, review the current diff and decide whether
  the refactor, UTF-8 policy, docs, TODO/HANDOFF updates, and version bump
  should land together.

## Relevant Files

- `src/ts/zip-package.ts`: ZIP read/write refactor and UTF-8 flag policy.
- `tests/zip-reproducibility.test.js`: reproducibility and UTF-8 flag coverage.
- `docs/api-reference.md`: public ZIP filename policy note.
- `TODO.md`: active AI agent task state and remaining PPTX fixture follow-up.
- `DECISIONS.md`: rationale for keeping ZIP filename handling explicit.
- `package.json`: current version is `0.5.1`.

## Watch Outs

- Keep DOCX, XLSX, PPTX, Markdown, and MS Project semantics out of this core.
- Do not revert deliberate sibling proof working tree changes mentioned in
  `TODO.md` unless explicitly requested.
- `release-assets/`, `dist/`, and `bundle/` are generated or build outputs;
  verify intentionally before committing any generated output.

## Last Verification

- `npm test` passed on 2026-06-25 after the ZIP refactor, version bump, and
  UTF-8 flag policy update: 8 test files, 18 tests.
