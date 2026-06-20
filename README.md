# ezmelo

音楽初学者向けのスマホ作曲ツールです。
ドラム、コード、メロディを組み合わせて、短い曲を直感的に作れます。

## Web版

https://ezmelon.com

スマートフォンでの操作を前提にしています。

## 主な機能

- ドラム、コード、メロディの編集
- 通常リズム / 3連リズムの入力
- コードトーンを見ながらメロディを作る補助表示
- 小節単位のコピー、繰り返し、再生範囲指定
- プロジェクトの保存、インポート、エクスポート
- 初回操作用のチュートリアル
- Web版とCapacitorによるモバイルアプリ構成

## 使用技術

- JavaScript
- Vite
- Tone.js
- Capacitor
- Swift
- Playwright

## 開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

## よく使うコマンド

```bash
npm run release:build
npm run test:e2e:webkit
npm run mobile:doctor
npm run mobile:sync:ios
npm run mobile:run:ios:sim
```

## ディレクトリ構成

```text
src/
  core/       状態、定数、リズム、音楽理論
  editors/    ドラム、コード、メロディ、全体プレビュー
  features/   再生、保存、bridge、トラック管理
  ui/         トップバー、下部バー、プロジェクト一覧、チュートリアル
  styles/     CSS
ios/
  App/App/NativePlaybackPlugin.swift
```

アプリ本体の正本は `src/` です。
Web / native の違いは `src/features/bridges/` にまとめています。
