# PROGRESS.md

最終更新: 2026-03-11

## 進捗ルール

- 進捗はこのファイルに追記する
- 大きい構成変更をしたら「今回の整理内容」を更新する
- 次に触る人は作業前にこのファイルと `CODEBASE_GUIDE.md` を読む
- UI変更時は主要な高さ・幅を `px` で明示し、あとで詰めやすいように CSS 変数や定数へ寄せる

## 今回の整理内容

- `preview-editor.js` をファサード化し、`preview-row / preview-actions / preview-repeat / preview-tone-sheet / preview-song-settings / preview-shared` へ分割
- `chord-editor.js` をファサード化し、`progress / timing / detail-sheet / drum-reference / shared` へ分割
- `editor.css` を入口のまま維持しつつ、`src/styles/base/` `src/styles/components/` `src/styles/editors/` に物理分割
- `project-storage.js` を `storage-core / storage-helpers` へ分割し、保存I/O と normalize/migration を分離
- `instrument-map.js` を `instrument-config / track-tone / playback-chains` へ分割し、楽器定義と Tone.js 再生管理を分離
- `tracks-controller.js` を `track-selection / track-measures / track-repeat` へ分割し、トラックCRUD、小節操作、繰り返し同期を分離
- 再生開始直後に停止した場合でも `play` 完了で `||` 表示へ戻らないよう、`playback-controller.js` に requestId ガードを追加

- 曲全体の `Root / Harmony / Scale Family` 設定を全体エディタへ持ち、メロディ強調を `スケール音 / 非スケール音` 基準へ切り替えた
- 全体エディタで各トラックの `発音ON/OFF` と `音量` を調整できるようにした
- 全体エディタの各カードでは EQ を要約表示にし、編集は `音作り` シートへ集約した
- `track.eq = { low, mid, high }` を保存/読込対象に追加した
- EQ の初期値と `初期化` の戻り先を、`drums / bass / chord / melody` のカテゴリ別に分けた
- 再生イベントへ `trackId` を流し、同じ楽器を複数トラックで使ってもトラックごとにEQが独立する再生チェーンへ変更した
- トラックバスを `EQ3` から `low shelf / mid peaking / high shelf + compressor + limiter` へ変更し、EQ の効き方を自然寄りにした
- `音作り` シートに `横軸=周波数 / 縦軸=dB` の EQ グラフを追加し、3 バンドの周波数と dB をドラッグで編集できるようにした
- 全体エディタの各カードに `音作り` ボタンを追加し、`Gain / Mid Q` を含む詳細シートを開けるようにした
- `音作り` シートに `Comp` コントロールを追加し、トラックバスのコンプレッサ量を1本のスライダーで調整できるようにした
- `track.tone` を保存/読込対象に追加し、音作りシートの変更を再生チェーンへ即時反映するようにした
- `songRoot / songHarmony / songScaleFamily` の3軸モデルへ移行し、旧 `songScaleType` 保存データは自動移行するようにした
- `major/minor` と `pentatonic/blues/dorian/mixolydian` を組み合わせて解決する形へ整理し、`C M ペンタ` と `C m ペンタ` を別スケールとして扱えるようにした
- `Scale Family` の候補は現在の `Harmony` に合うものだけを表示し、合わない組み合わせへ切り替わった時は `diatonic` へ戻すようにした
- `diatonic / pentatonic / blues` の表示名は Harmony に応じて `メジャー / ナチュラルマイナー / メジャーペンタ / マイナーペンタ / メジャーブルース / マイナーブルース` へ出し分けるようにした
- メロディエディタのスケール音強調は新しい 3 軸モデルに追従するようにした
- メロディエディタの octave 区切り行の右側に、拍番号付きのコード帯を表示し、上部の拍ヘッダは廃止した
- メロディエディタのコード音ガイドは、各拍のコードルート固有色を薄く反映するようにした
- UI を増やさず音質を底上げするため、楽器別の hidden `trim / high-pass` と共有マスターバスの整音を追加した
- `src/` ベース構成へ移行
  - `src/main.js`
  - `src/core/`
  - `src/editors/`
  - `src/features/`
  - `src/ui/`
  - `src/styles/editor.css`
- 下部シークバーを `src/ui/bottom-bar.js` に分離
- トップバータイトル更新を `src/ui/topbar.js` に分離
- `docs/architecture.md` を追加
- `CODEBASE_GUIDE.md` を新配置へ合わせて更新
- 下部小節シークバーに `A/B` の再生範囲指定を追加中
  - 小節単位
  - 両方そろった時だけ有効
  - 保存対象にはしない
- 小節またぎの横スワイプ遷移は無効化
- `A/B` はシークバー上の丸いマーカーでも表示
- 再生範囲は小節削除後にクランプするよう修正
- 再生中の `renderEditor` / `renderSidebar` では自動保存を止めた
- `通常/3連` 切替時に前回の音価を記憶するよう修正
- 再生UIを `▶ / ||` の単一トグルボタンへ変更
- ドラム画面の行高を縮め、4行が1画面で把握しやすい密度へ調整
- コード画面を `コード進行` と `鳴らすタイミング` に分離し、説明文を追加
- コード進行は拍単位で選ぶUIへ変更
- コードのドラム参照は `details` で折りたたみ表示に変更
- メロディ画面はアコーディオンをやめ、縦スクロールの連続ピアノロールへ変更
- 再生範囲 `A/B` の表記を初心者向けに `始/終` と `開始/終了` へ変更
- メロディ左鍵盤は独立スクロールをやめ、右グリッドのスクロール量に transform で追従させる形へ変更
- 音価ツールバーは `編集線` と `長さ` の2段に分離し、長さボタンは音符記号ベースの表示へ変更
- 初回オーバーレイでスマホ向け操作ガイドを追加
- ドラム、メロディ、コード各画面に短い操作ヒントを追加
- 下部シークバーに `小節操作` の説明文を追加
- 全体トラックビューを 48 分割プレビューに変更し、三連符を表示できるよう修正
- トップバーに `全体 / 戻る` ボタンを追加し、全体トラックビューへの入口を明示
- 全体トラックビューの各カードで、独立した繰り返し範囲を持てるよう変更
- 繰り返しの型範囲は黄色、反映済み範囲は緑で表示する仕様へ整理
- 黄色の型範囲を後から編集した場合、対応する緑の反映済み範囲へ再反映するよう変更
- 緑側の編集内容は黄色の型へ逆流させない一方向同期に変更
- 下部シークバーの黄/緑ハイライトは、開いているエディタのトラック色を反映するよう変更
- 全体エディタでは、最後に触れたトラックの繰り返し色をシークバーに表示するよう変更

## 2026-03-09 更新メモ

- 繰り返しUIをコピー/ペーストから分離し、カード単位で開始バー・終了バー・繰り返しボタンを操作する方式へ整理
- 開始バー、終了バー、繰り返しボタンを触ったトラックを `lastTouchedTrackId` として保持
- `repeatStates` をトラックごとに保持し、複数カードで同時に繰り返し設定できる状態へ変更
- シークバーは全トラック合成表示ではなく、現在編集中のトラック、または全体エディタで最後に触れたトラックだけを表示
- `repeatStates` と `lastTouchedTrackId` は保存/読込対象に追加
- 実ブラウザで確認済み
  - 複数カードの繰り返し設定が独立して共存する
  - 黄色の型編集が緑へ反映される
  - 緑の編集は黄色へ反映されない
  - シークバーの黄/緑は表示対象トラックに追従する
- WebKit 開発用に Playwright の土台を追加
  - `package.json` を追加
  - `playwright.config.js` で `webkit + iPhone 13` を既定化
  - `tests/webkit-smoke.spec.js` を追加
  - `dev-server.py` は `PORT` 環境変数で固定ポート起動できるよう変更

## 現在の主要ディレクトリ

| パス | 用途 |
| --- | --- |
| `src/core/` | 状態管理、定数、duration処理、リズム分割計算 |
| `src/editors/` | ドラム、メロディ、コード、プレビューの描画 |
| `src/features/` | 再生、保存、トラック管理 |
| `src/ui/` | サイドバー、モーダルなど外枠UI |
| `src/styles/` | CSS |
| `sounds/` | 楽器サンプル |
| ルート直下 | `index.html`、ドキュメント、起動補助 |

## 現在の実装状況

- 48ステップ内部解像度で通常音価と三連音価を共存
- `通常 / 3連` の編集モード切替あり
- `3連` は選択音価に応じて 12分割 or 24分割表示
- 音符はセル列ではなくタイムライン上のブロックとして描画
- 自動保存、JSON保存/読込あり

## 今やるべきこと

- `src/styles/editors/chord.css` がまだ大きいので、必要になったら `detail / palette / mobile` などへ追加分割する
- `tests/webkit-smoke.spec.js` は主要フロー確認用として維持しつつ、必要なら repeat / import-export も個別 spec に逃がす
- `docs/architecture.md` の CSS 分割予定記述を現状に合わせて追記する
- 細かい余白や視認性の最終確認は実機またはブラウザで継続する

## 長期目標

- App Store 公開を目指して、iOS アプリとして整える
  - モバイル Safari での操作性と音声まわりの安定化
  - 保存、読込、共有導線の整理
  - PWA かラッパーアプリかを含めた配布形態の検討
  - iPhone 実機前提の UI、権限、審査要件への対応

## 次回実装メモ

- コード画面のUI変更先
  - `src/editors/chord/render-chord-editor.js`
  - `src/editors/chord/chord-detail-sheet.js`
  - `src/styles/editors/chord.css`
- 全体プレビューのUI変更先
  - `src/editors/preview/render-preview.js`
  - `src/editors/preview/preview-row.js`
  - `src/editors/preview/preview-tone-sheet.js`
- 保存や repeat の変更先
  - `src/features/project/storage/storage-helpers.js`
  - `src/features/project/storage/storage-core.js`
  - `src/features/tracks/controller/track-repeat.js`
- 受け入れ条件
  - 公開 import のパスを変えずに内部責務だけを追加分割できる
  - build と webkit smoke が通る
  - 主要 editor の見た目と操作が大きく後退しない

## 確認メモ

- import の静的確認は通過
- 構成変更後はブラウザのハードリロードが前提
- WebKit 確認は `npm install` → `npm run playwright:install` → `npm run test:e2e:webkit`
