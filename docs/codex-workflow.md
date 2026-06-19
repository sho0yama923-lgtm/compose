# Codex Workflow

このリポジトリは Codex app / GPT-5.5 前提で、実装、確認、iOS リリース準備を同じスレッド内で進めやすい形にする。

## Project Actions

Codex app の action は `.codex/environments/environment.toml` で共有する。

- `Run`: Vite dev server を `127.0.0.1` で起動する
- `Build`: Web build を確認する
- `WebKit Smoke`: 既存 Playwright smoke を実行する
- `iOS Sync`: Web build 後に Capacitor iOS sync を実行する
- `iOS Simulator`: iPhone Simulator を boot し、iOS app を build / install / launch する
- `Mobile Doctor`: Node / Capacitor / Xcode などの環境を確認する

## UI 確認

UI 変更後は、Web 表示で十分に判断できる限り Codex app の in-app Browser / Browser plugin を使う。

既定URLは `http://127.0.0.1:5173/` とする。ユーザーが「ブラウザで開いて」とだけ言った場合は、まずこのURLを開く。

1. 既存の dev server が動いていれば、そのまま in-app Browser / Browser plugin で `http://127.0.0.1:5173/` を開く
2. dev server が動いていなければ、`Run` action または `npm run dev -- --host 127.0.0.1` で起動してから同じURLを開く
3. `#bootOverlay` が非表示になり、初期化が終わってから対象画面を操作する
4. 表示崩れ、タップしづらさ、コンソールエラーを確認する
5. 必要なら Browser annotation やスクリーンショットで対象箇所を絞る

サンドボックス内で dev server 起動が `listen EPERM` になった場合は、ローカル表示に必要なポート待ち受けとして同じ `npm run dev -- --host 127.0.0.1` を権限付きで再実行する。
Browser plugin は一度接続済みのスレッドでは再調査せず、既存タブまたは新規タブを `http://127.0.0.1:5173/` へ移動する。
Codex の terminal sandbox から `curl http://127.0.0.1:5173/` が失敗しても、in-app Browser から到達できる場合がある。ローカル表示確認の正本は Browser plugin 側の表示・DOM・コンソール確認とする。

認証が必要な外部サイトや通常ブラウザの profile が必要な確認は、in-app Browser ではなく通常ブラウザまたは Chrome extension を使う。

## 確認先の選び方

確認は変更のリスクに見合う最小限から始める。
複雑な自動テストや広い smoke は、手動確認や局所的なブラウザ確認だけでは不安が残る時に使う。

- 見た目、余白、配置、文言、WebView 内で完結する UI 操作:
  - in-app Browser / Browser plugin
- pure JS の軽い状態変化や DOM に現れる保存済み表示:
  - in-app Browser / Browser plugin
- WebKit smoke:
  - Web 回帰リスクがある時だけ使い、iOS 内部ロジックや native 挙動の代替にはしない
- 保存 bridge、Capacitor Filesystem / Share、native audio、AVAudioSession、iOS の lifecycle、Simulator 上の WebView 挙動:
  - iOS Simulator / XcodeBuildMCP
- App Store 提出前や実機固有の権限、音、共有、バックグラウンド挙動:
  - 実機を優先し、Simulator は事前確認として使う

## iOS 確認

Web UI は in-app Browser で早く確認し、内部ロジックや native に依存する挙動は XcodeBuildMCP / Xcode / 実機で確認する。

Codex 内で Simulator 確認をする時は、まず `npm run mobile:sync:ios` で web assets を同期し、XcodeBuildMCP の `build_run_sim` を使う。
通常のターミナルや Codex app action からまとめて実行する場合は `npm run mobile:run:ios:sim` を使う。
XcodeBuildMCP defaults は `.xcodebuildmcp/config.yaml` を参照する。

## Appshots

Xcode、Simulator、設定画面など、Codex の通常ツールだけでは状態を伝えづらい時は Appshots を使う。
スクリーンショットに秘密情報が含まれないか確認してから共有する。
