# Legacy Files

このディレクトリには、現在の本番運用では使わないが、過去の設定や復旧参考として残すファイルを置く。

- `netlify/`: GitHub Pages 移行前に使っていた Netlify build / header 設定
- `local-dev/`: Vite 以前または手元起動用の古い補助スクリプト

通常の開発では `npm run dev`、本番配信では `.github/workflows/deploy-pages.yml` を使う。
