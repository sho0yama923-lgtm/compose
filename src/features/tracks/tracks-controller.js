// track-manager.js — トラック管理（追加・削除・選択）+ 小節管理

import { appState, STEPS_PER_MEASURE, totalSteps, callbacks, clampPlayRangeMeasures } from '../../core/state.js';
import { INST_TYPE, OCTAVE_DEFAULT_BASE, DRUM_ROWS, INST_LABEL } from './instrument-map.js';
import { CHROMATIC } from '../../core/constants.js';
import { setTopbarTitle } from '../../ui/topbar.js';

// -------------------------------------------------------
// トラック選択
// -------------------------------------------------------
export function selectTrack(id) {
    appState.activeTrackId = id;
    appState.previewMode = false;
    callbacks.renderEditor();
    callbacks.renderSidebar();
    callbacks.closeSidebar();

    const track = appState.tracks.find(t => t.id === id);
    if (track) setTopbarTitle(INST_LABEL[track.instrument]);
}

// -------------------------------------------------------
// トラック削除
// -------------------------------------------------------
export function deleteTrack(id) {
    appState.tracks = appState.tracks.filter(t => t.id !== id);
    if (appState.activeTrackId === id) {
        appState.activeTrackId = appState.tracks.length > 0
            ? appState.tracks[appState.tracks.length - 1].id
            : null;
        const title = appState.activeTrackId
            ? INST_LABEL[appState.tracks.find(t => t.id === appState.activeTrackId).instrument]
            : '作曲ツール';
        setTopbarTitle(title);
    }
    callbacks.renderSidebar();
    callbacks.renderEditor();
}

// -------------------------------------------------------
// トラック追加
// -------------------------------------------------------
export function addTrack(instrument) {
    const id = appState.nextId++;
    let track;

    const ts = totalSteps();
    if (INST_TYPE[instrument] === 'rhythm') {
        track = {
            id, instrument,
            muted: false,
            volume: 1,
            rows: DRUM_ROWS.map(r => ({ label: r.label, note: r.note, steps: Array(ts).fill(null) })),
        };
    } else if (INST_TYPE[instrument] === 'chord') {
        track = {
            id, instrument,
            muted: false,
            volume: 1,
            chordMap:        Array(ts).fill(null),
            soundSteps:      Array(ts).fill(null),
            selectedChordRoot:   'C',
            selectedChordType:   'M',
            selectedChordOctave: 4,
            dividers:        [0, STEPS_PER_MEASURE / 2],
            selectedDivPos:  null,
            selectedDrumRows: new Set(),
        };
    } else {
        const stepsMap = {};
        for (let oct = 1; oct <= 7; oct++) {
            CHROMATIC.forEach(n => { stepsMap[`${n}${oct}`] = Array(ts).fill(null); });
        }
        const viewBase = OCTAVE_DEFAULT_BASE[instrument] ?? 3;
        track = {
            id, instrument,
            muted: false,
            volume: 1,
            viewBase,
            activeOctave: viewBase + 1,
            stepsMap,
        };
    }

    appState.tracks.push(track);
    selectTrack(id);
}

// -------------------------------------------------------
// 小節の追加・削除
// -------------------------------------------------------
export function addMeasure() {
    addMeasureInternal(true);
}

export function ensureMeasureCount(minMeasures) {
    while (appState.numMeasures < minMeasures) {
        addMeasureInternal(false);
    }
}

function addMeasureInternal(shouldRender) {
    appState.numMeasures++;
    // beatConfig に新しい小節を追加（デフォルト: 全拍4分割）
    if (appState.beatConfig.length < appState.numMeasures) {
        appState.beatConfig.push([4, 4, 4, 4]);
    }
    const newStart = (appState.numMeasures - 1) * STEPS_PER_MEASURE;
    appState.tracks.forEach(track => {
        if (INST_TYPE[track.instrument] === 'rhythm') {
            track.rows.forEach(r => r.steps.push(...Array(STEPS_PER_MEASURE).fill(null)));
        } else if (INST_TYPE[track.instrument] === 'chord') {
            track.chordMap.push(...Array(STEPS_PER_MEASURE).fill(null));
            track.soundSteps.push(...Array(STEPS_PER_MEASURE).fill(null));
            if (!track.dividers.includes(newStart)) {
                track.dividers.push(newStart);
                track.dividers.sort((a, b) => a - b);
            }
        } else {
            Object.values(track.stepsMap).forEach(steps =>
                steps.push(...Array(STEPS_PER_MEASURE).fill(null))
            );
        }
    });
    clampPlayRangeMeasures();
    if (shouldRender) callbacks.renderEditor();
}

export function removeMeasure() {
    if (appState.numMeasures <= 1) return;
    const removedMeasure = appState.currentMeasure;
    const removeStart = removedMeasure * STEPS_PER_MEASURE;
    appState.numMeasures--;
    if (appState.beatConfig.length > removedMeasure) {
        appState.beatConfig.splice(removedMeasure, 1);
    }
    if (appState.currentMeasure >= appState.numMeasures) {
        appState.currentMeasure = appState.numMeasures - 1;
    }
    shiftPlayRangeAfterMeasureRemoval(removedMeasure);
    appState.tracks.forEach(track => {
        if (INST_TYPE[track.instrument] === 'rhythm') {
            track.rows.forEach(r => r.steps.splice(removeStart, STEPS_PER_MEASURE));
        } else if (INST_TYPE[track.instrument] === 'chord') {
            track.chordMap.splice(removeStart, STEPS_PER_MEASURE);
            track.soundSteps.splice(removeStart, STEPS_PER_MEASURE);
            track.dividers = track.dividers
                .filter(d => d !== removeStart)
                .map(d => d > removeStart ? d - STEPS_PER_MEASURE : d);
            if (track.selectedDivPos !== null) {
                if (track.selectedDivPos === removeStart) track.selectedDivPos = null;
                else if (track.selectedDivPos > removeStart) track.selectedDivPos -= STEPS_PER_MEASURE;
            }
        } else {
            Object.values(track.stepsMap).forEach(steps =>
                steps.splice(removeStart, STEPS_PER_MEASURE)
            );
        }
    });
    clampPlayRangeMeasures();
    callbacks.renderEditor();
}

export function copyTrackMeasureRange(track, startMeasure, endMeasure) {
    const normalizedStart = Math.max(0, Math.min(startMeasure, endMeasure));
    const normalizedEnd = Math.max(normalizedStart, Math.max(startMeasure, endMeasure));
    const startStep = normalizedStart * STEPS_PER_MEASURE;
    const endStepExclusive = (normalizedEnd + 1) * STEPS_PER_MEASURE;
    const trackType = INST_TYPE[track.instrument];
    const measureLength = normalizedEnd - normalizedStart + 1;
    const metadata = {
        sourceTrackId: track.id,
        sourceStartMeasure: normalizedStart,
        sourceEndMeasure: normalizedEnd,
    };

    if (trackType === 'rhythm') {
        return {
            trackType,
            measureLength,
            ...metadata,
            payload: {
                rows: track.rows.map((row) => ({
                    label: row.label,
                    steps: row.steps.slice(startStep, endStepExclusive),
                })),
            },
        };
    }

    if (trackType === 'chord') {
        return {
            trackType,
            measureLength,
            ...metadata,
            payload: {
                chordMap: track.chordMap
                    .slice(startStep, endStepExclusive)
                    .map(cloneChordEntry),
                soundSteps: track.soundSteps.slice(startStep, endStepExclusive),
                dividers: (track.dividers || [])
                    .filter((divider) => divider >= startStep && divider < endStepExclusive)
                    .map((divider) => divider - startStep),
            },
        };
    }

    return {
        trackType,
        measureLength,
        ...metadata,
        payload: {
            stepsMap: Object.fromEntries(
                Object.entries(track.stepsMap).map(([note, steps]) => [
                    note,
                    steps.slice(startStep, endStepExclusive),
                ])
            ),
        },
    };
}

export function pasteTrackMeasureRange(track, startMeasure, clipboard, options = {}) {
    if (!clipboard) return false;
    const trackType = INST_TYPE[track.instrument];
    if (clipboard.trackType !== trackType) return false;

    const startStep = startMeasure * STEPS_PER_MEASURE;
    const sourceLength = clipboard.measureLength * STEPS_PER_MEASURE;
    const repeatUntilMeasure = typeof options.repeatUntilMeasure === 'number'
        ? Math.max(startMeasure, options.repeatUntilMeasure)
        : null;
    const targetLength = repeatUntilMeasure === null
        ? sourceLength
        : (repeatUntilMeasure - startMeasure + 1) * STEPS_PER_MEASURE;
    const requiredMeasures = Math.ceil((startStep + targetLength) / STEPS_PER_MEASURE);

    ensureMeasureCount(requiredMeasures);

    if (trackType === 'rhythm') {
        track.rows.forEach((row, rowIndex) => {
            const source = clipboard.payload.rows[rowIndex]?.steps || Array(sourceLength).fill(null);
            overwriteRepeatedSegment(row.steps, startStep, targetLength, source);
        });
        return true;
    }

    if (trackType === 'chord') {
        overwriteRepeatedSegment(
            track.chordMap,
            startStep,
            targetLength,
            clipboard.payload.chordMap,
            cloneChordEntry
        );
        overwriteRepeatedSegment(
            track.soundSteps,
            startStep,
            targetLength,
            clipboard.payload.soundSteps
        );
        track.dividers = (track.dividers || []).filter(
            (divider) => divider < startStep || divider >= startStep + targetLength
        );
        const dividerSet = new Set(track.dividers);
        for (let baseOffset = 0; baseOffset < targetLength; baseOffset += sourceLength) {
            clipboard.payload.dividers.forEach((dividerOffset) => {
                const targetDivider = startStep + baseOffset + dividerOffset;
                if (targetDivider < startStep + targetLength) {
                    dividerSet.add(targetDivider);
                }
            });
        }
        track.dividers = [...dividerSet].sort((a, b) => a - b);
        if (track.selectedDivPos !== null
            && track.selectedDivPos >= startStep
            && track.selectedDivPos < startStep + targetLength) {
            track.selectedDivPos = null;
        }
        return true;
    }

    Object.entries(track.stepsMap).forEach(([note, steps]) => {
        const source = clipboard.payload.stepsMap[note] || Array(sourceLength).fill(null);
        overwriteRepeatedSegment(steps, startStep, targetLength, source);
    });
    return true;
}

export function repeatTrackMeasureRange(track, sourceStartMeasure, sourceEndMeasure, repeatUntilMeasure) {
    const normalizedStart = Math.max(0, Math.min(sourceStartMeasure, sourceEndMeasure));
    const normalizedEnd = Math.max(normalizedStart, Math.max(sourceStartMeasure, sourceEndMeasure));
    const normalizedRepeatEnd = Math.max(normalizedEnd, repeatUntilMeasure);
    const clipboard = copyTrackMeasureRange(track, normalizedStart, normalizedEnd);
    return pasteTrackMeasureRange(track, normalizedStart, clipboard, {
        repeatUntilMeasure: normalizedRepeatEnd,
    });
}

export function syncTrackRepeats() {
    if (!appState.repeatStates) return false;
    let changed = false;

    Object.keys(appState.repeatStates).forEach((trackIdKey) => {
        const trackId = Number(trackIdKey);
        const track = appState.tracks.find((item) => item.id === trackId);
        const repeatState = appState.repeatStates[trackIdKey];

        if (!track) {
            delete appState.repeatStates[trackIdKey];
            return;
        }

        if (syncTrackRepeatState(track, repeatState)) {
            changed = true;
        }
    });

    return changed;
}

function syncTrackRepeatState(track, repeatState) {
    if (!repeatState
        || repeatState.sourceStartMeasure === null
        || repeatState.sourceEndMeasure === null) {
        return false;
    }

    const sourceStart = repeatState.sourceStartMeasure;
    const sourceEnd = repeatState.sourceEndMeasure;
    const targetEnd = repeatState.targetEndMeasure;
    const sourceSnapshot = copyTrackMeasureRange(track, sourceStart, sourceEnd);

    if (targetEnd === null || targetEnd <= sourceEnd) {
        repeatState.sourceSnapshot = sourceSnapshot;
        return false;
    }

    if (isSameClipboardSnapshot(sourceSnapshot, repeatState.sourceSnapshot)) {
        return false;
    }

    repeatTrackMeasureRange(track, sourceStart, sourceEnd, targetEnd);
    repeatState.sourceSnapshot = sourceSnapshot;
    return true;
}

function isSameClipboardSnapshot(a, b) {
    if (!a || !b) return false;
    return a.measureLength === b.measureLength
        && a.trackType === b.trackType
        && JSON.stringify(a.payload) === JSON.stringify(b.payload);
}

function overwriteRepeatedSegment(target, startStep, targetLength, source, transform = (value) => value) {
    const safeSource = Array.isArray(source) && source.length > 0
        ? source
        : [null];
    for (let i = 0; i < targetLength; i++) {
        const sourceValue = safeSource[i % safeSource.length];
        target[startStep + i] = transform(sourceValue);
    }
}

function cloneChordEntry(entry) {
    return entry ? { ...entry } : null;
}

function shiftPlayRangeAfterMeasureRemoval(removedMeasure) {
    if (appState.playRangeStartMeasure !== null) {
        if (appState.playRangeStartMeasure === removedMeasure) appState.playRangeStartMeasure = null;
        else if (appState.playRangeStartMeasure > removedMeasure) appState.playRangeStartMeasure--;
    }
    if (appState.playRangeEndMeasure !== null) {
        if (appState.playRangeEndMeasure === removedMeasure) appState.playRangeEndMeasure = null;
        else if (appState.playRangeEndMeasure > removedMeasure) appState.playRangeEndMeasure--;
    }
}
