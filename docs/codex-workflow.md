# 開発・デバッグ runbook

この文書は、変更の種類ごとに**最小の確認で止める**ための実行runbookです。作業契約は `AGENTS.md`、入口ファイルは `CODEBASE_GUIDE.md`、現在地は `PROGRESS.md` を参照します。

## まず選ぶ確認先

| 変更 / 症状 | 最初に読む | 最初の確認 | そこで止めてよい条件 |
| --- | --- | --- | --- |
| 見た目、文言、タップ、DOM | 対象UI / CSS | Browserで対象操作、console確認 | WebView内だけで完結し、崩れがない |
| 状態、保存、読込、インポート | `project-storage`、`storage/`、storage bridge | 新規作成 → 変更 → reload / 再読込 | 保存内容と復元値が一致する |
| 再生、音価、ループ | score builder、scheduler、audio bridge | Webで最小の再生/停止 | Web Audioだけの変更で、console errorなし |
| native再生、復帰、Share、Filesystem | bridge と `NativePlaybackPlugin.swift` | Simulator / 実機 | Webでは観測できない契約を確認済み |
| build、依存、公開設定 | `package.json`、Vite、workflow | `npm run build` | buildが成功し成果物に問題なし |
| 広いWeb回帰 | `tests/webkit-smoke.spec.js` | `npm run test:e2e:webkit` | 変更が既存フローへ波及しない |
| 配信成果物 | `package.json`、`playwright.config.js` | `npm run release:build && npm run test:e2e:webkit:preview` | `dist/`からUIの主要フローを確認済み |

WebKit smokeをUIの小変更ごとに実行しない。nativeの問題をWebKitで追わない。広い失敗を先に直そうとせず、再現できる最小操作を先に持つ。

## BrowserによるWeb確認

既定URLは [http://127.0.0.1:5173/](http://127.0.0.1:5173/) で固定する。ポートが毎回変わると、Browserが古い画面を開く・別のサーバーへ接続する原因になる。

### 通常の開き方

1. Codexの `Run` actionを一度だけ実行する。これは `npm run dev:codex` を呼び、`127.0.0.1:5173` を固定で使う。
2. 起動ログに `http://127.0.0.1:5173/` が出たことを確認する。別ポートのURLは使わない。
3. in-app Browserで上記URLを新規タブとして開く。画面が表示されるまで待ち、`#bootOverlay` が非表示になってから操作する。
4. 対象フローだけを操作し、見た目・タップ範囲・DOM状態・console errorを確認する。必要な時だけスクリーンショットを残す。

### 開けない時の復旧順

| 症状 | 行うこと | 行わないこと |
| --- | --- | --- |
| `5173` が使用中でRunが止まる | すでに起動しているRunを再利用する。不要な開発サーバーを終了してから、Runを一度だけやり直す | Viteに別ポートを自動選択させ、そのURLを使い続ける |
| Browserに古い画面が出る | URL欄を既定URLへ戻して再読込する。直らなければそのBrowserタブを閉じ、新規タブで既定URLを開く | 古いタブに対して何度も自動操作を再試行する |
| Browserがタブを作れない / 接続状態が失われた | in-app Browserを閉じてから開き直し、新規タブで既定URLを開く。それでも失敗する場合はCodexを再起動して同じ手順を最初から行う | Playwrightや別ブラウザへ勝手に切り替えて、in-app Browser確認済みと扱う |
| URLは開くが起動画面のまま | Runの最初のエラーとBrowser consoleだけを確認する。保存初期化が終わるまで待つ | 固定sleepを増やす、テストを先に書き換える |

sandboxで `listen EPERM` が出た時だけ、同じローカル開発サーバー / テストコマンドを権限付きで再実行する。Browser側で到達できるなら、terminalの`curl`失敗を追加調査しない。

## WebKitの失敗を最短で直す

1. `npm run test:e2e:webkit` を1回だけ実行する。
2. 最初の失敗だけを読み、該当行、`test-results/**/error-context.md`、screenshot、consoleを確認する。
3. 原因を次のどれかへ分類する。
   - 実装回帰: 仕様をコードへ戻し、局所確認後にsmokeを再実行
   - UI契約変更: 現在の製品仕様を確認してからテストのselector / expectationを更新
   - 非同期準備不足: 意味のあるready条件（boot完了、保存完了、画面遷移完了）を待つ
   - 環境失敗: ポート、browser binary、権限を切り分け、テスト自体は書き換えない
4. 固定sleep、無条件`force`、失敗を隠すskipを最初の解決策にしない。

Playwrightを直接操作する時は `playwright` skillを使い、snapshotを取得してから要素を参照する。既存の `@playwright/test` は回帰確認に使い、単発の画面調査には増やさない。

## iOS / native確認

- web assetsを変えた: `npm run mobile:sync:ios`
- Simulatorでの確認が必要: `npm run mobile:run:ios:sim` またはXcodeBuildMCP
- 実機固有（音、割り込み、silent switch、Share、権限、background）は実機で確認

Simulatorの画面だけでaudio sessionやShare sheetを正常と判断しない。native失敗時はJS側のscore / payloadとSwift pluginの入力を同じ時点で比較する。

## Codex actions とスクリプト

`.codex/environments/environment.toml` がCodex app actionの正本。似たnpm aliasを増やさず、次の入口を使う。

- `Run`: Webの局所確認
- `Build`: Vite / import / production artifactの確認
- `WebKit Smoke`: dev server上の全Web回帰（dev sourceを直接検証するケースを含む）
- `Web Release Check` / `Web Release Smoke`: build済み`dist/`の公開前確認
- `iOS Sync` / `iOS Simulator`: native確認が必要な時だけ
- `Mobile Doctor`: 開発環境やバージョン不一致の診断

## サブエージェントの使い分け

| 作業 | 担当を分けてよい | 親担当が保持するもの |
| --- | --- | --- |
| 調査 + 実装 | 調査をread-only、実装を対象ファイル限定 | 仮説、最終差分、確認 |
| Web + native | JS/Web確認とSwift/Simulator確認 | bridge契約、最終実機判断 |
| 複数独立バグ | ファイル責務が分かれるものだけ | 優先順位、競合解消、release判断 |

同じファイルを触る複数担当、同じ症状に対する並列の当てずっぽうな修正、未読のskill指示を子担当へ丸投げする運用は禁止する。

## 引き継ぎの完了条件

作業を終える時は `PROGRESS.md` に次を残す。

- 何を変更したか
- 何を確認し、結果がどうだったか
- 未検証の環境 / 再現条件
- 次に開くべきファイルまたは実行すべきコマンド

コードレビューや調査だけなら、変更しなかったことと根拠も記録する。
