import { CHORD_TYPES, CHROMATIC } from './constants.js';
import { INST_TYPE } from '../features/tracks/instrument-map.js';

const SCALE_INTERVALS = {
    major: [0, 2, 4, 5, 7, 9, 11],
    harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
    melodic_minor: [0, 2, 3, 5, 7, 9, 11],
};

export function getScalePitchClasses(root, scaleType = 'major') {
    const rootIndex = CHROMATIC.indexOf(root);
    const intervals = SCALE_INTERVALS[scaleType] ?? SCALE_INTERVALS.major;
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
