import { appState, STEPS_PER_BEAT, STEPS_PER_MEASURE } from '../../core/state.js';
import { placeNote } from '../../core/duration.js';

const CANON_CHORDS = [
    { root: 'C', type: 'M', octave: 4 },
    { root: 'G', type: 'M', octave: 3 },
    { root: 'A', type: 'm', octave: 3 },
    { root: 'E', type: 'm', octave: 3 },
    { root: 'F', type: 'M', octave: 3 },
    { root: 'C', type: 'M', octave: 4 },
    { root: 'F', type: 'M', octave: 3 },
    { root: 'G', type: 'M', octave: 3 },
];

const CANON_MELODY = [
    ['E4', '4n'],
    ['D4', '4n'],
    ['C4', '4n'],
    ['B3', '4n'],
    ['A3', '4n'],
    ['G3', '4n'],
    ['A3', '4n'],
    ['B3', '4n'],
    ['C4', '4n'],
    ['E4', '4n'],
    ['F4', '4n'],
    ['E4', '4n'],
    ['D4', '4n'],
    ['C4', '4n'],
    ['B3', '4n'],
    ['D4', '4n'],
];

function fillDrums(track) {
    const rows = Object.fromEntries((track.rows || []).map((row) => [row.sampleId, row.steps]));
    if (!rows.kick || !rows.snare || !rows.hihat) return;
    for (let measure = 0; measure < appState.numMeasures; measure += 1) {
        const measureStart = measure * STEPS_PER_MEASURE;
        [0, 2].forEach((beat) => {
            placeNote(rows.kick, measureStart + beat * STEPS_PER_BEAT, '8n', rows.kick.length);
        });
        [1, 3].forEach((beat) => {
            placeNote(rows.snare, measureStart + beat * STEPS_PER_BEAT, '8n', rows.snare.length);
        });
        for (let step = 0; step < STEPS_PER_MEASURE; step += STEPS_PER_BEAT / 2) {
            placeNote(rows.hihat, measureStart + step, '8n', rows.hihat.length);
        }
    }
}

function fillChords(track) {
    CANON_CHORDS.forEach((chord, index) => {
        const start = index * (STEPS_PER_MEASURE / 2);
        const end = start + (STEPS_PER_MEASURE / 2);
        for (let step = start; step < end; step += 1) {
            track.chordMap[step] = { ...chord, customNotes: null };
        }
        placeNote(track.soundSteps, start, '2n', track.soundSteps.length);
    });
}

function fillMelody(track) {
    CANON_MELODY.forEach(([note, duration], index) => {
        const steps = track.stepsMap[note];
        if (!steps) return;
        placeNote(steps, index * STEPS_PER_BEAT, duration, steps.length);
    });
}

export function applyCanonSample() {
    const drumTrack = appState.tracks.find((track) => track.instrument === 'drums');
    const chordTrack = appState.tracks.find((track) => track.instrument === 'chord');
    const melodyTrack = appState.tracks.find((track) => track.instrument === 'piano');

    if (drumTrack) fillDrums(drumTrack);
    if (chordTrack) fillChords(chordTrack);
    if (melodyTrack) fillMelody(melodyTrack);
}
