# PROGRESS.md

最終更新: 2026-06-09

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

- 2026-06-09: 音価ツールバーの3連バッジ位置を `top: 1px` に下げ、付点ボタンは使用可能な通常音価の時だけ表示するようにした。3連時の不要な空枠を削除し、`npm run build` が成功した
- 2026-06-09: プレビューカードの繰り返しボタンに提供SVG `src/assets/repeat_loop_icon.svg` を採用した。ボタンは `30px`、アイコン表示は `22px` のまま、`npm run build` が成功した
- 2026-06-09: プレビューカード右上の繰り返し / オプションボタンを `20px`、内側アイコン / 記号を `15px` に変更した。寸法は `--preview-header-small-button-size` / `--preview-header-small-icon-size` に集約し、`npm run build` が成功した
- 2026-06-09: プレビューカード黒帯の右側余白を `8px` にしてボタンと音量を右詰めにし、繰り返しONボタン背景を緑に変更した。寸法と色は `--preview-header-right-gap` / `--preview-repeat-active-bg` / `--preview-repeat-active-border` に集約し、`npm run build` が成功した
- 2026-06-09: プレビューカード黒帯の左側余白も `8px` にしてチェックと楽器名を左詰めにし、繰り返しボタンの緑表示を反映済み範囲の解除操作時だけに限定した。`npm run build` が成功した
- 2026-06-09: プレビューカードの繰り返しボタンを常時表示にし、範囲未指定時は直前 `1` 小節を型範囲として現在小節へ繰り返す既定動作を追加した。1小節目など実行できない状態は disabled にし、`npm run build` が成功した
- 2026-06-09: プレビューカードの3点リーダーをメニュー入口にし、音作り / コピー / ペーストを1段ずつ縦に並べた。コピー/ペーストの長押し起点は削除し、`npm run build` が成功した
- 2026-06-09: コピー操作を専用パネル表示に変更し、選択トラック名、終点の `B小節`、`コピー範囲: A小節からB小節まで`、既存の前後/実行/中止操作を表示するようにした。`npm run build` が成功した
- 2026-06-09: コピー範囲指定中は対象トラックの範囲内小節を青表示にし、繰り返しの黄/緑より優先されるようにした。コピー中止は3点メニュー自体を閉じる動作に変更し、`npm run build` が成功した
- 2026-06-09: コピー範囲指定中の色を赤に統一し、カード範囲表示と下部小節バーに赤いコピー範囲ハイライトを表示するようにした。`npm run build` が成功した
- 2026-06-09: 3点メニューのクリップボード説明チップを削除し、ペーストボタン押下後に「A小節からB小節をコピー中」/ ペースト / キャンセルの確認パネルを挟むようにした。`npm run build` が成功した
- 2026-06-09: コピー/ペーストの範囲文言を1小節だけの時は `A小節` と表示するようにし、コピー範囲指定中は下部小節バーの移動操作を無効化した。`npm run build` が成功した
- 2026-06-09: コピー範囲の終点選択をコピー専用パネル内の小型 `< >` から下部の既存小節移動ボタンへ移し、コピー中の赤枠を疑似要素で左右の繰り返しバーより上位レイヤーに表示するようにした。`npm run build` が成功した
- 2026-06-09: 音価ツールバーのCSS描画音符を `src/assets/全音符.svg` / `二分音符.svg` / `四分音符.svg` / `八分音符.svg` / `十六分音符.svg` に置き換えた。選択中はCSS filterで白表示にし、`npm run build` が成功した
- 2026-06-09: 音価ツールバーのSVG音符サイズを調整し、全音符は `18px`、二分/四分/八分/十六分音符は `26px`、アイコン枠は `26px` にした。`npm run build` が成功した
- 2026-06-09: メロディ/コード系上部ツールバーから `編集線` / `長さ` / `oct` / 区切り線テキストを削除し、オクターブ範囲表示を `表示 3オクターブ - 5オクターブ` 形式に変更した。`npm run build` が成功した
- 2026-06-08: テスト/確認方針を更新し、UI の見た目や WebView 内で完結する操作は Web / in-app Browser、内部ロジック、保存 bridge、native 再生、share sheet、iOS 固有挙動は iOS Simulator で確認する運用に整理した
- 2026-06-08: テストは変更リスクに見合う最小限に留め、手動確認や局所的なブラウザ確認で十分な時は WebKit smoke や Simulator 起動まで広げない方針を明文化した
- 2026-06-08: 新規プロジェクト作成時にプロジェクト名入力ダイアログを表示するようにした。入力欄高さは `48px`、操作ボタンは `44px` 以上、空欄時は作成ボタンを disabled にする。Web / in-app Browser で入力フローを確認し、`npm run build` が成功した
- 2026-06-08: Mac 内 iOS Simulator 確認環境を構築した。`.xcodebuildmcp/config.yaml` に `ios/App/App.xcodeproj` / scheme `App` / `iPhone 17` を設定し、XcodeBuildMCP `build_run_sim` が成功、screenshot で起動画面を確認した
- 2026-06-08: `npm run mobile:run:ios:sim` を追加し、Capacitor sync、Simulator boot、Xcode build、install、launch を一括実行できるようにした。DerivedData は `/tmp/compose-ios-sim-derived/`、bundle id は `com.yamaoxiogo.compose`
- 2026-06-08: iOS Simulator 実機相当表示でプロジェクト一覧を確認し、プロジェクトがある時に空状態が残る CSS bug を `.project-home-empty[hidden]` で修正した。`npm run build` / `npm run test:e2e:webkit` / `npm run mobile:run:ios:sim` が成功
- 2026-06-08: iOS 前提の保存体験として起動時にプロジェクト一覧を表示し、選択した active project へ基本上書き保存する構成に変更した。一覧 UI は左右 `20px`、カード高さ `94px`、名前変更/削除アイコン `44px`、下部アクション `48px`
- 2026-06-08: 保存 bridge を project index / active project / project body の複数保存に対応させ、Web は localStorage、native は Library 配下の app 内部ファイルへ保存する形にした。Files app は JSON 読込/書出の共有・バックアップ導線として残す
- 2026-06-08: `npm run build` と `npm run test:e2e:webkit` が成功し、Codex in-app Browser で一覧表示、新規作成、リロード後の一覧から再オープン、主要寸法、コンソールエラーなしを確認した
- 2026-06-07: プレビューカードの発音チェックをカード左上のタイトル横へ移動し、「発音」テキストを削除した。チェックの見た目は `20px`、タップ領域は `44px`、右上ボタンは `28px`
- 2026-06-08: プレビューカード右上の繰り返し / 音作りアイコンは円背景と枠を外し、タップ領域 `44px`、記号サイズ `28px` のアイコン単体表示へ変更した
- 2026-06-07: Codex app / GPT-5.5 前提の運用に合わせ、`.codex/environments/environment.toml` に Run / Build / WebKit Smoke / iOS Sync / Mobile Doctor actions を追加した
- 2026-06-07: `AGENTS.md`、`CODEBASE_GUIDE.md`、`docs/mobile-dev.md` に in-app Browser / Browser plugin で UI 確認する導線を追加し、`docs/codex-workflow.md` を新設した
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
