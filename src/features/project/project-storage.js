// save-load.js — 自動保存(localStorage) + JSONエクスポート/インポート

import { appState, callbacks, totalSteps, STEPS_PER_MEASURE, clearPreviewCopyState, clearRepeatState } from '../../core/state.js';
import { INST_TYPE, OCTAVE_DEFAULT_BASE, DRUM_ROWS, normalizeTrackEq, normalizeTrackTone } from '../tracks/instrument-map.js';
import {
    CHROMATIC,
    DURATION_CELLS,
    DEFAULT_SONG_SETTINGS,
    HARMONY_TYPE_MAP,
    SCALE_FAMILY_MAP,
    normalizeSongSettings,
} from '../../core/constants.js';

const STORAGE_KEY = 'compose_save';
const DATA_VERSION = 9;
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
    track.muted = track.muted === true;
    track.volume = typeof track.volume === 'number'
        ? Math.max(0, Math.min(1, track.volume))
        : 1;
    track.eq = normalizeTrackEq(track.eq, track.instrument);
    track.tone = normalizeTrackTone(track.tone);

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

function migrateLegacyScaleSelection(data) {
    const root = data.songRoot ?? data.songKeyRoot ?? DEFAULT_SONG_SETTINGS.root;
    const legacyScaleType = data.songScaleType;
    if (SCALE_FAMILY_MAP[data.songScaleFamily] && HARMONY_TYPE_MAP[data.songHarmony]) {
        return normalizeSongSettings(root, data.songHarmony, data.songScaleFamily);
    }
    switch (legacyScaleType) {
        case 'major':
            return normalizeSongSettings(root, 'major', 'diatonic');
        case 'harmonic_minor':
            return normalizeSongSettings(root, 'minor', 'harmonic');
        case 'melodic_minor':
            return normalizeSongSettings(root, 'minor', 'melodic');
        case 'blues':
            return normalizeSongSettings(root, 'minor', 'blues');
        case 'dorian':
            return normalizeSongSettings(root, 'minor', 'dorian');
        case 'mixolydian':
            return normalizeSongSettings(root, 'major', 'mixolydian');
        case 'minor_pentatonic':
            return normalizeSongSettings(root, 'minor', 'pentatonic');
        default:
            if (data.songKeyMode === 'minor') {
                return normalizeSongSettings(root, 'minor', 'harmonic');
            }
            return normalizeSongSettings(root, DEFAULT_SONG_SETTINGS.harmony, DEFAULT_SONG_SETTINGS.scaleFamily);
    }
}

function serializeRepeatStates() {
    return Object.fromEntries(
        Object.entries(appState.repeatStates || {}).map(([trackId, repeatState]) => [
            trackId,
            {
                sourceStartMeasure: repeatState.sourceStartMeasure,
                sourceEndMeasure: repeatState.sourceEndMeasure,
                targetEndMeasure: repeatState.targetEndMeasure,
                modeStep: repeatState.modeStep ?? null,
                restoreMeasures: repeatState.restoreMeasures || {},
                sourceSnapshot: repeatState.sourceSnapshot || null,
            },
        ])
    );
}

function normalizeRepeatStates(repeatStates, validTrackIds) {
    const trackIdSet = new Set(validTrackIds);
    if (!repeatStates || typeof repeatStates !== 'object') return {};

    return Object.fromEntries(
        Object.entries(repeatStates)
            .filter(([trackId]) => trackIdSet.has(Number(trackId)))
            .map(([trackId, repeatState]) => [
                trackId,
                {
                    sourceStartMeasure: typeof repeatState?.sourceStartMeasure === 'number'
                        ? repeatState.sourceStartMeasure
                        : null,
                    sourceEndMeasure: typeof repeatState?.sourceEndMeasure === 'number'
                        ? repeatState.sourceEndMeasure
                        : null,
                    targetEndMeasure: typeof repeatState?.targetEndMeasure === 'number'
                        ? repeatState.targetEndMeasure
                        : null,
                    modeStep: repeatState?.modeStep ?? null,
                    restoreMeasures: repeatState?.restoreMeasures && typeof repeatState.restoreMeasures === 'object'
                        ? repeatState.restoreMeasures
                        : {},
                    sourceSnapshot: repeatState?.sourceSnapshot ?? null,
                },
            ])
    );
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
            lastTouchedTrackId: appState.lastTouchedTrackId,
            drumHintDismissed: appState.drumHintDismissed,
            chordHintDismissed: appState.chordHintDismissed,
            melodicHintDismissed: appState.melodicHintDismissed,
            previewHintDismissed: appState.previewHintDismissed,
            songRoot: appState.songRoot,
            songHarmony: appState.songHarmony,
            songScaleFamily: appState.songScaleFamily,
            editorGridMode: appState.editorGridMode,
            selectedDuration: appState.selectedDuration,
            lastNormalDuration: appState.lastNormalDuration,
            lastTripletDuration: appState.lastTripletDuration,
            dottedMode: appState.dottedMode,
            beatConfig: appState.beatConfig,
            repeatStates: serializeRepeatStates(),
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
    appState.lastTouchedTrackId = data.lastTouchedTrackId ?? data.activeTrackId ?? null;
    appState.playheadStep = null;
    appState.isPlaying = false;
    appState.playRangeStartMeasure = null;
    appState.playRangeEndMeasure = null;
    appState.previewActionTrackId = null;
    appState.previewActionMenuOpen = false;
    appState.previewToneTrackId = null;
    clearPreviewCopyState();
    appState.clipboard = null;
    clearRepeatState();
    appState.chordDrumSheetOpen = false;
    appState.drumHintDismissed = data.drumHintDismissed === true;
    appState.chordHintDismissed = data.chordHintDismissed === true;
    appState.melodicHintDismissed = data.melodicHintDismissed === true;
    appState.previewHintDismissed = data.previewHintDismissed === true;
    const songSettings = migrateLegacyScaleSelection(data);
    appState.songRoot = songSettings.root;
    appState.songHarmony = songSettings.harmony;
    appState.songScaleFamily = songSettings.scaleFamily;
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
    appState.repeatStates = normalizeRepeatStates(
        data.repeatStates,
        appState.tracks.map((track) => track.id)
    );
    if (!appState.tracks.some(t => t.id === appState.activeTrackId)) {
        appState.activeTrackId = appState.tracks[0]?.id ?? null;
    }
    if (!appState.tracks.some(t => t.id === appState.lastTouchedTrackId)) {
        appState.lastTouchedTrackId = appState.activeTrackId;
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

function buildDefaultExportFileName() {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    return `compose_${yyyy}${mm}${dd}_${hh}${mi}.json`;
}

function normalizeExportFileName(requestedName, fallbackName) {
    const trimmed = requestedName.trim();
    if (!trimmed) return fallbackName;
    const sanitized = trimmed.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    if (!sanitized) return fallbackName;
    return sanitized.toLowerCase().endsWith('.json') ? sanitized : `${sanitized}.json`;
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
        appState.chordDrumSheetOpen = false;
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
        e.target.value = ''; // 同じファイルの再選択を可能に
        callbacks.closeSidebar();
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        if (confirm('現在のデータを破棄して新規作成しますか？')) {
            resetState();
        }
    });
}
