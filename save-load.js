// save-load.js — 自動保存(localStorage) + JSONエクスポート/インポート

import { appState, callbacks } from './state.js';

const STORAGE_KEY = 'compose_save';
const DATA_VERSION = 1;

// -------------------------------------------------------
// 保存
// -------------------------------------------------------
export function saveState() {
    try {
        const data = {
            version: DATA_VERSION,
            bpm: Number(document.getElementById('bpmInput').value) || 120,
            numMeasures: appState.numMeasures,
            nextId: appState.nextId,
            currentMeasure: appState.currentMeasure,
            activeTrackId: appState.activeTrackId,
            tracks: appState.tracks.map(t => {
                const clone = { ...t };
                // Set → Array 変換
                if (clone.selectedDrumRows instanceof Set) {
                    clone.selectedDrumRows = [...clone.selectedDrumRows];
                }
                return clone;
            }),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        // localStorage 容量超過などの場合は静かに失敗
        console.warn('saveState failed:', e);
    }
}

// -------------------------------------------------------
// 復元
// -------------------------------------------------------
export function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;

        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.tracks)) return false;

        // appState 復元
        appState.numMeasures   = data.numMeasures   ?? 4;
        appState.nextId        = data.nextId         ?? 0;
        appState.currentMeasure = data.currentMeasure ?? 0;
        appState.activeTrackId = data.activeTrackId  ?? null;

        // トラック復元（Array → Set 変換）
        appState.tracks = data.tracks.map(t => {
            if (Array.isArray(t.selectedDrumRows)) {
                t.selectedDrumRows = new Set(t.selectedDrumRows);
            }
            return t;
        });

        // BPM 復元
        if (data.bpm) {
            document.getElementById('bpmInput').value = data.bpm;
        }

        return true;
    } catch (e) {
        console.warn('loadState failed:', e);
        return false;
    }
}

// -------------------------------------------------------
// JSON → appState 復元（共通ロジック）
// -------------------------------------------------------
function restoreFromData(data) {
    if (!data || !Array.isArray(data.tracks)) return false;

    appState.numMeasures    = data.numMeasures   ?? 4;
    appState.nextId         = data.nextId         ?? 0;
    appState.currentMeasure = data.currentMeasure ?? 0;
    appState.activeTrackId  = data.activeTrackId  ?? null;

    appState.tracks = data.tracks.map(t => {
        if (Array.isArray(t.selectedDrumRows)) {
            t.selectedDrumRows = new Set(t.selectedDrumRows);
        }
        return t;
    });

    if (data.bpm) {
        document.getElementById('bpmInput').value = data.bpm;
    }

    return true;
}

// -------------------------------------------------------
// エクスポート（JSONファイルダウンロード）
// -------------------------------------------------------
export function exportJSON() {
    saveState(); // 最新状態を確定
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return;

    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `compose_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}

// -------------------------------------------------------
// インポート（JSONファイル読み込み）
// -------------------------------------------------------
export async function importJSON(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!restoreFromData(data)) {
            alert('ファイルの形式が正しくありません');
            return;
        }

        saveState();
        appState.previewMode = true;
        callbacks.renderEditor();
        callbacks.renderSidebar();
    } catch (e) {
        alert('ファイルの読み込みに失敗しました');
        console.warn('importJSON failed:', e);
    }
}

// -------------------------------------------------------
// 新規作成（リセット）
// -------------------------------------------------------
export function resetState() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
}

// -------------------------------------------------------
// UIイベント登録
// -------------------------------------------------------
export function initSaveLoad() {
    document.getElementById('exportBtn').addEventListener('click', () => {
        exportJSON();
        callbacks.closeSidebar();
    });

    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) await importJSON(file);
        e.target.value = ''; // 同じファイルの再選択を可能に
        callbacks.closeSidebar();
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        if (confirm('現在のデータを破棄して新規作成しますか？')) {
            resetState();
        }
    });
}
