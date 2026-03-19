import { appState, STEPS_PER_MEASURE } from '../../../core/state.js';
import { INST_TYPE } from '../instrument-map.js';
import { ensureMeasureCount } from './track-measures.js';

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
                    note: row.note,
                    sampleInstrumentId: row.sampleInstrumentId,
                    sampleId: row.sampleId,
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
    return entry
        ? {
            ...entry,
            customNotes: Array.isArray(entry.customNotes) ? [...entry.customNotes] : null,
        }
        : null;
}
