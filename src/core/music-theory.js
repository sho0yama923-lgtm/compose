import { CHORD_TYPES, CHROMATIC, normalizeSongSettings } from './constants.js';
import { INST_TYPE } from '../features/tracks/instrument-map.js';

const SCALE_INTERVALS = {
    diatonic: {
        major: [0, 2, 4, 5, 7, 9, 11],
        minor: [0, 2, 3, 5, 7, 8, 10],
    },
    harmonic: {
        minor: [0, 2, 3, 5, 7, 8, 11],
    },
    melodic: {
        minor: [0, 2, 3, 5, 7, 9, 11],
    },
    pentatonic: {
        major: [0, 2, 4, 7, 9],
        minor: [0, 3, 5, 7, 10],
    },
    blues: {
        major: [0, 2, 3, 4, 7, 9],
        minor: [0, 3, 5, 6, 7, 10],
    },
    dorian: {
        minor: [0, 2, 3, 5, 7, 9, 10],
    },
    mixolydian: {
        major: [0, 2, 4, 5, 7, 9, 10],
    },
};

export function getScalePitchClasses(root, harmony = 'major', scaleFamily = 'diatonic') {
    const normalized = normalizeSongSettings(root, harmony, scaleFamily);
    const rootIndex = CHROMATIC.indexOf(normalized.root);
    const familyIntervals = SCALE_INTERVALS[normalized.scaleFamily] ?? SCALE_INTERVALS.diatonic;
    const intervals = familyIntervals[normalized.harmony]
        ?? familyIntervals.major
        ?? familyIntervals.minor
        ?? SCALE_INTERVALS.diatonic.major;
    if (rootIndex < 0) return new Set();
    return new Set(intervals.map(interval => CHROMATIC[(rootIndex + interval) % 12]));
}

export function getChordPitchClasses(root, type) {
    const rootIndex = CHROMATIC.indexOf(root);
    const intervals = CHORD_TYPES[type];
    if (rootIndex < 0 || !intervals) return new Set();
    return new Set(intervals.map(interval => CHROMATIC[(rootIndex + interval) % 12]));
}

export function getPitchClass(noteName) {
    return String(noteName).replace(/\d+$/, '');
}

export function getPrimaryChordTrack(tracks) {
    return (tracks ?? []).find(track => INST_TYPE[track.instrument] === 'chord') ?? null;
}

export function getEffectiveChordAtStep(step, tracks) {
    const chordTrack = getPrimaryChordTrack(tracks);
    if (!chordTrack || !Array.isArray(chordTrack.chordMap)) return null;

    for (let i = Math.min(step, chordTrack.chordMap.length - 1); i >= 0; i--) {
        if (chordTrack.chordMap[i]) return chordTrack.chordMap[i];
    }
    return null;
}
