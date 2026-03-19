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

### iOS

1. `src/` または native 固有コードを編集する
2. `npm run mobile:sync:ios`
3. `npm run mobile:open:ios`
4. Xcode で実機または Simulator を選んで Run

### Android

1. `src/` または native 固有コードを編集する
2. `npm run mobile:sync:android`
3. `npm run mobile:open:android`
4. Android Studio で実機または Emulator を選んで Run

## 最小 acceptance flow

- `npm run build`
- `npm run mobile:sync:ios`
- Xcode で Run

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
