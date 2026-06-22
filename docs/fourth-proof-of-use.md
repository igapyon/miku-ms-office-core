# Fourth Proof of Use

Checked on 2026-06-23.

## Selected Repository

Use `miku-xlsx2md` as the second read-side proof-of-use target after
`miku-docx2md`.

## Scope

The local sibling proof is recorded as:

```text
docs/patches/miku-xlsx2md-ms-office-core-wrapper-proof.patch
```

The proof vendors the `v0.5.0.1` GitHub Release asset as:

```text
src/vendor/miku-ms-office-core-0.5.0.1.mjs
src/vendor/miku-ms-office-core-0.5.0.1.mjs.map
```

The release asset was verified with
`TAG_NAME=v0.5.0.1 npm run verify:release-assets`, and the product vendor copy
was verified with `TAG_NAME=v0.5.0.1 npm run verify:consumer-assets`. The
product build transforms that `.mjs` into `dist/js/ms-office-core.js`,
registers it as `msOfficeCore`, and updates `zip-io.ts` so `unzipEntries` uses
`readZipPackageAsync`.

## Deliberate Limit

`miku-xlsx2md` still owns `createStoredZip`.

Reason:
The existing product writer has a product-visible ZIP detail: ASCII-only entry
names do not set the UTF-8 flag, while non-ASCII entry names do. The current
core writer always uses the UTF-8 flag. Moving that writer path into core should
wait until the core ZIP write API has an explicit flag policy, or until the
product accepts the output change.

The proof therefore commonizes the XLSX package read path first and leaves
Markdown export archive writing as product-owned behavior for now.

## Verification Commands

Sibling-side:

```sh
cd ../miku-xlsx2md
npm test
npm audit
npm run build:runtime
npm run smoke:runtime
git apply --check --reverse ../miku-ms-office-core/docs/patches/miku-xlsx2md-ms-office-core-wrapper-proof.patch
```

## Follow-Up Targets

- Decide whether core ZIP writing should support product-controlled UTF-8 flag
  policy before replacing `miku-xlsx2md` `createStoredZip`.
- Use the same wrapper pattern to evaluate `mikuproject`.
