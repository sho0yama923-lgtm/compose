import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { STORAGE_KEY } from '../project/storage/storage-helpers.js';
import { canUseNativeFilesystem } from './device-bridge.js';

const PROJECT_DIR = 'compose';
const PROJECT_FILE = `${PROJECT_DIR}/compose-save.json`;
const PROJECT_INDEX_KEY = 'compose_project_index';
const ACTIVE_PROJECT_KEY = 'compose_active_project_id';
const PROJECT_INDEX_FILE = `${PROJECT_DIR}/project-index.json`;
const ACTIVE_PROJECT_FILE = `${PROJECT_DIR}/active-project.json`;
let hasEnsuredNativeProjectDir = false;
let ensureNativeProjectDirPromise = null;
const PROJECT_ID_PATTERN = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|project-\d+-\d+)$/i;

function requireValidProjectId(projectId) {
    const value = String(projectId || '');
    if (!PROJECT_ID_PATTERN.test(value)) {
        throw new TypeError('Invalid project id');
    }
    return value;
}

function buildProjectStorageKey(projectId) {
    return `compose_project:${requireValidProjectId(projectId)}`;
}

function buildProjectFile(projectId) {
    return `${PROJECT_DIR}/project-${requireValidProjectId(projectId)}.json`;
}

function isMissingEntryError(error) {
    const message = String(error?.message || error?.errorMessage || '');
    const code = String(error?.code || '');
    return code === 'OS-PLUG-FILE-0008'
        || code === 'NOT_FOUND_ERR'
        || /does not exist/i.test(message)
        || /not found/i.test(message);
}

async function ensureNativeProjectDir() {
    if (!canUseNativeFilesystem() || hasEnsuredNativeProjectDir) return;
    if (!ensureNativeProjectDirPromise) {
        ensureNativeProjectDirPromise = (async () => {
            try {
                await Filesystem.stat({
                    path: PROJECT_DIR,
                    directory: Directory.Library,
                });
            } catch (error) {
                if (!isMissingEntryError(error)) throw error;
                await Filesystem.mkdir({
                    path: PROJECT_DIR,
                    directory: Directory.Library,
                    recursive: true,
                });
            }
        })().catch(() => {}).finally(() => {
            hasEnsuredNativeProjectDir = true;
            ensureNativeProjectDirPromise = null;
        });
    }
    await ensureNativeProjectDirPromise;
}

async function writeNativeTextFile(path, serialized) {
    if (!canUseNativeFilesystem()) return;
    await ensureNativeProjectDir();
    await Filesystem.writeFile({
        path,
        data: serialized,
        directory: Directory.Library,
        encoding: Encoding.UTF8,
        recursive: true,
    });
}

async function readNativeTextFile(path) {
    if (!canUseNativeFilesystem()) return null;
    try {
        const result = await Filesystem.readFile({
            path,
            directory: Directory.Library,
            encoding: Encoding.UTF8,
        });
        return typeof result.data === 'string' ? result.data : null;
    } catch {
        return null;
    }
}

async function deleteNativeTextFile(path) {
    if (!canUseNativeFilesystem()) return;
    try {
        await Filesystem.deleteFile({
            path,
            directory: Directory.Library,
        });
    } catch {
        // 初回起動や未保存プロジェクトでは、削除対象がなくても正常扱いにする。
    }
}

export async function saveProjectData(serialized) {
    localStorage.setItem(STORAGE_KEY, serialized);
    try {
        await writeNativeTextFile(PROJECT_FILE, serialized);
    } catch (error) {
        console.warn('saveProjectData failed:', error);
    }
}

export async function loadProjectData() {
    const nativeData = await readNativeTextFile(PROJECT_FILE);
    if (nativeData) {
        localStorage.setItem(STORAGE_KEY, nativeData);
        return nativeData;
    }
    return localStorage.getItem(STORAGE_KEY);
}

export async function clearProjectData() {
    localStorage.removeItem(STORAGE_KEY);
    await deleteNativeTextFile(PROJECT_FILE);
}

export async function saveProjectIndexData(serialized) {
    localStorage.setItem(PROJECT_INDEX_KEY, serialized);
    try {
        await writeNativeTextFile(PROJECT_INDEX_FILE, serialized);
    } catch (error) {
        console.warn('saveProjectIndexData failed:', error);
    }
}

export async function loadProjectIndexData() {
    const nativeData = await readNativeTextFile(PROJECT_INDEX_FILE);
    if (nativeData) {
        localStorage.setItem(PROJECT_INDEX_KEY, nativeData);
        return nativeData;
    }
    return localStorage.getItem(PROJECT_INDEX_KEY);
}

export async function saveProjectDataById(projectId, serialized) {
    localStorage.setItem(buildProjectStorageKey(projectId), serialized);
    try {
        await writeNativeTextFile(buildProjectFile(projectId), serialized);
    } catch (error) {
        console.warn('saveProjectDataById failed:', error);
    }
}

export async function loadProjectDataById(projectId) {
    const nativeData = await readNativeTextFile(buildProjectFile(projectId));
    if (nativeData) {
        localStorage.setItem(buildProjectStorageKey(projectId), nativeData);
        return nativeData;
    }
    return localStorage.getItem(buildProjectStorageKey(projectId));
}

export async function deleteProjectDataById(projectId) {
    localStorage.removeItem(buildProjectStorageKey(projectId));
    await deleteNativeTextFile(buildProjectFile(projectId));
}

export async function saveActiveProjectId(projectId) {
    const value = projectId || '';
    localStorage.setItem(ACTIVE_PROJECT_KEY, value);
    try {
        await writeNativeTextFile(ACTIVE_PROJECT_FILE, value);
    } catch (error) {
        console.warn('saveActiveProjectId failed:', error);
    }
}

export async function loadActiveProjectId() {
    const nativeData = await readNativeTextFile(ACTIVE_PROJECT_FILE);
    if (nativeData !== null) {
        localStorage.setItem(ACTIVE_PROJECT_KEY, nativeData);
        return nativeData || null;
    }
    return localStorage.getItem(ACTIVE_PROJECT_KEY) || null;
}
