# Mobile development

この文書は Capacitor / native 固有の運用だけを扱う。Web確認、WebKit、デバッグ手順は `docs/codex-workflow.md`、作業入口は `CODEBASE_GUIDE.md` を正本にする。

## 境界と正本

- アプリ本体、音楽データ、Web UI: `src/`
- Web / native の判定とbridge: `src/features/bridges/`
- iOS固有: `ios/App/App/`
- Android固有: `android/app/src/main/`
- `ios/App/App/public/`、`ios/App/App/capacitor.config.json`、`android/app/src/main/assets/public/`、`android/app/src/main/assets/capacitor*.json` はsync生成物。編集しない。

## 最短の選択

| 目的 | コマンド | いつ使うか |
| --- | --- | --- |
| Web変更をiOSへ反映 | `npm run mobile:sync:ios` | `src/`変更後、native確認の直前 |
| iOS Simulatorの完全確認 | `npm run mobile:run:ios:sim` | bridge、音、lifecycle、Shareを確認する時。sync・boot・build・install・launchを含むため高コスト |
| Androidへ反映 | `npm run mobile:sync:android` | Android固有確認の直前 |
| 環境・version確認 | `npm run mobile:doctor` | sync / build失敗、提出前 |

Webだけで判断できるUI変更に、syncやSimulatorを連鎖させない。native / bridgeの変更をWeb表示だけで完了扱いにしない。

## バージョン

- 正本は `package.json` の`version`。
- `npm run mobile:sync:ios` は `version:sync` を含み、iOS `MARKETING_VERSION`と同期する。
- `npm run mobile:doctor` でWeb / iOSの不一致を確認する。

## iOS

通常は `npm run mobile:sync:ios` の後に `npm run mobile:open:ios` または `npm run mobile:run:ios:sim` を使う。XcodeBuildMCPのdefaultsは `.xcodebuildmcp/config.yaml`（project `ios/App/App.xcodeproj`、scheme `App`、iPhone 17）を正本とする。

実機では、保存・再読込・再生・停止・ループ・試聴・silent switch・Share・復帰後の音を確認する。Simulatorは事前確認であり、audio sessionやShareの最終判断は実機で行う。

## Android

通常は `npm run mobile:sync:android` の後に `npm run mobile:open:android` を使う。Androidは現在native playback未実装で、Tone.js fallbackを前提とする。保存、Share、狭い画面のタップ領域を実機またはEmulatorで確認する。

## 詳細runbook

- iOS build / Archive / App Store: `docs/ios-build.md`
- Android build: `docs/android-build.md`
