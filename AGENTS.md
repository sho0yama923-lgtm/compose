# AGENTS.md

このファイルは、このリポジトリで作業するエージェントの作業契約です。詳しい一覧を重複させず、**何を読むか、どこまで確認するか、次の担当へ何を残すか**だけを定めます。

## 正本と読む順番

1. このファイル — 作業契約
2. `PROGRESS.md` — 現在の目的、未検証事項、既知の注意点
3. `CODEBASE_GUIDE.md` — 作業種別ごとの入口ファイル
4. 対象実装と、その直接の依存先だけ

以下は必要な時だけ読む。

- 責務分割・依存方向: `docs/coding-rules.md`
- Web / Codex / Browser / WebKit の確認: `docs/codex-workflow.md`
- iOS / Android: `docs/mobile-dev.md` と該当 build runbook
- 公開: `docs/public-release.md`

`PROGRESS.md` に無関係な履歴は読まない。`CODEBASE_GUIDE.md` にない入口を推測で広く読む前に、まず `rg` で参照関係を絞る。

## 変更の境界

- アプリの正本は `src/`。native 固有コードだけを `ios/App/App/` / `android/` で扱う。
- `ios/App/App/public/`、`ios/App/App/capacitor.config.json`、`android/app/src/main/assets/public/`、`android/app/src/main/assets/capacitor*.json` は生成物。手編集しない。
- 保存仕様を変える時は serialize / validate / normalize / restore と Web・native storage bridge を同時に確認する。
- 再生を変える時は score 生成、scheduler、audio bridge、native plugin の契約を確認する。
- `index.html` にインライン JavaScript を置かない。共有定数は `src/core/constants.js` に寄せる。
- 構成を変えたら `CODEBASE_GUIDE.md`、現在地や注意点を変えたら `PROGRESS.md` を更新する。

## 実装の進め方

1. 再現条件または受け入れ条件を一文で決める。
2. `CODEBASE_GUIDE.md` の入口と直接依存だけを読む。
3. 最小差分で実装し、保存・再生・native の境界をまたぐ時だけ確認範囲を広げる。
4. 変更リスクに応じた最小の確認を行い、結果を記録する。

同じ不具合で別の仮説を試す時は、効果のなかった差分を戻してから次へ進む。無関係なリファクタ、テストの書換え、生成物の更新を混ぜない。

## UI の扱い

- UI関連ファイルを編集する前に、アスキーアートで概形・主要寸法・変更理由を示し、ユーザーの承認を得る。
- Mobile First を守り、タップ領域は原則44px以上にする。
- 実装後は Web で見た目を確認し、主要な幅・高さ・余白はpxとCSS変数/定数の位置を引き継ぎに残す。

## サブエージェントとスキル

- 分離できる責務だけを並行化する。同じファイル、同じ状態遷移、同じ検証失敗を複数担当で同時に扱わない。
- 親担当は作業計画、共有ファイル、統合、最終確認を所有する。子担当には「目的・読んでよい範囲・編集可否・完了条件」を明記する。
- 既存担当が文脈を持つなら再利用し、待機中の担当は終了して枠を空ける。
- 調査だけの担当は読み取り専用にし、発見・根拠・推奨だけを返す。実装担当は担当ファイルを明示する。
- skill が明示された、または作業内容がskillの説明に一致する時だけ使う。使用前に親担当が `SKILL.md` 全体を読み、必要な最小skillだけを選ぶ。

## 確認とデバッグ

確認方法の選択、Browser手順、WebKit / Simulatorの使い分けは `docs/codex-workflow.md` を正本にする。原則は次の順番。

1. `rg` と対象コードで事実を絞る
2. 局所的な手動確認または Browser確認
3. 変更リスクがある時だけ build / WebKit smoke
4. storage bridge、native audio、Share、lifecycle は Simulator / 実機

テスト失敗時は、最初の失敗箇所・コンソール・スクリーンショット/traceを読む。失敗を隠すために待機時間、`force`、期待値だけを先に増やさない。UI契約の変更が根拠である時だけテスト期待値を更新する。

## 記録とバージョン

- `PROGRESS.md` は「大目標 / 中目標 / 次の作業予定 / 変更履歴」を保ち、現在の判断に不要な履歴は要約する。
- 変更履歴には、変更内容、確認結果、残る未検証事項だけを1項目で残す。
- 修正を入れたら `package.json` のpatch versionを上げ、`package-lock.json` のroot versionも同期する。

## 変わらないプロダクト・技術制約

- 音楽初学者向けのスマホ作曲ツール。機能追加より既存操作の明確さを優先する。
- 1小節は48ステップ。トラック種別は `rhythm / chord / melody`。
- 繰り返しはトラック単位で `appState.repeatStates[trackId]` に持つ。黄色は型、緑は反映済みで、緑の編集は黄色へ逆流しない。
- 依存方向は `main -> ui/editors/features -> core`。`editors -> core`、`features -> core`、`ui -> features/core` を守る。

## 代表コマンド

- Web確認: `npm run dev -- --host 127.0.0.1`
- build: `npm run build`
- WebKit smoke: `npm run test:e2e:webkit`
- iOS sync / Simulator: `npm run mobile:sync:ios` / `npm run mobile:run:ios:sim`
- 環境確認: `npm run mobile:doctor`
