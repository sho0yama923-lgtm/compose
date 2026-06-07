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
- `General` の Bundle Identifier が `com.yamaoxiogo.compose` で、App Store Connect の登録と一致していること
- `General` の Version / Build が提出予定の値になっていること
- iPhone Simulator で起動すること
- 実機で音が鳴ること
- 保存と再読込が期待どおり動くこと
- `PrivacyInfo.xcprivacy` が App target の Resources に含まれ、archive 後の `.app/PrivacyInfo.xcprivacy` に入ること

## App Store 提出前チェック

1. `npm run mobile:doctor`
2. `npm run mobile:sync:ios`
3. Xcode で `Any iOS Device` または実機を選び、`Product > Archive`
4. Organizer で Validate App を通す
5. App Store Connect の Privacy Nutrition Labels と `ios/App/PrivacyInfo.xcprivacy` の内容を一致させる

現在の privacy manifest は、追跡なし、収集データなし、required reason API は file timestamp の `C617.1` として管理する。
アプリ機能や SDK を増やしてデータ収集、UserDefaults、Disk Space、System Boot Time などの required reason API が増えた場合は、`ios/App/PrivacyInfo.xcprivacy` も更新する。

## iOS 実機 acceptance flow

- 新規プロジェクト作成後に保存できること
- 保存済みプロジェクトを再読込できること
- ドラム、コード、メロディをそれぞれ追加、編集、削除できること
- 再生、停止、ループ、試聴が安定して動くこと
- サイレントスイッチ ON でも音が鳴ること
- 共有操作が iOS share sheet まで到達すること
- アプリを終了して再起動しても保存済み状態が復元されること

## このアプリで特に見る点

- `ios/App/App/public/` と `ios/App/App/capacitor.config.json` は sync 生成物なので手編集しない
- `Tone.js` の再生開始が iOS でブロックされないこと
- `AppDelegate.swift` で `AVAudioSession` を `.playback` にしているため、サイレントスイッチ時も再生できること
- `capacitor.config.json` では iOS の配信用 URL を `http://localhost` にして、サンプル音源の読込失敗を避ける
- サイレントモードやオーディオセッション時の挙動
- 狭い画面でタップ操作が詰まりすぎないこと
- 長時間再生時に操作や音が不安定にならないこと
