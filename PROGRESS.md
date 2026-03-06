# PROGRESS.md — 作曲ツール 進捗メモ

最終更新: 2026-03-06

---

## 現在の実装状況（完了済み）

### ファイル構成

| ファイル | 責務 |
|---------|------|
| `index.html` | HTML構造のみ（CSS外部化） |
| `style.css` | 全スタイル定義 |
| `app.js` | エントリポイント（コールバック登録 + 初期化 + 自動保存フック） |
| `state.js` | 共有状態（tracks, currentMeasure等）+ callbacksオブジェクト |
| `sidebar.js` | サイドバー開閉 + トラックリスト描画 |
| `track-manager.js` | トラック追加/削除/選択 + 小節追加/削除 |
| `editor-router.js` | renderEditor（シークバー生成 + エディタ振り分け + プレビューモード） |
| `editor-drum.js` | ドラムエディタ描画 |
| `editor-melodic.js` | メロディエディタ描画（オクターブアコーディオン） |
| `editor-chord.js` | コードエディタ描画 + ヘルパー関数 |
| `editor-preview.js` | 全トラックプレビュー画面（ドットグリッド + コード名表示） |
| `playback.js` | 再生/停止 + スコア構築 + 再生位置ハイライト |
| `modal.js` | 楽器選択モーダル |
| `swipe.js` | スワイプ小節移動 |
| `save-load.js` | 自動保存(localStorage) + JSONエクスポート/インポート |
| `constants.js` | 音楽理論定数 + getChordNotes() |
| `player.js` | Tone.js 再生エンジン（onStepコールバック対応） |
| `instruments.js` | 楽器設定 + Tone.Sampler 自動生成 |

### 最近の実装

- **プレビュー画面** (b47b3d6): 全トラックのドットグリッド表示、タップでエディタへ遷移
- **コード名表示**: プレビューのコードトラックにゾーンラベル（コード名+ROOT_COLORS背景+分割線）を表示
- **再生位置バー**: player.jsのonStepコールバック → Tone.Draw.scheduleでDOM同期 → .playing クラスで列ハイライト、小節自動切り替え
- **セーブ機能**: 自動保存(localStorage) + JSONエクスポート/インポート + 新規作成

### 対応楽器（8種）
- Drums / コード / Piano / Bass / Acoustic Guitar / Electric Guitar / Violin / Trumpet

---

## 直面している課題・メモ

- プレビューブラウザ（preview tool）のESモジュールキャッシュが古いまま残る問題あり。ユーザーの実ブラウザでは正常動作するはず。

---

## バグ修正履歴

- `activeTrackId === 0` のとき `!activeTrackId` が `true` になる → `=== null` チェックに変更（2026-02-28）
- trumpet/violin/ele_guitar の音が出ない → `sampleType:"range"` でHEADリクエスト方式に修正（2026-03-01→03-02）
