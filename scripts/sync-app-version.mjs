import { readFile, writeFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const projectPath = 'ios/App/App.xcodeproj/project.pbxproj';
const projectFile = await readFile(projectPath, 'utf8');
const versionPattern = /MARKETING_VERSION = [^;]+;/g;
const matches = projectFile.match(versionPattern) || [];

if (matches.length === 0) {
  throw new Error(`MARKETING_VERSION was not found in ${projectPath}`);
}

const nextProjectFile = projectFile.replace(
  versionPattern,
  `MARKETING_VERSION = ${packageJson.version};`
);

if (nextProjectFile !== projectFile) {
  await writeFile(projectPath, nextProjectFile);
}

console.log(`Synced app version ${packageJson.version} to iOS`);
