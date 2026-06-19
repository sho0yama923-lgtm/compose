# Web Public Release

## 公開前チェック

- `npm run release:check`
- Tone.js が npm dependency として bundle され、外部 CDN script がないことを確認する
- 本番 URL が HTTPS であることを確認する
- security header を実レスポンスで確認する
- JSON 読込、保存、再読込、書出、音源再生を本番 URL で確認する
- storage quota 超過時に保存エラー通知とJSON書出が動くことを確認する

Codex app では `Web Release Check` action から同じ確認を実行できる。

## 推奨 Security Headers

配信環境の HTTP response header で設定する。

```text
Content-Security-Policy: default-src 'self'; script-src 'self' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

`public/_headers` は Netlify など `_headers` 形式に対応する配信先で利用できる。対応しない配信先では同じ内容を管理画面や配信設定へ移す。

## Netlify

`netlify.toml` に次を設定済み。

- build command: `npm run release:build`
- publish directory: `dist`
- Node.js: `24`
- CSP と security headers
- HTML / hash asset / 音源の cache policy

Netlify で GitHub repository `sho0yama923-lgtm/compose` を選択すれば、追加の build 設定なしで preview deploy できる。

## CI

`.github/workflows/web-release-check.yml` は `main` push と pull request で次を確認する。

- `npm ci`
- `npm audit`
- production build と成果物検査
- 外部 script 混入なし
- security headers 定義
- 音源ファイルの MP3 payload
- WebKit smoke

WebKit は音源を含む初回bundle処理でCI負荷が上がるため、2 workers・1 test 60秒で実行する。

## Release Verification

`npm run release:verify` は `dist/` に対して以下を検査する。

- 合計サイズが `100MiB` 以下
- Tone.js / Figma の外部 script がない
- CSP、nosniff、Referrer-Policy、Permissions-Policy がある
- CSP が `script-src 'self'` と `frame-ancestors 'none'` を含む
- ピアノとドラムの配信用音源が有効な MP3

## 保存とプライバシー

- Web版の曲データはブラウザの localStorage に端末内保存する
- サーバーやアカウントへの同期は行わない
- ブラウザデータ削除で曲データも消える可能性がある
- 共有端末では利用後にプロジェクトを削除する
- バックアップには JSON 書出を利用する
- 個人情報、認証情報、秘密情報を保存形式へ追加しない

## Cache Policy

- hash 付き JS / CSS / 音源: 長期 cache 可
- `index.html`: 短期 cache または `no-cache`
- version 更新時は旧 asset を一定期間残すか、atomic deploy を使う

## 関連

- `security_best_practices_report.md`
- `docs/mobile-dev.md`
- `docs/codex-workflow.md`
