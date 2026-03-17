import { appState, callbacks, clearPreviewCopyState, clearRepeatState } from '../../../core/state.js';
import {
    STORAGE_KEY,
    createSaveData,
    restoreFromData,
    buildDefaultExportFileName,
    normalizeExportFileName,
} from './storage-helpers.js';

export function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(createSaveData()));
    } catch (e) {
        console.warn('saveState failed:', e);
    }
}

export function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;

        const data = JSON.parse(raw);
        return restoreFromData(data, { clearPreviewCopyState, clearRepeatState });
    } catch (e) {
        console.warn('loadState failed:', e);
        return false;
    }
}

export function exportJSON() {
    saveState();
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return false;

    const defaultFileName = buildDefaultExportFileName();
    const requestedName = window.prompt('保存ファイル名を入力してください', defaultFileName);
    if (requestedName === null) return false;

    const normalizedName = normalizeExportFileName(requestedName, defaultFileName);

    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = normalizedName;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
}

export async function importJSON(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!restoreFromData(data, { clearPreviewCopyState, clearRepeatState })) {
            alert('ファイルの形式が正しくありません');
            return;
        }

        saveState();
        appState.previewMode = true;
        appState.chordDrumSheetOpen = false;
        callbacks.renderEditor();
        callbacks.renderSidebar();
    } catch (e) {
        alert('ファイルの読み込みに失敗しました');
        console.warn('importJSON failed:', e);
    }
}

export function resetState() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
}

export function initSaveLoad() {
    document.getElementById('exportBtn').addEventListener('click', () => {
        if (exportJSON()) {
            callbacks.closeSidebar();
        }
    });

    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) await importJSON(file);
        e.target.value = '';
        callbacks.closeSidebar();
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        if (confirm('現在のデータを破棄して新規作成しますか？')) {
            resetState();
        }
    });
}
