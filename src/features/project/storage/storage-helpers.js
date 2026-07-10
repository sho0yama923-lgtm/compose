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
    CHORD_ROOTS,
    CHORD_TYPES,
    DURATION_CELLS,
    DEFAULT_SONG_SETTINGS,
    MAX_PROJECT_MEASURES,
    MAX_PROJECT_TRACKS,
    normalizeChordCustomNotes,
    normalizeSongSettings,
} from '../../../core/constants.js';
import { normalizeBpmValue, getCurrentBpm } from '../../../core/bpm.js';
import { normalizeUnitValue } from '../../../core/number-utils.js';

export const STORAGE_KEY = 'compose_save';
export const DATA_VERSION = 11;
export const VALID_DURATIONS = new Set(Object.keys(DURATION_CELLS));
export const MAX_PROJECT_FILE_BYTES = 5 * 1024 * 1024;
export { MAX_PROJECT_MEASURES, MAX_PROJECT_TRACKS } from '../../../core/constants.js';
const MAX_DRUM_ROWS = 64;
const MAX_REPEAT_STATES = MAX_PROJECT_TRACKS;
const VALID_INSTRUMENT_IDS = new Set(Object.keys(INST_TYPE));
const MIN_CHORD_OCTAVE = 1;
const MAX_CHORD_OCTAVE = 6;

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function isValidStepValue(value) {
    return value === null || value === '_tie' || VALID_DURATIONS.has(value);
}

function isValidStepArray(steps, length) {
    return Array.isArray(steps)
        && steps.length === length
        && steps.every(isValidStepValue);
}

function isValidChordEntry(entry) {
    return entry === null || (
        isPlainObject(entry)
        && CHORD_ROOTS.includes(entry.root)
        && Object.prototype.hasOwnProperty.call(CHORD_TYPES, entry.type)
        && Number.isInteger(entry.octave)
        && entry.octave >= MIN_CHORD_OCTAVE
        && entry.octave <= MAX_CHORD_OCTAVE
        && (entry.customNotes === undefined
            || entry.customNotes === null
            || normalizeChordCustomNotes(entry.customNotes) !== null)
    );
}

function isValidTrackShape(track, length) {
    if (!isPlainObject(track) || !VALID_INSTRUMENT_IDS.has(track.instrument)) return false;
    if (!Number.isSafeInteger(track.id) || track.id < 0) return false;

    const type = INST_TYPE[track.instrument];
    if (type === 'rhythm') {
        if (!Array.isArray(track.rows) || track.rows.length > MAX_DRUM_ROWS) return false;
        return track.rows.every((row) => (
            isPlainObject(row)
            && isValidStepArray(row.steps, length)
        ));
    }

    if (type === 'chord') {
        return isValidStepArray(track.soundSteps, length)
            && Array.isArray(track.chordMap)
            && track.chordMap.length === length
            && track.chordMap.every(isValidChordEntry);
    }

    if (!isPlainObject(track.stepsMap)) return false;
    const stepEntries = Object.entries(track.stepsMap);
    return stepEntries.length <= CHROMATIC.length * 7
        && stepEntries.every(([note, steps]) => (
            /^[A-G]#?[1-7]$/.test(note)
            && isValidStepArray(steps, length)
        ));
}

function isValidSaveDataShape(data) {
    if (!isPlainObject(data) || data.version !== DATA_VERSION) return false;
    if (data.nextId !== undefined && (!Number.isSafeInteger(data.nextId) || data.nextId < 0)) {
        return false;
    }
    if (!Number.isInteger(data.numMeasures)
        || data.numMeasures < 1
        || data.numMeasures > MAX_PROJECT_MEASURES) {
        return false;
    }
    if (!Array.isArray(data.tracks)
        || data.tracks.length === 0
        || data.tracks.length > MAX_PROJECT_TRACKS) {
        return false;
    }
    if (data.repeatStates !== undefined) {
        if (!isPlainObject(data.repeatStates)
            || Object.keys(data.repeatStates).length > MAX_REPEAT_STATES) {
            return false;
        }
    }

    const length = STEPS_PER_MEASURE * data.numMeasures;
    const trackIds = new Set();
    return data.tracks.every((track) => {
        if (!isValidTrackShape(track, length) || trackIds.has(track.id)) return false;
        trackIds.add(track.id);
        return true;
    });
}

function normalizeStepArray(steps, length) {
    if (Array.isArray(steps) && steps.length !== length) {
        return null;
    }
    const normalized = Array.isArray(steps) ? [...steps] : [];
    for (let i = 0; i < length; i++) {
        const value = normalized[i];
        if (value === true) normalized[i] = '16n';
        else if (value === false || value === undefined || !isValidStepValue(value)) normalized[i] = null;
    }
    if (normalized.length < length) {
        normalized.push(...Array(length - normalized.length).fill(null));
    } else if (normalized.length > length) {
        normalized.length = length;
    }
    return normalized;
}

function normalizeStepsOrEmpty(steps, length) {
    return normalizeStepArray(steps, length) ?? Array(length).fill(null);
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

function normalizeTrack(track, length) {
    const type = INST_TYPE[track.instrument];
    track.muted = track.muted === true;
    track.volume = normalizeUnitValue(track.volume);
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
            return createDrumRow(sampleInstrumentId, sampleId, {
                label: row.label ?? fallback?.label ?? sampleDefinition?.label ?? `Row ${idx + 1}`,
                steps: normalizeStepsOrEmpty(row.steps, length),
            });
        });
        return track;
    }

    if (type === 'chord') {
        track.chordMap = normalizeStepsOrEmpty(track.chordMap, length);
        track.chordMap = track.chordMap.map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            return {
                root: entry.root ?? 'C',
                type: entry.type ?? 'M',
                octave: typeof entry.octave === 'number' ? entry.octave : 3,
                customNotes: normalizeChordCustomNotes(entry.customNotes),
            };
        });
        track.soundSteps = normalizeStepsOrEmpty(track.soundSteps, length);
        track.playbackInstrument = INST_TYPE[track.playbackInstrument] === 'melody'
            ? track.playbackInstrument
            : 'piano';
        track.selectedChordRoot = track.selectedChordRoot ?? 'C';
        track.selectedChordType = track.selectedChordType ?? 'M';
        track.selectedChordOctave = track.selectedChordOctave ?? 3;
        if (Array.isArray(track.dividers) && track.dividers.length > 0) {
            track.dividers = track.dividers
                .filter((divider) => typeof divider === 'number');
        } else {
            track.dividers = [0, STEPS_PER_MEASURE / 2];
        }
        track.selectedDivPos = track.selectedDivPos ?? null;
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
            stepsMap[key] = normalizeStepsOrEmpty(stepsMap[key], length);
        });
    }
    track.stepsMap = stepsMap;
    return track;
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
        volume: normalizeUnitValue(track.volume),
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
    if (!isValidSaveDataShape(data)) return false;

    appState.numMeasures = data.numMeasures ?? 4;
    const nextTrackId = Math.max(0, ...data.tracks.map((track) => track.id + 1));
    appState.nextId = Math.max(nextTrackId, data.nextId ?? 0);
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
    const songSettings = normalizeSongSettings(
        data.songRoot ?? DEFAULT_SONG_SETTINGS.root,
        data.songHarmony ?? DEFAULT_SONG_SETTINGS.harmony,
        data.songScaleFamily ?? DEFAULT_SONG_SETTINGS.scaleFamily
    );
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
