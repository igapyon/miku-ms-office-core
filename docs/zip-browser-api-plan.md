# #11: ブラウザー／IIFE対応ZIP APIの設計・実装計画

作成日: 2026-11-04 JST。実装完了日: 2026-11-05 JST。
状態: **P1〜P6を実装し、core内の受入gateを完了**。
対象: [core Issue #11](https://github.com/igapyon/miku-ms-office-core/issues/11)。
基準: `miku-ms-office-core` 0.6.0、HEAD `656c5e9`。

## 1. この計画の範囲

Node.js、ブラウザーESM、IIFE、Workerで同じZIP実装を利用するための、
共通コア単体の設計と実装手順を定める。2026-11-04の計画ターン後、
2026-11-05に利用者の実装指示を受けてP1〜P6を実施した。

- 変更対象はこのリポジトリ内。実製品のソース、vendor、Web UI、CLIを更新しない。
- core内の既存proof-of-useテストは対象。兄弟リポジトリのテストは実行しない。
- [#10](https://github.com/igapyon/miku-ms-office-core/issues/10)のfile-backed entry、
  async sink、Nodeファイルadapterは後続作業。今回その公開APIを追加しない。
- commit、push、tag、Release公開、Issueへの書込・closeは今回も行わない。
- 当初P6でpackage/lockを計画値1.0.0にそろえた。その後、利用者の明示指定で
  現行versionを0.8.0へ訂正した。0.7.0の更新も履歴に残す。

参考にした兄弟側の計画は、2026-11-04時点の
`miku-md2xlsx/docs/async-zip-migration-plan.md`（未コミット）。
Lunaはその計画の製品移行カードへ進まず、本書のcore契約とP1〜P6を使う。
兄弟側の計画との差分として、**writerの既定圧縮方式は現行のSTOREを維持**する。
非同期化と圧縮方式の既定変更を同時に行う必要がなく、既存のSTORE互換性を保てるため。
DEFLATEは従来どおり明示指定できる。

## 2. 調査時点の事実と受入対象

| 箇所 | 現在の状態 | 計画での扱い |
| --- | --- | --- |
| `src/ts/zip-package.ts` | 同期read/writeは`process.getBuiltinModule`経由のzlib。非同期readは標準API、zlib fallback、inflater注入 | 標準Streamsによる非同期read/writeへ一本化 |
| `src/ts/office-package.ts` | 同期readerと非同期readerが併存 | 同じ非同期ZIP readerへ接続 |
| `scripts/build-library-bundle.mjs` | `platform: node`、`target: node20` | `neutral`、`es2022`の単一ESM |
| `tsconfig.json` | Node型を利用 | coreはWeb標準型だけでコンパイル |
| Release asset | `.mjs`、`.mjs.map` | 同じ版の生成`.d.mts`を追加 |
| IIFEテスト／smoke | 主にSTOREのVM検証 | 実配布物のDEFLATE、実ブラウザー、Workerも検証 |
| engine／CI | Node >=20／Node20 | Node >=22／Node22・24 |

前ターンのNode 26.12.1による`process`なしVMプローブでは、STORE読書き、
非同期DEFLATE読込は成功し、同期DEFLATE読書きはNode zlib不足で失敗した。
これは実ブラウザー検証ではなく、現状の依存箇所を特定する根拠である。
また、現在の`getBuiltinModule`はNode 20.16.0／22.3.0以降の機能であり、
`engines: >=20`の全範囲を満たしていない。新版はNode22以上へそろえる。
[Node.js process資料](https://nodejs.org/api/process.html#processgetbuiltinmoduleid)

### 当初の目標マトリクス（実測結果は8章に記録）

| 環境 | STORE read/write | DEFLATE read/write | 条件 |
| --- | --- | --- | --- |
| Node22・24 | 対応 | 対応 | 組込みの標準Streamsを使用 |
| ブラウザーESM | 対応 | 対応 | `deflate-raw`対応の標準APIが必要 |
| 製品が変換したIIFE | 対応 | 対応 | 同一ESMから生成した検証用IIFEで確認 |
| Worker | 対応 | 対応 | DOM・Node globalを要求しない |
| 圧縮／展開APIがない環境 | 対応 | `zip.runtime.unsupported` | module import時には失敗させない |

ブラウザーは固定したPlaywrightと付属Chromium／Firefox／WebKitの実行結果を
版付きで記録する。未実行の旧ブラウザーまで保証を広げない。

## 3. 固定する公開契約

### 3.1 APIと互換性

既存の`ZipEntryInput`、`ZipEntry`、`ZipReadResult`、`OfficePackage`の基本形を
維持し、日時は`modifiedAt: Date`を正とする。ZIPの読書きに依存する3関数は
常にPromiseを返す。STOREも同期戻り値にしない。

```ts
export interface ZipReadLimits {
  maxInputBytes: number;
  maxEntries: number;
  maxEntryBytes: number;
  maxTotalBytes: number;
}

export interface ZipWriteLimits {
  maxEntries: number;
  maxEntryBytes: number;
  maxTotalBytes: number;
  maxOutputBytes: number;
}

export interface ZipReadOptions {
  limits?: Partial<ZipReadLimits>;
  signal?: AbortSignal;
}

export interface ZipWriteOptions {
  timestamp?: Date;
  compression?: "store" | "deflate";
  order?: "stable" | "input";
  limits?: Partial<ZipWriteLimits>;
  signal?: AbortSignal;
}

export function readZipPackage(
  data: Uint8Array, options?: ZipReadOptions
): Promise<ZipReadResult>;

export function writeZipPackage(
  entries: ZipEntryInput[], options?: ZipWriteOptions
): Promise<Uint8Array>;

export function readOfficePackage(
  data: Uint8Array, options?: ZipReadOptions
): Promise<OfficePackage>;

export class ZipError extends Error {
  readonly code: string;
  readonly path?: string;
  constructor(code: string, message: string, path?: string);
}

export const DEFAULT_ZIP_READ_LIMITS: Readonly<ZipReadLimits>;
export const DEFAULT_ZIP_WRITE_LIMITS: Readonly<ZipWriteLimits>;
```

- `readZipPackageAsync`と`readOfficePackageAsync`は、対応する新canonical関数への
  deprecated aliasとして1.x中は残す。同じ関数を参照させ、別実装を持たせない。
- `getZipEntry`、`getZipTextEntry`、`upsertZipEntry`、OPC、XML、binary、診断の
  各ヘルパーは同期を維持する。内部のStreamsヘルパーはindexからexportしない。
- `ZipReadOptions.inflateRaw`と`ZipWriteOptions.compressionLevel`は廃止する。
  型エラーに加え、JavaScriptから渡された場合も`zip.options.invalid`でrejectする。
- 未知のoption、未知のlimitsキー、旧`date`、不正なentry shapeを黙って無視しない。
  entryの許可キーは`path`、`data`、`compression`、`modifiedAt`。
- 任意項目の`undefined`は省略として扱う。`null`、配列をoptionsとして受け付けない。
  limits値は0以上の安全な整数。圧縮と順序は上記literal以外を拒否する。
- 不正なDate／1980〜2107年の範囲外は`zip.options.invalid`。UTCでDOS時刻へ変換し、
  秒は2秒単位へ切り捨てる。
- 公開async関数の入力不正はPromiseのrejectとして返す。
  signalは同一realmの`instanceof`だけで判定せず、AbortSignalの利用契約を確認する。

戻り値変更、旧options廃止、読込失敗時の扱いの変更を含むため、予定版を1.0.0とする。
旧0.6.0のファイルを使う製品を、この実装作業で更新する必要はない。

### 3.2 入力の所有権と再現性

最初のawaitより前にoptions、entry配列、Date値と入力bytesをsnapshotする。
呼出直後の入力変更が処理結果へ混ざらないようにする。signalだけは元の参照を保つ。
巨大な入力を複製する前に、型、入力長、entry数、各entry長、合計量を確認する。
stringのUTF-8化は`TextEncoder.encodeInto`と64 KiB以下の一時領域で上限を数え、
上限内と確認できた文字列だけを最終bytesへ変換する。孤立surrogateは従来同様に
TextEncoderの置換規則に従う。

writerの既定値は`compression: "store"`、`order: "stable"`、
1980-01-01 00:00:00 UTC。entryごとの指定をoptionsより優先する。
順序は正規化後の相対パスのUTF-16コード単位順。`order: "input"`は入力順。
ファイル名はUTF-8、local／central両ヘッダーのUTF-8フラグを設定する。

STOREは同じ条件の0.6.0 goldenとのbyte互換を守る。DEFLATEは同一の実行環境・版で
繰返し生成の一致を検証する。環境間や旧zlibとの比較では、圧縮bytesの一致を
要求せず、名前、順序、日時、method、CRC、展開後bytesを比較する。
標準Streamsには従来の圧縮level指定を引き継がない。

### 3.3 処理量の制限

| 項目 | read既定 | write既定 |
| --- | ---: | ---: |
| 入力ZIP | 64 MiB | 対象外 |
| entry数（directoryを含む） | 10,000 | 10,000 |
| 1 entryの展開後／元データ | 64 MiB | 64 MiB |
| 全entryの展開後／元データ合計 | 256 MiB | 256 MiB |
| 完成ZIP | 対象外 | 256 MiB |

1 MiB = 1024 * 1024 bytes。既定値は`Object.freeze`した定数として公開する。
これは初期の処理量制限であり、最大メモリー使用量の保証ではない。
snapshot、圧縮出力、最終連結が併存する。#10のbounded-memory契約とは別である。

省略した制限だけ既定値で補う。0は有効で、空入力・空ZIPにも実際のサイズを適用する。
加算は安全な整数とZIP32範囲を検査する。writeの出力予算はヘッダー、名前、
central directory、EOCDを含める。確保後ではなく、chunk保存や最終確保の前に判定する。
処理はentry単位で逐次実行し、無制限にPromise.allしない。

### 3.4 エラーと結果

| 状況 | read／Office read | write |
| --- | --- | --- |
| 正常 | entriesとdiagnostics | 完成Uint8Array |
| ZIP破損・未対応ZIP機能・処理量超過 | `entries: []`とerror診断 | `ZipError`でreject |
| options／入力shape不正・必要なruntime機能なし | `ZipError`でreject | 同左 |
| 中断 | `name === "AbortError"`のエラーでreject | 同左 |
| 予期しない実装例外 | 元の例外でreject | 同左 |

readで途中のentryが失敗した場合、成功済みentriesも破棄し、最初のerror診断を返す。
Office readerはZIP errorをそのまま引き継ぎ、`entries: []`を返す。
この場合は内容型を解析せず、`opc.content_types.missing`を重ねて追加しない。
ZIP正常時の既存のOPC warning動作は維持する。

診断のshapeは既存`OfficeDiagnostic`、severityは`error`。次のcodeを使う。

| code | 用途 |
| --- | --- |
| `zip.eocd.missing` | EOCDを特定できない |
| `zip.central_directory.invalid` | central directoryの領域／構造不正 |
| `zip.local_header.invalid` | local headerの領域／構造／整合性不正 |
| `zip.compression.unsupported` | method 0/8以外 |
| `zip.feature.unsupported` | ZIP64、暗号化、分割ZIP、未対応filename encoding等 |
| `zip.path.invalid` | 空、ルート外、無効UTF-8等の名前 |
| `zip.path.duplicate` | 正規化後の同種entry名重複 |
| `zip.entry.read_failed` | DEFLATEストリームのデータエラー |
| `zip.entry.size_mismatch` | 宣言サイズと実サイズの不一致 |
| `zip.entry.crc_mismatch` | CRC不一致 |
| `zip.limit.exceeded` | 設定上限またはZIP32で表現できる範囲の超過 |
| `zip.runtime.unsupported` | 必要な標準API／raw形式が使えない |
| `zip.options.invalid` | 不正／廃止済みoption、引数shape不正 |

ZIP64 sentinelは`zip.feature.unsupported`として扱い、通常の数値超過と区別する。
readerがsentinelを未対応とする範囲をwriterも生成しない。今回の出力上限はentry数
65,534、size／offsetは0xfffffffe以下とし、設定値を上げてもこの範囲を超えない。
readの宣言量が設定上限を超えたら展開前に停止する。実chunkの累計でも再確認する。
実出力が設定上限を超える場合は`zip.limit.exceeded`、設定内で宣言サイズだけを
超える場合は`zip.entry.size_mismatch`。最後に不足していてもsize mismatch。
両方を超えた同じchunkではlimitを優先する。

options検査→中断確認→ZIP検査→entryの展開／CRCの順に処理する。
中断時は`signal.reason`の型に依存せず、常にAbortErrorとしてrejectする。
何でもcatchして破損診断へ変換しない。データ由来の既知エラーだけを診断化する。

## 4. 内部構造と処理手順

| ファイル | 責務 |
| --- | --- |
| `zip-streams.ts`（新規） | 標準raw圧縮／展開、出力予算、中断とcancel |
| `zip-errors.ts`（新規） | ZipErrorと内部の既知エラー分類 |
| `zip-validation.ts`（新規） | 引数、予算計算、ZIP領域・ヘッダー検査 |
| `zip-package.ts` | entry準備、ZIP read/writeの順序制御、シリアライズ |
| `crc32.ts` | 現在のCRC32。今回はincremental公開APIを追加しない |
| `office-package.ts` | ZIPのawaitと既存OPC組立て |

`fs`、`os`、`path`、zlib、`require`、`process`、`Buffer`をcore本体と配布型から除く。
`Blob`、`Response`、`window`、`document`もZIP実装の必須依存にしない。
Node APIはビルド／独立検証スクリプトとテストで使用できる。

### 4.1 Streamsヘルパー

内部の`deflateRawBytes`と`inflateRawBytes`は入力Uint8Array、出力上限、signalを受け、
Promise<Uint8Array>を返す。inflateには宣言サイズとpathも渡す。

1. 操作時にだけ必要なコンストラクターと`deflate-raw`対応を検査する。
   圧縮はCompressionStream、展開はDecompressionStreamだけを要求する。
2. Uint8Arrayを最大64 KiBずつpullで供給するReadableStreamを作る。
3. 標準transformへpipeThroughし、出力readerで読みながら予算を検査する。
   input writerのwriteをすべてawaitしてから出力を読む構造にしない。
4. 上限内のchunkだけ保存し、最後に一度連結する。予算超過時に全出力を収集しない。
5. abort listenerは待機中のreadも解除する。エラー／中断時はreaderと上流をcancelし、
   listenerとlockをfinallyで解放する。二次的なcancel失敗で最初のエラーを上書きしない。
6. コンストラクターの機能未対応と、処理中のデータ破損を区別する。
   データ破損を別エンジンへfallbackしない。

STOREだけを使う呼出しとmodule importでは、Streamsの有無を検査しない。
compressionとdecompressionの片方だけがない環境も個別にテストする。

### 4.2 ZIP reader／writer

readerはsnapshot→全体構造と宣言予算→entryごとのpayload取得→展開→長さ／CRC照合
の順とする。STOREにも長さとCRCの検査を適用する。
writerはsnapshot→path／日時／順序確定→entryごとの圧縮→local／central組立て
→EOCD→最終連結とする。`serializeZipEntry`までawaitを伝播する。

ZIPのフィールド定義は[PKWARE APPNOTE 6.3.10](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)
を正とし、次を本ライブラリの受入範囲として実装する。

- ZIP32、単一disk、method 0/8。通常のextra fieldとコメントは領域検査して読み飛ばす。
  ZIP64、暗号化、分割、未対応flags／methodを推測して読み進めない。
- EOCDは末尾とコメント長まで確認し、central全体と各local/payloadの範囲を検査する。
  名前、method、関連flagsはlocalとcentralで照合する。数値読込前の境界検査を省かない。
- bit 3の入力はcentralのCRC／サイズを正とする。localの0を不一致にしない。
  直後のZIP32 descriptor（signatureなし12 bytes／あり16 bytes）の値も照合する。
  bit 3なしではlocalとcentralのCRC／両サイズも一致させる。writerはdescriptorを生成しない。
- 名前は厳密なUTF-8。UTF-8 flagなしの場合はASCIIだけを受け付け、旧code pageを推測しない。
  既存`normalizeOpcPartPath`の正規化を使い、正規化後の重複を拒否する。
- directory entryも予算・データ・CRCを検査してから返却対象外にする。
  重複キーは正規化名とfile/directoryの組。writerはfileだけを受け付ける。
- writerはZIP32のcount／size／offset、UTF-8名長、最終出力量を確保前に検査する。

payload同士やcentral領域との不正な重なりも拒否する。
ZIP64の未対応判定を行った後、通常ZIP32の末尾・領域整合性を調べる。
受入flagsはUTF-8、descriptor、method 8の圧縮設定bit 1/2に限定する。
centralの解析終端はEOCD開始位置と一致させ、それ以外の追加レコードは未対応とする。
完全な汎用アーカイバー機能やファイルへの展開処理は追加しない。

### 4.3 #10との接続点

圧縮、CRC、entry metadata、ヘッダー組立ての責務を分け、ZIPの仕様判断を一箇所に保つ。
ただし今回は`filePath`、source/sink、spool、data descriptor出力の公開契約を作らない。
将来の#10では、汎用byte入出力とNodeファイルadapterを分離し、本書のruntime条件と
STORE互換性を壊さずに追加設計する。メモリ型APIの上限値をstreamingへ流用しない。

## 5. 配布物と検証の設計

### 5.1 生成と型定義

`build:bundle`は`platform: "neutral"`、`target: "es2022"`で単一ESMを生成する。
外部importとNode依存を含めない。packageのdist出口は現在のまま維持し、
release用の型はTypeScriptソースから`dts-bundle-generator`で単一ファイルへ生成する。
生成結果を手で編集しない。generatorは生成型の検証を有効にして使う。
[generator公式資料](https://github.com/timocov/dts-bundle-generator)

生成物は`bundle/miku-ms-office-core.mjs`、`.mjs.map`、`.d.mts`。
stageは現在の版をpackageから読み、3点とも`miku-ms-office-core-<version>`でそろえる。
既存のsourceMappingURL書換えとtag検査は維持する。型は未同梱の相対import、
Node型参照、外部runtime型依存を残さない。packageの型出口とrelease型のAPIをそろえる。

新設コマンドとスクリプト:

| command | script／役割 |
| --- | --- |
| `build:types` | `scripts/build-library-types.mjs`: 単一`.d.mts`生成 |
| `test:types` | `scripts/verify-library-types.mjs`: 空の利用先へコピーして型検証 |
| `verify:staged-assets` | `scripts/verify-staged-assets.mjs`: ローカル3成果物、source map参照、import、型、SHA-256照合 |
| `test:browser` | Playwrightでstage済みの同一成果物を検証 |

`build:bundle`の末尾から型生成を呼ぶ。bundle生成で出力を消した後に型を配置する。
空の利用先はignoredな`workplace/`下へ作り、repo外の実製品は使わない。
`types: []`、DOM lib、NodeNextの`.mts`で3点だけから型解決できることを検証する。
型テストにはPromise戻り値、両alias、limits、modifiedAt、旧optionsの型エラーを含める。
`test:types`は既定でbundleの3点を検証する。型検証scriptには`--asset-dir`を設け、
`verify:staged-assets`からは`release-assets`を指定して、実際のstageも同じ検証を通す。
`test:browser`はstageを再生成せず、欠落やbundleとの不一致を検出したら失敗させる。
stageの`.mjs`はsourceMappingURLを版付き名へ書き換えた期待bytesと比較する。
書換え前のbundleと単純にSHA-256一致を要求しない。map／型は元のbytesと一致させる。
型の空ディレクトリー検証はDOM libとWebWorker libの2構成を別々に実行する。

stageの版選択は`release-asset-info.mjs`で共有する。`TAG_NAME`指定時はその版へ固定し、
未指定時はstage内の単一`.mjs`から版を取得する。候補が0または複数なら失敗する。
既存のdot suffix付きtagも同じ処理を通し、Release workflowはjob全体へ`TAG_NAME`を渡す。
型検証、ブラウザーserver、IIFE生成、Workerのimport先も同じ版を使う。

公開後の`verify:release-assets`は期待ファイルに`.d.mts`を追加するだけとし、
公開前gateには使わない。`verify:consumer-assets`の修正・実行は製品移行の後続作業。
SHA-256はstage bytesを対象に記録し、ブラウザーテストが同じstageを使ったことも記録する。

### 5.2 実ブラウザーの受入

devDependencyは`@playwright/test`と`dts-bundle-generator`のみ必要に応じて追加し、
Node22/24・現行TypeScriptと互換な安定版をexact指定しlockに記録する。
runtime dependencyは増やさない。

- `playwright.config.mjs`にChromium／Firefox／WebKitの3projectを定義する。
  `tests/browser/zip.spec.mjs`にテストを置き、Vitest側は`tests/**/*.test.js`だけを実行する。
- ESMは検証用loopback HTTP serverからstage済み`.mjs`をimportする。
  `file://`上のESM import成功を前提にしない。
- IIFEは同じstage済みESMをesbuildで変換し、検証HTMLへ埋め込む。
  `file://`で開き、オフラインでも実行する。別の手書きZIP実装を埋め込まない。
- 各browserで通常ページとBlob WorkerのDEFLATE read/writeを確認する。
  ブラウザー内の標準StreamsをNode版やpolyfillへ差し替えない。
- HTTPはloopbackの検証serverだけ許可し、外部通信を禁止する。
  server、HTML、Workerコードはcoreテスト用であり製品UIを作らない。
- Nodeが作った圧縮ZIPをbrowserが読む。browserが作ったZIPはNodeと、独立した
  Python3標準`zipfile`で開き、展開manifestとmetadataを検査する。
  golden、fixture、破損生成をcore writerだけへ依存させない。

browser binaryを準備できなければ、そのgateは未完了として停止する。
VM、JSDOM、bundle成功で実ブラウザー成功を代替しない。
[Playwright設定資料](https://playwright.dev/docs/test-configuration)

## 6. Luna向けの実装カード

作成時点ではすべて未着手だった。2026-11-05に全カードを実施した。
実装差分はcore repo内で、既存の計画・版更新の作業差分を保持している。
途中版はReleaseや実製品へ配っていない。

### P1: 標準Streamsとエラー内部基盤

変更先: 新規`src/ts/zip-streams.ts`、`src/ts/zip-errors.ts`、
`tests/zip-streams.test.js`、`tests/fixtures/zip/store-v0.6.0.json`。

1. APIを変更する前に基準HEADのSTORE出力goldenを保存する。空ZIP、日本語名、
   binary、既定順序・日時の小さい例に入力、options、length、SHA-256、生成元HEADを記録する。
   基準コードが現在と異なる場合は一時領域で生成し、作業branchをreset／checkoutしない。
2. 4.1の内部ヘルパーを実装する。この段階ではindexの公開exportを変えない。
3. 空データ、多chunk、Node zlibとの双方向相互運用、低い上限、中断、破損データを検証する。
4. runtime欠如・形式未対応は隔離したVM/contextで検証する。共有globalを並行テスト中に変更しない。
5. 本体に既存Buffer型が残る間はNode型設定を早まって外さない。

gate: `npm run test:unit -- tests/zip-streams.test.js`。
既存ZIP APIはこのカードでは変更しない。

### P2: 公開APIの非同期化

変更先: `zip-package.ts`、`office-package.ts`、`index.ts`、`tsconfig.json`、
`tests/*.test.js`、`scripts/smoke-library-bundle.mjs`、package/lockのNode engine。

1. 3.1のasync関数とaliasへ変更し、getNodeZlib、fallback、inflater注入、Buffer型を除去する。
2. snapshotと旧options拒否を実装する。ZipErrorをexportし、公開API guardとsmokeの一覧も更新する。
3. core内の全呼出元をawaitへ移行する。proof-of-use、fixture reader、テスト用ZIP生成、
   smokeを含める。意味的なassertionを削除してテストを通さない。
4. `lib: ["ES2022", "DOM", "DOM.Iterable"]`、`types: []`へ変更する。
   Node engineを>=22にする。CI matrix変更はP5だが、このカードの検証はNode22以上で行う。
5. STORE golden、明示DEFLATE、alias同一性、呼出直後の入力変更、旧options拒否を確認する。

gate: `npm test`、`npm run build:bundle`、`npm run smoke:bundle`。
この段階も未公開の途中版。厳密なZIP検証はP3で完了させる。

### P3: ZIP検証・処理量・中断の統合

変更先: 新規`zip-validation.ts`、`zip-package.ts`、必要な`office-package.ts`、
新規`tests/zip-validation.test.js`、`tests/zip-limits.test.js`、公開export guardとsmoke。

1. 3.3／3.4／4.2を実装し、DEFAULT定数をexportする。
2. 宣言量を展開前に検証し、実chunkの予算とsize、CRCを全経路で照合する。
3. 正常ZIP32 descriptorの入力を受け付け、ZIP64／暗号化等を未対応として扱う。
4. 破損時に部分entriesを返さず、Office readerの診断伝播もテストする。
5. 上限テストは小さいoverrideを使う。数百MiBやZIP32上限の実メモリーを確保しない。

gate: 新規2ファイルを`test:unit`で個別実行後、`npm test`。
3.4の診断codeと上限優先順位をテストで固定する。

### P4: 単一ESM・型・ローカルstage

変更先: `scripts/build-library-bundle.mjs`、新規型生成／型検証／stage検証script、
`scripts/prepare-release-assets.mjs`、`scripts/verify-release-assets.mjs`、package/lock、
必要なcore内型テストfixture。

1. 5.1のneutral bundleと3成果物を生成する。版番号を1.0.0へハードコードしない。
2. 単一型の生成と空ディレクトリーでの利用を検証する。
3. stageの3成果物・source map参照・digestを確認する。remoteへアクセスしない。
4. distのpackage出口、単一ESM出口、生成型のAPI一致を確認する。

gate: `npm run build:all`、`npm run test:types`、`npm run smoke:bundle`、
`npm run prepare:release-assets -- v0.6.0`、`npm run verify:staged-assets`。
P6前は現行package versionのstageをローカル検証に使うだけで、旧Releaseを更新しない。
実装開始時にpackage versionが変わっていれば、上のtag引数もその値へ読み替える。

### P5: 実ブラウザーとCI gate

変更先: 新規Playwright config、`tests/browser/`、検証server／harness生成script、
Vitest config、package/lock、両GitHub workflow。

1. 5.2のESM／IIFE／Worker検証を3エンジンへ実装する。
2. Node jobは22/24 matrix。browser jobはNode24でbuild、型、stage、3エンジンを検証する。
3. Release workflowも同じ公開前gateが通ってからuploadする構成へ変更する。
   `verify:release-assets`は呼ばない。変更したworkflowをこの作業で起動しない。
4. Playwright版、browser版、Node版、OS、stage digestと結果を記録する。

初回導入はlock済みPlaywrightで`npx --no-install playwright install chromium firefox webkit`。
Linux CIは同じコマンドに`--with-deps`を付ける。
gate: `npm run test:browser`、既存Vitestとbrowserの収集対象が分離されていること。

### P6: API資料と予定版の確定

変更先: README、`docs/api-reference.md`、`docs/package-consumption.md`、
`docs/completion-audit.md`、package/lock、本書、TODO、DECISIONS、HANDOFF。

1. 実装指示がP6までを含む場合にpackageとlockを1.0.0へそろえる。
   すでに版が進んでいればdowngradeせず、破壊的変更の予定値を再評価して記録する。
2. 同期をPromiseへ変更したこと、options廃止、STORE既定、処理量制限、必要な標準API、
   3成果物とdeprecated aliasを記載する。実行できた環境だけ対応済みとする。
3. 過去のproofや古いReleaseの記述は履歴として残し、新版の保証と区別する。
4. 下記の最終検証を順に実行する。既に通った同じ変更の検証を理由なく繰り返さない。

```sh
npm test
npm run build:all
npm run test:types
npm run smoke:bundle
npm run prepare:release-assets -- v0.8.0
npm run verify:staged-assets
npm run test:browser
npm pack --dry-run
git diff --check
git status -sb
```

予定版を再評価した場合は、上のstage引数も同じ版へ読み替える。
gate: P1〜P5と下表が完了し、未検証環境を明示した引継ぎがあること。
stage成功は公開済みを意味しない。製品移行と#10は別の指示・別ターンに残す。

## 7. 最小の受入テスト一覧

| 分類 | 必須ケース | 主な担当 |
| --- | --- | --- |
| 圧縮互換 | 空、UTF-8本文、binary、64 KiB超、Node zlibとの双方向検査 | P1 |
| runtime | import可能、STORE可能、圧縮だけ／展開だけ未対応、raw形式未対応 | P1/P2/P5 |
| API | Promise、alias同一性、snapshot、廃止options拒否、modifiedAt、公開exports | P2 |
| 再現性 | STOREの0.6.0 golden、順序・日時・UTF-8 flag、同環境DEFLATE反復 | P2/P5 |
| ZIP入力 | 既存DOCX/XLSX fixture、descriptor、directory、extra、comment、空ZIP | P3 |
| 破損／未対応 | 切断、偽EOCD、無効offset、重なり、header不一致、サイズ／CRC不一致、重複、invalid UTF-8、method、ZIP64、暗号化、複数disk | P3 |
| 予算 | 各limitの境界、0、小さいoverride、宣言値／実出力両方、後続展開を始めない | P3 |
| 中断 | 開始前、圧縮／展開途中、待機中read、listener解放、元のエラー保持 | P1/P3 |
| Office | ZIP失敗時entries空・不要なOPC warningなし、正常時の既存OPC結果 | P3 |
| 型／成果物 | 3点だけでimportと型解決、Node型なし、distとのAPI一致、stage digest | P4 |
| 実環境 | 3browserのESM・offline IIFE・Worker、Nodeとの相互読込、Python独立検査 | P5 |

## 8. 記録と次の実装指示

2026-11-04の計画ターンでは調査と計画書作成のみを行った。
2026-11-05の実装ターンでP1〜P6、依存追加、テスト、bundle、型定義、
version更新、実ブラウザー検証を完了した。

- [x] P1: 標準Streams、内部エラー、0.6.0 STORE golden。
- [x] P2: 公開ZIP／Office API非同期化とcore呼出元のawait移行。
- [x] P3: ZIP32検証、処理量上限、中断、破損時の全件破棄。
- [x] P4: neutral ESM、`.d.mts`生成、DOM／Worker型検証、ローカルstage。
- [x] P5: Node22/24 CI、Node24 release-browser gate、3実ブラウザー受入。
- [x] P6: API資料、1.0.0 package/lock、最終検証と状態記録。

### 実装・検証記録 (2026-11-05)

- `npm test`: Vitest 4.1.12、12ファイル／43 tests passed（自己レビュー修正後）。
- `npm run build:all`、`npm run test:types`、`npm run smoke:bundle` passed。
- `npm run verify:staged-assets` passed。ESM・source map・declarationの
  版付き名とSHA-256は`docs/completion-audit.md`に記録。
- `npm run test:browser`: Playwright 1.64.1、9 tests passed。Node 26.12.1、
  macOS 27.0.1 arm64、Chromium 156.0.8078.4、Firefox 157.0、WebKit 27.2。
- Node22/24はCI matrixへ設定。ローカル検証を実行したNode版は26.12.1。
- `npm audit`、`npm pack --dry-run`、`git diff --check`を最終gateとして実行。
- 実製品、#10、commit、push、tag、Release upload、Issue書込は対象外で未実施。

自己レビューで発見した4点も修正し、回帰テストを追加した。宣言量は全entryを展開前に
検査し、実出力はentry上限と残り合計予算をchunk保存前に検査する。宣言サイズ超過も
最初の該当chunkで止め、同時超過ならlimitを優先する。書込は最終awaitの直後にも中断を
確認する。通常版とdot suffix版のstage／型／IIFE生成を自動テストし、実ブラウザーも
`v1.0.0.1`の自動版選択と`TAG_NAME=v1.0.0`の明示版指定で各9件を確認した。

その後、利用者の指定によりpackage.jsonとpackage-lock.jsonのroot versionを
0.8.0へ訂正した。1.0.0は計画上の初期提案であり、利用者が指定したversionではない。
`npm version 0.8.0 --no-git-tag-version`でpackageとlockのversionを更新し、
0.8.0のbuild、型検証、版付きstage検証、package dry-runを実施した。
現行stageのdigestは`docs/completion-audit.md`のVersion Correction節に記録する。

Lunaへ渡す最初の指示例（この文章自体は今回の実装許可ではない）:

> `docs/zip-browser-api-plan.md`のP1を実装してください。まず1〜4章とP1を読み、
> このrepoのbranch・差分・版を確認してください。P1の変更とgateを完了し、
> TODO/HANDOFFへ結果、未完了事項、次のP番号を記録してください。
> 指定外のカード、実製品、#10、commitや公開操作へ進まないでください。

各カードの終了記録には変更ファイル、実行commandと結果、artifactの版／digest、
未完了gateを記す。環境制約で未実行の場合は成功扱いにしない。

## 9. 技術資料

- [Compression Standard](https://compression.spec.whatwg.org/#supported-formats): ZIP用のraw形式と標準API。
- [Node22 Web Streams](https://nodejs.org/docs/latest-v22.x/api/webstreams.html#new-compressionstreamformat): Node側の標準API対応。
- [PKWARE APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT): ZIPフィールド解釈の参照先。
- [Playwright](https://playwright.dev/docs/test-configuration): browser projectと検証serverの設定。
- [DTS Bundle Generator](https://github.com/timocov/dts-bundle-generator): ソースからの単一型生成。
