# PROGRESS.md — 作曲ツール 進捗メモ

最終更新: 2026-03-06

---

## 現在の実装状況（完了済み）

### ファイル構成

| ファイル | 責務 |
|---------|------|
| `index.html` | HTML構造のみ（CSS外部化） |
| `style.css` | 全スタイル定義 |
| `app.js` | エントリポイント（コールバック登録 + 初期化 + 自動保存フック + beatConfig初期化） |
| `state.js` | 共有状態（tracks, selectedDuration, dottedMode, tripletMode, beatConfig等）+ callbacks |
| `sidebar.js` | サイドバー開閉 + トラックリスト描画 |
| `track-manager.js` | トラック追加/削除/選択 + 小節追加/削除（beatConfig連動） |
| `editor-router.js` | renderEditor（シークバー生成 + エディタ振り分け + プレビューモード） |
| `editor-drum.js` | ドラムエディタ描画（デュレーションツールバー + 3連符対応） |
| `editor-melodic.js` | メロディエディタ描画（オクターブアコーディオン + デュレーション対応） |
| `editor-chord.js` | コードエディタ描画 + デュレーション対応 soundSteps |
| `editor-preview.js` | 全トラックプレビュー画面（ドットグリッド + コード名表示） |
| `playback.js` | 再生/停止 + スコア構築（duration付き） + 再生位置ハイライト + beatConfig渡し |
| `modal.js` | 楽器選択モーダル |
| `swipe.js` | スワイプ小節移動 |
| `save-load.js` | 自動保存 + JSONエクスポート/インポート + v1→v2マイグレーション + beatConfig保存 |
| `constants.js` | 音楽理論定数 + DURATION_CELLS, DURATION_LIST + getChordNotes() |
| `player.js` | Tone.js 再生エンジン（Tone.Part/Tone.Sequence切替、3連符可変タイミング対応） |
| `instruments.js` | 楽器設定 + Tone.Sampler 自動生成 |
| `duration-utils.js` | **新規** — ノート配置・削除ユーティリティ (placeNote, clearNote, toggleStep等) |
| `duration-toolbar.js` | **新規** — デュレーション選択ツールバー + 付点 + 3連符ボタン |

### 最近の実装

- **音符の長さ（デュレーション）機能**:
  - データモデル: `boolean` → `null | duration_string | '_tie'` に変更
  - ツールバー: 全/2分/4分/8分/16分 + 付点(8d,4d,2d) + 3連符ボタン
  - 連結表示: head-span + tie セルの視覚的結合（CSSで border 除去 + opacity）
  - 全トラックタイプ対応: rhythm, melody, chord
  - 3連符: beatConfig で拍ごとにサブディビジョン数(3/4)を管理、4番目セルを非表示
  - 再生: 3連符あり→Tone.Part(可変タイミング), なし→Tone.Sequence(均一'16n')
  - セーブ: v1→v2自動マイグレーション、beatConfig永続化
- **セーブ機能**: 自動保存(localStorage) + JSONエクスポート/インポート + 新規作成
- **プレビュー画面**: 全トラックのドットグリッド表示 + コード名表示 + 再生位置バー

### 対応楽器（8種）
- Drums / コード / Piano / Bass / Acoustic Guitar / Electric Guitar / Violin / Trumpet

---

## 直面している課題・メモ

- プレビューブラウザ（preview tool）のESモジュールキャッシュが古いまま残る問題あり。ユーザーの実ブラウザでは正常動作するはず。

---

## 次にやるべきこと

- 動作確認: 全エディタでデュレーションツールバーが表示され、音価選択→配置→連結表示が正常に動くか確認
- v1セーブデータからのマイグレーションが正常に動くか確認
- 3連符の動作確認（ツールバー3連ボタン→ビートヘッダータップ→3分割表示→再生タイミング）

---

## バグ修正履歴

- `activeTrackId === 0` のとき `!activeTrackId` が `true` になる → `=== null` チェックに変更（2026-02-28）
- trumpet/violin/ele_guitar の音が出ない → `sampleType:"range"` でHEADリクエスト方式に修正（2026-03-01→03-02）
