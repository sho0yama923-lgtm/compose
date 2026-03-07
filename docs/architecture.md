# architecture.md

## 現在の構成方針

- `src/main.js`
  - アプリ初期化だけを担当する
- `src/core/`
  - 共有状態、定数、duration処理、リズム変換のような低レベル共通ロジック
- `src/editors/`
  - ドラム、メロディ、コード、プレビューの描画
- `src/features/`
  - 再生、保存、トラック管理のような振る舞い単位のロジック
- `src/ui/`
  - サイドバー、モーダル、トップバー補助、下部シークバーなどアプリ外枠の UI
- `src/styles/`
  - 現状は `editor.css` に集約。将来 `base/layout/components/mobile` に分割予定

## 依存方向

- `main -> ui/editors/features -> core`
- `editors -> core`
- `features -> core`
- `ui -> features/core`

## 近いうちにやる整理

- `src/styles/editor.css` を `base/layout/components/mobile/editor` に分割

## 今はやらないこと

- `shared/` ディレクトリの追加
- save/load のファイル分割
- 機能追加を伴う構成変更
