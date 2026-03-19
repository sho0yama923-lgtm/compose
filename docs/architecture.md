# architecture.md

## 現在の構成方針

- `src/`
  - アプリ本体の唯一の正本
  - UI、作曲ロジック、保存データ、score 生成を持つ
- `capacitor.config.json`
  - Web ビルド成果物 `dist/` を iOS ラッパーへ渡す設定
- `ios/`
  - Capacitor が管理するネイティブ側プロジェクト
  - ラッパーと native 固有コードだけを持つ
- `android/`
  - Capacitor が管理するネイティブ側プロジェクト
  - ラッパーと native 固有設定だけを持つ
- `src/main.js`
  - アプリ初期化だけを担当する
- `src/core/`
  - 共有状態、定数、duration処理、リズム変換のような低レベル共通ロジック
- `src/editors/`
  - ドラム、メロディ、コード、プレビューの描画
- `src/features/`
  - 再生、保存、トラック管理のような振る舞い単位のロジック
- `src/features/bridges/`
  - audio / storage / file-share / device のネイティブ境界
  - audio は iOS で native plugin、Web / Android で Tone.js fallback を使い分ける
- `src/ui/`
  - サイドバー、モーダル、トップバー補助、下部シークバーなどアプリ外枠の UI
- `src/styles/`
  - 現状は `editor.css` に集約。将来 `base/layout/components/mobile` に分割予定

## 依存方向

- `main -> ui/editors/features -> core`
- `editors -> core`
- `features -> core`
- `ui -> features/core`

## 再生アーキテクチャ

- `playback-controller.js`
  - トラック状態から step 配列の score を構築する
- `score-serializer.js`
  - step 配列を native plugin 向け `events[]` payload と音源 manifest へ正規化する
- `audio-bridge.js`
  - iOS 実機では `NativePlaybackPlugin.swift` を呼び、Web / Android では `scheduler.js` へフォールバックする
- `scheduler.js`
  - browser fallback として Tone.js 再生を維持する

## スマホ開発運用

- `ios/App/App/public/` と `android/app/src/main/assets/public/` は `cap sync` の生成物
- `xcuserdata` と `xcuserstate` は個人依存ファイルとして管理対象外
- 日常運用は `npm run mobile:sync:ios` または `npm run mobile:sync:android` を入口にする

## 近いうちにやる整理

- `src/styles/editor.css` を `base/layout/components/mobile/editor` に分割

## 今はやらないこと

- `shared/` ディレクトリの追加
- save/load のファイル分割
- 機能追加を伴う構成変更
