# 開発指針: スマホ向け作曲ツール

## [Core Goals & Policy]
- Target: 音楽初学者向け、直感的なスマホ作曲ツール (音楽理論不要)
- Priority: シンプルさ最優先。機能追加より既存機能の明確化。1画面の情報量と操作を最小限に。
- Mobile-First: タップ領域≧44px、`-webkit-overflow-scrolling: touch`、`touch-action: manipulation`(ズーム防止)
- Out of Scope: 高度な機能(MIDI/ミキサー)、PC専用レイアウト、ユーザー登録/DB保存

## [Agent Rules & Workflow]
- QA & Testing: 仕様通り動くかの動作確認はユーザーが手動（人力）で行う。テストコードの作成や、自律的なブラウザでの動作確認は不要。コードの実装に集中すること。
- Token Saving: トークン節約のため、セッション(会話履歴)はユーザーによって頻繁に `clear` される。
- State Save: 作業の区切りやセッション終了前には、現在の進捗・次にやるべきこと・直面している課題を必ず `PROGRESS.md` に簡潔に書き込み・上書き保存すること。
- State Resume: セッションが新しく開始された際（あるいは指示が曖昧な際）は、まず `PROGRESS.md` を読み込み、コンテキストを自己復帰させてから作業を再開すること。
- File Access: トークン浪費を防ぐため、関係のないファイルは読み込まない。編集時は対象ファイルの必要な箇所のみを直接読み書きすること。

## [Tech Stack]
- 音声: Tone.js v14.8.49 (CDN)
- モジュール: ES Modules (`type="module"`)
- 開発環境: `python3 -m http.server 8080` (CORS対策必須)

## [Architecture & Files]
*Rule: index.htmlのインラインJS禁止。定数はconstants.jsへ。肥大化時は適宜ファイル分割。*
- `index.html`: UI(トップ/サイドバー/メイン/楽器モーダル)。`<script type="module" src="./app.js">`のみ記述。
- `app.js`: 状態管理/DOM描画/イベント処理。
  - 主要関数: `addTrack`, `deleteTrack`, `selectTrack`, `renderSidebar`, `renderEditor`(drum/melodic分岐), `buildSteps`
  - 再生時: 全トラックからスコアを構築し `player.play()` へ渡す。
- `constants.js`: 定数群 (`DRUM_ROWS`, `CHROMATIC`, `BLACK_KEYS`, `OCTAVE_RANGE`, `OCT_COLOR`, `INST_LABEL`)
- `player.js`: Tone.js再生エンジン。`play(score, { bpm, loop })`, `stop()`
  - ⚠️重要: `Tone.Sequence`に配列を直接渡すとサブ分割されるバグあり。回避のため、インデックス配列(0〜15)を渡し、コールバック内で `score[i]` を参照する実装とすること。
- `instruments.js`: 楽器ごとの `Tone.Sampler` 定義。piano/drums/bass/aco_guitar。音源パス: `sounds/`

## [Data Model]
- 1小節 = 16ステップ
- Drum: `{ id, instrument: 'drums', rows: [{ label, note, steps: Array(16) }] }`
- Melodic: `{ id, instrument: 'piano', activeOctave: 4, stepsMap: { 'C4': Array(16), ... } }`
- Score: `score[i] = [{ instrument: 'piano', notes: 'C4' }]` (null=無音)

## [UI Design: ピアノモチーフ(白黒基調)]
- トップバー(天板): `#0a0a0a`
- トラックアイテム, ステップON(黒鍵押下), 楽器ボタン: `#111`
- サイドバー背景, メロディ白鍵行, 再生ボタン: `#fff`
- メインエリア背景: `#f0f0f0`
- ステップOFF(白鍵): `#f8f8f8` (薄ボーダー付)
- メロディ黒鍵行: `#e4e4e4`
- オクターブ識別: ステップON時とタブに `OCT_COLOR` (低=青, 中=緑, 高=黄〜橙) を適用
- レイアウト: 窮屈にならないよう十分な余白を確保
