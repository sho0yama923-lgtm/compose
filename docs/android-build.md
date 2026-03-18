# Android App Build

## 前提

- Android Studio
- Android SDK
- Node.js / npm

## 初回セットアップ

1. `npm install`
2. `npm run build:android-web`
3. `npx cap add android`

このリポジトリでは `android/` は生成済みなので、通常は `cap add` を再実行しなくてよい。

## 日常フロー

1. Web 側を修正する
2. `npm run android:buildprep`
3. `npm run android:open`
4. Android Studio で Emulator または実機を選んで Run

## npm scripts

- `npm run build:android-web`
  - `vite build` で `dist/` を更新する
- `npm run android:sync`
  - `dist/` を `android/` 側へ反映する
- `npm run android:open`
  - Android Studio プロジェクトを開く
- `npm run android:buildprep`
  - `build:android-web` と `android:sync` を連続実行する

## このアプリで特に見る点

- 実機で音が鳴ること
- 保存と再読込が期待どおり動くこと
- share sheet で JSON を書き出せること
- 狭い画面でも preview / editor のタップ領域が崩れないこと
