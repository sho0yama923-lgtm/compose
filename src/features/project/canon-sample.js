import { appState, STEPS_PER_BEAT, STEPS_PER_MEASURE } from '../../core/state.js';
import { placeNote } from '../../core/duration.js';

const CANON_INTRO_CHORDS = [
    { root: 'C', type: 'M', octave: 4 },
    { root: 'G', type: 'M', octave: 3 },
    { root: 'A', type: 'm', octave: 3 },
    { root: 'E', type: 'm', octave: 3 },
];

function fillDrums(track) {
    const rows = Object.fromEntries((track.rows || []).map((row) => [row.sampleId, row.steps]));
    if (!rows.kick || !rows.snare || !rows.hihat) return;
    for (let measure = 0; measure < Math.min(2, appState.numMeasures); measure += 1) {
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
    CANON_INTRO_CHORDS.forEach((chord, index) => {
        const start = index * (STEPS_PER_MEASURE / 2);
        const end = start + (STEPS_PER_MEASURE / 2);
        for (let step = start; step < end; step += 1) {
            track.chordMap[step] = { ...chord, customNotes: null };
        }
        for (let step = start; step < end; step += STEPS_PER_BEAT) {
            placeNote(track.soundSteps, step, '8n', track.soundSteps.length);
        }
    });
}

export function applyCanonSample() {
    const drumTrack = appState.tracks.find((track) => track.instrument === 'drums');
    const chordTrack = appState.tracks.find((track) => track.instrument === 'chord');

    if (drumTrack) fillDrums(drumTrack);
    if (chordTrack) fillChords(chordTrack);
}
