import { appState, STEPS_PER_BEAT, STEPS_PER_MEASURE } from './state.js';
import { clearNote, isStepHead, noteReachesIndex } from './duration-utils.js';

export const DEFAULT_BEAT_CONFIG = [4, 4, 4, 4];

const BEAT_COLUMN_WEIGHTS = {
    3: Array(3).fill('1fr'),
    4: Array(4).fill('0.75fr'),
    6: Array(6).fill('0.5fr'),
};

const STEP_OFFSETS = {
    3: [0, 4, 8],
    4: [0, 3, 6, 9],
    6: [0, 2, 4, 6, 8, 10],
};

export function normalizeBeatSubdivision(value) {
    return value === 3 || value === 6 ? value : 4;
}

export function getMeasureBeatConfig(measureIndex) {
    const beats = appState.beatConfig[measureIndex] || DEFAULT_BEAT_CONFIG;
    return DEFAULT_BEAT_CONFIG.map((fallback, beat) => normalizeBeatSubdivision(beats[beat] ?? fallback));
}

export function getMeasureGridColumns(measureIndex) {
    return getMeasureBeatConfig(measureIndex)
        .flatMap(subs => BEAT_COLUMN_WEIGHTS[subs] || BEAT_COLUMN_WEIGHTS[4])
        .join(' ');
}

export function getMeasureCells(measureIndex) {
    const config = getMeasureBeatConfig(measureIndex);
    const cells = [];

    config.forEach((subs, beat) => {
        const offsets = STEP_OFFSETS[subs] || STEP_OFFSETS[4];
        offsets.forEach((offset, slot) => {
            cells.push({
                beat,
                slot,
                subs,
                localStep: beat * STEPS_PER_BEAT + offset,
            });
        });
    });

    return cells;
}

export function getStepOffsetWithinBeat(subs, slot) {
    const offsets = STEP_OFFSETS[normalizeBeatSubdivision(subs)] || STEP_OFFSETS[4];
    return offsets[slot] ?? offsets[0];
}

export function cycleBeatSubdivision(current) {
    if (current === 3) return 6;
    if (current === 6) return 4;
    return 3;
}

export function ensureBeatConfig(measureIndex) {
    if (!appState.beatConfig[measureIndex]) {
        appState.beatConfig[measureIndex] = [...DEFAULT_BEAT_CONFIG];
    }
    appState.beatConfig[measureIndex] = appState.beatConfig[measureIndex].map(normalizeBeatSubdivision);
    return appState.beatConfig[measureIndex];
}

export function applyBeatSubdivisionChange(measureIndex, beatIndex, newSubdivision) {
    const beatConfig = ensureBeatConfig(measureIndex);
    beatConfig[beatIndex] = normalizeBeatSubdivision(newSubdivision);
    const beatStart = getMeasureStart(measureIndex) + beatIndex * STEPS_PER_BEAT;
    const allowedOffsets = Array.from(
        { length: beatConfig[beatIndex] },
        (_, slot) => getStepOffsetWithinBeat(beatConfig[beatIndex], slot)
    );
    sanitizeBeatStarts(beatStart, allowedOffsets);
}

export function sanitizeBeatStarts(beatStart, allowedOffsets) {
    const allowed = new Set(allowedOffsets.map(offset => beatStart + offset));
    const beatEnd = beatStart + STEPS_PER_BEAT;

    appState.tracks.forEach(track => {
        if (track.rows) {
            track.rows.forEach(row => clearDisallowedHeads(row.steps, beatStart, beatEnd, allowed));
        }
        if (track.stepsMap) {
            Object.values(track.stepsMap).forEach(steps => clearDisallowedHeads(steps, beatStart, beatEnd, allowed));
        }
        if (track.soundSteps) {
            clearDisallowedHeads(track.soundSteps, beatStart, beatEnd, allowed);
        }
        if (track.chordMap) {
            clearDisallowedChordMarkers(track.chordMap, beatStart, beatEnd, allowed);
        }
        if (track.dividers) {
            track.dividers = track.dividers.filter(div => div < beatStart || div >= beatEnd || allowed.has(div));
        }
    });
}

function clearDisallowedHeads(steps, beatStart, beatEnd, allowed) {
    for (let i = beatStart; i < beatEnd; i++) {
        if (!allowed.has(i) && isStepHead(steps[i])) {
            clearNote(steps, i);
        }
    }
}

function clearDisallowedChordMarkers(chordMap, beatStart, beatEnd, allowed) {
    for (let i = beatStart; i < beatEnd; i++) {
        if (!allowed.has(i)) {
            chordMap[i] = null;
        }
    }
}

export function getMeasureStart(measureIndex) {
    return measureIndex * STEPS_PER_MEASURE;
}

export function getVisibleSpanCount(cells, cellIndex, measureOffset, steps, startIndex, maxIndex) {
    if (!isStepHead(steps[startIndex])) return 1;

    let span = 1;
    for (let i = cellIndex + 1; i < cells.length; i++) {
        const absoluteIndex = measureOffset + cells[i].localStep;
        if (!noteReachesIndex(steps, startIndex, absoluteIndex)) break;
        span++;
    }

    return span;
}
