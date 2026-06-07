# coding-rules.md

このファイルは、今後の実装でディレクトリ構成の煩雑化、責務の混線、再生まわりの不安定化を防ぐためのルール集です。

## 目的

- サブエージェントごとに安全に担当ファイルを分けられるようにする
- 新しいディレクトリやファイルを増やす前に、置き場所と依存方向を判断できるようにする
- 再生や保存のような不安定になりやすい経路で、責務重複を増やさない
- 一時しのぎの分岐や引数追加で巨大ファイルを延命しない

## ディレクトリ設計ルール

- `src/` はアプリ本体の正本とする
- `src/main.js` は初期化、モジュール接続、起動時の最小フローだけを持つ
- `src/core/` は UI を知らない純粋寄りロジック、共有 state、定数、変換処理だけを置く
- `src/editors/` は編集画面の描画、DOM イベント、画面固有の UI 状態だけを置く
- `src/features/` は保存、再生、トラック管理、bridge などの振る舞い単位のロジックを置く
- `src/ui/` はアプリ外枠の UI だけを置き、個別 editor の詳細ロジックを持たない
- `src/styles/` は CSS の正本とし、入口は `src/styles/editor.css` に固定する
- `ios/` と `android/` は native 固有コードと wrapper のみを置く
- Web / native の差分は `src/features/bridges/` で吸収し、editor から native API を直接呼ばない
- 新しいトップレベルディレクトリは原則追加しない。必要な場合は `CODEBASE_GUIDE.md` とこのファイルを同時に更新する
- `shared/`、`common/`、`misc/`、`utils/` のような曖昧な広域置き場は作らない
- 生成物、依存物、互換ファイルを現行実装の入口にしない

## 依存方向

- `main -> ui/editors/features -> core`
- `editors -> features/core`
- `features -> core`
- `ui -> features/core`
- `core` から `editors`、`features`、`ui`、native へ依存しない
- `features` から editor の DOM 構造へ依存しない
- `bridges` 以外から Capacitor / native API を直接呼ばない

## 境界ルール

- `src/main.js` は初期化とモジュール接続だけを持つ
- `src/editors/` は描画と UI イベントだけを持つ
- `src/features/` は振る舞い単位のロジックだけを持つ
- `src/core/` は純粋計算、共有 state、定数だけを持つ
- `src/features/bridges/` は Web / native 差分の吸収だけを持つ
- 現行コード、レガシー/互換、生成物の区分は `CODEBASE_GUIDE.md` に従う
- レガシー/互換ファイルを新しい実装の入口にしない

## 再生ルール

- 再生スコアの組み立てと、再生 UI の進行管理を同じファイルに混在させない
- native 再生の時間正本は native が持ち、JS は描画と補正だけを担当する
- bridge 層は payload の受け渡しと fallback 判定だけに留める
- `playScore` や `stopScorePlayback` の呼び出し引数には、実際に使う値だけを渡す
- 再生停止時に即時性が必要な処理は、cleanup 完了を待つ処理と分ける

## ファイル分割ルール

- 1 ファイルで 2 種類以上の責務を持ち始めたら分割を検討する
- 目安として 250 行を超えたら、公開入口を維持したまま内部分割を優先する
- 分割先の命名は「責務名ベース」にする
- `misc` `helpers` `temp` のような曖昧名は増やさない

## サブエージェント前提ルール

- 実装依頼を出す時は、変更対象ファイルを先に固定する
- 同じファイルを複数サブエージェントに触らせない
- 入口ファイルと内部実装ファイルを分け、入口は薄く保つ
- 依存方向を逆流させない

## 変更時チェック

- 新しい state や保存項目を増やす時は、保存 / normalize / migrate を同時に確認する
- bridge の API を増やす時は、Web fallback と native 実装の両方を確認する
- 再生関連の変更時は、開始、停止、ループ、試聴の4経路を最低限見る
- 使っていない引数、未使用キャッシュ、重複した prewarm は残さない

## 禁止寄りルール

- UI 都合で feature 層に DOM 操作を増やさない
- native と JS の両方で同じ時間計算を正本として持たない
- 一時対応のフラグを増やして構造問題を隠さない
- 動いているからという理由で未使用コードや未使用引数を残さない
