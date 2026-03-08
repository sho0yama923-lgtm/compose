# 作曲ツール 設計メモ

## 現在の設計

### 全体構成

- `src/main.js`
  - 起動、初期トラック生成、保存フック登録
- `src/editors/*`
  - ドラム、メロディ、コード、全体エディタの描画
- `src/features/playback/*`
  - 再生用スコア生成と Tone.js 送出
- `src/features/project/project-storage.js`
  - localStorage / JSON 保存読込

### 音楽データ

- 内部解像度は 1 小節 48 ステップ
- `通常 / 3連` は `src/core/rhythm-grid.js` で 48 ステップへ変換
- トラック種別は `rhythm / chord / melody`
- 各トラックは `volume` を持ち、全体エディタから変更できる

### 全体エディタ

- 各トラックはカードとして表示する
- カードヘッダでは以下を操作する
  - 発音 ON/OFF
  - 音量
  - 繰り返しUI
- 長押しメニューは `コピー / ペースト` のみ
- `Key / Scale` は全体エディタに集約している

### 繰り返しUI

- 繰り返しはカード単位で独立して持つ
- 状態は `appState.repeatStates[trackId]` に保持する
- 型範囲は黄色、反映済み範囲は緑で表現する
- 黄色の型を編集すると、対応する緑へ再反映する
- 緑側の編集は黄色へ逆流しない
- 下部シークバーの黄/緑は 1 トラック分だけ表示する
  - トラックエディタでは `activeTrackId`
  - 全体エディタでは `lastTouchedTrackId`

### スケール表示

- 現在は `major / harmonic_minor / melodic_minor`
- スケールはメロディエディタの行ハイライトに使う
- スケール定義は `src/core/music-theory.js`

## 次に入れる設計

### 1. ブルース/ジャズ向けスケール追加

- 追加対象
  - `blues`
  - `dorian`
  - `mixolydian`
  - `minor_pentatonic`
- 合計 7 種
  - `major`
  - `harmonic_minor`
  - `melodic_minor`
  - `blues`
  - `dorian`
  - `mixolydian`
  - `minor_pentatonic`
- UI 方針
  - 全体エディタの `Scale` はタブではなくドロップダウンにする
- 適用範囲
  - まずはメロディエディタのスケール音強調だけに使う
  - コード候補や自動補助までは広げない

### 2. トラックEQ

- EQ は各トラックごとに持つ
- 形式は固定 3 バンド
  - `Low`
  - `Mid`
  - `High`
- 値は dB で `-24 .. +24`
- UI は全体エディタの各カード内に置く
- 保存対象
  - `track.eq = { low: 0, mid: 0, high: 0 }`

### 3. EQ 追加に伴う再生設計変更

- 現在は楽器ごとの共有 sampler を直接鳴らしている
- トラックEQを独立させるため、再生イベントへ `trackId` を載せる
- 再生チェーンはトラック単位へ分ける
  - `instrument source -> EQ -> destination`
- chord は piano 音源を流用してよいが、出力EQは chord track と piano track で分ける

## 実装時の注意

- 保存項目を増やしたら `project-storage` の normalize を必ず更新する
- 全体エディタの仕様変更は `preview-editor` と `bottom-bar` を合わせて確認する
- 再生まわりの変更は `playback-controller` と `scheduler` の両方を見る
