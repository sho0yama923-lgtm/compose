import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { STORAGE_KEY } from '../project/storage/storage-helpers.js';
import { isNativeApp } from './device-bridge.js';

const PROJECT_DIR = 'compose';
const PROJECT_FILE = `${PROJECT_DIR}/compose-save.json`;
let hasEnsuredNativeProjectDir = false;
let ensureNativeProjectDirPromise = null;

async function ensureNativeProjectDir() {
    if (!isNativeApp() || hasEnsuredNativeProjectDir) return;
    if (!ensureNativeProjectDirPromise) {
        ensureNativeProjectDirPromise = Filesystem.mkdir({
            path: PROJECT_DIR,
            directory: Directory.Library,
            recursive: true,
        }).catch(() => {}).finally(() => {
            hasEnsuredNativeProjectDir = true;
            ensureNativeProjectDirPromise = null;
        });
    }
    await ensureNativeProjectDirPromise;
}

async function writeNativeProjectData(serialized) {
    if (!isNativeApp()) return;
    await ensureNativeProjectDir();
    await Filesystem.writeFile({
        path: PROJECT_FILE,
        data: serialized,
        directory: Directory.Library,
        encoding: Encoding.UTF8,
        recursive: true,
    });
}

async function readNativeProjectData() {
    if (!isNativeApp()) return null;
    try {
        const result = await Filesystem.readFile({
            path: PROJECT_FILE,
            directory: Directory.Library,
            encoding: Encoding.UTF8,
        });
        return typeof result.data === 'string' ? result.data : null;
    } catch {
        return null;
    }
}

export async function saveProjectData(serialized) {
    localStorage.setItem(STORAGE_KEY, serialized);
    try {
        await writeNativeProjectData(serialized);
    } catch (error) {
        console.warn('saveProjectData failed:', error);
    }
}

export async function loadProjectData() {
    const nativeData = await readNativeProjectData();
    if (nativeData) {
        localStorage.setItem(STORAGE_KEY, nativeData);
        return nativeData;
    }
    return localStorage.getItem(STORAGE_KEY);
}

export async function clearProjectData() {
    localStorage.removeItem(STORAGE_KEY);
    if (!isNativeApp()) return;
    try {
        await Filesystem.deleteFile({
            path: PROJECT_FILE,
            directory: Directory.Library,
        });
    } catch {
        // 初回や未保存時は削除対象がないので無視する
    }
}
