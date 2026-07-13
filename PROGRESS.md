# PROGRESS.md

最終更新: 2026-07-13

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

1. GitHub Pages のCDNキャッシュ更新後、`https://ezmelon.com/` が HTTPS 200 になることを確認する。
2. `Run` actionから固定URLでin-app Browserを開き、Safari対象UI（プロジェクト操作メニュー、上部タブ横スクロール、プレビューカード、下部プレイヤー）を確認する。
3. Xcode OrganizerでarchiveをApp Store Connect用署名へ切り替え、Validate / Distributeを通す。
4. Privacy Nutrition Labelsと `ios/App/PrivacyInfo.xcprivacy` を一致させ、Version / Build / Bundle ID / Team / app recordを提出値へそろえる。

## 現在の注意点

- `ezmelon.com` は Pages API 上で custom domain、GitHub Actions配信、HTTPS強制、証明書承認まで反映済み。`/index.html` は 200 だが、ルート `/` は設定変更前の404がGitHub CDNに一時キャッシュされている。
- Web UIの確認は `docs/codex-workflow.md` のBrowser手順を優先する。WebKit smokeはWeb回帰用で、iOS nativeの代替ではない。
- Safari / 復帰後の音声は、ユーザー操作内でWeb Audioを復旧する設計。復帰イベントで自動的にTone contextを再開しない。
- 保存データの上限は128小節・64トラック。編集時とインポート時の両方で守る。

## 変更履歴

- 2026-07-13: GitHub Pages を再確認し、`cname: ezmelon.com`、`build_type: workflow`、HTTPS強制、証明書承認済みへの更新を確認。`/index.html` は HTTPS 200、ルートは旧404のCDNキャッシュ（HIT）が残っているため時間経過後の再確認が必要。コード変更なし。
- 2026-07-13: `ezmelon.com` の公開障害を実環境で診断。DNSとデプロイ成果物は正常、Pages のリポジトリ設定が legacy branch 配信かつ custom domain 未設定であることを確認した。診断のみのためコード・Pages設定は未変更。
- 2026-07-13: 通常/3連と音符を上部トラック選択と同じフラットな選択バーへ変更。個別ボタンの枠・背景・間隔をなくし、透明な44px以上の操作領域と青い3px下線だけを残した。モード群と音符群の間は既存の1px縦線と8px余白を維持。Pianoで通常/3連を切り替え、390×844pxと1280×720pxの実ブラウザで枠0px・背景透明・group gap 0px・縦線1px・横溢れなし・console errorなしを確認し、`npm run build` 成功。WebKit smoke / nativeは未実施。version `1.0.27`。
- 2026-07-13: 通常/3連と音符ボタン、選択中の青い下線を `border-radius: 0` へ変更し、直角のステップシーケンサー表現へ統一。オクターブ操作など他部品の角丸は維持した。Pianoで通常/3連を切り替え、390×844pxと1280×720pxの実ブラウザでボタン・下線とも0px、操作領域44px以上、横溢れなし、console errorなしを確認し、`npm run build` 成功。WebKit smoke / nativeは未実施。version `1.0.26`。
- 2026-07-13: 通常/3連と全音符ボタンの選択表現を黒背景から白背景＋青い3pxアンダーラインへ統一。未選択と同じ枠・黒文字/黒い音符を保ち、`src/styles/components/duration-toolbar.css` の `--workspace-accent` で選択だけを示す。Pianoで通常→3連、1拍3連→半拍3連、通常への復帰を実ブラウザ確認し、390×844pxと1280×720pxで白背景・3px下線・横溢れなし、console errorなし、`npm run build` 成功。WebKit smoke / nativeは未実施。version `1.0.25`。
- 2026-07-13: Pianoの音域レールを音価ボタンと同じ白黒・8px角丸へ統一し、中央を黒地の `OCT | 3 | 4 | 5`、左右を白地の44px操作へ変更。中央レールの横スワイプを追加し、左で高音側・右で低音側へ1ジェスチャー1オクターブだけ移動する。8pxで横/縦を判定し、32pxの横移動で1段変更、端では抵抗を付けて停止し、縦操作は音域変更しない。390×844pxと1280×720pxの実ブラウザで横溢れなし、`3–5 → 4–6 → 5–7`、上限停止、段階復帰、縦スワイプ不変、console errorなしを確認し、`npm run build` 成功。WebKit smoke / native実機は未実施。version `1.0.24`。
- 2026-07-13: Pianoのオクターブ範囲表示を文章から `OCT 3━4━5` の音域レールへ変更し、左右操作へ低音/高音方向のアクセシビリティ名を追加。グリッド境界の折り返される `Oct` 表示は17pxの番号マーカーへ置換した。390×844pxと1280×720pxの実ブラウザで横溢れなし、音域行56px、左右操作44px、`3–5 → 4–6 → 3–5` の更新、console errorなしを確認し、`npm run build` 成功。WebKit smoke / nativeは未実施。version `1.0.23`。
- 2026-07-13: 通常/3連切替の音価領域を5列の固定座標へ変更し、3連時に2ボタンが横へ巨大化するレイアウトシフトを解消。Pianoも先頭44px操作レールをDrums/コードと共通化し、オクターブ操作を独立44px行へ整理した。下部再生パネルは`height`/`min-height`と自動スクロールの同時処理を廃止し、240msの`transform`移動と詳細フェードへ変更。展開前後でグリッド寸法と`--seek-overlay-space: 86px`が不変、通常/3連ともツールバー57px、横溢れなしを実ブラウザで確認。`npm run build`とWebKit smoke 4件成功。version `1.0.21`。
- 2026-07-13: 編集エディタをコンパクトなステップシーケンサーとして再設計。トップタブをフラット化し、ドラム/コードのモード・音価操作を56pxの1段レールへ統合、グリッド線を小節/拍/ステップの3階層に整理した。音源追加を44pxのフラットな行、下部再生を全幅86pxドックに変更し、編集幅・行高・48ステップは維持。405×708の実ブラウザで横溢れなし、グリッド405×446px・各ドラム行52pxを確認。`npm run build` と WebKit smoke 4件成功。主要色トークンは `src/styles/base/layout.css` の `--editor-grid-*` / `--editor-lane`。version `1.0.20`。
- 2026-07-13: 音価ツールバーの二重角丸を解消。外側のモード列・音価列を透明化し、ツールバー全体の1面と細い区切り線、内側ボタンの選択状態で階層を表現した。`npm run build` と WebKit smoke 4件成功。version `1.0.19`。
- 2026-07-13: プロジェクト一覧ヘッダーから見出しと説明文を削除し、拡大した `EZMELO` と `☰` の1行へ簡略化。ロゴとメニューの高さを揃え、44pxタップ領域と既存メニュー動作を維持し、`npm run build` と WebKit smoke 4件成功。version `1.0.18`。
- 2026-07-13: プロジェクト一覧ヘッダーを上下中央揃えにし、右上の `☰` を左側タイトルブロックの中心へ整列。44pxタップ領域と既存メニュー動作を維持し、`npm run build` と WebKit smoke 4件成功。version `1.0.17`。
- 2026-07-13: UI更新で保存スキーマを古い扱いにしないよう、現行形状を保つ旧スキーマ番号（最大11）を受け入れる検証へ分離。昔の編集ロジックや16ステップ形式は復元せず、UI変更のみで既存プロジェクトが開けなくなる経路を防いだ。旧番号の復元テストを追加し、`npm run build` と WebKit smoke 4件成功。version `1.0.16`。
- 2026-07-13: プロジェクト行の開く導線 `>` を削除し、`⋮` を角丸背景なしで右端に整列。全体メニュー `☰` も枠・背景を外して記号だけに統一した。既存のメニュー動作と44pxタップ領域を維持し、`npm run build` と WebKit smoke 4件成功。version `1.0.14`。
- 2026-07-13: 画面全体メニューをハンバーガー `☰`、プロジェクト固有操作を縦三点 `⋮` に分け、ナビゲーションとコンテキスト操作の意味を明確化した。既存の行メニュー動作・配色・44pxタップ領域を維持し、`npm run build` と WebKit smoke 4件成功。version `1.0.13`。
- 2026-07-13: 共通の濃色トークンを濃紺 `#172033` から黒 `#111111` へ戻し、上部バー、全体プレビューの全トラックヘッダー、プロジェクト一覧の主要ボタンと濃い文字へ統一。一体型リスト、行メニュー、押下反応、青・黄・緑の状態色は維持した。390×844pxでホームと編集画面の実色・横溢れなし、`npm run build`、WebKit smoke 4件成功。version `1.0.11`。
- 2026-07-13: Apple風試作から配色だけを従来の濃紺・白・青みのある背景へ戻し、一体型プロジェクトリスト、行メニュー、起点付きポップオーバー、即時押下反応、アクセシビリティmedia queryは維持した。390×844pxでホームと編集画面の色、行メニュー、新規作成から編集画面への遷移、横溢れなし、`npm run build`、WebKit smoke 4件成功。version `1.0.10`。
- 2026-07-13: Appleの設計原則を参考にWeb UIを試作。プロジェクト一覧を一体型リストと行メニューへ再構成し、上部バー・下部プレイヤー・ポップオーバーへ半透明素材、即時押下反応、reduced motion / transparency / high contrast対応を追加。390×844pxと1280×720pxで横溢れなし、行メニュー、新規作成から編集画面への遷移、`npm run build`、WebKit smoke 4件成功。iOS Simulator / 実機の素材表示は未確認。version `1.0.9`。
- 2026-07-13: 作曲ソフト初心者向けにWeb UIの情報階層を整理。ホームへ用途説明を加え、ワークスペース共通の色・余白・角丸・focus表示を定義し、全体プレビューの「曲の設定」とトラックカードを統一した。390×844pxと1280×720pxで横溢れなし、新規作成・reload後の再読込、`npm run build`、WebKit smoke 4件成功。既存のローカル一覧だけが残った2件は本体欠損のため読込不可だが、新規保存経路は正常。version `1.0.8`。
- 2026-07-10: CodexのBrowser確認導線を固定化。`Run` actionを`npm run dev:codex`へ切り替え、`127.0.0.1:5173`を`--strictPort`で固定した。Browserの古いタブ、ポート競合、タブ接続喪失ごとの復旧順をrunbookへ追加。`npm run build`とスクリプト定義確認が成功。version `1.0.7`。
- 2026-07-10: Safari向けのUI視認性と操作導線を改善。プロジェクトカードの常時表示していた編集・削除を1つのSVG操作メニューへ集約し、上部タブに横スクロールのsnap、全体プレビューの操作ボタン・文字・音量表示を拡大した。下部プレイヤー、メニュー、追加、編集、削除、オプションをSVGアイコンへ統一。`npm run build` とWebKit smoke 4件成功。version `1.0.6`。
- 2026-07-10: エージェント作業契約、短い復帰記録、Web / nativeのデバッグrunbookを再編。作業種別ごとに最小確認を選ぶ表、サブエージェント / skillの分担基準、失敗artifactの読み方を追加した。release CIは`dist/`をpreview serverで検証し、失敗時はreport・trace・videoをartifact化する。dev WebKit smokeは4件、release artifact smokeは2件成功。version `1.0.5`。
- 2026-07-10: 保存・インポートの堅牢性を改善。128小節 / 64トラック上限を編集・貼り付け・インポートで統一し、音価・コード・`nextId`の検証/正規化で再生例外とID重複を防止。WebKit smokeは4件成功、`npm run build`成功。version `1.0.4`。
- 2026-06-21: Web Safariの復帰後無音を、ユーザー操作内でのcontext / playback chain再構築へ整理。Pianoは再生に必要なサンプルだけを読む。GitHub Pages移行とiOSリリース準備を進めた。
- 2026-06-08: プロジェクト一覧、Web / native保存bridge、iOS Simulator導線、`src/`中心の責務分割を整備した。

## 過去の要約

- `src/` は `core / editors / features / ui / styles` に分割済み。保存はproject indexとproject body、再生はscore生成・serializer・bridge・scheduler・iOS native pluginに分離している。
