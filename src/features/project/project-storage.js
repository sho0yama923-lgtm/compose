// save-load.js — 自動保存(localStorage) + JSONエクスポート/インポート

import { appState, callbacks, totalSteps, STEPS_PER_MEASURE } from '../../core/state.js';
import { INST_TYPE, OCTAVE_DEFAULT_BASE, DRUM_ROWS } from '../tracks/instrument-map.js';
import { CHROMATIC, DURATION_CELLS } from '../../core/constants.js';

const STORAGE_KEY = 'compose_save';
const DATA_VERSION = 4;
const VALID_DURATIONS = new Set(Object.keys(DURATION_CELLS));

// -------------------------------------------------------
// v1 → v2 マイグレーション: boolean → duration string
// -------------------------------------------------------
function migrateV1toV2(data) {
    data.tracks.forEach(t => {
        // rhythm: rows.steps
        if (t.rows) {
            t.rows.forEach(r => {
                r.steps = r.steps.map(v => v === true ? '16n' : (v === false ? null : v));
            });
        }
        // melody: stepsMap
        if (t.stepsMap) {
            Object.keys(t.stepsMap).forEach(k => {
                t.stepsMap[k] = t.stepsMap[k].map(v => v === true ? '16n' : (v === false ? null : v));
            });
        }
        // chord: soundSteps
        if (t.soundSteps) {
            t.soundSteps = t.soundSteps.map(v => v === true ? '16n' : (v === false ? null : v));
        }
    });
    data.version = 2;
}

function normalizeStepArray(steps, length) {
    if (Array.isArray(steps) && steps.length !== length) {
        return null;
    }
    const normalized = Array.isArray(steps) ? [...steps] : [];
    for (let i = 0; i < length; i++) {
        const val = normalized[i];
        if (val === true) normalized[i] = '16n';
        else if (val === false || val === undefined) normalized[i] = null;
    }
    if (normalized.length < length) {
        normalized.push(...Array(length - normalized.length).fill(null));
    } else if (normalized.length > length) {
        normalized.length = length;
    }
    return normalized;
}

function normalizeBeatConfig(numMeasures, beatConfig) {
    const normalized = Array.isArray(beatConfig) ? beatConfig.slice(0, numMeasures) : [];
    while (normalized.length < numMeasures) {
        normalized.push([4, 4, 4, 4]);
    }
    return normalized.map(measure => {
        const beats = Array.isArray(measure) ? measure.slice(0, 4) : [];
        while (beats.length < 4) beats.push(4);
        return beats.map(v => (v === 3 || v === 6) ? v : 4);
    });
}

function toDurationValue(val) {
    if (val === true) return '16n';
    if (val === false || val === undefined) return null;
    return val;
}

function legacyStepOffset(beatConfig, measure, beat, slot) {
    const subs = beatConfig[measure]?.[beat] === 3 ? 3 : 4;
    if (subs === 3) {
        if (slot > 2) return null;
        return [0, 4, 8][slot];
    }
    return [0, 3, 6, 9][slot] ?? null;
}

function expandLegacyStepArray(steps, numMeasures, beatConfig, fillTies = true) {
    if (!Array.isArray(steps) || steps.length !== numMeasures * 16) return null;

    const expanded = Array(numMeasures * STEPS_PER_MEASURE).fill(null);

    steps.forEach((rawVal, legacyIndex) => {
        const value = toDurationValue(rawVal);
        if (!value || value === '_tie') return;

        const measure = Math.floor(legacyIndex / 16);
        const local = legacyIndex % 16;
        const beat = Math.floor(local / 4);
        const slot = local % 4;
        const offset = legacyStepOffset(beatConfig, measure, beat, slot);
        if (offset === null) return;

        const start = measure * STEPS_PER_MEASURE + beat * 12 + offset;
        expanded[start] = value;

        if (fillTies) {
            const span = DURATION_CELLS[value] || DURATION_CELLS['16n'];
            for (let i = 1; i < span && start + i < expanded.length; i++) {
                expanded[start + i] = '_tie';
            }
        }
    });

    return expanded;
}

function convertLegacyDivider(divider, numMeasures, beatConfig) {
    if (typeof divider !== 'number') return null;
    const measure = Math.floor(divider / 16);
    const local = divider % 16;
    const beat = Math.floor(local / 4);
    const slot = local % 4;
    const offset = legacyStepOffset(beatConfig, measure, beat, slot);
    if (offset === null) return null;
    return measure * STEPS_PER_MEASURE + beat * 12 + offset;
}

function normalizeTrack(track, length) {
    const type = INST_TYPE[track.instrument];

    if (type === 'rhythm') {
        const rows = Array.isArray(track.rows) ? track.rows : DRUM_ROWS.map(r => ({ label: r.label, note: r.note, steps: [] }));
        track.rows = rows.map((row, idx) => ({
            label: row.label ?? DRUM_ROWS[idx]?.label ?? `Row ${idx + 1}`,
            note: row.note ?? DRUM_ROWS[idx]?.note ?? 'C1',
            steps: normalizeStepArray(row.steps, length) ?? expandLegacyStepArray(row.steps, appState.numMeasures, appState.beatConfig) ?? Array(length).fill(null),
        }));
        return track;
    }

    if (type === 'chord') {
        const isLegacyResolution = Array.isArray(track.chordMap) && track.chordMap.length === appState.numMeasures * 16;
        track.chordMap = normalizeStepArray(track.chordMap, length) ?? expandLegacyStepArray(track.chordMap, appState.numMeasures, appState.beatConfig, false) ?? Array(length).fill(null);
        track.soundSteps = normalizeStepArray(track.soundSteps, length) ?? expandLegacyStepArray(track.soundSteps, appState.numMeasures, appState.beatConfig) ?? Array(length).fill(null);
        track.selectedChordRoot = track.selectedChordRoot ?? 'C';
        track.selectedChordType = track.selectedChordType ?? 'M';
        track.selectedChordOctave = track.selectedChordOctave ?? 4;
        if (Array.isArray(track.dividers) && track.dividers.length > 0) {
            track.dividers = track.dividers
                .map(divider => isLegacyResolution
                    ? convertLegacyDivider(divider, appState.numMeasures, appState.beatConfig)
                    : divider)
                .filter(divider => divider !== null);
        } else {
            track.dividers = [0, STEPS_PER_MEASURE / 2];
        }
        track.selectedDivPos = isLegacyResolution
            ? convertLegacyDivider(track.selectedDivPos, appState.numMeasures, appState.beatConfig)
            : (track.selectedDivPos ?? null);
        track.selectedDrumRows = new Set(Array.isArray(track.selectedDrumRows) ? track.selectedDrumRows : []);
        return track;
    }

    const viewBase = track.viewBase ?? OCTAVE_DEFAULT_BASE[track.instrument] ?? 3;
    track.viewBase = viewBase;
    track.activeOctave = track.activeOctave ?? (viewBase + 1);
    const stepsMap = track.stepsMap && typeof track.stepsMap === 'object' ? track.stepsMap : {};
    for (let oct = 1; oct <= 7; oct++) {
        CHROMATIC.forEach(note => {
            const key = `${note}${oct}`;
            stepsMap[key] = normalizeStepArray(stepsMap[key], length)
                ?? expandLegacyStepArray(stepsMap[key], appState.numMeasures, appState.beatConfig)
                ?? Array(length).fill(null);
        });
    }
    track.stepsMap = stepsMap;
    return track;
}

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
            editorGridMode: appState.editorGridMode,
            selectedDuration: appState.selectedDuration,
            lastNormalDuration: appState.lastNormalDuration,
            lastTripletDuration: appState.lastTripletDuration,
            dottedMode: appState.dottedMode,
            beatConfig: appState.beatConfig,
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
// JSON → appState 復元（共通ロジック）
// -------------------------------------------------------
function restoreFromData(data) {
    if (!data || !Array.isArray(data.tracks)) return false;

    // マイグレーション
    if (data.version === 1 || !data.version) {
        migrateV1toV2(data);
    }

    appState.numMeasures    = data.numMeasures   ?? 4;
    appState.nextId         = data.nextId         ?? 0;
    appState.currentMeasure = data.currentMeasure ?? 0;
    appState.activeTrackId  = data.activeTrackId  ?? null;
    appState.playheadStep = null;
    appState.isPlaying = false;
    appState.playRangeStartMeasure = null;
    appState.playRangeEndMeasure = null;
    appState.editorGridMode = data.editorGridMode === 'triplet' ? 'triplet' : 'normal';
    appState.selectedDuration = VALID_DURATIONS.has(data.selectedDuration)
        ? data.selectedDuration
        : '16n';
    appState.lastNormalDuration = VALID_DURATIONS.has(data.lastNormalDuration) && !data.lastNormalDuration.endsWith('t')
        ? data.lastNormalDuration
        : '16n';
    appState.lastTripletDuration = VALID_DURATIONS.has(data.lastTripletDuration) && data.lastTripletDuration.endsWith('t')
        ? data.lastTripletDuration
        : '8t';
    if (appState.editorGridMode === 'triplet' && !appState.selectedDuration.endsWith('t')) {
        appState.selectedDuration = appState.lastTripletDuration;
    }
    if (appState.editorGridMode === 'normal' && appState.selectedDuration.endsWith('t')) {
        appState.selectedDuration = appState.lastNormalDuration;
    }
    appState.dottedMode = appState.editorGridMode === 'normal'
        && ['8n', '4n', '2n'].includes(appState.selectedDuration)
        && data.dottedMode === true;
    appState.beatConfig     = normalizeBeatConfig(appState.numMeasures, data.beatConfig);

    const length = totalSteps();
    appState.tracks = data.tracks.map(t => normalizeTrack({ ...t }, length));
    if (!appState.tracks.some(t => t.id === appState.activeTrackId)) {
        appState.activeTrackId = appState.tracks[0]?.id ?? null;
    }

    if (data.bpm) {
        document.getElementById('bpmInput').value = data.bpm;
    }

    return true;
}

// -------------------------------------------------------
// 復元
// -------------------------------------------------------
export function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;

        const data = JSON.parse(raw);
        return restoreFromData(data);
    } catch (e) {
        console.warn('loadState failed:', e);
        return false;
    }
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
