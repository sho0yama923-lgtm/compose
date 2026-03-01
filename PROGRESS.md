# PROGRESS.md — 作曲ツール 進捗メモ

最終更新: 2026-03-01

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
- 楽器選択モーダル: 下からスライドアップ・5種選択（Drums / コード / Piano / Bass / Acoustic Guitar）
- エンプティステート: トラックなし時のガイド表示

### トラックエディタ
- **ドラムエディタ**: 6ステップ行 × 16ステップグリッド
- **コードエディタ**: 専用トラック（`INST_TYPE='chord'`）として独立
  - パレット: ルート選択（C〜B）/ タイプ選択（maj〜aug 9種）/ オクターブ選択
  - **コード範囲セクション（ゾーンエディタ方式）**:
    - `dividers: [0]` でゾーンを定義（0は常に固定、複数の区切り線を持てる）
    - ゾーンをタップ（シングルクリック 250ms debounce） → そのゾーン全体に現在のパレットコードを適用
    - ステップをダブルクリック → その位置に新しい区切り線を追加
    - 区切り線をクリック → 選択状態に（`selectedDivPos`）
    - セクション左端の [◀][▶] → 選択中の区切り線を1ステップ移動（chordMap も連動更新）
    - [全クリア]: chordMap / dividers / selectedDivPos をリセット
    - 隣接ゾーンの色分け: コードが変わるたびに黒(#1a1a1a) / グレー(#666) を交互切り替え
  - **発音セクション**: どのステップで実際に音を出すか（コード範囲と独立）
    - ドラムパターン参照 + 各行にチェックボックス + [同期] ボタン1つ（チェック行を一括同期）
    - 16ステップ（シンプルON/OFF）
  - 再生時: `soundSteps[i]=true` かつ `chordMap` の最新コードで発音（継承方式）
  - データモデル: `{ id, instrument:'chord', chordMap[16], soundSteps[16], selectedChordRoot, selectedChordType, selectedChordOctave, dividers: [0], selectedDivPos: null, selectedDrumRows(Set) }`
- **メロディエディタ**: オクターブ アコーディオン形式
  - 各オクターブが縦に並ぶ折りたたみパネル（タップで開閉）
  - 高オクターブが上、低オクターブが下の順
  - 展開時: 左列にピアノ鍵盤UI（白鍵/黒鍵）+ 右に12音 × 16ステップグリッド
  - 折りたたみ時: ヘッダー内に 12音 × 16ステップの細いミニプレビューグリッド
  - オクターブ幅を3オクターブに制限（piano: 3〜5 / bass: 1〜3 / aco_guitar: 2〜4）

### デフォルトトラック
起動時に drums → chord → piano の3本が自動生成される

### 再生エンジン
- 全トラックからスコアを構築し `play()` へ渡す実装
- `Tone.Sequence` にインデックス配列を渡す（サブ分割バグ回避済み）
- rhythm / chord / melody すべてのトラック型に対応

### データモデル
- Drum: `{ id, instrument, rows: [{ label, note, steps[16] }] }`
- Chord: `{ id, instrument:'chord', chordMap[16], soundSteps[16], dividers:[0], selectedDivPos:null, selectedChordRoot, selectedChordType, selectedChordOctave, selectedDrumRows(Set) }`
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
- 音源ファイル（`sounds/`）はすでに用意済みの前提でコードが組まれている（未確認）

## バグ修正履歴

- `activeTrackId === 0` のとき `!activeTrackId` が `true` になる → `=== null` チェックに変更（2026-02-28）
