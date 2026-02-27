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

## 今後のロードマップ（DESIGN.md より）

### Phase 1: 演奏体験の向上（優先度: 高）

#### 1-A. 再生中ステップのハイライト
- CSSに `.step.playing { background: #f5c518; }` は定義済み
- `player.js` の Tone.Sequence コールバックで現在ステップに `.playing` クラスを付与/除去する実装が未完
- app.js 側でステップボタンの参照をどう渡すか設計が必要

#### 1-B. ドラムパターンの拡充
- 現状 Kick / Snare / HiHat の3種のみ
- 追加候補: Open HiHat / Clap / Tom など
- `constants.js` の `DRUM_ROWS` と `instruments.js` の `drums.mapping` を拡張するだけで対応可能

---

### Phase 2: メロディ作曲の補助（優先度: 中）

#### 2-A. 和音（コード）追加機能（DESIGN.md §2）
- コード名（例: Cmaj / Am / G7）を選ぶと構成音を自動展開して同ステップに一括セット
- `player.js` は既に `notes` 配列対応済みなので、**スコア構築側のみ変更で対応可能**
- UI案: エディタ上部に「コード挿入」ボタン → コード選択ダイアログ → ステップ列をタップで挿入

#### 2-B. スケール選択機能（DESIGN.md §3）
- スケール（例: Cメジャー / Aマイナー）を選ぶと、スケール外の音をグレーアウト・無効化
- 音楽理論を知らなくても外れた音を選ばずに済む
- `constants.js` にスケール定義を追加し、`renderMelodicEditor` でフィルタ処理

---

### Phase 3: 楽曲構成（優先度: 低）

#### 3-A. 複数小節対応
- 現状は1小節（16ステップ）固定
- 小節を複数作って並べる「アレンジビュー」的なUI

#### 3-B. データ保存・読み込み
- localStorage を使ったセッション保存
- JSON エクスポート/インポート

---

## 直面している課題・メモ

- 再生中ハイライトを実現するには、ステップボタンの DOM 参照をどこで管理するかの設計が必要
- メロディエディタのスクロール幅がオクターブ数 × 16ステップで広くなるため、スマホでの操作性要検討
- 音源ファイル（`sounds/`）はすでに用意済みの前提でコードが組まれている（未確認）
