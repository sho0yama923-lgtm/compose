import { appState, STEPS_PER_MEASURE, callbacks, clampPlayRangeMeasures } from '../../../core/state.js';
import { INST_TYPE } from '../instrument-map.js';

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
    if (appState.beatConfig.length < appState.numMeasures) {
        appState.beatConfig.push([4, 4, 4, 4]);
    }
    const newStart = (appState.numMeasures - 1) * STEPS_PER_MEASURE;
    appState.tracks.forEach((track) => {
        if (INST_TYPE[track.instrument] === 'rhythm') {
            track.rows.forEach((row) => row.steps.push(...Array(STEPS_PER_MEASURE).fill(null)));
        } else if (INST_TYPE[track.instrument] === 'chord') {
            track.chordMap.push(...Array(STEPS_PER_MEASURE).fill(null));
            track.soundSteps.push(...Array(STEPS_PER_MEASURE).fill(null));
            if (!track.dividers.includes(newStart)) {
                track.dividers.push(newStart);
                track.dividers.sort((a, b) => a - b);
            }
        } else {
            Object.values(track.stepsMap).forEach((steps) =>
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
    appState.tracks.forEach((track) => {
        if (INST_TYPE[track.instrument] === 'rhythm') {
            track.rows.forEach((row) => row.steps.splice(removeStart, STEPS_PER_MEASURE));
        } else if (INST_TYPE[track.instrument] === 'chord') {
            track.chordMap.splice(removeStart, STEPS_PER_MEASURE);
            track.soundSteps.splice(removeStart, STEPS_PER_MEASURE);
            track.dividers = track.dividers
                .filter((divider) => divider !== removeStart)
                .map((divider) => divider > removeStart ? divider - STEPS_PER_MEASURE : divider);
            if (track.selectedDivPos !== null) {
                if (track.selectedDivPos === removeStart) track.selectedDivPos = null;
                else if (track.selectedDivPos > removeStart) track.selectedDivPos -= STEPS_PER_MEASURE;
            }
        } else {
            Object.values(track.stepsMap).forEach((steps) =>
                steps.splice(removeStart, STEPS_PER_MEASURE)
            );
        }
    });
    clampPlayRangeMeasures();
    callbacks.renderEditor();
}

export function clearTrackMeasure(track, measure = appState.currentMeasure) {
    if (!track) return;

    const startStep = measure * STEPS_PER_MEASURE;
    const endStepExclusive = startStep + STEPS_PER_MEASURE;
    const trackType = INST_TYPE[track.instrument];

    if (trackType === 'rhythm') {
        track.rows.forEach((row) => {
            row.steps.fill(null, startStep, endStepExclusive);
        });
        callbacks.renderEditor();
        return;
    }

    if (trackType === 'chord') {
        track.chordMap.fill(null, startStep, endStepExclusive);
        track.soundSteps.fill(null, startStep, endStepExclusive);
        if (track.selectedDivPos !== null
            && track.selectedDivPos >= startStep
            && track.selectedDivPos < endStepExclusive) {
            track.selectedDivPos = null;
        }
        callbacks.renderEditor();
        return;
    }

    Object.values(track.stepsMap).forEach((steps) => {
        steps.fill(null, startStep, endStepExclusive);
    });
    callbacks.renderEditor();
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
