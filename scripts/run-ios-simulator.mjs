import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectPath = resolve(rootDir, 'ios/App/App.xcodeproj');
const scheme = 'App';
const configuration = 'Debug';
const bundleId = 'com.yamaoxiogo.compose';
const derivedDataPath = process.env.IOS_DERIVED_DATA_PATH
    ? resolve(process.env.IOS_DERIVED_DATA_PATH)
    : resolve(tmpdir(), 'compose-ios-sim-derived');
const iosPublicPath = resolve(rootDir, 'ios/App/App/public');
const defaultSimulatorName = process.env.IOS_SIMULATOR_NAME || 'iPhone 17';
const requestedSimulatorId = process.env.IOS_SIMULATOR_ID || '';

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: rootDir,
        env: process.env,
        stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        encoding: 'utf8',
    });
    if (result.status !== 0) {
        const details = options.capture ? `\n${result.stderr || result.stdout || ''}` : '';
        throw new Error(`${command} ${args.join(' ')} failed${details}`);
    }
    return options.capture ? result.stdout : '';
}

function readJson(command, args) {
    return JSON.parse(execFileSync(command, args, {
        cwd: rootDir,
        encoding: 'utf8',
    }));
}

function getAvailableSimulators() {
    const data = readJson('xcrun', ['simctl', 'list', 'devices', 'available', '--json']);
    return Object.entries(data.devices || {})
        .flatMap(([runtime, devices]) => devices.map((device) => ({ ...device, runtime })));
}

function pickSimulator() {
    const simulators = getAvailableSimulators();
    if (requestedSimulatorId) {
        const match = simulators.find((device) => device.udid === requestedSimulatorId);
        if (!match) throw new Error(`Simulator not found: ${requestedSimulatorId}`);
        return match;
    }

    const exact = simulators
        .filter((device) => device.name === defaultSimulatorName)
        .sort((a, b) => b.runtime.localeCompare(a.runtime))[0];
    if (exact) return exact;

    const booted = simulators.find((device) => device.state === 'Booted');
    if (booted) return booted;

    const iphone = simulators.find((device) => device.name.startsWith('iPhone'));
    if (iphone) return iphone;

    throw new Error('No available iOS simulator was found.');
}

async function main() {
    const simulator = pickSimulator();
    const appPath = resolve(
        derivedDataPath,
        `Build/Products/${configuration}-iphonesimulator/${scheme}.app`
    );

    console.log(`Using simulator: ${simulator.name} (${simulator.udid})`);
    run('npm', ['run', 'mobile:sync:ios']);
    run('xattr', ['-cr', iosPublicPath]);
    run('find', [iosPublicPath, '-name', '.DS_Store', '-delete']);
    await mkdir(derivedDataPath, { recursive: true });
    await rm(appPath, { recursive: true, force: true });

    if (simulator.state !== 'Booted') {
        run('xcrun', ['simctl', 'boot', simulator.udid]);
    }
    run('xcrun', ['simctl', 'bootstatus', simulator.udid, '-b']);
    run('open', ['-a', 'Simulator']);

    run('xcodebuild', [
        '-project', projectPath,
        '-scheme', scheme,
        '-configuration', configuration,
        '-destination', `id=${simulator.udid}`,
        '-derivedDataPath', derivedDataPath,
        '-quiet',
        'build',
    ]);

    if (!existsSync(appPath)) {
        throw new Error(`Built app was not found: ${appPath}`);
    }

    run('xcrun', ['simctl', 'install', simulator.udid, appPath]);
    run('xcrun', ['simctl', 'launch', simulator.udid, bundleId]);
    console.log(`Launched ${bundleId} on ${simulator.name}`);
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
