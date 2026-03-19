# Android App Build

## 前提

- Android Studio
- Android SDK
- Node.js / npm

入口の運用ガイドは `docs/mobile-dev.md` を参照する。このファイルは Android の詳細 runbook として使う。

## 初回セットアップ

1. `npm install`
2. `npm run build`
3. `npx cap add android`

このリポジトリでは `android/` は生成済みなので、通常は `cap add` を再実行しなくてよい。

## 日常フロー

1. Web 側を修正する
2. `npm run mobile:sync:android`
3. `npm run mobile:open:android`
4. Android Studio で Emulator または実機を選んで Run

## npm scripts

- `npm run mobile:sync:android`
  - `vite build` と `cap sync android` を連続実行する
- `npm run mobile:open:android`
  - Android Studio プロジェクトを開く
- `npm run android:buildprep`
  - 旧 alias。内部では `mobile:sync:android` を呼ぶ

## このアプリで特に見る点

- `android/app/src/main/assets/public/` と `android/app/src/main/assets/capacitor*.json` は sync 生成物なので手編集しない
- 実機で音が鳴ること
- 保存と再読込が期待どおり動くこと
- share sheet で JSON を書き出せること
- 狭い画面でも preview / editor のタップ領域が崩れないこと
- Android は現在 native playback 未実装で、再生は Tone.js fallback 前提
