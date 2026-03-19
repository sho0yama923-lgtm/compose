# iPhone App Build

## 前提

- macOS
- Xcode
- Node.js / npm
- App Store 提出時は Apple Developer Program

入口の運用ガイドは `docs/mobile-dev.md` を参照する。このファイルは iOS の詳細 runbook として使う。

## 初回セットアップ

1. `npm install`
2. `npm run build`
3. `npx cap add ios`

このリポジトリでは `ios/` は生成済みなので、通常は `cap add` を再実行しなくてよい。

## 日常フロー

1. Web 側を修正する
2. `npm run mobile:sync:ios`
3. `npm run mobile:open:ios`
4. Xcode で Simulator または実機を選んで Run

## npm scripts

- `npm run mobile:sync:ios`
  - `vite build` と `cap sync ios` を連続実行する
- `npm run mobile:open:ios`
  - Xcode プロジェクトを開く
- `npm run ios:buildprep`
  - 旧 alias。内部では `mobile:sync:ios` を呼ぶ

## Xcode で確認すること

- `Signing & Capabilities` の Team 設定
- iPhone Simulator で起動すること
- 実機で音が鳴ること
- 保存と再読込が期待どおり動くこと

## このアプリで特に見る点

- `ios/App/App/public/` と `ios/App/App/capacitor.config.json` は sync 生成物なので手編集しない
- `Tone.js` の再生開始が iOS でブロックされないこと
- `AppDelegate.swift` で `AVAudioSession` を `.playback` にしているため、サイレントスイッチ時も再生できること
- `capacitor.config.json` では iOS の配信用 URL を `http://localhost` にして、サンプル音源の読込失敗を避ける
- サイレントモードやオーディオセッション時の挙動
- 狭い画面でタップ操作が詰まりすぎないこと
- 長時間再生時に操作や音が不安定にならないこと
