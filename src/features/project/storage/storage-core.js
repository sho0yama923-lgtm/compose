import { appState, callbacks, clearPreviewCopyState, clearRepeatState } from '../../../core/state.js';
import {
    createSaveData,
    restoreFromData,
    buildDefaultExportFileName,
    normalizeExportFileName,
    MAX_PROJECT_FILE_BYTES,
} from './storage-helpers.js';
import { exportProjectData, exportProjectFiles, requestProjectImport } from '../../bridges/file-share-bridge.js';
import {
    clearProjectData,
    deleteProjectDataById,
    loadActiveProjectId,
    loadProjectData,
    loadProjectDataById,
    loadProjectIndexData,
    saveActiveProjectId,
    saveProjectData,
    saveProjectDataById,
    saveProjectIndexData,
} from '../../bridges/storage-bridge.js';
import { hideSaveErrorNotice, showSaveErrorNotice } from '../../../ui/save-error-notice.js';

const PROJECT_INDEX_VERSION = 1;
const MAX_PROJECT_NAME_LENGTH = 40;
const MAX_PROJECT_INDEX_BYTES = 512 * 1024;
const PROJECT_ID_PATTERN = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|project-\d+-\d+)$/i;
let latestUnsavedProjectJson = null;

function createProjectId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `project-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createTimestamp() {
    return new Date().toISOString();
}

function normalizeProjectName(name, fallback = '新規プロジェクト') {
    const trimmed = String(name || '').trim().slice(0, MAX_PROJECT_NAME_LENGTH);
    return trimmed || fallback;
}

function normalizeProjectId(projectId) {
    const value = String(projectId || '');
    return PROJECT_ID_PATTERN.test(value) ? value : null;
}

function normalizeProjectMeta(meta) {
    if (!meta || typeof meta !== 'object') return null;
    const id = normalizeProjectId(meta.id);
    if (!id) return null;
    const createdAt = typeof meta.createdAt === 'string' ? meta.createdAt : createTimestamp();
    return {
        id,
        name: normalizeProjectName(meta.name),
        createdAt,
        updatedAt: typeof meta.updatedAt === 'string' ? meta.updatedAt : createdAt,
    };
}

function sortProjectList(projects) {
    return [...projects].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function buildProjectIndexData(projects) {
    return JSON.stringify({
        version: PROJECT_INDEX_VERSION,
        projects: sortProjectList(projects),
    });
}

function parseProjectIndex(raw) {
    if (!raw) return [];
    if (raw.length > MAX_PROJECT_INDEX_BYTES) return [];
    try {
        const parsed = JSON.parse(raw);
        if (parsed?.version !== PROJECT_INDEX_VERSION || !Array.isArray(parsed.projects)) {
            return [];
        }
        return sortProjectList(parsed.projects.map(normalizeProjectMeta).filter(Boolean));
    } catch {
        return [];
    }
}

function setProjectList(projects) {
    appState.projectList = sortProjectList(projects.map(normalizeProjectMeta).filter(Boolean));
}

async function persistProjectList() {
    await saveProjectIndexData(buildProjectIndexData(appState.projectList));
}

function getActiveProjectMeta() {
    return appState.projectList.find((project) => project.id === appState.activeProjectId) || null;
}

function updateProjectMeta(projectId, updates) {
    const nextList = appState.projectList.map((project) => (
        project.id === projectId
            ? normalizeProjectMeta({ ...project, ...updates })
            : project
    )).filter(Boolean);
    setProjectList(nextList);
}

export async function initProjectStorage() {
    setProjectList(parseProjectIndex(await loadProjectIndexData()));
    const activeProjectId = await loadActiveProjectId();
    appState.activeProjectId = appState.projectList.some((project) => project.id === activeProjectId)
        ? activeProjectId
        : null;
    return appState.projectList;
}

export async function createProject(name = null) {
    const now = createTimestamp();
    const project = {
        id: createProjectId(),
        name: normalizeProjectName(name, `新規プロジェクト ${appState.projectList.length + 1}`),
        createdAt: now,
        updatedAt: now,
    };
    appState.activeProjectId = project.id;
    setProjectList([project, ...appState.projectList]);
    await persistProjectList();
    await saveActiveProjectId(project.id);
    return project;
}

export async function openProject(projectId) {
    try {
        const normalizedProjectId = normalizeProjectId(projectId);
        if (!normalizedProjectId) return false;
        const raw = await loadProjectDataById(normalizedProjectId);
        if (!raw || raw.length > MAX_PROJECT_FILE_BYTES) return false;

        const data = JSON.parse(raw);
        if (!restoreFromData(data, { clearPreviewCopyState, clearRepeatState })) return false;

        appState.activeProjectId = normalizedProjectId;
        appState.projectHomeVisible = false;
        appState.previewMode = true;
        appState.chordDrumSheetOpen = false;
        await saveActiveProjectId(normalizedProjectId);
        return true;
    } catch (e) {
        console.warn('openProject failed:', e);
        return false;
    }
}

export async function renameProject(projectId, name) {
    updateProjectMeta(projectId, {
        name: normalizeProjectName(name),
        updatedAt: createTimestamp(),
    });
    await persistProjectList();
    callbacks.renderProjectHome?.();
}

export async function deleteProject(projectId) {
    await deleteProjectDataById(projectId);
    setProjectList(appState.projectList.filter((project) => project.id !== projectId));
    if (appState.activeProjectId === projectId) {
        appState.activeProjectId = null;
        await saveActiveProjectId(null);
    }
    await persistProjectList();
    callbacks.renderProjectHome?.();
}

export async function deleteProjects(projectIds) {
    const ids = Array.isArray(projectIds)
        ? projectIds.map(normalizeProjectId).filter(Boolean)
        : [];
    if (ids.length === 0) return false;
    const idSet = new Set(ids);
    await Promise.all(ids.map((projectId) => deleteProjectDataById(projectId)));
    setProjectList(appState.projectList.filter((project) => !idSet.has(project.id)));
    if (idSet.has(appState.activeProjectId)) {
        appState.activeProjectId = null;
        await saveActiveProjectId(null);
    }
    appState.selectedProjectIds = [];
    appState.projectSelectionMode = false;
    await persistProjectList();
    callbacks.renderProjectHome?.();
    return true;
}

async function exportProjectJson(json) {
    if (!json) return false;

    const activeProject = getActiveProjectMeta();
    const defaultFileName = normalizeExportFileName(
        activeProject?.name || buildDefaultExportFileName(),
        buildDefaultExportFileName()
    );
    const requestedName = window.prompt('エクスポートするファイル名を入力してください', defaultFileName);
    if (requestedName === null) return false;

    return exportProjectData(
        json,
        normalizeExportFileName(requestedName, defaultFileName)
    );
}

async function exportLatestProjectBackup() {
    const json = latestUnsavedProjectJson || JSON.stringify(createSaveData());
    if (await exportProjectJson(json)) {
        hideSaveErrorNotice();
        return true;
    }
    return false;
}

export async function saveState({ notifyOnError = true } = {}) {
    if (!appState.activeProjectId) return true;
    try {
        const serialized = JSON.stringify(createSaveData());
        latestUnsavedProjectJson = serialized;
        await saveProjectDataById(appState.activeProjectId, serialized);
        await saveProjectData(serialized);

        const activeProject = getActiveProjectMeta();
        if (activeProject) {
            updateProjectMeta(activeProject.id, { updatedAt: createTimestamp() });
            await persistProjectList();
            callbacks.renderProjectHome?.();
        }
        latestUnsavedProjectJson = null;
        hideSaveErrorNotice();
        return true;
    } catch (e) {
        console.warn('saveState failed:', e);
        if (notifyOnError) {
            showSaveErrorNotice({ onExport: exportLatestProjectBackup });
        }
        return false;
    }
}

export async function loadState() {
    if (appState.activeProjectId) {
        return openProject(appState.activeProjectId);
    }

    try {
        const raw = await loadProjectData();
        if (!raw || raw.length > MAX_PROJECT_FILE_BYTES) return false;

        const data = JSON.parse(raw);
        return restoreFromData(data, { clearPreviewCopyState, clearRepeatState });
    } catch (e) {
        console.warn('loadState failed:', e);
        return false;
    }
}

export async function exportJSON() {
    const saved = await saveState({ notifyOnError: false });
    const json = saved && appState.activeProjectId
        ? await loadProjectDataById(appState.activeProjectId)
        : (saved ? await loadProjectData() : latestUnsavedProjectJson);
    if (!json) return false;

    return exportProjectJson(json);
}

export async function exportProjectsJSON(projectIds) {
    const ids = Array.isArray(projectIds)
        ? projectIds.map(normalizeProjectId).filter(Boolean)
        : [];
    if (ids.length === 0) return false;

    const files = [];
    const usedFileNames = new Map();
    for (const projectId of ids) {
        const project = appState.projectList.find((item) => item.id === projectId);
        const json = await loadProjectDataById(projectId);
        if (!json) continue;
        const defaultName = normalizeExportFileName(
            project?.name || buildDefaultExportFileName(),
            buildDefaultExportFileName()
        );
        const usedCount = usedFileNames.get(defaultName) || 0;
        usedFileNames.set(defaultName, usedCount + 1);
        const fileName = usedCount === 0
            ? defaultName
            : defaultName.replace(/\.json$/i, `-${usedCount + 1}.json`);
        files.push({ serialized: json, fileName });
    }
    if (files.length === 0) return false;
    return exportProjectFiles(files);
}

export async function importJSON(file) {
    try {
        if (!file || file.size > MAX_PROJECT_FILE_BYTES) {
            alert('ファイルサイズが大きすぎます');
            return false;
        }
        const text = await file.text();
        if (text.length > MAX_PROJECT_FILE_BYTES) {
            alert('ファイルサイズが大きすぎます');
            return false;
        }
        const data = JSON.parse(text);

        if (!restoreFromData(data, { clearPreviewCopyState, clearRepeatState })) {
            alert('ファイルの形式が正しくありません');
            return false;
        }

        const fileName = file.name?.replace(/\.json$/i, '') || null;
        await createProject(fileName || null);
        appState.previewMode = true;
        appState.chordDrumSheetOpen = false;
        await saveState();
        callbacks.showProjectEditor?.();
        callbacks.renderEditor?.();
        callbacks.renderSidebar?.();
        return true;
    } catch (e) {
        alert('ファイルのインポートに失敗しました');
        console.warn('importJSON failed:', e);
        return false;
    }
}

export async function resetState() {
    await clearProjectData();
    location.reload();
}

export function showProjectList() {
    appState.projectHomeVisible = true;
    callbacks.closeSidebar?.();
    callbacks.showProjectHome?.();
}

export function initSaveLoad() {
    document.getElementById('exportBtn').addEventListener('click', async () => {
        if (await exportJSON()) {
            callbacks.closeSidebar();
        }
    });

    document.getElementById('importBtn').addEventListener('click', () => {
        requestProjectImport(document.getElementById('importFile'));
    });

    document.getElementById('importFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) await importJSON(file);
        e.target.value = '';
        callbacks.closeSidebar();
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        showProjectList();
    });
}
