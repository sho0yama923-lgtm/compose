import { appState, totalSteps, STEPS_PER_MEASURE } from '../../../core/state.js';
import {
    INST_TYPE,
    OCTAVE_DEFAULT_BASE,
    DRUM_ROWS,
    createDrumRow,
    getDrumSampleDefinition,
    getDrumSampleIdFromNote,
    normalizeTrackEq,
    normalizeTrackTone,
} from '../../tracks/instrument-map.js';
import {
    CHROMATIC,
    DURATION_CELLS,
    DEFAULT_SONG_SETTINGS,
    HARMONY_TYPE_MAP,
    SCALE_FAMILY_MAP,
    normalizeChordCustomNotes,
    normalizeSongSettings,
} from '../../../core/constants.js';
import { normalizeBpmValue, getCurrentBpm } from '../../../core/bpm.js';

export const STORAGE_KEY = 'compose_save';
export const DATA_VERSION = 10;
export const VALID_DURATIONS = new Set(Object.keys(DURATION_CELLS));

function migrateV1toV2(data) {
    data.tracks.forEach((track) => {
        if (track.rows) {
            track.rows.forEach((row) => {
                row.steps = row.steps.map((value) => value === true ? '16n' : (value === false ? null : value));
            });
        }
        if (track.stepsMap) {
            Object.keys(track.stepsMap).forEach((key) => {
                track.stepsMap[key] = track.stepsMap[key].map((value) => value === true ? '16n' : (value === false ? null : value));
            });
        }
        if (track.soundSteps) {
            track.soundSteps = track.soundSteps.map((value) => value === true ? '16n' : (value === false ? null : value));
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
        const value = normalized[i];
        if (value === true) normalized[i] = '16n';
        else if (value === false || value === undefined) normalized[i] = null;
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
    return normalized.map((measure) => {
        const beats = Array.isArray(measure) ? measure.slice(0, 4) : [];
        while (beats.length < 4) beats.push(4);
        return beats.map((value) => (value === 3 || value === 6) ? value : 4);
    });
}

function toDurationValue(value) {
    if (value === true) return '16n';
    if (value === false || value === undefined) return null;
    return value;
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

    steps.forEach((rawValue, legacyIndex) => {
        const value = toDurationValue(rawValue);
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
        const rows = Array.isArray(track.rows)
            ? track.rows
            : DRUM_ROWS.map((row) => createDrumRow(row.sampleInstrumentId, row.sampleId));
        track.rows = rows.map((row, idx) => {
            const fallback = DRUM_ROWS[idx] || null;
            const note = row.note ?? fallback?.note ?? 'C1';
            const sampleId = row.sampleId || getDrumSampleIdFromNote(note) || fallback?.sampleId || 'kick';
            const sampleDefinition = getDrumSampleDefinition(sampleId);
            const sampleInstrumentId = row.sampleInstrumentId || 'drums_default';
            const normalizedSteps = normalizeStepArray(row.steps, length)
                ?? expandLegacyStepArray(row.steps, appState.numMeasures, appState.beatConfig)
                ?? Array(length).fill(null);
            return createDrumRow(sampleInstrumentId, sampleId, {
                label: row.label ?? fallback?.label ?? sampleDefinition?.label ?? `Row ${idx + 1}`,
                steps: normalizedSteps,
            });
        });
        return track;
    }

    if (type === 'chord') {
        const isLegacyResolution = Array.isArray(track.chordMap) && track.chordMap.length === appState.numMeasures * 16;
        track.chordMap = normalizeStepArray(track.chordMap, length) ?? expandLegacyStepArray(track.chordMap, appState.numMeasures, appState.beatConfig, false) ?? Array(length).fill(null);
        track.chordMap = track.chordMap.map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            return {
                root: entry.root ?? 'C',
                type: entry.type ?? 'M',
                octave: typeof entry.octave === 'number' ? entry.octave : 4,
                customNotes: normalizeChordCustomNotes(entry.customNotes),
            };
        });
        track.soundSteps = normalizeStepArray(track.soundSteps, length) ?? expandLegacyStepArray(track.soundSteps, appState.numMeasures, appState.beatConfig) ?? Array(length).fill(null);
        track.playbackInstrument = INST_TYPE[track.playbackInstrument] === 'melody'
            ? track.playbackInstrument
            : 'piano';
        track.selectedChordRoot = track.selectedChordRoot ?? 'C';
        track.selectedChordType = track.selectedChordType ?? 'M';
        track.selectedChordOctave = track.selectedChordOctave ?? 4;
        if (Array.isArray(track.dividers) && track.dividers.length > 0) {
            track.dividers = track.dividers
                .map((divider) => isLegacyResolution
                    ? convertLegacyDivider(divider, appState.numMeasures, appState.beatConfig)
                    : divider)
                .filter((divider) => divider !== null);
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
        CHROMATIC.forEach((note) => {
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

function serializeTrackForSave(track) {
    const base = {
        id: track.id,
        instrument: track.instrument,
        muted: track.muted === true,
        volume: typeof track.volume === 'number'
            ? Math.max(0, Math.min(1, track.volume))
            : 1,
        eq: normalizeTrackEq(track.eq, track.instrument),
        tone: normalizeTrackTone(track.tone),
    };

    const type = INST_TYPE[track.instrument];
    if (type === 'rhythm') {
        return {
            ...base,
            rows: Array.isArray(track.rows)
                ? track.rows.map((row) => ({
                    label: row.label,
                    note: row.note,
                    steps: Array.isArray(row.steps) ? [...row.steps] : [],
                    sampleInstrumentId: row.sampleInstrumentId || 'drums_default',
                    sampleId: row.sampleId || getDrumSampleIdFromNote(row.note) || 'kick',
                }))
                : [],
        };
    }

    if (type === 'chord') {
        return {
            ...base,
            playbackInstrument: track.playbackInstrument || 'piano',
            chordMap: Array.isArray(track.chordMap) ? [...track.chordMap] : [],
            soundSteps: Array.isArray(track.soundSteps) ? [...track.soundSteps] : [],
            dividers: Array.isArray(track.dividers) ? [...track.dividers] : [0, STEPS_PER_MEASURE / 2],
        };
    }

    return {
        ...base,
        stepsMap: track.stepsMap && typeof track.stepsMap === 'object'
            ? Object.fromEntries(
                Object.entries(track.stepsMap).map(([note, steps]) => [
                    note,
                    Array.isArray(steps) ? [...steps] : [],
                ])
            )
            : {},
    };
}

export function createSaveData() {
    return {
        version: DATA_VERSION,
        bpm: getCurrentBpm(),
        numMeasures: appState.numMeasures,
        nextId: appState.nextId,
        drumHintDismissed: appState.drumHintDismissed,
        chordHintDismissed: appState.chordHintDismissed,
        melodicHintDismissed: appState.melodicHintDismissed,
        previewHintDismissed: appState.previewHintDismissed,
        songRoot: appState.songRoot,
        songHarmony: appState.songHarmony,
        songScaleFamily: appState.songScaleFamily,
        editorGridMode: appState.editorGridMode,
        beatConfig: appState.beatConfig,
        repeatStates: serializeRepeatStates(),
        tracks: appState.tracks.map((track) => serializeTrackForSave(track)),
    };
}

export function restoreFromData(data, options = {}) {
    if (!data || !Array.isArray(data.tracks)) return false;

    if (data.version === 1 || !data.version) {
        migrateV1toV2(data);
    }

    appState.numMeasures = data.numMeasures ?? 4;
    appState.nextId = data.nextId ?? 0;
    appState.currentMeasure = 0;
    appState.activeTrackId = null;
    appState.lastTouchedTrackId = null;
    appState.playheadStep = null;
    appState.isPlaying = false;
    appState.playRangeStartMeasure = null;
    appState.playRangeEndMeasure = null;
    appState.previewMode = true;
    appState.previewScrollTop = 0;
    appState.previewActionTrackId = null;
    appState.previewActionMenuOpen = false;
    appState.previewToneTrackId = null;
    appState.chordDetailTrackId = null;
    appState.chordDetailStep = null;
    appState.drumAddTrackId = null;
    appState.drumAddOpenGroups = {};
    appState.pendingDeleteNoteId = null;
    appState.noteDrag = null;
    appState.suppressNextNoteClick = false;
    options.clearPreviewCopyState?.();
    appState.clipboard = null;
    options.clearRepeatState?.();
    appState.chordDrumSheetOpen = false;
    appState.drumHintDismissed = data.drumHintDismissed === true;
    appState.chordHintDismissed = data.chordHintDismissed === true;
    appState.melodicHintDismissed = data.melodicHintDismissed === true;
    appState.previewHintDismissed = data.previewHintDismissed === true;
    const songSettings = migrateLegacyScaleSelection(data);
    appState.songRoot = songSettings.root;
    appState.songHarmony = songSettings.harmony;
    appState.songScaleFamily = songSettings.scaleFamily;
    appState.editorGridMode = 'normal';
    appState.selectedDuration = '16n';
    appState.lastNormalDuration = '16n';
    appState.lastTripletDuration = '8t';
    appState.dottedMode = false;
    appState.beatConfig = normalizeBeatConfig(appState.numMeasures, data.beatConfig);

    const length = totalSteps();
    appState.tracks = data.tracks.map((track) => normalizeTrack({ ...track }, length));
    appState.repeatStates = normalizeRepeatStates(
        data.repeatStates,
        appState.tracks.map((track) => track.id)
    );
    appState.activeTrackId = appState.tracks[0]?.id ?? null;
    appState.lastTouchedTrackId = appState.activeTrackId;

    if (data.bpm !== undefined && data.bpm !== null) {
        document.getElementById('bpmInput').value = String(normalizeBpmValue(data.bpm));
    }

    return true;
}

export function buildDefaultExportFileName() {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    return `compose_${yyyy}${mm}${dd}_${hh}${mi}.json`;
}

export function normalizeExportFileName(requestedName, fallbackName) {
    const trimmed = requestedName.trim();
    if (!trimmed) return fallbackName;
    const sanitized = trimmed.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    if (!sanitized) return fallbackName;
    return sanitized.toLowerCase().endsWith('.json') ? sanitized : `${sanitized}.json`;
}
