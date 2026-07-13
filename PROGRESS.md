# PROGRESS.md

最終更新: 2026-07-10

## 進捗ルール

- 次の担当がこのファイルだけで「今の目的・未検証・次の一手」を判断できる状態を保つ。
- `大目標`、`中目標`、`次の作業予定`、`変更履歴` を維持する。完了済みの試行錯誤は残さない。
- 変更履歴は1件につき、変更 / 根拠 / 確認 / 残課題を短く記録する。
- 構成、入口、責務を変えたら、同じ作業で `CODEBASE_GUIDE.md` と必要なrunbookを更新する。

## 大目標

- iOSアプリとしてリリースできる状態にし、初学者が作曲・保存・再生・共有を実機で安定して行えるようにする。
- `src/` をアプリの正本とし、Web / native / 生成物の境界を崩さない。

## 中目標

- iOS実機で作曲、保存、読込、ループ、試聴、共有、復帰後再生を確認する。
- App Store提出に必要な署名、PrivacyInfo、App Store Connectの設定をそろえる。
- 保存は validate / normalize / restore、再生は score / bridge / native payload の契約を維持する。

## 次の作業予定

1. `Run` actionから固定URLでin-app Browserを開き、Safari対象UI（プロジェクト操作メニュー、上部タブ横スクロール、プレビューカード、下部プレイヤー）を確認する。
2. Xcode OrganizerでarchiveをApp Store Connect用署名へ切り替え、Validate / Distributeを通す。
3. Privacy Nutrition Labelsと `ios/App/PrivacyInfo.xcprivacy` を一致させ、Version / Build / Bundle ID / Team / app recordを提出値へそろえる。

## 現在の注意点

- Web UIの確認は `docs/codex-workflow.md` のBrowser手順を優先する。WebKit smokeはWeb回帰用で、iOS nativeの代替ではない。
- Safari / 復帰後の音声は、ユーザー操作内でWeb Audioを復旧する設計。復帰イベントで自動的にTone contextを再開しない。
- 保存データの上限は128小節・64トラック。編集時とインポート時の両方で守る。

## 変更履歴

- 2026-07-13: 作曲ソフト初心者向けにWeb UIの情報階層を整理。ホームへ用途説明を加え、ワークスペース共通の色・余白・角丸・focus表示を定義し、全体プレビューの「曲の設定」とトラックカードを統一した。390×844pxと1280×720pxで横溢れなし、新規作成・reload後の再読込、`npm run build`、WebKit smoke 4件成功。既存のローカル一覧だけが残った2件は本体欠損のため読込不可だが、新規保存経路は正常。version `1.0.8`。
- 2026-07-10: CodexのBrowser確認導線を固定化。`Run` actionを`npm run dev:codex`へ切り替え、`127.0.0.1:5173`を`--strictPort`で固定した。Browserの古いタブ、ポート競合、タブ接続喪失ごとの復旧順をrunbookへ追加。`npm run build`とスクリプト定義確認が成功。version `1.0.7`。
- 2026-07-10: Safari向けのUI視認性と操作導線を改善。プロジェクトカードの常時表示していた編集・削除を1つのSVG操作メニューへ集約し、上部タブに横スクロールのsnap、全体プレビューの操作ボタン・文字・音量表示を拡大した。下部プレイヤー、メニュー、追加、編集、削除、オプションをSVGアイコンへ統一。`npm run build` とWebKit smoke 4件成功。version `1.0.6`。
- 2026-07-10: エージェント作業契約、短い復帰記録、Web / nativeのデバッグrunbookを再編。作業種別ごとに最小確認を選ぶ表、サブエージェント / skillの分担基準、失敗artifactの読み方を追加した。release CIは`dist/`をpreview serverで検証し、失敗時はreport・trace・videoをartifact化する。dev WebKit smokeは4件、release artifact smokeは2件成功。version `1.0.5`。
- 2026-07-10: 保存・インポートの堅牢性を改善。128小節 / 64トラック上限を編集・貼り付け・インポートで統一し、音価・コード・`nextId`の検証/正規化で再生例外とID重複を防止。WebKit smokeは4件成功、`npm run build`成功。version `1.0.4`。
- 2026-06-21: Web Safariの復帰後無音を、ユーザー操作内でのcontext / playback chain再構築へ整理。Pianoは再生に必要なサンプルだけを読む。GitHub Pages移行とiOSリリース準備を進めた。
- 2026-06-08: プロジェクト一覧、Web / native保存bridge、iOS Simulator導線、`src/`中心の責務分割を整備した。

## 過去の要約

- `src/` は `core / editors / features / ui / styles` に分割済み。保存はproject indexとproject body、再生はscore生成・serializer・bridge・scheduler・iOS native pluginに分離している。
