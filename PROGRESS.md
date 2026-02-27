# PROGRESS.md — 作曲ツール 進捗メモ

最終更新: 2026-02-27

---

## 現在の実装状況（完了済み）

### コアアーキテクチャ
- `index.html`: 全UI（トップバー / サイドバー / メインエリア / 楽器モーダル）
- `app.js`: 状態管理・DOM描画・イベント処理
- `constants.js`: 全定数（DRUM_ROWS / CHROMATIC / BLACK_KEYS / OCTAVE_RANGE / OCT_COLOR / INST_LABEL）
- `player.js`: Tone.js 再生エンジン（スコアベース・BPM・ループ対応）
- `instruments.js`: Tone.Sampler 定義（piano / drums / bass / aco_guitar）

### UI
- トップバー: メニューボタン・トラック名表示・BPM入力・再生/停止ボタン
- サイドバー: トラック一覧（黒鍵スタイル）・スライドイン/オーバーレイ・トラック削除
- 楽器選択モーダル: 下からスライドアップ・4楽器選択（Drums / Piano / Bass / Acoustic Guitar）
- エンプティステート: トラックなし時のガイド表示

### トラックエディタ
- **ドラムエディタ**: Kick / Snare / HiHat の3行 × 16ステップ
- **メロディエディタ**: 12音（クロマチック）× 全オクターブを1画面に横並び表示
  - 左列: ピアノ鍵盤UI（白鍵/黒鍵の視覚区別）
  - オクターブ凡例バッジ（色付き）
  - ビート番号ヘッダー（1〜4）
  - オクターブ区切り線
  - ステップON時: オクターブカラー（青=低音域 / 緑=中音域 / 黄橙=高音域）

### 再生エンジン
- 全トラックからスコアを構築し `play()` へ渡す実装
- `Tone.Sequence` にインデックス配列を渡す（サブ分割バグ回避済み）
- ドラム・メロディ両対応のスコア構築
- 和音再生: `player.js` は `notes` 配列に対応済み（UI側は未実装）

### データモデル
- Drum: `{ id, instrument, rows: [{ label, note, steps[16] }] }`
- Melodic: `{ id, instrument, activeOctave, stepsMap: { 'C4': steps[16], ... } }`
- 複数トラック追加・削除・選択

### 楽器音源
- Piano: オクターブ1〜7 クロマチック（ファイル名自動生成）
- Drums: Kick(C1) / Snare(D1) / HiHat(F#1) — manualマッピング
- Bass: A#1〜G4 — manualマッピング
- Acoustic Guitar: A2〜G#4 — manualマッピング

---

## 今後のロードマップ

### 次に着手するもの（優先度: 高）

#### A. ピアノの音順逆転（app.js 修正・小規模）
- **問題**: 現状は上=低音・下=高音の逆順になっている
- **方針**: `renderMelodicEditor` 内で `[...CHROMATIC].reverse()` して描画
- **工数**: 1行変更、即効性大

#### B. 音符の長さ対応（16分音符以上）
- **方針**: スコア構築時に連続ONステップを自動連結して長い音符に変換
  - 例: Step 0,1 ON → step0 に `duration: '8n'`
  - 例: Step 0,1,2,3 ON → step0 に `duration: '4n'`
- **変更箇所**: `app.js` のスコア構築部分のみ（データモデル・UI変更なし）
- **工数**: 中程度

#### C. オクターブUIの再設計
- **問題**: 全オクターブ横並びでスクロール幅が広すぎる（ピアノは5オクターブ分）
- **方針**: タブ切替方式（1オクターブずつ表示）に変更
  - DESIGN.md の当初案に近い
  - 画面を広く使えてスマホ操作に適する
- **工数**: 大（renderMelodicEditor の再設計が必要）

---

### Phase 2: 演奏体験の向上（優先度: 中）

#### D. 再生中ステップのハイライト
- CSSに `.step.playing { background: #f5c518; }` は定義済み
- `player.js` の Tone.Sequence コールバックで現在ステップに `.playing` クラスを付与/除去する実装が未完
- app.js 側でステップボタンの DOM 参照をどう渡すか設計が必要

#### E. ドラムパターンの拡充
- 現状 Kick / Snare / HiHat の3種のみ
- 追加候補: Open HiHat / Clap / Tom など
- `constants.js` の `DRUM_ROWS` と `instruments.js` の `drums.mapping` を拡張するだけで対応可能

---

### Phase 3: メロディ作曲の補助（優先度: 低）

#### F. 和音（コード）追加機能（DESIGN.md §2）
- コード名（例: Cmaj / Am / G7）を選ぶと構成音を自動展開して同ステップに一括セット
- `player.js` は既に `notes` 配列対応済みなので、スコア構築側のみ変更で対応可能

#### G. スケール選択機能（DESIGN.md §3）
- スケール（例: Cメジャー / Aマイナー）を選ぶと、スケール外の音をグレーアウト・無効化
- `constants.js` にスケール定義を追加し、`renderMelodicEditor` でフィルタ処理

---

### Phase 4: 楽曲構成（優先度: 低）

#### H. 複数小節対応
- 現状は1小節（16ステップ）固定
- 小節を複数作って並べる「アレンジビュー」的なUI

#### I. データ保存・読み込み
- localStorage を使ったセッション保存
- JSON エクスポート/インポート

---

## 直面している課題・メモ

- 音源ファイル（`sounds/`）はすでに用意済みの前提でコードが組まれている（未確認）
