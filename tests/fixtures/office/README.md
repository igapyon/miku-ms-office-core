# Office Package Fixtures

These fixtures are copied from sibling miku-soft repositories only for
package-level tests.

- `word-headings-basic.docx`: from `miku-docx2md`
- `xlsx2md-basic-sample01.xlsx`: from `miku-xlsx2md`
- `mikuproject-sample.xlsx`: from `mikuproject`

The tests use these files to verify ZIP, OPC relationships, content types, and
part path behavior. They must not be used to move DOCX document semantics, XLSX
workbook semantics, Markdown conversion policy, or MS Project semantics into
`miku-ms-office-core`.
