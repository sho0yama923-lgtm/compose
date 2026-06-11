import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const DIST_DIR = resolve('dist');
const MAX_DIST_BYTES = 100 * 1024 * 1024;
const REQUIRED_HEADERS = [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
];

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return nestedFiles.flat();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const files = await listFiles(DIST_DIR);
const fileStats = await Promise.all(files.map((file) => stat(file)));
const distBytes = fileStats.reduce((sum, fileStat) => sum + fileStat.size, 0);
assert(distBytes <= MAX_DIST_BYTES, `dist exceeds 100 MiB: ${distBytes} bytes`);

const indexHtml = await readFile(join(DIST_DIR, 'index.html'), 'utf8');
assert(!/<script[^>]+src=["']https?:\/\//i.test(indexHtml), 'External script found in dist/index.html');
assert(/<script[^>]+type=["']module["'][^>]+src=["'](?:\.\/|\/)assets\//i.test(indexHtml), 'Bundled module script not found');

const headers = await readFile(join(DIST_DIR, '_headers'), 'utf8');
for (const header of REQUIRED_HEADERS) {
  assert(headers.includes(`${header}:`), `Missing security header: ${header}`);
}
assert(headers.includes("script-src 'self'"), "CSP must restrict scripts to 'self'");
assert(headers.includes("frame-ancestors 'none'"), 'CSP must block framing');

const samplePaths = [
  join(DIST_DIR, 'audio-buffers', 'sounds', 'piano', 'A1.mp3.bin'),
  join(DIST_DIR, 'audio-buffers', 'sounds', 'drums', 'kick.mp3.bin'),
];
for (const samplePath of samplePaths) {
  const sample = await readFile(samplePath);
  assert(sample.length > 1024, `Audio sample is unexpectedly small: ${samplePath}`);
  const hasId3Header = sample.subarray(0, 3).toString() === 'ID3';
  const hasMpegSync = sample[0] === 0xff && (sample[1] & 0xe0) === 0xe0;
  assert(hasId3Header || hasMpegSync, `Invalid MP3 payload: ${samplePath}`);
}

const externalTextAssets = files.filter((file) => ['.html', '.js', '.css'].includes(extname(file)));
for (const file of externalTextAssets) {
  const content = await readFile(file, 'utf8');
  assert(!content.includes('mcp.figma.com'), `Development script reference found: ${file}`);
  assert(!content.includes('cdnjs.cloudflare.com/ajax/libs/tone'), `Tone.js CDN reference found: ${file}`);
}

console.log(`Web release verified: ${files.length} files, ${(distBytes / 1024 / 1024).toFixed(1)} MiB`);
