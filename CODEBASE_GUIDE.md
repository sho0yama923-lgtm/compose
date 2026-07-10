# CODEBASE_GUIDE.md

このファイルは、作業前に「どのファイルを読むか / 触るか」を決めるための入口です。
トークンの無駄遣いを防ぐため、まず作業タイプを選び、該当する入口だけを読んでください。

## 最初に読む順番

1. `AGENTS.md`
2. `PROGRESS.md`
3. このファイル
4. 変更対象の入口ファイル
5. 必要になった時だけ `docs/coding-rules.md`

スマホ開発や native ビルド運用だけを触る場合は、追加で `docs/mobile-dev.md` を読んでください。確認コマンドの選択と失敗時の調査は `docs/codex-workflow.md` を正本にします。

## ファイル区分

### 現行コード

- `src/`
  - アプリ本体の正本。UI、作曲ロジック、保存データ、score 生成はここを編集する
- `index.html`
  - DOM の土台。インライン JavaScript は置かない
- `sounds/`
  - Web / native に渡す音源サンプルの正本
- `ios/App/App/NativePlaybackPlugin.swift`
  - iOS 実機向け native 再生 plugin
- `ios/App/App/AppDelegate.swift`
  - Capacitor と iOS scene / plugin 登録の入口
- `ios/App/App/Info.plist`
  - iOS アプリ設定
- `android/app/src/main/`
  - Android の manifest、MainActivity、res 資産
- `package.json`
  - npm scripts と依存関係
- `vite.config.js`
  - Vite 設定と音源 copy plugin
- `capacitor.config.json`
  - Capacitor root 設定
- `playwright.config.js`、`tests/`
  - WebKit smoke の確認基盤
- `.codex/environments/environment.toml`
  - Codex app の project actions。Run / Build / WebKit smoke / iOS sync などの共有導線
- `.github/workflows/web-release-check.yml`
  - Web公開前の依存監査、成果物検査、`dist/`に対するWebKit smoke
- `public/CNAME`
  - GitHub Pages artifact に同梱する custom domain 設定。root 直下の `CNAME` は追跡しない
- `scripts/verify-web-release.mjs`
  - `dist/` の外部script、音源、容量を検査する公開判定script
- `.xcodebuildmcp/config.yaml`
  - XcodeBuildMCP の iOS Simulator session defaults。Codex から `build_run_sim` する時の正本
- `scripts/run-ios-simulator.mjs`
  - Terminal / Codex action から iOS Simulator へ sync、build、install、launch する補助 script

### レガシー / 互換 / 参照のみ

- `CLAUDE.md`
  - `CLAUDE.md` を読むツール向けの互換入口。実装ルールの正本は `AGENTS.md`
- `legacy/local-dev/dev-server.py`
  - Vite 以前/補助確認用の簡易サーバー。通常は `npm run dev` を使う
- `legacy/local-dev/start.command`
  - macOS で開発サーバーを起動してブラウザを開く補助導線
- `legacy/netlify/netlify.toml`、`legacy/netlify/_headers`
  - Netlify 配信用に使っていた旧設定。現在の公開先は GitHub Pages
- `docs/reports/security_best_practices_report.md`
  - 公開前セキュリティ確認の過去レポート

### 生成物 / 依存物

これらは手編集しません。変更したい場合は正本側を直して再生成します。

- `dist/`
- `node_modules/`
- `playwright-report/`
- `test-results/`
- `test-results 2/`
- `compose-web-*.zip`
- `.claude/`
- `.vscode/`
- `ios/App/App/public/`
- `ios/App/App/capacitor.config.json`
- `ios/App/App/config [0-9]*.xml`
- `android/app/src/main/assets/public/`
- `android/app/src/main/assets/capacitor.config.json`
- `android/app/src/main/assets/capacitor.plugins.json`
- `android/**/build/`
- `ios/**/xcuserdata/`
- `ios/**/*.xcuserstate`

## ディレクトリ責務

- `src/main.js`
  - 起動順序、初期化、保存フック、初回トラック生成
- `src/core/`
  - 状態、アプリバージョン、定数、BPM、duration、リズム分割、音楽理論、操作ガードなどの低レベル共通ロジック
- `src/editors/`
  - ドラム、メロディ、コード、全体プレビューの描画と UI イベント
- `src/features/`
  - 再生、保存、bridge、トラック管理、楽器定義などの振る舞い単位のロジック
- `src/features/bridges/`
  - audio / storage / file-share / device の Web / native 境界
- `src/ui/`
  - プロジェクト一覧、トップバー、下部バー、トラックドロワー、モーダル、オンボーディング
- `src/styles/`
  - CSS の正本。入口は `src/styles/editor.css`
- `docs/`
  - 運用、ビルド、実装ルールなどの補助文書
  - Web 一般公開の確認は `docs/public-release.md`

## 作業タイプ別の入口

### 起動や初期表示

- `src/main.js`
- `src/core/state.js`
- `src/core/tutorial-events.js`
- `src/features/project/canon-sample.js`
- `src/ui/project-home.js`
- `src/ui/onboarding.js`
- `src/ui/topbar.js`
- `src/ui/track-drawer.js`
- `src/editors/editor-router.js`

### 音価や 48 ステップ変換

- `src/core/constants.js`
- `src/core/duration.js`
- `src/core/rhythm-grid.js`
- `src/editors/duration-toolbar.js`

### ドラム画面

- `src/editors/drum-editor.js`
- `src/styles/editors/drum.css`
- `src/features/tracks/instruments/instrument-config.js`
- 保存互換が絡む場合は `src/features/project/storage/storage-helpers.js`

### メロディ画面

- `src/editors/melodic-editor.js`
- `src/styles/editors/melodic.css`
- `src/core/music-theory.js`
- `src/core/duration.js`

### コード画面

- `src/editors/chord-editor.js`
- `src/editors/chord/render-chord-editor.js`
- `src/editors/chord/chord-progress-section.js`
- `src/editors/chord/chord-timing-section.js`
- `src/editors/chord/chord-detail-sheet.js`
- `src/styles/editors/chord.css`

### 全体プレビュー / トラックカード

- `src/editors/preview-editor.js`
- `src/editors/preview/render-preview.js`
- `src/editors/preview/preview-row.js`
- `src/editors/preview/preview-actions.js`
- `src/editors/preview/preview-repeat.js`
- `src/editors/preview/preview-tone-sheet.js`
- `src/editors/preview/preview-song-settings.js`
- `src/ui/bottom-bar.js`

### 保存 / 読込 / 移行

- `src/features/project/project-storage.js`
- `src/features/project/storage/storage-core.js`
- `src/features/project/storage/storage-helpers.js`
- `src/features/bridges/storage-bridge.js`
- `src/ui/project-home.js`
- `src/core/state.js`

保存対象を増やす時は serialize / normalize / migrate を必ず同時に確認してください。
プロジェクト一覧は `projectIndex` 相当のメタ情報と `project:{id}` 相当の本体保存を分け、編集画面の上書き保存は active project に対して行います。

### 再生タイミング / 音作り

- `src/features/playback/playback-controller.js`
- `src/features/playback/score-builder.js`
- `src/features/playback/score-serializer.js`
- `src/features/bridges/audio-bridge.js`
- `src/features/playback/scheduler.js`
- `src/features/tracks/instruments/playback-chains.js`
- `src/features/tracks/instruments/track-tone.js`
- iOS native が絡む場合は `ios/App/App/NativePlaybackPlugin.swift`

### トラック追加 / 削除 / 小節操作 / 繰り返し

- `src/features/tracks/tracks-controller.js`
- `src/features/tracks/controller/track-selection.js`
- `src/features/tracks/controller/track-measures.js`
- `src/features/tracks/controller/track-repeat.js`
- `src/core/state.js`
- `src/ui/bottom-bar.js`

### 楽器定義 / 音源追加

- `src/features/tracks/instrument-map.js`
- `src/features/tracks/instruments/instrument-config.js`
- `src/features/tracks/instruments/playback-chains.js`
- `sounds/`
- native preload が絡む場合は `src/features/playback/score-serializer.js`

### WebKit / ブラウザ確認

- `.codex/environments/environment.toml`
- `playwright.config.js`
- `tests/webkit-smoke.spec.js`
- `package.json`

局所確認は `Run` action または `npm run dev:codex` とBrowserを使う。`dev:codex` は `127.0.0.1:5173` を固定し、使用中なら別ポートへ逃げずに停止する。Web回帰は `npm run test:e2e:webkit`、release artifactは `npm run release:build && npm run test:e2e:webkit:preview` を使う。具体的な選択と失敗時の調査は `docs/codex-workflow.md` を参照する。

### iPhone アプリ

- `package.json`
- `src/core/app-info.js`
- `docs/mobile-dev.md`
- `docs/ios-build.md`
- `capacitor.config.json`
- `package.json`
- `.xcodebuildmcp/config.yaml`
- `scripts/run-ios-simulator.mjs`
- `ios/App/App/NativePlaybackPlugin.swift`
- `ios/App/App/AppDelegate.swift`
- `ios/App/App/Info.plist`

アプリバージョンの正本は `package.json` の `version` とし、Web ビルドには Vite が埋め込む。`npm run version:sync` または `npm run mobile:sync:ios` で iOS の `MARKETING_VERSION` へ反映し、`npm run mobile:doctor` で不一致を検出する。

### Android アプリ

- `docs/mobile-dev.md`
- `docs/android-build.md`
- `capacitor.config.json`
- `package.json`
- `android/app/src/main/`

## 読み方のルール

- まず作業タイプ別の入口だけ読む
- 入口から呼ばれているファイルを必要分だけ辿る
- 保存、再生、bridge、native の変更は影響範囲が広いので、対応する入口セットを全部見る
- 生成物やレガシー/互換ファイルを新規実装の入口にしない
- 構成や責務を変えたら、このファイルと `PROGRESS.md` を更新する
