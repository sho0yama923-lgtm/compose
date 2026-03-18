import { appState, callbacks, clearPreviewCopyState, clearRepeatState } from '../../../core/state.js';
import {
    createSaveData,
    restoreFromData,
    buildDefaultExportFileName,
    normalizeExportFileName,
} from './storage-helpers.js';
import { exportProjectData, requestProjectImport } from '../../bridges/file-share-bridge.js';
import { clearProjectData, loadProjectData, saveProjectData } from '../../bridges/storage-bridge.js';

export async function saveState() {
    try {
        await saveProjectData(JSON.stringify(createSaveData()));
    } catch (e) {
        console.warn('saveState failed:', e);
    }
}

export async function loadState() {
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
    const json = await loadProjectData();
    if (!json) return false;

    const defaultFileName = buildDefaultExportFileName();
    const requestedName = window.prompt('保存ファイル名を入力してください', defaultFileName);
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
            return;
        }

        await saveState();
        appState.previewMode = true;
        appState.chordDrumSheetOpen = false;
        callbacks.renderEditor();
        callbacks.renderSidebar();
    } catch (e) {
        alert('ファイルの読み込みに失敗しました');
        console.warn('importJSON failed:', e);
    }
}

export async function resetState() {
    await clearProjectData();
    location.reload();
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

    document.getElementById('resetBtn').addEventListener('click', async () => {
        if (confirm('現在のデータを破棄して新規作成しますか？')) {
            await resetState();
        }
    });
}
