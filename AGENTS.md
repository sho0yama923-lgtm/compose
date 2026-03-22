# AGENTS.md

このファイルは、このリポジトリで実装作業を行うエージェント向けの共通ルール集です。
既存の `CLAUDE.md` `PROGRESS.md` `CODEBASE_GUIDE.md` `DESIGN.md` `docs/architecture.md` に散っていた実装時ルールと参照方針を集約しています。

## 最初に確認するもの

1. `PROGRESS.md`
2. `CODEBASE_GUIDE.md`
3. `src/main.js`
4. `docs/coding-rules.md`
5. 変更対象に対応する実装ファイル

- セッション開始時や指示が曖昧な時は、まず `PROGRESS.md` を読んで状態復帰すること。
- 構成を変えたら `PROGRESS.md` と `CODEBASE_GUIDE.md` も必要に応じて更新すること。

## プロダクト方針

- 対象は音楽初学者向けの直感的なスマホ作曲ツール。
- 最優先はシンプルさ。機能追加より既存機能の明確化を優先する。
- 1画面の情報量と操作は最小限に保つ。
- PC専用レイアウトや高度な機能追加は基本的に優先しない。

## 実装フロー

- 変更前に現在の構造と責務を読む。起動順、対象画面、状態管理、保存処理の順で確認する。
- 変更は最小差分で行い、既存UIのトーンと責務分割を崩さない。
- 関係ないファイルは読まない。必要箇所だけを直接読む。
- 保存項目を増やしたら、保存処理と normalize / migrate 系の更新を必ず確認する。
- 作業が複数ある場合は、ファイル責務や担当範囲を安全に分けられる限り、サブエージェントを立てて並行で進める。
- サブエージェントを使う時は、まず既存の担当を再利用できるか確認し、文脈が続いている担当があれば新規起動より再利用を優先する。
- 同じファイルを複数担当が触る、責務境界が曖昧、または分離コストが高い場合は、無理に並行せず 1 エージェントで実装する。
- 使っていないサブエージェントは閉じて空きを作り、枠を埋めたまま放置しない。
- 新規サブエージェントは、本当に別責務として独立して進められる時だけ追加する。
- 1つの不具合に対して複数の筋で修正を試す場合は、別の筋へ切り替える時点で、効果がなかった修正は戻してから次の筋を試す。
- 作業の区切りやセッション終了前には `PROGRESS.md` を更新する。

## UI変更フロー

- UI変更時は、ファイル編集前に線や図形を組み合わせたアスキーアートで概形案を提示する。
- ユーザー承認があるまで、UI関連ファイルは編集しない。
- 承認後に実装する。
- 実装後はUI崩れを確認する。
- 変更したパーツの幅・高さ・余白・位置など、主要寸法を `px` で明示する。
- 主要寸法は、あとで詰めやすいように CSS 変数やまとまった定数へ寄せる。
- ユーザーから数値ベースの再修正案が来る前提で、寸法情報を整理して返す。

## テストと確認

- 基本方針として、仕様通り動くかの最終確認はユーザーの手動確認を前提とする。
- 不要なテストコード追加や、自律的なブラウザ確認を前提にしない。
- ただし既存の確認基盤が必要な変更では、既存の `playwright` / スモークテスト資産を読む。
- 実ブラウザや WebKit 確認が必要になった場合は、`playwright.config.js` `tests/webkit-smoke.spec.js` `start.command` を参照する。

## モバイルUI制約

- Mobile First で実装する。
- タップ領域は 44px 以上を目安にする。
- `-webkit-overflow-scrolling: touch` と `touch-action: manipulation` を意識する。
- 狭い画面で窮屈にならない余白を確保する。

## アーキテクチャ方針

- `src/main.js` はアプリ初期化だけを担当する。
- `src/core/` は共有状態、定数、duration、リズム変換などの低レベル共通ロジックを置く。
- `src/editors/` はドラム、メロディ、コード、全体プレビューの描画を置く。
- `src/features/` は再生、保存、トラック管理などの振る舞い単位のロジックを置く。
- `src/ui/` はサイドバー、モーダル、トップバー、下部バーなどの外枠UIを置く。
- `src/styles/` はスタイルを置く。CSS 入口は `src/styles/editor.css`。

## 依存方向

- `main -> ui/editors/features -> core`
- `editors -> core`
- `features -> core`
- `ui -> features/core`

## 実装上の重要ルール

- `index.html` にインライン JavaScript を書かない。
- 定数は `src/core/constants.js` に寄せる。
- ファイルが肥大化したら、公開入口を維持したまま内部を分割する。
- 全体エディタの仕様変更時は、関連する下部シークバーも合わせて確認する。
- 再生まわりの変更時は、スコア生成側と Tone.js 送出側の両方を見る。
- `src/` をアプリ本体の正本として扱い、`ios/` と `android/` には native 固有コードだけを置く。
- `ios/App/App/public/`、`ios/App/App/capacitor.config.json`、`android/app/src/main/assets/public/`、`android/app/src/main/assets/capacitor*.json` は sync 生成物として扱い、手編集しない。
- スマホ開発の基本導線は `npm run mobile:sync:ios` / `npm run mobile:sync:android` を使う。

## 音楽データとUI仕様

- 内部解像度は 1 小節 48 ステップ。
- `通常 / 3連` は `src/core/rhythm-grid.js` で 48 ステップへ変換する。
- トラック種別は `rhythm / chord / melody`。
- 各トラックは `volume` を持つ。
- 繰り返し状態はトラック単位で持ち、`appState.repeatStates[trackId]` に保持する。
- 繰り返しUIは、型範囲が黄色、反映済み範囲が緑。
- 黄色の編集は緑へ再反映されるが、緑の編集は黄色へ逆流しない。
- 下部シークバーの黄/緑は 1 トラック分だけ表示する。

## 主要変更ごとの確認先

- 音価や理論定義の変更:
  - `src/core/constants.js`
  - `src/core/duration.js`
  - `src/editors/duration-toolbar.js`
- 通常/3連の見た目や分割変更:
  - `src/core/rhythm-grid.js`
  - `src/styles/editor.css`
  - `src/styles/editors/`
- ノート配置やクリック判定変更:
  - 対象エディタ
  - `src/core/duration.js`
- 保存内容の変更:
  - `src/features/project/project-storage.js`
  - `src/features/project/storage/`
  - `src/core/state.js`
- スケールや理論表示の変更:
  - `src/core/music-theory.js`
  - `src/editors/preview/preview-song-settings.js`
  - `src/editors/melodic-editor.js`
- 再生タイミングや音作り変更:
- `src/features/playback/playback-controller.js`
- `src/features/playback/scheduler.js`
- `src/features/playback/score-builder.js`
- `src/features/tracks/instruments/`
- 繰り返しUI変更:
  - `src/editors/preview/preview-repeat.js`
  - `src/ui/bottom-bar.js`
  - `src/features/tracks/controller/track-repeat.js`

## 更新ルール

- 構成変更や責務変更をしたら、この `AGENTS.md` も必要に応じて更新する。
- 詳細な進捗や一時的な実装メモは `PROGRESS.md` に残す。
- ファイル対応表や読む順番が変わったら `CODEBASE_GUIDE.md` を更新する。
