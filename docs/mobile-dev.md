# Mobile Dev Guide

## 最初に読むもの

1. `AGENTS.md`
2. `PROGRESS.md`
3. `CODEBASE_GUIDE.md`
4. このファイル

## Repo の境界

- `src/`
  - アプリ本体の正本
  - UI、作曲ロジック、保存データ、score 生成はここを編集する
- `ios/`
  - iOS ラッパーと native 固有実装
  - `NativePlaybackPlugin.swift` などの native コードだけを持つ
- `android/`
  - Android ラッパーと native 固有設定
- `src/features/bridges/`
  - Web と native の境界
  - iOS / Android 差分はここ経由で吸収する

## 生成物として扱うもの

- `ios/App/App/public/`
- `ios/App/App/capacitor.config.json`
- `android/app/src/main/assets/public/`
- `android/app/src/main/assets/capacitor.config.json`
- `android/app/src/main/assets/capacitor.plugins.json`
- `xcuserdata` と `xcuserstate`

これらは `cap sync` の生成物なので手編集しない。変更したい時は `src/` または native 固有ファイルを直してから `mobile:sync:*` を実行する。

## 日常フロー

### Codex app

1. `Run` action または `npm run dev -- --host 127.0.0.1` で dev server を起動する
2. in-app Browser / Browser plugin でローカル URL を開く
3. UI 変更時は Web 表示で十分なら対象画面を操作し、表示崩れ、コンソールエラー、スマホ幅の詰まりを確認する
4. 内部ロジック、保存 bridge、native 再生、share sheet など Web だけで判断できない変更は iOS Simulator で確認する
5. 必要に応じて `Build`、`WebKit Smoke`、`iOS Sync`、`iOS Simulator` action を使う

Codex app actions の定義は `.codex/environments/environment.toml` に置く。

### 確認先の選び方

確認は変更のリスクに見合う最小限にする。
手動確認や局所的なブラウザ確認で十分な時は、WebKit smoke や Simulator 起動まで広げない。

- UI の見た目、配置、文言、タップしやすさ:
  - Web / in-app Browser
- DOM に現れる JS 状態や通常の Web 操作:
  - Web / in-app Browser
- Web 回帰リスクがある変更:
  - 必要な時だけ WebKit smoke
- 保存の永続化、Capacitor bridge、iOS native 再生、共有、lifecycle:
  - iOS Simulator
- App Store 提出前の音、権限、共有、実機性能:
  - 実機

### iOS

1. `src/` または native 固有コードを編集する
2. `npm run mobile:sync:ios`
3. `npm run mobile:open:ios`
4. Xcode で実機または Simulator を選んで Run

### iOS Simulator on Mac

Codex から native iOS 画面を確認する時は、XcodeBuildMCP の session defaults を使う。
この repo では `.xcodebuildmcp/config.yaml` に以下を設定済み。

- project: `ios/App/App.xcodeproj`
- scheme: `App`
- configuration: `Debug`
- simulator: `iPhone 17`
- bundle id: `com.yamaoxiogo.compose`

通常の確認は次のどちらかを使う。

- Codex / XcodeBuildMCP: `build_run_sim`
- Terminal / Codex action: `npm run mobile:run:ios:sim`

`npm run mobile:run:ios:sim` は `mobile:sync:ios`、Simulator boot、Xcode build、install、launch をまとめて行う。
DerivedData は標準で `/tmp/compose-ios-sim-derived/` に置く。
別の simulator を使う場合は環境変数で指定する。

```sh
IOS_SIMULATOR_NAME="iPhone 17 Pro" npm run mobile:run:ios:sim
IOS_SIMULATOR_ID="650BD6F5-97D3-4370-84FB-72DC3C65999E" npm run mobile:run:ios:sim
IOS_DERIVED_DATA_PATH="/tmp/compose-ios-sim-derived" npm run mobile:run:ios:sim
```

### Android

1. `src/` または native 固有コードを編集する
2. `npm run mobile:sync:android`
3. `npm run mobile:open:android`
4. Android Studio で実機または Emulator を選んで Run

## 最小 acceptance flow

- `npm run build`
- UI だけの確認:
  - `Run` action または `npm run dev -- --host 127.0.0.1`
  - in-app Browser / Browser plugin
- 内部ロジックや native 絡みの確認:
  - `npm run mobile:run:ios:sim`

Android は同じ構成で追従するが、再生はまだ Tone.js fallback 前提。

## トラブルシュート

- 環境確認:
  - `npm run mobile:doctor`
- iOS の詳細 runbook:
  - `docs/ios-build.md`
- Android の詳細 runbook:
  - `docs/android-build.md`
- WebKit smoke:
  - `npm run test:e2e:webkit`
