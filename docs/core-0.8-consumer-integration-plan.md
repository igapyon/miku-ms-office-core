# miku-ms-office-core 既存APIの利用側統合計画

作成日: 2026-11-06 JST。状態: 計画。実装の次カードは **A1**。
基準: `miku-ms-office-core` 0.8.0の既存API契約。
主要な利用側: `miku-md2xlsx`、`miku-project`。

2026-11-06の方針更新: coreは仕様に基づく、十分に安定した汎用処理に限定する。
本書は利用側の統合計画であり、製品固有機能や未成熟な共通化案をcoreへ追加する
変更依頼としては受け入れない。先行commitでpackage版を0.9.0にしたが、利用者の
指定により0.8.1へ訂正する。このmetadata変更はconsumer移行や新しいcore APIの実装を
意味しない。
以下の0.8.0とdigestは計画開始時点の基準記録として保持する。

既存の公開APIを共通のZIP基盤として使い、両製品の実際の入出力経路が同じ公開APIを
通る状態を目指す。本書を今後のconsumer作業の正本とする。
core本体のP1〜P6の完了記録は[既存計画](zip-browser-api-plan.md)を参照する。
既に実装されたcoreを作り直す作業からは始めない。

## coreへの受入境界

coreへの新規追加は、次の条件をすべて満たすものだけを個別に検討する。

- 製品名や製品モデルを知らず、ZIP・OPC・XML等の仕様で処理を定義できる。
- 複数製品の実利用で、同じ契約が必要だと確認できる。
- 入出力・エラー・互換性の契約が固まり、回帰テストで継続して守れる。
- 製品固有の例外、暫定的なfallback、将来の拡張予測に依存しない。

「低レベル」「重複している」「移行すると便利」だけでは受け入れない。
条件を満たさない要求はcoreへの追加を却下し、製品側に残す。多少の重複を許容する。
新規APIの提案は本計画の実装項目に自動追加せず、根拠を揃えた別の検討事項とする。

| 要求 | coreでの扱い | 所有先 |
| --- | --- | --- |
| 既存の汎用ZIP/OPC/XML契約への不具合修正 | 再現例と回帰テストで確認して修正 | core |
| XLSXのpart生成、template、styles、WBS、SVG、report構成 | 受入不可 | 各製品 |
| 公開binary APIのPromise化、CLIのawait、型・adapterの接続 | core機能としては受入不可 | 各製品 |
| 製品の旧ZIP bytesへ合わせる特例やcore既定値の変更 | 受入不可。既存の汎用optionで表現できる範囲を使う | 製品側の互換性判断 |
| 製品向けcodec注入、zlib fallback、同期互換層 | 本計画では受入不可 | 製品側で採用可否を判断 |
| file-backed entry、async sink等の新しいZIP API | 本計画では受入不可 | 別計画で受入条件から検討 |

詳細な恒常方針は[共通化の範囲](commonization-scope-check.md)を参照する。

## 1. 所有する処理と到達点

| 所有者 | 責務 |
| --- | --- |
| core | 既存の安定したZIP/OPC/XML契約と配布物の維持、契約に対する不具合修正 |
| md2xlsx | Markdown/workbookモデル、XLSXの各part、template適用、CLI/runtimeからcore APIへの接続 |
| project | Project/workbook/reportモデル、XLSX/SVG等の各part、CLI/runtimeからcore APIへの接続 |
| Web等の配布先 | 検証済み製品runtimeの採用。Release lock更新は別の配布作業 |

到達点は、md2xlsxとprojectをcoreの並列の利用側として検証できること。
既存の汎用契約に対する不具合はcoreで直す。製品要望による不足をcore不具合とみなして
APIを拡張しない。既存APIで移行できない経路は制約と理由を記録して製品側に残す。
本計画の移行ではconsumerに独自inflater、zlib fallback、ZIPヘッダー生成を増やさない。
XML文書の構成やProjectの意味モデルは製品側が所有する。

projectの同期ZIP APIをなくすには戻り値の変更が必要となるため、互換性を確認してから
段階的にPromiseを伝播する。同期実装の残存を「全ZIP共通化済み」とは扱わない。

## 2. 開始時点の事実

| 対象 | 現在の状態 | 今回の扱い |
| --- | --- | --- |
| core | 0.8.0、基準HEAD `657db16b8c678da90e4971592cd58d9475836400`。非同期ZIP/Office API・標準Streams実装あり | 契約と配布物の所有元 |
| md2xlsx | 2.0.0作業ツリー。`readXlsxTemplateParts`、`writeXlsx`、公開binary APIがPromise。出力は明示DEFLATE | 採用済み経路を監査し、必要な差分だけ修正 |
| project | 1.1.2作業ツリー。`unpackZipAsync`はcore readerを使用 | 残存する同期の製品経路を調査・移行 |
| projectの独自ZIP | `excel-io-zip.ts`、`main-util.ts`、`wbs-svg-zip.ts`に同期実装あり | G1後にcoreへ委譲 |
| projectの公開経路 | `api.xlsx.encodeWorkbook/decodeWorkbook`、`importExternal`、report ZIP等が同期 | 内部helperの更新だけで完了扱いにしない |
| project-web | 既存runtime lock 0.13.0へ復帰。元からあるpackage/lockの依存更新は保持 | この計画で追随版へpinしない |

巻き戻し済みの範囲は、project-webの未公開1.1.2配布変更、追加CI workflow、
重複するsmoke版チェック、独立したポリシーが承認済みだとした追記。
md2xlsx/projectのcore接続と、core 0.8.0のNode 22+要件に合わせたmetadataは保持した。
退避はmd2xlsxの`workplace/core-0.8-scope-1izrvudg/`にある。

既存の検証記録（今回の計画ターンで再実行した結果ではない）:

- core起点のconsumer照合: 7製品×module/map/declaration = 21ファイル一致。
- core staged assetsとDOM/WebWorker型宣言: 通過。
- md2xlsx: 99 tests、CLI/runtime smoke、3ブラウザーの記録あり。
- project: `build:full` 32 files / 374 tests、巻き戻し後のbrowser-runtime 6/6。
- projectの直近ローカル実行環境はNode 26.12.1。Node 22/24の実行済み結果と混同しない。

## 3. 固定する契約

1. `readZipPackage`、`writeZipPackage`、`readOfficePackage`は常にPromise。
   `readZipPackageAsync`等の既存aliasはcoreの契約に従い、consumerで別実装を作らない。
2. ZIP method 8は標準`CompressionStream("deflate-raw")` /
   `DecompressionStream("deflate-raw")`を使う。Node importやcodec注入を追加しない。
3. core writerの既定はSTORE。md2xlsxの明示DEFLATEを維持する。
   projectは移行時もSTOREを明示し、非同期化と圧縮方式の変更を混ぜない。
4. core 0.8.0のNode要件は22+。製品固有のCI新設やRelease trigger変更を自動追加しない。
5. 配布3ファイルは同一stageから一組で取り込む。生成JSは各製品のbuildで作る。
6. fixtureで既存の汎用契約に対するcore不具合が再現した場合に限り、coreの
   回帰テスト・修正・再stageを行う。製品固有の期待との差はcore不具合に含めない。
   stage bytesが変わったら採用対象consumerのdigestと検証を更新する。
   実装開始時に公開状況も確認し、公開済み版のbytesを同じversionで差し替えない。

計画開始時点の0.8.0 stage SHA-256:

| File | SHA-256 |
| --- | --- |
| `.mjs` | `82bdc9fb46726eef62946d4992041ce9d35c927452646cec5bd4e83ada11377c` |
| `.mjs.map` | `b36240dd3a17c13a93c93124fafb0a77d3ea145233ca56c074177c981ec8b265` |
| `.d.mts` | `3c67737ff84c1eda496bc3b421d828b04c4aaba7de38e21e94e0988fdc7c734d` |

core Issue #10のfile-backed entryやasync sink等、新しいZIP公開APIの追加は別計画とする。

## 4. 実施カード

| 順序 | カード | 主な編集先 | 前提 | 状態 |
| --- | --- | --- | --- | --- |
| B0 | 選択的巻き戻しと退避 | project / project-web / core記録 | なし | 完了 |
| B1 | core配布物とconsumerの一致確認 | core verifier / 採用記録 | B0 | 基準0.8.0 stageで完了 |
| A1 | 製品経路・互換性の棚卸し | core docs、必要なローカル検証素材 | B1 | 未着手 |
| A2 | md2xlsxのcore採用監査 | md2xlsx。coreは既存契約の不具合修正のみ | A1 | 製品側作業・未着手（既存実装あり） |
| G1 | projectの戻り値・出力互換性を固定 | core内の調査記録、project contract | A1 | 判断材料を作成して確認 |
| A3 | project XLSX経路の非同期統合 | project XLSX / 既存core APIへの接続 / CLI | G1 | 製品側作業・未着手 |
| A4 | projectの残りのZIP生成を統合 | project report / WBS SVG / main-util | A3 | 製品側作業・未着手 |
| A5 | 両製品の受入・配布境界の確認 | core、md2xlsx、projectの検証 | A2、A4 | 未着手 |
| A6 | 採用一覧と残件の確定 | core docs / TODO | A1と実施対象カードの結果 | 未着手 |

### A1: 製品経路・互換性の棚卸し

編集の中心はcoreの`docs/package-consumption.md`と採用一覧。
7consumer（md2xlsx/md2docx/md2pptx/docx2md/xlsx2md/pptx2md/project）について、
版・core版・使用API・Node/browser形態・確認した利用経路・未確認経路を表にする。
主要2製品以外は調査対象とし、追加の実装を自動で始めない。
coreへの追加要求は、受入可能な既存契約の不具合と、受入不可の製品要望を区別して
記録する。受入不可の要求をcoreの未完了TODOへ移さない。

projectでは次を呼出元まで辿る:

- XLSX: `excel-io-zip.ts` → `excel-io.ts` → `core-api-workbook-xlsx.ts`。
- import: `core-api-external-binary.ts` → `core-api-external-import.ts` /
  `core-api-import.ts` → `scripts/lib/cli-exchange-commands.mjs`。
- reports: `core-api-report.ts` / `core-api-report-adapters.ts` →
  `scripts/lib/cli-report-commands.mjs`。
- archives: `main-util.ts`の`packZipEntries`、`wbs-svg-zip.ts`、
  `wbs-svg-calendar.ts`、`wbs-svg-public.ts`、`wbs-svg.ts`。
- global型定義、sample builder、test、runtime利用例の全call site。

`api.xlsx.exportWorkbook`はworkbookモデル生成、`encodeWorkbook`はZIP binary化であり、
同じ名前のcodecメソッドと混同しない。純粋なモデル関数まで一律async化しない。

完了条件: 同期/非同期の実経路、委譲先、変更が必要な公開戻り値、ZIP複製箇所が一覧化される。
ファイル名だけを列挙して完了扱いにしない。

### A2: md2xlsxのcore採用監査

`src/ts/xlsx-template.ts`、`xlsx-writer.ts`、`core.ts`とCLI/runtimeを確認する。
既存のPromise伝播・vendor 0.8.0・明示DEFLATEを再利用し、core0.8の同一moduleを
使っていることを確認する。codec fallbackや独自ZIP実装が残る場合にだけ修正する。

検証は既存の99 tests、build、CLI/runtime smoke、browser harnessを使う。
新たな意味上の変更がなければ同じ検証を無意味に反復しない。
必要なgateは`npm test`、`npm run build:all`、`npm run smoke:bundle`、
`npm run smoke:runtime`、`npm run test:browser`。

完了条件: DEFLATE templateを読み、生成XLSXを独立したZIP実装でCRCとpart bytesまで確認。
画像、文字列、リンク、styles/theme等の製品意味が保持される。

### G1: project互換性の判断を具体化する

実装前に、有効なproject XLSX、WBS XLSX、月次SVG ZIP、report-all ZIPの同一入力を用い、
現行writerとcore 0.8.0 writerの比較素材をローカルに作る。

比較項目はentry順、名前、UTF-8 flag、圧縮method、DOS日時、CRC、展開後part bytes、
必要なOOXML内容。coreの`compression: "store"`、`order: "input"`、明示timestampで
維持できる範囲と、UTF-8 flag等の差を記録する。元の日時を有効なDateで表せない場合も記録する。
製品の旧bytesを再現するためのcore特例や既定値変更は受け入れない。
既存APIで契約を維持できなければ、製品側で契約変更または移行見送りを判断する。

推奨する着地点:

- ZIP/OOXMLとしての意味と製品の入出力を維持し、coreの正規ZIP表現へ揃える。
- 公開binary APIのPromise化は破壊的変更としてproject **2.0.0を提案**する。
  開始時点で版が進んでいればdowngradeせず、次のmajor候補を記録する。
- canonical APIを非同期に揃える。同期に見せかけた待機や戻り値`T | Promise<T>`を作らない。

projectにはNode/JavaのWBS XLSXバイト比較があるため、単にsnapshotや期待値を更新して
済ませない。`docs/node-java-work-plan-v20261022/remaining-work.md`のREM-04/05等を読み、
実際に影響する契約と、意味比較で足りる契約を特定する。

完了条件: 変更対象API、版、許容するZIP metadata差、保持するbyte契約を具体的な差分付きで固定する。
既存の明示的なbyte互換契約を変更する必要がある場合は、この材料で利用者の判断を得てからA3へ進む。
Java側の契約・実装やWeb Release lockをこのカードだけで変更しない。

### A3: project XLSXをcoreへ接続し、Promiseを実経路へ伝える

一つの整合した変更単位として次を進める。

1. `excel-io-zip.ts`のZIP読書きをcore `readZipPackage` / `writeZipPackage`へ委譲。
   `{name,data}`と`{path,data}`の変換、診断から製品エラーへの変換を薄いadapterに置く。
2. `XlsxWorkbookCodec`のbinary export/import/list/unpackをPromise化する。
   既存`*Async`名を残す場合はcanonical関数へ委譲し、ZIPロジックを複製しない。
3. `core-api-workbook-xlsx.ts`の`encodeWorkbook` / `decodeWorkbook`、
   `importXlsx` / 公開`importExternal`の型と戻り値を一貫したPromiseへ更新する。
4. XLSXに依存するreport entry生成、global型定義、CLI exchange/report、
   `scripts/build-project-xlsx-sample.mjs`、利用例、testsをawaitへ更新する。
   非同期結果の`.length`参照や、Promiseをfile writerに渡す箇所を残さない。
5. 生成JSは`npm run build:core`等の既存buildから作る。

完了条件: 公開CLIからDEFLATEされた有効なproject XLSXをimportできる。
XLSX exportとWBS reportがcore writerを通り、モデル内容・diagnostics・exit codeの契約を保つ。
`npm run build:full`を通し、G1で固定したAPI移行説明とversion metadataを同時に更新する。

### A4: projectの残りのZIP生成をcoreへ集める

`main-util.ts`のreport bundle ZIP、`wbs-svg-zip.ts`の月次SVG ZIPをcore writerへ委譲する。
`wbs-svg-calendar.ts` / `wbs-svg-public.ts` / `wbs-svg.ts`、report adapters、CLIまで
Promiseを伝える。XML escapeやSVG生成の純粋な関数はその役割を維持する。

製品側で選ぶentry順・timestamp・STOREはG1の決定どおり明示する。
独自のCRC表、ZIPヘッダー生成、central directory parser等は参照がなくなったものを削除する。

完了条件: 主要製品source内のZIP binary実装がcoreへ集まり、report all内のXLSXとZIPを
すべてawaitする。`npm run build:full`と独立ZIP readerで月次/archive/report内容を確認する。

### A5: coreを起点に両製品を受け入れる

- coreの`npm run verify:staged-assets`とconsumer照合を実施対象の採用版で実行する。
  `npm run verify:consumer-assets -- v0.8.0`は基準版での実行例であり、package版と
  stage版が一致する状態で使う。0.8.1へのmetadata訂正だけでconsumerを一括更新しない。
- 既存契約の不具合でcore実装を変更した場合はcore unit/type/browser gateも実行し、
  変更後stageを採用対象へ配る。
- md2xlsxはDEFLATE template読込とXLSX生成を既存browser harnessで確認する。
- projectは公開`api.xlsx` / `importExternal` / CLI経路で、有効な圧縮project fixtureを読む。
  内部の`unpackZipAsync`が通るだけの検証で済ませない。
- projectのXLSX、月次ZIP、report-all ZIPを独立実装（Python標準`zipfile`等）で開き、
  CRC、entry manifest、展開後bytes、含まれる文書を確認する。
- 製品runtimeはESM/IIFEの実artifactから検証する。projectのDOMを必要とする意味処理に、
  core単体のDOMなしWorker契約をそのまま要求しない。
- 破損CRC等の代表例でcore診断が製品側に伝わり、部分的な成功出力を返さないことを確認する。

Node22/24とChromium/Firefox/WebKitの実行版・実行結果を記録する。
利用できない実行環境は未実施gateとして残し、過去の記録を今回の成功として転記しない。
入力形式の制約は各製品の契約に従う。一般的なmd2xlsx出力をproject固有schemaのCLIへ渡し、
読めないことをcoreの不具合と判断しない。

### A6: 採用一覧と残件を確定する

coreの`docs/package-consumption.md`とTODOに、製品ごとの版・API・runtime・digest・
実行結果・未移行経路を記録する。md2xlsx側の従来計画は履歴としてリンクする。

完了は「同じvendor bytes」「実際の公開経路がcoreを使用」「製品意味の回帰なし」を
それぞれ確認して判定する。7製品のasset一致だけで全製品の機能移行完了とはしない。
coreへの受入を却下した項目と、製品側に残す経路・理由も明記する。移行見送りを
core機能追加の未完了事項として扱わない。
G1等で移行を見送った経路も、その判断をA6へ記録できる。全経路の移行を
記録完了の条件にしてcore拡張を強制しない。

Web/Skills/MCPやJavaへの配布更新、Release公開、tag、commit、push、Issue操作は
別の指示に沿って扱う。製品runtimeを未公開版へpinするために既存のlock規則を緩めない。

## 5. Lunaへの実行指示

> 本書のA1から開始してください。既存core API契約と採用済みconsumer差分を保ち、
> 完了済みB0/B1やcore P1〜P6を作り直さないでください。各カードで対象repoの差分と
> 呼出元を確認し、指定された変更・検証・記録を完了してから次へ進んでください。
> coreへの追加は本書の受入境界で判定してください。製品固有の処理や未成熟な共通化は
> 受入不可と記録し、製品側に残してください。既存APIの制約を移行都合で拡張しないでください。
> G1の互換性差は具体的なartifactで示してください。明示的な既存byte契約の変更が
> 必要な場合は判断材料を整えて確認し、G1を飛ばして期待値だけを変更しないでください。
> 未実施gate、未移行の同期経路、別作業の配布先を明記してください。

各カードの終了記録は、編集したrepo/ファイル、最終API、core stage digest、実行した
検証と実測結果、未完了条件、次カードを短く残す。build生成物を手編集しない。
