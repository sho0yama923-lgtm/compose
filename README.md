# ezmelo

音楽初学者向けのスマホ作曲ツールです。ドラム、コード、メロディを 1 画面で組み合わせながら、短い曲の形を直感的に作れることを目標にしています。

Web で動作し、Capacitor を通して iOS / Android アプリとしても動かせる構成です。iOS では Web Audio だけに頼らず、native 再生 plugin へスコアを渡す経路も実装しています。

## Demo

- Web: https://sho0yama923-lgtm.github.io/compose/
- 対象: スマートフォン表示を前提にした作曲体験

## Features

- ドラム、コード、メロディのトラック編集
- 1 小節 48 ステップ解像度による通常 / 3 連リズムの入力
- コードトーンを見ながらメロディを置ける補助表示
- 小節単位のコピー、繰り返し、再生範囲指定
- プロジェクト一覧、保存、インポート / エクスポート
- 初回操作を案内するチュートリアル
- Web 公開、iOS / Android Capacitor build、iOS native 再生

## Tech Stack

- JavaScript
- Vite
- Tone.js
- Capacitor
- Swift / iOS native plugin
- Playwright
- GitHub Actions

## Architecture

アプリ本体の正本は `src/` です。

- `src/core/`: 状態、定数、音価、リズム変換、音楽理論
- `src/editors/`: ドラム、コード、メロディ、全体プレビューの描画
- `src/features/`: 再生、保存、bridge、トラック管理
- `src/ui/`: プロジェクト一覧、トップバー、下部バー、チュートリアル
- `src/styles/`: 画面スタイル
- `ios/App/App/NativePlaybackPlugin.swift`: iOS native 再生

Web / native の境界は `src/features/bridges/` に集約し、保存、共有、再生の実行環境差を分離しています。

## Getting Started

```bash
npm install
npm run dev
```

ローカルでは `http://127.0.0.1:5173` を開きます。

## Useful Commands

```bash
npm run build
npm run release:build
npm run test:e2e:webkit
npm run mobile:doctor
npm run mobile:sync:ios
npm run mobile:run:ios:sim
```

## Quality Checks

- `npm run release:build` で Vite build と公開成果物チェックを実行
- `npm run test:e2e:webkit` で WebKit smoke test を実行
- GitHub Actions で audit、release build、WebKit smoke、Pages deploy を実行
- iOS は Capacitor sync 後、Simulator / Xcode で確認

## Notes

- `dist/`、Playwright report、mobile sync 生成物は Git 管理しません。
- 音源サンプルは `sounds/` を正本として管理しています。
- 開発ルールとファイル責務は `AGENTS.md`、`CODEBASE_GUIDE.md`、`docs/coding-rules.md` にまとめています。
