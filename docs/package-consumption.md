# Package Consumption

Checked on 2026-06-22.

## Initial Policy

`miku-ms-office-core` is currently an internal ESM package.

Initial sibling integration should use public package imports:

```ts
import { readOfficePackage, writeZipPackage } from "miku-ms-office-core";
```

Do not import from `dist/*` paths.

## Local Development Dependency

Sibling proof branches currently use a local file dependency:

```json
{
  "dependencies": {
    "miku-ms-office-core": "file:../miku-ms-office-core"
  }
}
```

Run `npm install` in the sibling repository after changing this dependency so
the sibling lockfile records the local package.

## Artifact Shape

The package artifact should contain only:

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

## Publication Status

The package remains `"private": true` for now.

Do not publish this package until sibling proof changes have been reviewed and
the internal distribution path is chosen. For now, local `file:` dependencies
are the authoritative proof mechanism.

## Runtime Note

The current published surface is ESM and Node-oriented. Synchronous ZIP
compression/decompression uses `node:zlib`. Async read APIs can use
`DecompressionStream` or an injected inflater, but this is not yet a separate
browser/IIFE runtime artifact.
