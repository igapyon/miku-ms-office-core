---
purpose: ai-agent-goal
read_when:
  - before_starting_work
  - before_finishing_work
  - when_scope_is_unclear
update_when:
  - goal_changes
  - done_conditions_change
  - stop_conditions_change
---

# Goal

This file defines what the AI agent is trying to accomplish.
Read this before starting work, before deciding that work is complete, and whenever scope becomes unclear.

## Objective

Build `miku-ms-office-core` as the shared low-level Microsoft Office package
foundation for miku-soft products by extracting practical common plumbing from
`miku-docx2md`, `miku-xlsx2md`, `miku-md2docx`, `miku-md2xlsx`, and the XLSX
input/output layer in `mikuproject`.

The core must stay below document meaning. It should help sibling products
handle ZIP containers, reproducible package generation, OPC paths,
relationships, content types, media parts, XML helpers, and diagnostics while
leaving DOCX, XLSX, PPTX, Markdown, and MS Project semantics in the product
repositories.

Only highly stable, specification-based, product-neutral behavior belongs in
core. New additions require demonstrated use across multiple products and
settled contracts protected by regression tests. Product-specific requirements
and unsettled abstractions are rejected as core additions; retain them in the
products even when this leaves duplication. Consumer integration should use
existing core APIs. See `docs/commonization-scope-check.md` for the boundary.

## Done

- The repository has a TypeScript / Node.js package foundation with build and
  test commands.
- Shared low-level APIs cover the first useful ZIP / OPC / XML / diagnostics
  layer needed by the sibling repositories.
- Reproducibility behavior for ZIP timestamp normalization, entry ordering, and
  compression policy is protected by tests.
- The implementation has been compared against the relevant low-level code in
  `miku-docx2md`, `miku-xlsx2md`, `miku-md2docx`, `miku-md2xlsx`, and
  `mikuproject` XLSX input/output.
- At least one sibling repository has a clear next-step migration plan, or a
  small proof-of-use, showing how it will consume `miku-ms-office-core`.
- README, TODO, and DECISIONS describe the current scope, non-goals, and
  unresolved follow-ups.

## Stop

- A proposed API would require moving DOCX, XLSX, PPTX, Markdown, or MS Project
  meaning interpretation into `miku-ms-office-core`.
- A sibling repository needs behavior that conflicts with another sibling and
  the common boundary is no longer clear.
- A proposed addition fails the strict admission conditions. Reject the core
  addition and record the product-side constraint instead of expanding the
  core backlog to force migration.
- A dependency or ZIP/XML implementation choice would make reproducible output
  or cross-runtime parity difficult to explain.
- `TODO.md` の `Retry Log` に同じ原因の失敗が3回記録された。
