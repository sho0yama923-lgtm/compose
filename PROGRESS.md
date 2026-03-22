# PROGRESS.md

最終更新: 2026-03-20

## 進捗ルール

- 進捗はこのファイルに追記する
- 大きい構成変更をしたら「今回の整理内容」を更新する
- 次に触る人は作業前にこのファイルと `CODEBASE_GUIDE.md` を読む
- UI変更時は主要な高さ・幅を `px` で明示し、あとで詰めやすいように CSS 変数や定数へ寄せる

## 今回の整理内容

- ドラムエディタは、行数が増えた時に下部の再生ドックを潰さないよう、`.drum-editor` 自体を縦スクロール可能な flex 領域へ戻した。`responsive.css` で `flex: 1 1 auto / min-height: 0 / overflow-y: auto` に整理し、下端は `--drum-editor-scroll-bottom-gap = 12px` の逃がしを持たせた
- ドラムエディタで楽器追加後に左列とグリッドがズレる件は、scroll 主体を `.steps-grid-scroll` に戻し、左列は `translateY(-scrollTop)` で同期する形に変更した。あわせて `track.drumScrollTop` を一時保持して、ノート配置や行追加の再描画後も scroll 位置を復元するようにした
- さらにドラムエディタの左列とグリッドをメロディ寄りの「同一スクロール領域内の2カラム構造」へ寄せた。各行を `48px + minmax(0, 1fr)` の lane として描画し、左ラベルだけ別カラムで後追い同期しない形に変えた
- 音の長さが少し残りすぎる件は drums だけでなく pitched 側でも目立っていたため、`NativePlaybackPlugin.swift` の native note end を調整した。drums は `drumSampleTailCapSeconds = 0.16s` を残しつつ、pitched は sample tail を可聴長へ足さず、`pitchedFadeOutDurationSeconds = 0.012s` の短い fade-out で規定長へ寄せる形に整理した
- 音価確認のために一時追加していた per-note の timing log は、Xcode の debugger 接続中だけ音に悪影響を出す可能性が高いため外した。`scheduleEvent` の高頻度 `print` と web fallback の `console.debug` は常時出さない状態へ戻した
- native の note end は、pitched を「規定長まで鳴らし、終了直前だけ短い fade-out」で切る形へ組み替えた。drums は従来どおり sample tail を少し残せる一方、pitched は `sample tail` を可聴長へ足さず、`audibleSeconds` と `fadeSeconds` を分けて扱う
- タスクキル後の再起動でドラムだけ消える件は、native 本体だけでなく fallback 側も確認したところ、`playback-chains.js` が `track.id = 0` を falsy 扱いして chain 生成を落とす経路があった。最初のドラムトラックが `id=0` の時に Tone.js fallback / warmup が失敗しうるため、`track?.id == null` 判定へ修正した
- `UIScene lifecycle will soon be required` 警告に対応するため、`Info.plist` に `UIApplicationSceneManifest` を追加し、`AppDelegate.swift` を `UIWindowSceneDelegate` 兼用にした。custom plugin 登録も scene 経由で `CAPBridgeViewController` を解決できるよう整理した
- 再生中に note cleanup の `stop()` が急に入ると iOS でプツッという切れ音が出やすかったため、`NativePlaybackPlugin.swift` の各 voice に `AVAudioMixerNode` を足し、pool 返却前に数 ms の短いフェードアウトを挟んでから reset するようにした
- フェードアウト後の pool 返却が遅延クロージャ経由になったことで、古い stop/fade が後から走って voice 状態へ触る危険があったため、`NativePlaybackPlugin.swift` の voice に `fadeSequence` を持たせて世代不一致の古い closure を無効化した。頻出する `finishVoice / scheduleWorkItem` まわりの weak capture も外し、weak reference 警告が出にくい形へ整理した
- 再生線同期のために `NativePlayback.getStatus()` を常時 polling していたが、Capacitor の `To Native -> NativePlayback getStatus ...` がコンソールを埋めていた。`playback-controller.js` は native 開始時刻ベースのローカル補間だけで再生線を動かす形に戻し、常時 status polling を外した
- `NativePlaybackPlugin.swift` では drums の voice pool key を `trackId + instrumentId` だけで共有していたため、Kick / Snare / HiHat など同一キット内の別音が同じ pool を奪い合っていた。sample tail を長めに保持する変更と組み合わさると pool 枯渇が起きやすく、ドラム無音や再生途中の音欠けにつながるため、drums だけは `trackId + instrumentId + note` 単位で voice pool を分離した
- `NativePlayback` の console で `voice pool exhausted for 1|piano` が確認でき、pitched 系でも sample tail を長く保持しすぎて route pool を掴みっぱなしにしていたことが分かった。`NativePlaybackPlugin.swift` では drums と pitched で pool 数と sample tail の保持上限を分け、drums は `12 voices / +0.24s`、pitched は `36 voices / +0.18s` の上限に調整した
- `run` 直後とタスクキル後再起動の差を見直すと、drum と melody の event 生成よりも `NativePlayback.preload()` の sample cache が部分 manifest で上書きされる構造のほうが危険だった。`NativePlaybackPlugin.swift` は partial preload でも既存 cache を保持するよう変更し、`audio-bridge.js` の drum / melody preview と native warmup も「単独楽器だけ」ではなく「現在のトラック全体 + 要求楽器」をまとめた manifest を送るようにした
- `AURemoteIO::IOThread` の `memmove` クラッシュが出たため、native `preload()` の挙動も見直した。既に cache 済みの instrument を再 preload した時はサンプルを読み直さず `reused` 扱いで保持し、再生中/直後に古い `AVAudioPCMBuffer` が解放されて audio thread が落ちる経路を避けるようにした
- iOS 再生のプツプツ音は、voice cleanup を音価長だけで切って sample の実 tail を途中で stop していたことが原因候補だったため、`NativePlaybackPlugin.swift` で cleanup 時刻を `max(音価長, sample実再生長)` 基準に変更し、drums 向けの voice pool 数も 24 に増やした
- ドラム移動後に音が消える件は、移動先に置けない場合でも元ノートを先に消していたことが原因だったため、`drum-editor.js` では clone 配列に対して配置成功時だけ commit するよう修正した。あわせて同じ欠陥があった `melodic-editor.js` と `chord-timing-section.js` の移動処理も同じ形へ揃えた
- トラック配列の中にも `viewBase / activeOctave / melodyScrollTop / selectedChordRoot / selectedChordType / selectedChordOctave / selectedDivPos / selectedDrumRows` などのエディタ一時状態が混ざっていたため、`storage-helpers.js` に `serializeTrackForSave()` を追加して保存対象を「曲データとトラック設定」だけに絞った
- タスクキル後の復元内容を確認したところ、`isPlaying / playheadStep / playRange / previewMode` などの再生状態は保存していなかった一方で、`currentMeasure / activeTrackId / lastTouchedTrackId / selectedDuration / dottedMode` などの画面・編集状態は保存対象だった。`storage-helpers.js` からそれらの保存を外し、復元時も毎回 `先頭小節 / 最初のトラック / 通常16分 / プレビュー画面` に戻すよう整理した
- 起動直後の待機が見かけだけで効かない経路を潰すため、native plugin の `getStatus()` に `ready / readyAtMs` を追加し、`prepareAudioPlayback()` は `warmup()` 完了だけでなく native ready が true になるまで待つようにした。あわせて下部シークバーの再生ボタンも描画時に `appState.isBooting` を反映するよう修正した
- タスクキル後の再起動で native `warmup()` が即完了しても再生を急がせないよう、`src/main.js` の boot / visible 復帰で最小待機ロックを追加した。起動直後は 1200ms、前面復帰直後は 800ms だけ `isBooting` を維持し、再生ボタン解禁を遅らせる
- `NativePlaybackPlugin.swift` では各ノートごとに fresh な `AVAudioPlayerNode` を engine 起動後に attach/connect していたため、`voice.player.play()` の瞬間に graph へ反映しきれず `player started when in a disconnected state` が出る経路が残っていた。voice は `play()` 前に route ごとの pool としてまとめて接続し、再生中は接続済み node を checkout / return する構成へ戻した
- `NativePlaybackPlugin.swift` の `play()` では毎回 `AVAudioPlayerNode` を attach/connect して即 `play(at:)` していたため、`player started when in a disconnected state` が出る経路があった。再生前に track+instrument ごとの voice pool を先に接続しておき、再生中は接続済み node だけを checkout / return する方式へ変更した。あわせて event 開始は `player.play(at:)` ではなく `scheduleBuffer(at:) + play()` に寄せた
- `warmup()` で起動した `AVAudioEngine` を `play()` 冒頭の `stopLocked()` が毎回 `pause()` していたため、warmup 直後に graph を組み直す無駄が残っていた。停止時も engine 自体は生かしたまま、voice / timer / mixer 出力だけをリセットする形へ変更した
- `NativePlaybackPlugin.swift` で複数 voice を `trackMixer` へ `connect(... to: mixer ...)` の簡易 API でつないでいたため、同じ input bus を奪い合って先に作った voice が暗黙に切断されていた。各 voice に `trackMixer` の専用 input bus を割り当てる形へ変更した
- `AVAudioPlayerNode` は buffer 未予約の idle 状態で先に `play()` すると `disconnected state` 例外を起こす経路が残っていたため、voice pool の事前 start をやめた。native 再生は `player -> rate -> mainMixer` の単純経路に戻し、各ノートで buffer を積んだ瞬間だけ `play()` する形へ整理した
- native warmup は engine start だけでは不十分だったため、`NativePlaybackPlugin.swift` の `warmup()` で無音バッファを 1 回流し切ってから完了を返すようにした
- boot/復帰の warmup は sample preload だけでは不十分だったため、`NativePlaybackPlugin.swift` に `warmup()` を追加し、`AVAudioEngine` 起動自体も先に済ませるようにした
- タスクキル後の再起動でも同じ初回高速再生バグが出ないよう、`pageshow` と `visibilitychange` の visible 復帰ごとに audio warmup を再実行し、その完了まで再生をロックするようにした
- 起動直後の初回再生バグを避けるため、boot 中に native 音源 manifest を先読みし、起動完了までは再生ボタンを無効化するようにした
- 起動直後の初回再生だけ速くなる件は、native 側で `renderBaseHostTime` を `audioEngine.start()` 前に計算していたことが原因候補だったため、開始基準時刻を engine 起動後に取り直すよう修正した
- 再生線は `playScore()` 応答待ち後に初めて動き出していたため、再生要求直後に provisional animation を開始し、native 応答後に時刻だけ補正する形へ変更した
- iOS の数値入力起点で BPM が `120` へフォールバックして速くなる経路を避けるため、`src/core/bpm.js` を追加し、再生と保存で同じ BPM 正規化を使うようにした
- ドラムエディタ左端の楽器名をタップ / Enter / Space で試聴できるようにし、メロディ左鍵盤と同じ導線に寄せた
- 全体エディタのメロディカードは 1 オクターブ詳細表示をやめ、`viewBase` 起点の 3 オクターブ分を 3 音ずつ束ねた 12 段の要約ドット表示へ変更した
- 長押し時の青い選択帯を減らすため、`layout.css` と `drum.css` で編集領域 / 下部ドック / 固定シートに `user-select: none` と `-webkit-touch-callout: none` を寄せ、`input/select/textarea` だけは選択可能に戻した
- `playback-controller.js` からトラック配列 -> 再生 score 変換を `score-builder.js` へ切り出し、再生開始UIとスコア構築の責務を分離した
- `playScore` 呼び出しで未使用だった `beatConfig / numMeasures` を落とし、再生経路の引数を実使用分だけに整理した
- `NativePlaybackPlugin.swift` の未使用 `instrumentManifests` キャッシュを削除し、native preload の責務を sample cache に絞った
- 今後のスパゲッティ化を防ぐ実装ルールを `docs/coding-rules.md` に追加し、AGENTS / CODEBASE_GUIDE から参照するよう整理した
- iOS 再生基盤は「音の transport を native が持ち、再生線は native status を参照して JS が描画する」形へ寄せ直し、ループ先読みも `main asyncAfter` から専用 queue + horizon refill へ変更した
- ドラム追加シートの試聴は `trackId = 0` を通すように修正し、最初のトラックでも再生できるようにした
- メロディエディタの左鍵盤をタップ / Enter / Space で単音試聴できるようにした
- iOS native playback の `startDelayMs` は 0ms を正しく扱うようにし、ループの先読みを少し広げて再生線とループ崩れを安定させた
- iOS native 再生は JS 側を再生の正本から外し、`NativePlaybackPlugin.swift` が持つ transport 状態を `getPlaybackState()` で定期同期して playhead を補正する構成へ寄せた
- `NativePlaybackPlugin.swift` のループ予約と voice cleanup は「再生開始時点からの絶対時刻」を基準に取り直し、再帰 `asyncAfter` の相対ズレでループが遅れていく構造を解消した
- native の予約/cleanup は専用 serial queue 上で管理し、pending work の肥大化で数回ループ後に不安定になる経路を抑えた
- `preview-editor.js` をファサード化し、`preview-row / preview-actions / preview-repeat / preview-tone-sheet / preview-song-settings / preview-shared` へ分割
- `chord-editor.js` をファサード化し、`progress / timing / detail-sheet / drum-reference / shared` へ分割
- `editor.css` を入口のまま維持しつつ、`src/styles/base/` `src/styles/components/` `src/styles/editors/` に物理分割
- `project-storage.js` を `storage-core / storage-helpers` へ分割し、保存I/O と normalize/migration を分離
- `instrument-map.js` を `instrument-config / track-tone / playback-chains` へ分割し、楽器定義と Tone.js 再生管理を分離
- `tracks-controller.js` を `track-selection / track-measures / track-repeat` へ分割し、トラックCRUD、小節操作、繰り返し同期を分離
- ドラムの「音源を追加」シートの試聴ボタンは `trackId = 0` でも動くように修正し、左鍵盤の試聴は `melodic-editor` から単音 helper を呼ぶ形へ整理
- 再生中の `renderEditor()` は次フレームへ逃がし、iOS で playhead 線の遅延やループ境界のガタつきが出にくいよう再生UI更新を軽くした
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
- 配置済みノート/打点の削除を即削除から `1回目タップで × 保留 → 2回目タップで削除` へ変更し、別場所タップで保留解除するよう整理
- 配置済みノート/打点は `長押しで移動モード` に入り、元ノートと移動先ガイドを同じ見た目の `拡大率 1.08 / 不透明度 0.72` で表示するよう変更

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

## 2026-03-17 追記

- 音価ツールバーの音符アイコンを CSS 描画へ統一したうえで、8分音符/16分音符の旗を参考画像寄りの流線形シルエットへ更新
- 旗は `src/styles/components/duration-toolbar.css` の `note-flag` で1本の形として描画し、以前の「円弧 + 先端」の分離感を解消
- 旗の根本が棒を貫通して見えないよう、シルエット開始位置を `1px` 右へ寄せ、回転を `10deg -> 7deg` に調整
- 16分音符だけ旗の高さを `8px -> 6px` に下げ、1本目 `top 1px`、2本目 `top 5px` へ詰めて8分との差を整理
- 音価ボタンの `全 / 2分 / 4分 / 8分 / 16分 / 付点` ラベルを削除し、記号のみを中央表示へ変更。`3連` バッジは維持
- WebKit の一時 Playwright spec で `.duration-value-row` を撮影して見た目確認済み
- build 成功を確認済み
- `Capacitor` を導入し、`capacitor.config.json` と `ios/` ネイティブプロジェクトを追加する iPhone アプリ向けビルド導線を整備
- `package.json` に `build:ios-web / ios:sync / ios:open / ios:buildprep` を追加し、基本フローを `vite build -> cap sync ios -> Xcode build` に寄せる
- iPhone 実機で topbar がステータスバーと重ならないよう、`viewport-fit=cover` と `--safe-top = env(safe-area-inset-top)` を追加し、`topbar` と `sidebar` の上端余白を safe area 基準に変更
- iPhone 実機で音が出ないケースに備え、`ios/App/App/AppDelegate.swift` で `AVAudioSession` を `.playback` で有効化し、WebAudio 再生がサイレントスイッチに消されにくいよう調整
- iPhone 実機でサンプル音源が無音になる問題に対応するため、`vite.config.js` に `sounds/ -> dist/sounds/` コピー処理を追加し、Capacitor 配布物にも mp3 群が入るようにした
- 実機の初回再生で Sampler 読み込みが間に合わず無音になるケースに備え、`scheduler.js` で `syncTrackPlaybackChains()` 後に `Tone.loaded()` を待ってから Transport を開始するよう変更
- iOS WebView の音源読み込み安定化のため、`capacitor.config.json` に `server.hostname = localhost` と `server.iosScheme = http` を追加し、`http://localhost/...` でサンプルを読ませる構成へ変更
- 音源 URL 解決の曖昧さを減らすため、`playback-chains.js` で Sampler の `baseUrl` を `'/sounds/.../'` 形式の絶対パスへ統一し、ロード成功/失敗のログも追加
- iOS WKWebView で `.mp3` 拡張子のカスタムスキーム応答と `Tone.Sampler` が噛み合わない可能性に対応するため、`vite.config.js` で `dist/audio-buffers/sounds/**/*.mp3.bin` を生成し、Sampler には `.bin` 側を読ませる構成へ変更
- `@capacitor/android` を追加して `android/` プロジェクトを生成し、`android:sync / android:open / android:buildprep` の導線を追加
- `src/features/bridges/` に `audio / storage / file-share / device` を追加し、再生と保存の呼び出し境界をアプリ共通化の方向へ整理
- preview カード長押し時の iOS 選択ハンドル抑止のため、`preview.css` と `preview-actions.js` で `user-select / -webkit-touch-callout` と `contextmenu / selectstart` 抑止を preview UI 限定で追加
- `@capacitor/filesystem` 利用に備えて `ios/App/PrivacyInfo.xcprivacy` を追加
- `score-serializer.js` を追加し、step 配列の score から native plugin 向け `events[]` payload と音源 manifest を組み立てる層を分離
- `audio-bridge.js` を iOS native playback 優先・Web/Android Tone.js fallback の二段構成へ変更し、`playbackStep` listener を既存 playhead 更新へ接続
- `ios/App/App/NativePlaybackPlugin.swift` を追加し、`AVAudioEngine + AVAudioPlayerNode + AVAudioUnitVarispeed` でサンプル再生を行う Capacitor custom plugin を実装
- `AppDelegate.swift` でアプリ起動後に `NativePlaybackPlugin` を bridge 登録するよう変更
- iOS 起動直後の `Filesystem mkdir` 重複エラーを抑えるため、`storage-bridge.js` のディレクトリ初期化を共有 Promise 化して並行呼び出しを 1 回へ畳んだ
- 再生ラインのカクつきを減らすため、playhead 更新を native の step 通知依存から外し、`playback-controller.js` で `requestAnimationFrame` による連続補間へ変更
- iOS native 再生では `NativePlaybackPlugin.swift` の全ステップ `playbackStep` 通知を廃止し、音声スケジューリングだけに責務を絞ってループ時の負荷と揺れを減らした
- native plugin の `play()` は `startDelayMs` を返すようにし、JS 側の playhead 開始タイミングを音の立ち上がりに合わせやすくした
- `npm run build`、`npm run test:e2e:webkit`、`npm run ios:buildprep`、`xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /tmp/compose-iosbuild CODE_SIGNING_ALLOWED=NO build` が通過
- スマホ開発向けの repo 整理として `.gitignore` に native sync 生成物と個人依存ファイルを追加し、`src/` を正本・`ios/` / `android/` を wrapper として扱う運用ルールを docs と AGENTS へ反映
- `package.json` に `mobile:sync:ios` / `mobile:open:ios` / `mobile:sync:android` / `mobile:open:android` / `mobile:doctor` を追加し、旧 `ios:buildprep` / `android:buildprep` は alias 化
- `docs/mobile-dev.md` を追加し、スマホ開発の入口を一本化
- 下部バーを `measure-seek-card` ベースの浮かせたプレイヤードックへ変更し、下端から `12px + safe-area` 上げた位置に再配置
- 再生/停止は topbar から下部ドック中央の丸ボタンへ移し、主要寸法を `58px` の主ボタン、`44px` の送りボタン、`40px` の A/B ボタン、`18px` のカード角丸に整理
- `playback-controller.js` の再生ボタン制御を動的 `data-play-toggle` 前提へ変更し、editor 再描画後も下部再生ボタンが効くようにした
- `npm run build` と `npm run test:e2e:webkit` が通過し、ローカル WebKit スクリーンショットでも下部ドックの浮き配置を確認
- コードエディタは `コード進行` 行を `鳴らすタイミング` グリッドの真上へ埋め込み、1 つの連続パネルとして見える `chord-sequencer-section` 構成へ変更
- 上段のコード進行ヘッダーは `42px` 高の低いセル列、下段のタイミンググリッドは既存幅を維持する形にし、横位置を完全に揃えて拍ごとの読み取りをしやすくした
- `npm run build` と `npm run test:e2e:webkit` で、埋め込みヘッダー付きコード UI の回帰を確認
- コードのリズムグリッドを `コード進行` の直下へ固定し、`ドラムを参照` ボタンは `chord-sequencer-actions` としてその下の補助行へ分離
- 埋め込み時のコードリズムグリッド最小高は `132px` に調整し、進行直下の詰まり感を戻しつつ、下段の補助ボタンとの距離は `8px` で整理
- コードエディタ上段は `ルート / タイプ / <octN>` と `コード進行` を同じ `chord-sequencer-section` 内へ統合し、独立していた進行ボックスを吸収
- 上段の日本語ラベルは外し、オクターブ表示は `<oct4>` 形式へ変更。楽器選択だけは別行へ残して既存機能を維持
- 上段オクターブ表示は `<octN>` ではなく `◀ oct4 ▶` の中央表記へ変更し、進行ヘッダー右側の `全クリア` は削除
- コード詳細編集シートも `C / M / oct` の 1 行構成へ揃え、ルート・タイプ・オクターブの日本語ラベルを外した
- コードを鳴らす楽器のプルダウンは `C / M / oct` の下ではなく同じコード進行ブロックの最上段へ移動し、楽器選択 -> 設定行 -> 進行 -> グリッドの順へ整理
- ドラム再生用キットを `drums_default / drums_hiphop1 / drums_hiphop2 / drums_hiphop3` に分離し、既存 `drums` はトラック種別だけを持つ形へ整理
- ドラム行データに `sampleInstrumentId / sampleId` を追加し、旧セーブは `note` から `DEFAULT` キットへ自動補完するよう migration を追加
- ドラムトラック初期行は `Kick / Snare / HiHat / Tom1` を維持しつつ、`Tom2 / Tom3` と `HIPHOP1/2/3` の各行を `音源を追加` 下部シートから追加できるようにした
- Web 再生チェーンと native manifest は「1トラック1キット」前提をやめ、同一ドラムトラック内で複数キットを同時に鳴らせるよう変更
- `npm run build`、`npm run test:e2e:webkit`、`npm run mobile:sync:ios`、`xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /tmp/compose-iosbuild CODE_SIGNING_ALLOWED=NO build` が通過
- ドラム追加シートは固定 `60vh` から `100dvh` 基準の最大高へ変更し、グループを開いて収まりきらない分はシート内本文だけ縦スクロールするよう調整
- その後、ドラム追加シートは `60vh` 固定へ戻し、ヘッダーと閉じるボタンは固定、本文だけ `overflow-y: auto` で内部スクロールする構成に整理
- ドラム追加シートで内部スクロールが効かなかった原因は、本文内の `.drum-add-group` が `flex-shrink: 1` の既定値で縦に潰れていたためで、各グループを `flex: 0 0 auto` にして本文高さを超えた分だけ `scrollTop` が伸びるよう修正
- ドラムエディタ本体グリッドと `音源を追加` ボタンの横幅を下部小節ボックスに合わせるため、左右 `8px` のインセットで統一
- ドラム追加メニューの kit 一覧は `details/summary` を使った 1 セクションずつ開くアコーディオン挙動へ整理
- iOS native playback の `play` で `NSIndirectTaggedPointerString objectForKey:` が出るケースに対応するため、bridge からの再生 payload は `payloadJson` 文字列で渡し、plugin 側で `Decodable` へ直接復元する経路を追加
- タスクキル後の再起動で再生準備が整うまで全画面の起動オーバーレイ（`#bootOverlay`）を表示するようにした。`pageshow` / `visibilitychange` 復帰時にも同じオーバーレイを表示する
- タスクキル後に native 再生が失敗して Tone.js フォールバックへ切り替わった際、`playScore` の options に `bpm / startStep / endStepExclusive / loop` が渡されずデフォルト BPM 120 で再生されるバグを修正
- BPM 対策として一時的に足していた固定待機時間（起動時 1200ms / 復帰時 800ms）は外し、`#bootOverlay` は `prepareAudioPlayback()` の実完了までだけ表示する形へ整理した
- ドラムエディタの左ラベル列は `48px` だと `Kick(HIPHOP1)` 系が収まらず 1拍目の線も境界に埋もれていたため、列幅を `72px` に広げ、短い名前は従来サイズ、長い名前だけ `Kick / HIPHOP1` の2行・小さめ表示へ変更した
- ドラムグリッド先頭には header/row の `border-left` を追加し、1拍目の縦線が左列境界と重なって消えないようにした
- その後、ドラム左列は音名だけを見せる方針へ戻し、`DEFAULT / HIPHOP1 / HIPHOP2 ...` はグリッド側の帯見出しとして分離した。左列幅は `48px` に戻し、ジャンル名で列が膨らまない構成に整理した
- メロディエディタと横幅感を揃えるため、ドラム左列幅も `28px` へ合わせた。短い音名表示に絞ったうえで、文字サイズは `7px` へ詰めてスマホ幅でもグリッド開始位置がメロディと揃うようにした
- さらにドラム全体の見え幅もメロディへ寄せるため、ドラム専用の左右インセット `--drum-editor-inline-gap` は `0px` に戻し、グリッド本体とジャンル帯がコンテナ幅いっぱいまで広がるようにした
- ドラムの右幅がまだメロディより詰まって見えていたため、`.drum-roll-content` と `.timeline-grid` に `width: 100% / min-width: 100% / min-height: max-content` を追加し、スクロール領域の伸び方をメロディの `melody-roll-content` と揃えた
- 最後に、ドラム左列が左端から始まって見えない問題は幅ではなく文字寄せが原因だったため、左列幅 `28px` は維持したままラベルだけ `left` 揃えへ変更した
- さらにメロディとの見え方差は外枠にも残っていたため、ドラムエディタにもメロディと同じ `border-left/right: 0`、`border-radius: 0`、`margin-right: 8px` を適用し、グリッドカードの端処理も揃えた
- 最後まで残っていた横幅差は `#trackEditor.melodic-track-editor` にだけ `margin-inline: -12px` が入っていたことが原因だったため、同じ補正を `#trackEditor.drum-track-editor` にも追加し、ドラム画面全体の横幅基準をメロディと一致させた
- 右端の逃がしは外枠 `margin-right` だと見た目に効きづらかったため外し、ドラムの実スクロール領域 `.steps-grid-scroll` 側へ `padding-right: 8px` を移した。左端はそのまま、右端だけメロディ同等の押しやすい余白を持たせる形に整理した
- ドラム左ラベル列の音名は幅 `28px` のまま、文字位置だけ縦横中央揃えへ変更した。`Kick / Snare / HiHat` をセル中央へ寄せ、左端起点のまま文字だけ片寄って見える状態を解消した
- 下部シークバーの `A開始 / B終了 + スライダー` 構成は、上段 `56px` タイムライン + `14px` 範囲帯 + `22px/28px` の A/B ハンドルを持つドラッグ式 UI に置き換えた。A/B は初期状態で `先頭小節〜最後の小節` に置き、ハンドルを左右へドラッグして範囲調整する。中段は `前小節 / 再生 / 次小節`、下段は既存の `削除 / 追加` アクションを維持する構成へ整理した
- さらに下部プレイヤーは仕様に合わせ、上段を「グリッド背景なし」の `72px` スクラブバーへ整理した。小節番号だけを等間隔表示し、A/B ループ帯は `24px`、A/B ハンドルは見た目 `12x24px`・タッチ判定 `44x44px`、再生ヘッドは `2px` 赤線 + `6px` 丸に変更した。下段は `+小節追加` と `・・・その他` を分け、削除と範囲リセットはボトムシートから行う構成へ変更した
- 下部プレイヤー上段では、コピー/繰り返し編集用の型強調を消し、再生範囲だけを見せるよう整理した。範囲外は `#F0F0F0`、範囲内は `rgba(59,130,246,0.25)`、開始/終了端は `#3B82F6` の `4px` 強調帯で差を出し、A/B の始点と終点が一目で分かる構成にした
- さらに下部プレイヤー上段の小節番号は外し、A/B 範囲バーだけを残す構成へ整理した。A/B ハンドルには `A / B` 文字を直接見せて開始/終了を読みやすくし、赤い再生ヘッドは停止中ドラッグのまま維持した
- 下部プレイヤーの safe area は、外側に余白を足すのではなくカード内の下パディングへ吸収し、ボタンは safe area へ置かず、白いメニュー面だけが下まで続く形にした
- 下部プレイヤーの赤い再生ヘッドは、連続位置ではなく `1小節` 単位へスナップして動くように変更した。停止中のドラッグでも最寄り小節へカクッと移動し、見た目の赤バーは `8px` 幅、タッチ判定は `44px` のまま掴みやすくした
- 下部プレイヤーの赤い再生ヘッドはさらに `5px` 幅へ細くし、上端の丸は削除した。レイヤー順も `赤バー > A/B ハンドル > 範囲帯` に上げ、ドラッグ判定は赤バーが最優先になるよう整理した
- 開始/終了ハンドルは `A / B` 表記をやめ、グレー角丸の中に `||:` / `:||` を入れた繰り返し記号モチーフへ変更した。開始は `||:`、終了は `:||` の向きで固定し、再生範囲の端であることを視覚的に読み取りやすくした
- 開始/終了ハンドルの視認性を上げるため、角丸四角の背景は濃い青 `#2563EB`、記号は白抜きに変更した。赤い再生ヘッドよりは後ろ、範囲帯よりは前のレイヤーは維持している
- その後、`background: currentColor` のままだと記号色と一緒に四角も白化していたため、開始/終了ハンドルの背景は `#2563EB` 固定値へ修正した
- 開始/終了ハンドルの四角本体は `14x24px` に詰め、記号は文字ではなく図形で描く形へ変更した。縦線は `20px` 高で箱の上下ギリギリまで伸ばし、`||:` / `:||` をより読みやすくした
- その後、開始/終了の向きが逆転していたため、開始を `||:`、終了を `:||` になるよう `measure-repeat-symbol` の並び順を入れ替えた
- 下段の `+ 小節追加 / ・・・` 行は、safe area 直上 `var(--safe-bottom) + 0px` まで下げた。カード下パディングも `var(--safe-bottom)` へ詰め、白い面ごと最下まで寄せる形に調整した
- ドラム追加シートは、追加後に開いていたジャンルトグルを閉じないようにした。`appState.drumAddOpenGroups` で track ごとの開閉状態だけを持ち、保存データには含めない
- ドラムエディタ本体の行表示順は追加順ではなく、`DEFAULT -> HIPHOP1 -> HIPHOP2 -> HIPHOP3` のジャンル順、その中で `Kick -> Snare -> HiHat -> Tom1 -> Tom2 -> Tom3` の音色順で描画するよう整理した
- ドラム行ラベルは通常タップで試聴、長押しで削除確認に分けた。長押し `420ms` で画面中央の確認ダイアログを出し、「はい」でその row 自体を `track.rows` から削除して、表示と全小節分のノートをまとめて消す
- ドラム行ラベル長押し時の青い選択帯を抑えるため、`drum-key` と内部ラベルに `user-select: none / -webkit-touch-callout: none` を追加した。削除確認文言は「この音源を削除しますか？」改行「＊全ての小節から削除されます」に変更した
- ダイアログ表示時にも iOS の選択ハンドルが残るケースがあったため、削除ダイアログ全体にも `user-select: none / -webkit-touch-callout: none` を追加し、表示直前に `window.getSelection()?.removeAllRanges()` で既存選択をクリアするようにした
- ドラムノート長押し移動の開始で再描画が走ると `.main` の scroll が先頭へ戻るケースがあったため、`callbacks.renderEditor` で再描画前の `.main` と `#trackEditor` の scrollTop を退避し、描画直後と `requestAnimationFrame` 後に復元するようにした
- さらに、指を大きく動かした時は再描画だけでなく `.main` 自体がスクロールしていたため、ドラムノートの長押しドラッグ中だけ `main / trackEditor` の `overflowY` を `hidden`、`touchAction` を `none` にして viewport をロックするようにした
- それでも横移動だけで画面が飛ぶケースが残ったため、ドラムの長押しドラッグ中は `pointermove` ごとに `renderEditor()` しない構造へ切り替えた。source note はその場で `visibility: hidden` にし、同じ row 内へローカル preview 要素を出して移動だけ反映し、実データ反映と再描画は `pointerup` 時だけにした
- その後、同じ症状がドラムだけでなくメロディ/コードでも出ると分かったため、長押し移動の共通経路を揃えた。`src/editors/note-drag-session.js` を追加し、ドラッグ開始時に `setPointerCapture` と viewport lock をまとめて行うよう整理したうえで、メロディ/コードも `pointermove` 中は再描画せず、source note を隠してローカル preview だけ動かし、実データ反映と再描画は `pointerup` 時だけにした
- `main.js` 側で試していた再描画後の scroll 強制復元は、本命ではなかったため戻した。長押し移動の正本は `note-drag-session.js` と各エディタのローカル preview 方式に寄せている
- メロディのオクターブ境界を長押し移動でまたぐ時は、`elementFromPoint()` が divider 帯へ入った瞬間に target row が揺れていたため、`resolveTarget()` は直前の有効 `melody-grid-row` を保持するようにした。境界帯の上でも最後の実 row を継続し、別 octave へ移るのは次の実 row 上へ入った時だけにしている
