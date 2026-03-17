import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { defineConfig } from 'vite';

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
        const normalizedPath = normalize(decodeURIComponent(requestUrl)).replace(/^(\.\.[/\\])+/, '');
        const filePath = resolve(sourceDir, `.${normalizedPath.replace(/\.bin$/, '')}`);
        if (!filePath.startsWith(sourceDir) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
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
  plugins: [copySoundsPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});
