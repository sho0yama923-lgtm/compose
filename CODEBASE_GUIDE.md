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
- `playwright.config.js`
  - WebKit の E2E 起動設定
  - `PORT=41234 python3 ./dev-server.py` で静的サーバーを固定ポート起動する
- `src/styles/editor.css`
  - いまの表示ルールを集約した CSS

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
  - コード進行と発音タイミングのUI
- `src/editors/preview-editor.js`
  - 全体プレビュー
  - `Key / Scale`、カード内の `発音 / 音量`、繰り返しUIはここ

### features

- `src/features/playback/playback-controller.js`
  - 各トラックを再生用スコアへ変換
  - 再生ボタン、再生範囲、playhead 更新を変える時はここ
  - 将来のトラックEQ追加では event に `trackId` を流す入口になる
- `src/features/playback/scheduler.js`
  - Tone.js への実送出
  - タイミングや Tone.js 側の鳴らし方を変える時はここ
  - EQ やエフェクトを実際に挿すならここ
- `src/features/project/project-storage.js`
  - localStorage、JSON保存、読込、データ移行
  - 保存項目を増やす時はここ
- `src/features/tracks/tracks-controller.js`
  - トラック追加削除、小節数変更、初期データ生成
  - 繰り返しの実データ反映と source→target 同期もここ
- `src/features/tracks/instrument-map.js`
  - 楽器定義、サンプル、Sampler 生成
  - 将来トラック単位の再生チェーンを持たせるならここを読む

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
- 必要なら `src/editors/melodic-editor.js`
- 必要なら `src/editors/drum-editor.js`
- 必要なら `src/editors/chord-editor.js`

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
- `src/editors/preview-editor.js`
- `src/editors/melodic-editor.js`
- `src/features/project/project-storage.js`

### 6. 再生タイミングや音の出し方を変えたい

- `src/features/playback/playback-controller.js`
- `src/features/playback/scheduler.js`
- `src/core/rhythm-grid.js`
- エフェクト追加なら `src/features/tracks/instrument-map.js` も読む

### 7. 繰り返しUIや繰り返し反映ルールを変えたい

- `src/editors/preview-editor.js`
- `src/ui/bottom-bar.js`
- `src/core/state.js`
- `src/features/tracks/tracks-controller.js`
- `src/features/project/project-storage.js`

### 8. トラックの追加・初期値を変えたい

- `src/features/tracks/tracks-controller.js`
- `src/features/tracks/instrument-map.js`
- `src/core/state.js`

### 9. Safari / WebKit で画面確認したい

- `playwright.config.js`
- `tests/webkit-smoke.spec.js`
- `dev-server.py`

## 読み方のコツ

- まず `src/main.js` で起動順を確認する
- 次に対象機能の state と描画ファイルを読む
- 最後に `src/features/project/project-storage.js` を見て、保存互換を壊していないか確認する
- 全体エディタ起点の変更は `src/editors/preview-editor.js` と `src/ui/bottom-bar.js` をセットで読むと早い

## 更新ルール

- 構成を変えたらこのファイルも更新する
- 新しい主要ファイルを増やしたら「変更内容ごとの入口」に追記する
