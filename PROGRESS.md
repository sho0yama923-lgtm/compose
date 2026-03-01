# PROGRESS.md — 作曲ツール 進捗メモ

最終更新: 2026-03-01

---

## 現在の実装状況（完了済み）

### コアアーキテクチャ
- `index.html`: 全UI（トップバー / サイドバー / メインエリア / 楽器モーダル）
- `app.js`: 状態管理・DOM描画・イベント処理
- `constants.js`: 定数（DRUM_ROWS / CHROMATIC / BLACK_KEYS / OCT_COLOR / ROOT_COLORS / CHORD_ROOTS / CHORD_TYPES）
- `player.js`: Tone.js 再生エンジン（スコアベース・BPM・ループ対応）
- `instruments.js`: 楽器設定の一元管理 + Tone.Sampler 自動生成
  - `INSTRUMENT_LIST`: 全楽器のメタデータ（id / label / instType / octaveBase / sampleType）
  - `sampleType: "auto"`: フォルダ内の .mp3 を自動検出（top-level await + fetch）
  - `sampleType: "chromatic"`: 全クロマチック音源（piano のみ）
  - `sampleType: "manual"`: ドラム用の手動マッピング
  - computed export: `INST_LABEL` / `INST_TYPE` / `OCTAVE_DEFAULT_BASE`
  - **新楽器追加 = `sounds/xxx/` にファイルを置き INSTRUMENT_LIST に1行追加するだけ**

### 対応楽器（8種）
- Drums / コード / Piano / Bass / Acoustic Guitar / Electric Guitar / Violin / Trumpet

### UI
- トップバー: メニューボタン・トラック名表示・BPM入力・再生/停止ボタン
- サイドバー: トラック一覧（黒鍵スタイル）・スライドイン/オーバーレイ・トラック削除
- 楽器選択モーダル: 下からスライドアップ・8種選択
- エンプティステート: トラックなし時のガイド表示

### トラックエディタ
- **ドラムエディタ**: 4ステップ行 × 16ステップグリッド
- **コードエディタ**: 専用トラック（`INST_TYPE='chord'`）として独立
  - パレット: ルート選択（C〜B、ROOT_COLORS で色付き）/ タイプ選択（maj〜aug 9種）/ オクターブ選択
  - **コード範囲セクション（ゾーンエディタ方式）**:
    - `dividers: [0, 8]` でデフォルト2分割。0は常に固定。
    - ゾーン帯が flex で比例幅になり、16ドットが常に1画面に収まる
    - シングルタップ（250ms debounce）→ ゾーン全体にコード適用
    - ダブルタップ → タップ座標から最近傍ステップ境界に分割線追加
    - 区切り線タップ → 選択状態、◀▶で移動、✕で削除
    - 全クリア → dividers を `[0]` にリセット
  - **発音セクション**: 16ステップ ON/OFF（コード範囲と独立）
  - 再生時: `soundSteps[i]=true` かつ `chordMap` の最新コード（継承方式）で発音
- **メロディエディタ**: オクターブ アコーディオン形式
  - 各オクターブが縦に並ぶ折りたたみパネル（タップで開閉）
  - 展開時: ピアノ鍵盤UI + 12音 × 16ステップグリッド
  - 折りたたみ時: 12音 × 16ステップのミニプレビュー

### デフォルトトラック
起動時に drums → chord → piano の3本が自動生成される

### 再生エンジン
- 全トラックからスコアを構築し `play()` へ渡す実装
- `Tone.Sequence` にインデックス配列を渡す（サブ分割バグ回避済み）
- rhythm / chord / melody すべてのトラック型に対応

### データモデル
- Drum: `{ id, instrument, rows: [{ label, note, steps[16] }] }`
- Chord: `{ id, instrument:'chord', chordMap[16], soundSteps[16], dividers:[0,8], selectedDivPos:null, ... }`
- Melodic: `{ id, instrument, viewBase, activeOctave, stepsMap: { 'C4': steps[16], ... } }`


## 次にやるべきこと

### 再生中ステップハイライト（優先度: 高）
- CSSに `.step.playing { background: #f5c518; }` は定義済み
- `player.js` の Tone.Sequence コールバックで現在ステップに `.playing` クラスを付与/除去する実装が未完
- app.js 側でステップボタンの参照を渡す設計が必要


---

## 今後のロードマップ

### Phase 1: 演奏体験の向上（優先度: 高）

#### 1-A. 再生中ステップのハイライト
- CSSに `.step.playing { background: #f5c518; }` は定義済み
- `player.js` の Tone.Sequence コールバックで現在ステップに `.playing` クラスを付与/除去する実装が未完
- app.js 側でステップボタンの参照をどう渡すか設計が必要

#### 1-B. ドラムパターンの拡充
- `constants.js` の `DRUM_ROWS` と `instruments.js` の `drums.mapping` を拡張するだけで対応可能

### Phase 2: メロディ作曲の補助（優先度: 中）

#### 2-A. スケール選択機能
- スケール外の音をグレーアウト・無効化
- `constants.js` にスケール定義を追加し、`renderMelodicEditor` でフィルタ処理

### Phase 3: 楽曲構成（優先度: 低）

#### 3-A. 複数小節対応
#### 3-B. データ保存・読み込み（localStorage / JSON）

---

## 直面している課題・メモ

- 再生中ハイライトを実現するには、ステップボタンの DOM 参照をどこで管理するかの設計が必要
- `sampleType: "auto"` は Python `http.server` のディレクトリ一覧に依存（開発専用）

## バグ修正履歴

- `activeTrackId === 0` のとき `!activeTrackId` が `true` になる → `=== null` チェックに変更（2026-02-28）
- trumpet/violin/ele_guitar の音が出ない → `generateChromaticFiles` の 404 が原因で `Sampler.loaded=false`。`sampleType:"auto"` で実在ファイルのみ検出する方式に修正（2026-03-01）
- aco_guitar の `loaded=false` → 同上の修正を適用（2026-03-01）
