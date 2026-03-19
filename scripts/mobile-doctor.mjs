import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execSync } from 'node:child_process';
import process from 'node:process';

const checks = [
  {
    label: 'Node.js',
    command: 'node --version',
  },
  {
    label: 'npm',
    command: 'npm --version',
  },
  {
    label: 'Capacitor CLI',
    command: 'npx cap --version',
  },
  {
    label: 'Xcode',
    command: 'xcodebuild -version',
    optional: true,
  },
  {
    label: 'Android Studio helper',
    command: 'adb --version',
    optional: true,
  },
];

const nativePaths = [
  'ios/App/App.xcodeproj',
  'android/app/build.gradle',
  'src/main.js',
];

function runCheck({ label, command, optional = false }) {
  try {
    const output = execSync(command, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim();
    console.log(`[ok] ${label}: ${output.split('\n')[0]}`);
    return true;
  } catch (error) {
    const reason = error.stderr?.toString().trim() || error.message;
    const prefix = optional ? '[warn]' : '[missing]';
    console.log(`${prefix} ${label}: ${reason}`);
    return optional;
  }
}

async function checkPath(path) {
  try {
    await access(path, constants.F_OK);
    console.log(`[ok] path: ${path}`);
  } catch {
    console.log(`[missing] path: ${path}`);
  }
}

console.log('Mobile Doctor');
console.log(`cwd: ${process.cwd()}`);
console.log('');

let healthy = true;
for (const check of checks) {
  const result = runCheck(check);
  healthy = healthy && result;
}

console.log('');
for (const path of nativePaths) {
  await checkPath(path);
}

console.log('');
console.log('Recommended daily flow');
console.log('- iOS: npm run mobile:sync:ios -> npm run mobile:open:ios');
console.log('- Android: npm run mobile:sync:android -> npm run mobile:open:android');
console.log('- Web smoke: npm run test:e2e:webkit');

if (!healthy) {
  process.exitCode = 1;
}
