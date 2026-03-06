# CODEBASE_GUIDE.md

このファイルは「何を変更したい時に、どのファイルから読むべきか」をまとめたガイドです。

## 最初に読むファイル

1. `PROGRESS.md`
2. `app.js`
3. 変更対象に対応する以下のファイル

## ディレクトリ構成

### アプリ外枠

- `app.js`
  - 起動順序、初期化、保存フック、初回トラック生成
- `index.html`
  - 画面の土台
- `style.css`
  - すべての表示ルール

### core

- `core/state.js`
  - 共有状態
  - 何かを「選択状態として覚える」時はここを見る
- `core/constants.js`
  - 音価、音名、コード定義、色定義
  - 音価や理論定義を増やす時はここ
- `core/duration-utils.js`
  - ノート配置、削除、tie処理
  - 音符の置き方や上書きルールを変える時はここ
- `core/rhythm-grid.js`
  - 通常/3連の表示分割と内部48ステップの変換
  - グリッド本数、強調単位、クリック位置変換を変える時はここ

### editors

- `editors/editor-router.js`
  - どのエディタを描くかの振り分け
  - 画面切替や下部シークバーを変える時はここ
- `editors/duration-toolbar.js`
  - `通常 / 3連` と音価ボタン
  - 音価UIや表示ルールを変える時はここ
- `editors/editor-drum.js`
  - ドラムエディタ描画
- `editors/editor-melodic.js`
  - ピアノロール描画
  - 音程、オクターブ、ノート配置のUIを変える時はここ
- `editors/editor-chord.js`
  - コード範囲と発音配置
- `editors/editor-preview.js`
  - 全体プレビュー

### 再生と保存

- `playback.js`
  - 各トラックを再生用スコアへ変換
  - どのステップで何を鳴らすかを変える時はここ
- `player.js`
  - Tone.js への実送出
  - タイミングやTone.js側の鳴らし方を変える時はここ
- `save-load.js`
  - localStorage、JSON保存、読込、データ移行
  - 保存項目を増やす時はここ

### UI補助

- `sidebar.js`
  - トラック一覧
- `track-manager.js`
  - トラック追加削除、小節数変更、初期データ生成
- `modal.js`
  - 楽器選択モーダル
- `swipe.js`
  - スワイプでの小節移動
- `instruments.js`
  - 楽器定義、サンプル、Sampler生成

## 変更内容ごとの入口

### 1. 音価を増やしたい

- `core/constants.js`
- `core/duration-utils.js`
- `editors/duration-toolbar.js`
- 必要なら `playback.js`

### 2. 通常/3連の見た目や線の本数を変えたい

- `core/rhythm-grid.js`
- `style.css`
- 必要なら `editors/editor-melodic.js`
- 必要なら `editors/editor-drum.js`
- 必要なら `editors/editor-chord.js`

### 3. ノートのクリック判定や配置方法を変えたい

- `core/duration-utils.js`
- 対象エディタ
  - `editors/editor-melodic.js`
  - `editors/editor-drum.js`
  - `editors/editor-chord.js`

### 4. 保存される内容を変えたい

- `save-load.js`
- `core/state.js`
- 既存データ互換が必要なら移行処理も同時に更新

### 5. 再生タイミングを変えたい

- `playback.js`
- `player.js`
- `core/rhythm-grid.js`

### 6. トラックの追加・初期値を変えたい

- `track-manager.js`
- `instruments.js`
- `core/state.js`

## 読み方のコツ

- まず `app.js` で起動順を確認する
- 次に対象機能の state と描画ファイルを読む
- 最後に `save-load.js` を見て、保存互換を壊していないか確認する

## 更新ルール

- 構成を変えたらこのファイルも更新する
- 新しい主要ファイルを増やしたら「変更内容ごとの入口」に追記する
