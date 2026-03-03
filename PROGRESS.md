# PROGRESS.md — 作曲ツール 進捗メモ

最終更新: 2026-03-03

---

## 現在の実装状況（完了済み）

### ファイル構成（2026-03-03 リファクタリング済み）

app.js が1118行の巨大ファイルだったものを、責務ごとに分割。

| ファイル | 責務 |
|---------|------|
| `index.html` | HTML構造のみ（CSS外部化） |
| `style.css` | 全スタイル定義 |
| `app.js` | エントリポイント（コールバック登録 + 初期化） |
| `state.js` | 共有状態（tracks, currentMeasure等）+ callbacksオブジェクト |
| `sidebar.js` | サイドバー開閉 + トラックリスト描画 |
| `track-manager.js` | トラック追加/削除/選択 + 小節追加/削除 |
| `editor-router.js` | renderEditor（シークバー生成 + エディタ振り分け） |
| `editor-drum.js` | ドラムエディタ描画 |
| `editor-melodic.js` | メロディエディタ描画（オクターブアコーディオン） |
| `editor-chord.js` | コードエディタ描画 + ヘルパー関数 |
| `playback.js` | 再生/停止 + スコア構築 |
| `modal.js` | 楽器選択モーダル |
| `swipe.js` | スワイプ小節移動 |
| `constants.js` | 音楽理論定数 + getChordNotes() |
| `player.js` | Tone.js 再生エンジン |
| `instruments.js` | 楽器設定 + Tone.Sampler 自動生成 |

**循環依存回避**: `state.js` の `callbacks` オブジェクトに `renderEditor` / `renderSidebar` / `closeSidebar` を `app.js` 初期化時に登録。各モジュールは `callbacks.renderEditor()` を呼ぶことで直接importせずに再描画をトリガー。

### 対応楽器（8種）
- Drums / コード / Piano / Bass / Acoustic Guitar / Electric Guitar / Violin / Trumpet

### UI
- トップバー: メニューボタン・トラック名表示・BPM入力・再生/停止ボタン
- サイドバー: トラック一覧（黒鍵スタイル）・スライドイン/オーバーレイ・トラック削除
- 楽器選択モーダル: 下からスライドアップ・INSTRUMENT_LIST から動的生成
- エンプティステート: トラックなし時のガイド表示

### トラックエディタ
- **ドラムエディタ**: 4ステップ行 × 16ステップグリッド
- **コードエディタ**: ゾーンエディタ方式（パレット / コード範囲 / 発音セクション）
- **メロディエディタ**: オクターブ アコーディオン形式

### データモデル
- `STEPS_PER_MEASURE = 16`、`numMeasures = 4`（デフォルト）
- フラット配列方式: 配列長 = `STEPS_PER_MEASURE * numMeasures`
- スワイプ / シークバーで小節移動

---

## 次にやるべきこと

### 再生中ステップハイライト（優先度: 高）
- CSSに `.step.playing { background: #f5c518; }` は定義済み
- `player.js` の Tone.Sequence コールバックで現在ステップに `.playing` クラスを付与/除去する実装が未完

---

## 今後のロードマップ

### Phase 1: 演奏体験の向上（優先度: 高）
- 再生中ステップのハイライト
- ドラムパターンの拡充

### Phase 2: メロディ作曲の補助（優先度: 中）
- スケール選択機能

### Phase 3: 楽曲構成（優先度: 低）
- データ保存・読み込み（localStorage / JSON）

---

## 直面している課題・メモ

- 再生中ハイライトを実現するには、ステップボタンの DOM 参照をどこで管理するかの設計が必要

## バグ修正履歴

- `activeTrackId === 0` のとき `!activeTrackId` が `true` になる → `=== null` チェックに変更（2026-02-28）
- trumpet/violin/ele_guitar の音が出ない → `sampleType:"range"` でHEADリクエスト方式に修正（2026-03-01→03-02）
