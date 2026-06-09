import { appState, callbacks, clearPreviewCopyState, clearRepeatState } from '../../../core/state.js';
import {
    createSaveData,
    restoreFromData,
    buildDefaultExportFileName,
    normalizeExportFileName,
} from './storage-helpers.js';
import { exportProjectData, requestProjectImport } from '../../bridges/file-share-bridge.js';
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

const PROJECT_INDEX_VERSION = 1;

function createProjectId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `project-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createTimestamp() {
    return new Date().toISOString();
}

function normalizeProjectName(name, fallback = '新規プロジェクト') {
    const trimmed = String(name || '').trim();
    return trimmed || fallback;
}

function normalizeProjectMeta(meta) {
    if (!meta || typeof meta !== 'object' || !meta.id) return null;
    const createdAt = typeof meta.createdAt === 'string' ? meta.createdAt : createTimestamp();
    return {
        id: String(meta.id),
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
        const raw = await loadProjectDataById(projectId);
        if (!raw) return false;

        const data = JSON.parse(raw);
        if (!restoreFromData(data, { clearPreviewCopyState, clearRepeatState })) return false;

        appState.activeProjectId = projectId;
        appState.projectHomeVisible = false;
        appState.previewMode = true;
        appState.chordDrumSheetOpen = false;
        await saveActiveProjectId(projectId);
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

export async function saveState() {
    if (!appState.activeProjectId) return;
    try {
        const serialized = JSON.stringify(createSaveData());
        await saveProjectDataById(appState.activeProjectId, serialized);
        await saveProjectData(serialized);

        const activeProject = getActiveProjectMeta();
        if (activeProject) {
            updateProjectMeta(activeProject.id, { updatedAt: createTimestamp() });
            await persistProjectList();
            callbacks.renderProjectHome?.();
        }
    } catch (e) {
        console.warn('saveState failed:', e);
    }
}

export async function loadState() {
    if (appState.activeProjectId) {
        return openProject(appState.activeProjectId);
    }

    try {
        const raw = await loadProjectData();
        if (!raw) return false;

        const data = JSON.parse(raw);
        return restoreFromData(data, { clearPreviewCopyState, clearRepeatState });
    } catch (e) {
        console.warn('loadState failed:', e);
        return false;
    }
}

export async function exportJSON() {
    await saveState();
    const json = appState.activeProjectId
        ? await loadProjectDataById(appState.activeProjectId)
        : await loadProjectData();
    if (!json) return false;

    const activeProject = getActiveProjectMeta();
    const defaultFileName = normalizeExportFileName(
        activeProject?.name || buildDefaultExportFileName(),
        buildDefaultExportFileName()
    );
    const requestedName = window.prompt('書き出すファイル名を入力してください', defaultFileName);
    if (requestedName === null) return false;

    const normalizedName = normalizeExportFileName(requestedName, defaultFileName);

    return exportProjectData(json, normalizedName);
}

export async function importJSON(file) {
    try {
        const text = await file.text();
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
        alert('ファイルの読み込みに失敗しました');
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
