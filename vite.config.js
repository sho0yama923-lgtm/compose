import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { defineConfig } from 'vite';

const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function copyAudioBufferAssets(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyAudioBufferAssets(sourcePath, targetPath);
      continue;
    }
    const fileBuffer = readFileSync(sourcePath);
    const nextTargetPath = extname(entry.name).toLowerCase() === '.mp3'
      ? `${targetPath}.bin`
      : targetPath;
    writeFileSync(nextTargetPath, fileBuffer);
  }
}

function copySoundsPlugin() {
  const sourceDir = resolve(__dirname, 'sounds');

  return {
    name: 'copy-sounds-assets',
    configureServer(server) {
      server.middlewares.use('/audio-buffers', (req, res, next) => {
        const requestUrl = req.url || '/';
        const normalizedPath = normalize(decodeURIComponent(requestUrl))
          .replace(/^[/\\]+/, '')
          .replace(/^(\.\.[/\\])+/, '')
          .replace(/\.bin$/, '');
        const filePath = resolve(__dirname, normalizedPath);
        const isSoundAsset = filePath.startsWith(`${sourceDir}${sep}`);
        if (!isSoundAsset || !existsSync(filePath) || statSync(filePath).isDirectory()) {
          next();
          return;
        }
        res.setHeader('Content-Type', 'application/octet-stream');
        res.end(readFileSync(filePath));
      });
    },
    closeBundle() {
      const targetDir = resolve(__dirname, 'dist', 'sounds');
      const audioBufferTargetDir = resolve(__dirname, 'dist', 'audio-buffers', 'sounds');
      if (!existsSync(sourceDir)) return;
      cpSync(sourceDir, targetDir, { recursive: true });
      copyAudioBufferAssets(sourceDir, audioBufferTargetDir);
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [copySoundsPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    headers: securityHeaders,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    headers: securityHeaders,
  },
});
