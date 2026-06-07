# PROGRESS.md

最終更新: 2026-06-07

## 進捗ルール

- 作業の区切り、構成変更、目標変更、次の作業予定が変わった時はこのファイルを更新する
- `大目標`、`中目標`、`次の作業予定`、`変更履歴` の形を保つ
- 長大な詳細履歴は残さず、現在の作業判断に必要な要約だけを書く
- 実装済み機能は詳細な手順や試行錯誤を残さず、何が完成したか、どの責務に収まったか、次に影響する注意点だけへ圧縮する
- 同じ機能の変更履歴が増えたら、古い個別ログを 1 行の機能要約へ統合する
- 不具合調査の一時メモは、解決後に原因、修正先、再発防止だけへ圧縮する
- 構成や入口ファイルを変えたら `CODEBASE_GUIDE.md` も更新する
- ディレクトリ責務や依存方向を変えたら `docs/coding-rules.md` も更新する
- 次に触る人は作業前に `AGENTS.md`、このファイル、`CODEBASE_GUIDE.md` を読む
- UI 変更時は主要な高さ・幅を `px` で明示し、CSS 変数や定数へ寄せる

## 大目標

- 次の到達点は iOS アプリとしてリリースできる状態にすること
- 音楽初学者向けの直感的なスマホ作曲ツールとして、iPhone 実機で安定して作曲、保存、再生、共有できる体験を固める
- App Store 公開に向けて、ビルド、署名、審査前確認、リリース手順を整える
- `src/` を現行コードの正本として保ち、レガシー/互換/生成物を誤って触らない開発導線を維持する

## 中目標

- iOS 実機での作曲、再生、停止、ループ、試聴、保存、読込、共有の主要フローを安定させる
- iOS native 再生は JS 側の score / manifest と `NativePlaybackPlugin.swift` の契約を崩さず改善する
- App Store リリース前に必要なアプリ設定、アイコン、スプラッシュ、PrivacyInfo、署名、ビルド手順を確認する
- `docs/mobile-dev.md` と `docs/ios-build.md` をリリース作業の runbook として使える状態に保つ
- 作業前に `CODEBASE_GUIDE.md` で作業タイプを選び、読むファイルを絞る
- `docs/coding-rules.md` のディレクトリ設計ルールに従い、責務が混ざる前に分割する
- 再生まわりは `score-builder`、`score-serializer`、`audio-bridge`、`scheduler`、native plugin の責務分離を崩さない
- 保存項目を増やす時は serialize / normalize / migrate を同時に確認する
- UI 変更は Mobile First を維持し、主要寸法を px と CSS 変数/定数で追跡しやすくする

## 次の作業予定

- Xcode 実機または `Any iOS Device` で Archive を作成し、Organizer の Validate App を通す
- iOS 実機で `docs/ios-build.md` の acceptance flow に沿って、再生、停止、ループ、試聴、保存、読込、共有を確認する
- App Store Connect の Privacy Nutrition Labels と `ios/App/PrivacyInfo.xcprivacy` の「追跡なし、収集データなし、file timestamp C617.1」を一致させる
- Version / Build、Bundle Identifier、Team、App Store Connect の app record を提出予定値にそろえる
- レガシー候補の `swipe.js` を削除するか、必要なら `src/` 配下へ現行責務として移すか判断する
- tracked 済みの `.DS_Store` をリリース前に整理する

## 変更履歴

- 2026-06-07: リリース前のため旧保存形式の互換 migration を削除し、保存 version を 11 に上げ、復元を現行 48 step / `songRoot + songHarmony + songScaleFamily` 形式へ単純化した
- 2026-06-07: 再生まわりの音量 clamp / 数値正規化を `src/core/number-utils.js` に集約し、native payload 生成の track lookup を Map 化した
- 2026-06-07: `playback-controller.js` の再生 click handler を `buildPlaybackContext` / `startPlayback` へ分け、イベント登録と再生開始処理の責務を整理した
- 2026-06-07: iOS release hygiene として `PrivacyInfo.xcprivacy` を App target の Resources に追加し、built `.app/PrivacyInfo.xcprivacy` に入ることを確認した。manifest は追跡なし、収集データなし、file timestamp `C617.1`
- 2026-06-07: `docs/ios-build.md` に App Store 提出前チェック、実機 acceptance flow、privacy manifest 更新条件を追加した
- 2026-06-07: `npm run mobile:doctor`、`npm run mobile:sync:ios`、XcodeBuildMCP の iPhone 17 simulator build が Debug / Release ともに成功した
- 2026-06-07: iOS リリース準備と GitHub 運用に使う Codex skills として `playwright`、`gh-fix-ci`、`gh-address-comments`、`yeet`、`security-best-practices` を導入した。反映には Codex の再起動が必要
- 2026-06-07: 次の大目標を iOS アプリとしてのリリースに定め、作業方針をリリース準備中心へ更新した
- 2026-06-07: 実装済み機能は詳細ログを残さず、完成内容、責務、注意点へ圧縮する進捗ルールを明文化した
- 2026-06-07: トークン節約のため、作業入口を `CODEBASE_GUIDE.md` に統合した
- 2026-06-07: `docs/file-structure.md` と `docs/architecture.md` と `DESIGN.md` を廃止し、重複する役割を `CODEBASE_GUIDE.md` / `docs/coding-rules.md` に統合した
- 2026-06-07: `docs/coding-rules.md` にディレクトリ設計ルールを追加し、煩雑化防止の正本にした
- 2026-06-07: `PROGRESS.md` の長大な過去ログを要約へ圧縮し、大目標・中目標・次の作業予定・変更履歴の運用に整理した

## 過去の要約

- `src/` ベース構成へ移行済み。`core / editors / features / ui / styles` を主な責務境界として扱う
- コードエディタと全体プレビューはファサード化し、内部を責務別ファイルへ分割済み
- 保存処理は `project-storage.js` を入口に、`storage-core / storage-helpers` へ分割済み
- 再生処理は score 生成、native payload、audio bridge、Tone.js fallback、iOS native plugin に分離済み
- CSS は `src/styles/editor.css` を入口に、`base / components / editors` へ分割済み
- 内部解像度は 1 小節 48 ステップ。通常/3連は `src/core/rhythm-grid.js` で変換する
- 繰り返し状態はトラック単位で `appState.repeatStates[trackId]` に保持する。黄色は型範囲、緑は反映済み範囲
- `src/` がアプリ本体の正本。`ios/` / `android/` は native 固有コードと wrapper に限定する
