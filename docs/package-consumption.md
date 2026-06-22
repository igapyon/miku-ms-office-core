# Package Consumption

Checked on 2026-06-23.

## Consumer Policy

`miku-ms-office-core` is currently an internal ESM library. The standard
consumer-facing artifact is the versioned single-file release asset:

```text
miku-ms-office-core-<version>.mjs
```

For version `0.5.0`, the source asset is:

```text
https://github.com/igapyon/miku-ms-office-core/releases/download/v0.5.0/miku-ms-office-core-0.5.0.mjs
```

Each consuming miku-soft product should vendor or otherwise include that
versioned `.mjs` file in its own source/build layout, then wire the product's
build or runtime to import from the vendored copy. Do not make `miku-md2docx`,
`miku-md2xlsx`, read-side products, and project tools use different
distribution mechanisms unless a product-specific runtime constraint is
documented.

Products whose current runtime is not ESM, such as IIFE/module-registry builds,
should still start from the versioned `.mjs` asset. Their build can transform the
vendored `.mjs` into a product-local wrapper module or global adapter before the
rest of the product modules are bundled. The wrapper is product-owned; the
reviewed source artifact remains the versioned release `.mjs`.

This is the proof pattern used by `miku-docx2md`, `miku-xlsx2md`, and
`mikuproject`: vendor the release `.mjs`, generate a product-local adapter, and
let the final product bundle absorb that generated adapter.

When the product keeps source maps for local diagnostics, also copy the release
`.mjs.map` asset next to the vendored `.mjs`. The generated `.mjs` currently
contains `//# sourceMappingURL=miku-ms-office-core.mjs.map`, so either keep that
local map filename or rewrite the source map reference in a documented product
build step.

Consumer code should still import the public API surface, not private generated
internals. The local import path is product-owned, but the imported names should
match the public release asset exports:

```ts
import { readOfficePackage, writeZipPackage } from "./path/to/miku-ms-office-core-0.5.0.mjs";
```

Do not import from this repository's `dist/*` paths in consuming products.

## Proof Dependency Status

Earlier sibling proof branches used a local file dependency:

```json
{
  "dependencies": {
    "miku-ms-office-core": "file:../miku-ms-office-core"
  }
}
```

That was useful to prove the API boundary, but it is no longer the intended
consumer distribution mechanism. Refresh sibling proof patches to consume the
versioned release `.mjs` asset instead of keeping `file:../miku-ms-office-core`
as the landing shape.

## Artifact Shape

The npm package artifact should contain only:

- `dist`
- `README.md`
- `LICENSE`
- `package.json`

The package `files` field enforces this. The build runs `scripts/clean-dist.mjs`
before TypeScript compilation so stale renamed modules are not packed.

Verification command:

```sh
npm run build
npm_config_cache=workplace/.npm-cache npm pack --dry-run
```

The local cache avoids machine-level npm cache ownership problems and keeps
temporary files under the repository-local ignored `workplace/` area.
Run pack verification after build, not in parallel with build or test, because
`prebuild` intentionally cleans `dist`.

The release bundle artifact is generated separately:

```sh
npm run build:bundle
npm run smoke:bundle
```

The local generated filenames are stable:

```text
bundle/miku-ms-office-core.mjs
bundle/miku-ms-office-core.mjs.map
```

The GitHub Release asset filenames are versioned:

```text
miku-ms-office-core-0.5.0.mjs
miku-ms-office-core-0.5.0.mjs.map
```

Release assets are prepared by the repository script:

```sh
TAG_NAME=v0.5.0.1 npm run prepare:release-assets
```

The script stages files under `release-assets/`, validates that the tag version
matches `package.json` or uses an accepted dot suffix, and rewrites the `.mjs`
`sourceMappingURL` to the staged versioned `.mjs.map` filename. The GitHub
Release workflow uses the same script before uploading assets.

After the GitHub Release asset is published, verify that the uploaded asset
matches the locally staged asset:

```sh
TAG_NAME=v0.5.0.1 npm run verify:release-assets
```

For local sibling proof work, verify that each product's vendored asset matches
the staged release asset:

```sh
TAG_NAME=v0.5.0.1 npm run verify:consumer-assets
```

The current `v0.5.0` digests are:

```text
369a9e0232129dbb59c982999b71671614a4d4ead180331b4d90437966cf1af4  miku-ms-office-core-0.5.0.mjs
de1a3b0da882bd7828e29227171191a95f6c072ffaef96ee0bd456748b3c520c  miku-ms-office-core-0.5.0.mjs.map
```

The current `v0.5.0.1` digests are:

```text
458540423efd321bc6aeafe9dad978e453302b1e6e01822652a978f8334832e4  miku-ms-office-core-0.5.0.1.mjs
fac0f44a6c419bfb82dee5bebfc5b9362183281bd7e09438addec5c3f57b554b  miku-ms-office-core-0.5.0.1.mjs.map
```

## Publication Status

The package remains `"private": true` for now. GitHub Release assets are the
current distribution channel for product-side vendoring.

Do not publish this package to npm until that is explicitly chosen as a separate
distribution path.

## Runtime Note

The current published `v0.5.0` asset is ESM and Node-oriented. Its ZIP sync
compression/decompression path uses `node:zlib`, and the published asset still
contains a static Node builtin import.

The next release asset should keep the same versioned `.mjs` consumption model
while avoiding top-level Node builtin imports. ZIP sync compression and sync
deflated-read paths may still require Node zlib at call time, but browser-
oriented products should be able to load the artifact when they use stored
entries, `readZipPackageAsync` / `readOfficePackageAsync`,
`DecompressionStream`, or an injected async inflater.

This is not yet a separate browser/IIFE runtime artifact. Read-side products and
`mikuproject` should first test whether the versioned release `.mjs` can fit
their existing build/runtime shape before introducing another artifact kind.
The local proofs show that this shape works for read-side ZIP paths; write-side
replacement still needs explicit core policy for product ZIP flag and timestamp
behavior.

As of 2026-06-23, GitHub Release `v0.5.0.1` publishes the post-`v0.5.0`
runtime-shape asset names `miku-ms-office-core-0.5.0.1.mjs` and
`miku-ms-office-core-0.5.0.1.mjs.map`. The release asset digests match the
locally staged assets, and the sibling proof vendor copies were verified with
`TAG_NAME=v0.5.0.1 npm run verify:consumer-assets`.
