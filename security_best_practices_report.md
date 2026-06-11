# Security Best Practices Report

更新日: 2026-06-10

## Executive Summary

一般公開前のレビューで、保存 JSON の無制限読込、native 保存パスへ流れる project ID、公開 HTML に残っていた開発用外部 script を修正した。

現時点で確認できた Critical finding はない。公開前に残る主な課題は、Tone.js の外部 CDN 実行を自己ホストへ変更することと、本番ホスティングで CSP などの security header を設定することである。

## High

該当なし。

## Medium

### SEC-002: 本番 security header の設定がリポジトリから確認できない

- Rule ID: JS-DEPLOY-001
- Severity: Medium
- Location: repository root。Netlify、Vercel、Cloudflare、nginx 等の公開設定ファイルなし
- Evidence: `public/_headers` を追加したが、配信先がこの形式に対応するか未確定
- Impact: XSS の影響範囲、クリックジャッキング、MIME sniffing、不要な referrer 送信への防御が弱くなる
- Fix: 配信先で `public/_headers` が反映されることを確認し、非対応なら最低限次を HTTP response header として設定する
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - CSP の `frame-ancestors 'none'`
- Mitigation: 配信先決定後、preview URL で実レスポンスを検査する
- False positive notes: edge/CDN 側ですでに設定されている可能性はあるため、公開URLで確認が必要

## Low

### SEC-003: Web版のプロジェクトは平文で localStorage に保存される

- Rule ID: JS-STORAGE-001
- Severity: Low
- Location: `src/features/bridges/storage-bridge.js:104`
- Evidence: project JSON、project index、active project ID を localStorage に保存している
- Impact: 同一 origin で XSS が起きた場合や共有端末を利用した場合、保存した曲データを閲覧される可能性がある
- Fix: 公開時に「端末内保存」「アカウント同期なし」「共有端末では削除推奨」を明記し、全プロジェクト削除導線を用意する
- Mitigation: 保存データに個人情報、認証情報、秘密情報を追加しない
- False positive notes: 現在の保存対象は作曲データであり、通常は機密性が低い

## Fixed In This Review

### SEC-FIX-001: 開発用 Figma capture script の公開読込

- 修正: `index.html` から削除
- 効果: 不要な third-party script へ同一 origin 権限を与えない

### SEC-FIX-002: JSON import と保存復元の無制限処理

- 修正: `src/features/project/storage/storage-core.js` と `storage-helpers.js`
- 制限: 5MB、128小節、64トラック、64ドラム行
- 検証: version、楽器ID、track ID、配列長、重複ID、repeat state 数
- 効果: 細工されたJSONによるメモリ・CPU過負荷と不正な state 復元を抑制

### SEC-FIX-003: project ID の native 保存パス混入

- 修正: `src/features/project/storage/storage-core.js` と `src/features/bridges/storage-bridge.js`
- 効果: UUID またはアプリ生成形式以外を拒否し、パストラバーサルに使える文字列を保存パスへ渡さない

### SEC-FIX-004: Web 音源 middleware のパス境界

- 修正: `vite.config.js`
- 効果: `sounds/` 配下だけを配信し、解決後の絶対パスが音源ディレクトリ内であることを確認

### SEC-FIX-005: 開発依存の既知脆弱性

- 修正: `npm audit fix`
- 更新: Vite `7.3.5`、`@xmldom/xmldom` `0.8.13`、picomatch `4.0.4`、PostCSS `8.5.15` など
- 効果: Vite dev server の任意ファイル読取・deny bypass、XML injection、ReDoS などの既知脆弱性を解消

### SEC-FIX-006: Tone.js の外部 CDN 実行

- 修正: Tone.js `14.8.49` を npm dependency として固定し、Vite bundle へ含めた
- 効果: third-party CDN script の実行を廃止し、CSP `script-src 'self'` を利用可能にした

### SEC-FIX-007: Security headers の配信設定

- 修正: `public/_headers` と Vite dev/preview headers を追加
- 設定: CSP、nosniff、Referrer-Policy、Permissions-Policy、cache policy
- 注意: 本番配信先が `_headers` 形式へ対応するか、公開URLで確認が必要

### SEC-FIX-008: 保存失敗のユーザー通知

- 修正: `saveState` が成否を返し、失敗時に画面下部の通知を表示
- バックアップ: 保存失敗直前のメモリ上データをJSONとして書き出せる
- 効果: quota超過やstorage制限時に、保存済みという誤認とデータ喪失を防ぐ

## Verification

- `npm audit`: vulnerabilities 0
- secret/key scan:該当なし
- `npm run release:build`: 418 files / 69.0 MiB / success
- `npm run test:e2e:webkit`: 4 passed
- Web音源 endpoint: `application/octet-stream` と MP3 header を smoke test で確認

## Public Release Gate

- 公開先で security header を設定し、実レスポンスを確認する
- HTTPS の公開URLを使用する
- プライバシー説明と保存・削除・バックアップ方針を掲載する
- 公開URLで JSON import、保存、再読込、書出、音源読込を確認する
