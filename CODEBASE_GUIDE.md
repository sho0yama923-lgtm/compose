# CODEBASE_GUIDE.md

このファイルは「何を変更したい時に、どのファイルから読むべきか」をまとめたガイドです。

## 最初に読むファイル

1. `PROGRESS.md`
2. `src/main.js`
3. 変更対象に対応する以下のファイル

## ディレクトリ構成

### アプリ外枠

- `index.html`
  - 画面の土台
- `src/main.js`
  - 起動順序、初期化、保存フック、初回トラック生成
- `capacitor.config.json`
  - iOS ラッパーの基本設定
  - `webDir` は `dist` を参照する
- `ios/`
  - Capacitor が生成する Xcode プロジェクト
  - `npm run ios:buildprep` 後に Xcode で開いてビルドする
  - `ios/App/App/NativePlaybackPlugin.swift` に iOS 実機向けの native 再生 plugin を置く
- `android/`
  - Capacitor が生成する Android Studio プロジェクト
  - `npm run android:buildprep` 後に Android Studio で開いてビルドする
- `docs/ios-build.md`
  - iPhone アプリ向けのセットアップ手順と日常フロー
- `docs/android-build.md`
  - Android アプリ向けのセットアップ手順と日常フロー
- `playwright.config.js`
  - WebKit の E2E 起動設定
  - `npm run dev -- --host 127.0.0.1 --port 41234` で固定ポート起動する
- `src/styles/editor.css`
  - CSS の入口ファイル
  - 実体は `@import` で `src/styles/base/` `src/styles/components/` `src/styles/editors/` へ分割済み

### core

- `src/core/state.js`
  - 共有状態
  - 何かを「選択状態として覚える」時はここを見る
  - 全体エディタの繰り返し参照トラックは `lastTouchedTrackId` を使う
- `src/core/constants.js`
  - 音価、音名、コード定義、色定義
  - 音価や理論定義を増やす時はここ
- `src/core/music-theory.js`
  - スケール音、コード構成音の計算
  - スケール追加や音階ハイライトの基準変更はここ
- `src/core/duration.js`
  - ノート配置、削除、tie 処理
  - 音符の置き方や上書きルールを変える時はここ
- `src/core/rhythm-grid.js`
  - 通常/3連の表示分割と内部48ステップの変換
  - グリッド本数、強調単位、クリック位置変換を変える時はここ

### editors

- `src/editors/editor-router.js`
  - どのエディタを描くかの振り分け
  - 画面切替や下部シークバーを変える時はここ
- `src/editors/duration-toolbar.js`
  - `通常 / 3連` と音価ボタン
  - 音価UIや表示ルールを変える時はここ
- `src/editors/drum-editor.js`
  - ドラムエディタ描画
- `src/editors/melodic-editor.js`
  - ピアノロール描画
  - 音程、オクターブ、ノート配置のUIを変える時はここ
- `src/editors/chord-editor.js`
  - コードエディタの公開入口ファサード
  - 実体は `src/editors/chord/` に分割
- `src/editors/preview-editor.js`
  - 全体プレビューの公開入口ファサード
  - 実体は `src/editors/preview/` に分割

### editors の分割先

- `src/editors/chord/render-chord-editor.js`
  - コード画面の組み立て入口
- `src/editors/chord/chord-progress-section.js`
  - コード進行グリッド
- `src/editors/chord/chord-timing-section.js`
  - 発音タイミンググリッド
- `src/editors/chord/chord-detail-sheet.js`
  - コード詳細シート
- `src/editors/chord/chord-drum-reference-sheet.js`
  - ドラム参照シート
- `src/editors/preview/render-preview.js`
  - 全体プレビューの組み立て入口
- `src/editors/preview/preview-row.js`
  - 各トラックカード描画
- `src/editors/preview/preview-actions.js`
  - アクションメニュー、長押し制御
- `src/editors/preview/preview-repeat.js`
  - 繰り返し範囲UI
- `src/editors/preview/preview-tone-sheet.js`
  - 音作りシート / EQ UI
- `src/editors/preview/preview-song-settings.js`
  - 楽曲設定カード
- `src/editors/preview/preview-shared.js`
  - スクロール復元や共通ヘルパ

### features

- `src/features/playback/playback-controller.js`
  - 各トラックを再生用スコアへ変換
  - 再生ボタン、再生範囲、playhead 更新を変える時はここ
  - 将来のトラックEQ追加では event に `trackId` を流す入口になる
- `src/features/playback/score-serializer.js`
  - step 配列の score を native plugin 向け payload と音源 manifest に正規化する
  - iOS / Android の native 再生へ渡す契約を変える時はここ
- `src/features/playback/scheduler.js`
  - Tone.js への実送出
  - タイミングや Tone.js 側の鳴らし方を変える時はここ
  - EQ やエフェクトを実際に挿すならここ
- `src/features/bridges/`
  - audio / storage / file-share / device の抽象境界
  - Web fallback とネイティブ導線を分けたい時はここ
- `src/features/project/project-storage.js`
  - 保存機能の公開入口ファサード
  - 実体は `src/features/project/storage/` に分割
- `src/features/tracks/tracks-controller.js`
  - トラック管理の公開入口ファサード
  - 実体は `src/features/tracks/controller/` に分割
- `src/features/tracks/instrument-map.js`
  - 楽器/再生定義の公開入口ファサード
  - 実体は `src/features/tracks/instruments/` に分割

### features の分割先

- `src/features/project/storage/storage-helpers.js`
  - migrate / normalize / restore の純粋寄りロジック
- `src/features/project/storage/storage-core.js`
  - save/load/import/export/reset と UI フック
- `src/features/tracks/controller/track-selection.js`
  - トラック選択、追加、削除
- `src/features/tracks/controller/track-measures.js`
  - 小節追加、削除、クリア
- `src/features/tracks/controller/track-repeat.js`
  - copy / paste / repeat / repeat 同期
- `src/features/tracks/instruments/instrument-config.js`
  - 楽器カタログ、表示名、URL解決
- `src/features/tracks/instruments/track-tone.js`
  - EQ / tone の正規化と既定値
- `src/features/tracks/instruments/playback-chains.js`
  - Tone.js 再生チェーン管理

### ui

- `src/ui/topbar.js`
  - トップバータイトル更新
- `src/ui/bottom-bar.js`
  - 下部小節シークバーと `始/終` UI
- `src/ui/track-drawer.js`
  - サイドバー開閉とトラック一覧
- `src/ui/instrument-modal.js`
  - 楽器選択モーダル

### tests

- `tests/webkit-smoke.spec.js`
  - iPhone 幅の WebKit で起動確認する最小スモークテスト

## 変更内容ごとの入口

### 1. 音価を増やしたい

- `src/core/constants.js`
- `src/core/duration.js`
- `src/editors/duration-toolbar.js`
- 必要なら `src/features/playback/playback-controller.js`

### 2. 通常/3連の見た目や線の本数を変えたい

- `src/core/rhythm-grid.js`
- `src/styles/editor.css`
- `src/styles/editors/melodic.css`
- `src/styles/editors/drum.css`
- `src/styles/editors/chord.css`
- 必要なら `src/editors/melodic-editor.js`
- 必要なら `src/editors/drum-editor.js`
- 必要なら `src/editors/chord/`

### 3. ノートのクリック判定や配置方法を変えたい

- `src/core/duration.js`
- 対象エディタ
  - `src/editors/melodic-editor.js`
  - `src/editors/drum-editor.js`
  - `src/editors/chord-editor.js`

### 4. 保存される内容を変えたい

- `src/features/project/project-storage.js`
- `src/core/state.js`
- 既存データ互換が必要なら移行処理も同時に更新

### 5. スケールを増やしたい

- `src/core/constants.js`
- `src/core/music-theory.js`
- `src/editors/preview/preview-song-settings.js`
- `src/editors/melodic-editor.js`
- `src/features/project/project-storage.js`

### 6. 再生タイミングや音の出し方を変えたい

- `src/features/playback/playback-controller.js`
- `src/features/playback/score-serializer.js`
- `src/features/playback/scheduler.js`
- `ios/App/App/NativePlaybackPlugin.swift`
- `src/core/rhythm-grid.js`
- エフェクト追加なら `src/features/tracks/instrument-map.js` も読む

### 7. 繰り返しUIや繰り返し反映ルールを変えたい

- `src/editors/preview/preview-repeat.js`
- `src/ui/bottom-bar.js`
- `src/core/state.js`
- `src/features/tracks/controller/track-repeat.js`
- `src/features/project/project-storage.js`

### 8. トラックの追加・初期値を変えたい

- `src/features/tracks/tracks-controller.js`
- `src/features/tracks/instrument-map.js`
- `src/core/state.js`

### 9. Safari / WebKit で画面確認したい

- `playwright.config.js`
- `tests/webkit-smoke.spec.js`
- `start.command`

### 10. iPhone アプリとしてビルドしたい

- `capacitor.config.json`
- `package.json`
- `ios/`
- `npm run build:ios-web`
- `npm run ios:sync`
- `npm run ios:open`

### 11. Android アプリとしてビルドしたい

- `capacitor.config.json`
- `package.json`
- `android/`
- `npm run build:android-web`
- `npm run android:sync`
- `npm run android:open`

## 読み方のコツ

- まず `src/main.js` で起動順を確認する
- 次に対象機能の state と描画ファイルを読む
- 最後に `src/features/project/project-storage.js` を見て、保存互換を壊していないか確認する
- 全体エディタ起点の変更は `src/editors/preview/render-preview.js` と `src/ui/bottom-bar.js` をセットで読むと早い
- コード画面の変更は `src/editors/chord/render-chord-editor.js` から辿ると責務を見失いにくい

## 更新ルール

- 構成を変えたらこのファイルも更新する
- 新しい主要ファイルを増やしたら「変更内容ごとの入口」に追記する
