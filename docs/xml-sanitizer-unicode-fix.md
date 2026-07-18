# XML Sanitizer Supplementary Unicode Fix

Checked on 2026-07-18.

## Contract

The Node.js and Java `sanitizeXmlText` implementations follow the XML 1.0
`Char` production:

- `#x9`, `#xA`, and `#xD`
- `#x20-#xD7FF`
- `#xE000-#xFFFD`
- `#x10000-#x10FFFF`

This preserves valid supplementary Unicode characters such as emoji and
`𠮷`, while removing invalid controls, isolated UTF-16 surrogates, `U+FFFE`,
and `U+FFFF`.

## Core Changes

- `miku-ms-office-core` uses a Unicode-aware regular expression and has Node
  regression coverage for text escaping, attribute escaping, supplementary
  characters, isolated surrogates, and XML range boundaries.
- `miku-ms-office-core-java` iterates by Unicode code point and has matching
  Java regression coverage and upstream test mapping.
- Both core versions are prepared as `0.6.0` without changing public API
  signatures.

## Downstream Audit

Product-local XML sanitizers were aligned with the same contract in:

- `miku-md2xlsx`
- `miku-md2xlsx-java`
- `mikuproject` Node/Web source and generated JavaScript
- `mikuproject-java`

### Consumer Repositories Changed in This Work

| Consumer repository | Local commit | Verification |
| --- | --- | --- |
| `miku-md2xlsx` | `583ab54` | Full build, 98 tests, 13 semantic roundtrip fixtures, CLI/runtime bundle smoke |
| `miku-md2xlsx-java` | `17a02e1` | `mvn clean package`, 84 tests, runtime/sources/dist artifacts |
| `mikuproject` | `ab3d8d1` | Web/CLI full build, 221-test full suite, 308-test all suite |
| `mikuproject-java` | `a393514` | `mvn clean package`, 125 passed and three optional Node parity tests skipped |

These are the consumer-side repositories modified directly for the sanitizer
behavior. The repositories listed below were audited for vendored core usage
but were not modified in this work; their vendor updates remain a post-release
task.

Vendored Node core assets still awaiting the human-owned `0.6.0` release:

- `miku-md2xlsx`: `0.5.1`
- `miku-md2docx`: `0.5.1`
- `miku-xlsx2md`: `0.5.0.1`
- `miku-docx2md`: `0.5.0.1`
- `mikuproject`: `0.5.0.1`

Vendored Java core jars still awaiting the human-owned `0.6.0` release:

- `miku-md2docx-java`: `0.5.1`
- `miku-md2xlsx-java`: `0.5.1`
- `miku-xlsx2md-java`: `0.5.1`

After both `0.6.0` releases are published, replace these vendored artifacts,
update their recorded versions and digests, and run each affected product's
documented focused and full verification commands.

## Local Verification

- `miku-ms-office-core`: `npm run build:all`, `npm test` with 19 tests, and
  `npm run smoke:bundle` passed.
- `miku-ms-office-core`: `v0.6.0` release assets were staged locally and
  `npm_config_cache=workplace/.npm-cache npm pack --dry-run` passed.
- `miku-ms-office-core-java`: `mvn clean package` passed 18 tests and created
  the `0.6.0` library and sources jars.
- `miku-md2xlsx`: `npm run build:all`, `npm test` with 98 tests, the
  13-fixture semantic roundtrip, CLI bundle smoke, and runtime bundle smoke
  passed.
- `miku-md2xlsx-java`: `mvn clean package` passed all 84 tests and created the
  runtime jar, sources jar, and distribution zip.
- `mikuproject`: `npm run build:full` passed its 221-test full suite, and the
  broader `npm run test:all` passed all 308 tests.
- `mikuproject-java`: `mvn clean package` passed 125 tests with three optional
  Node parity tests skipped, and created the runtime jar, sources jar, and
  distribution zip.
