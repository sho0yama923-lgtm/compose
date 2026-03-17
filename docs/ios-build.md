# iPhone App Build

## 前提

- macOS
- Xcode
- Node.js / npm
- App Store 提出時は Apple Developer Program

## 初回セットアップ

1. `npm install`
2. `npm run build:ios-web`
3. `npx cap add ios`

このリポジトリでは `ios/` は生成済みなので、通常は `cap add` を再実行しなくてよい。

## 日常フロー

1. Web 側を修正する
2. `npm run ios:buildprep`
3. `npm run ios:open`
4. Xcode で Simulator または実機を選んで Run

## npm scripts

- `npm run build:ios-web`
  - `vite build` で `dist/` を更新する
- `npm run ios:sync`
  - `dist/` を `ios/` 側へ反映する
- `npm run ios:open`
  - Xcode プロジェクトを開く
- `npm run ios:buildprep`
  - `build:ios-web` と `ios:sync` を連続実行する

## Xcode で確認すること

- `Signing & Capabilities` の Team 設定
- iPhone Simulator で起動すること
- 実機で音が鳴ること
- 保存と再読込が期待どおり動くこと

## このアプリで特に見る点

- `Tone.js` の再生開始が iOS でブロックされないこと
- `AppDelegate.swift` で `AVAudioSession` を `.playback` にしているため、サイレントスイッチ時も再生できること
- `capacitor.config.json` では iOS の配信用 URL を `http://localhost` にして、サンプル音源の読込失敗を避ける
- サイレントモードやオーディオセッション時の挙動
- 狭い画面でタップ操作が詰まりすぎないこと
- 長時間再生時に操作や音が不安定にならないこと
