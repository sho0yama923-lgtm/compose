import { STEPS_PER_MEASURE } from '../../core/state.js';
import { getResolvedChordNotes } from '../../core/constants.js';
import { isStepHead } from '../../core/duration.js';
import { INST_TYPE } from '../tracks/instrument-map.js';

function clampTrackVolume(track) {
    return typeof track?.volume === 'number'
        ? Math.max(0, Math.min(1, track.volume))
        : 1;
}

function appendRhythmTrackEvents(score, track) {
    const trackVolume = clampTrackVolume(track);
    (track.rows || []).forEach((row) => {
        row.steps.forEach((value, stepIndex) => {
            if (!isStepHead(value)) return;
            score[stepIndex] = score[stepIndex] || [];
            score[stepIndex].push({
                trackId: track.id,
                instrument: row.sampleInstrumentId || 'drums_default',
                notes: row.note,
                duration: value,
                volume: trackVolume,
            });
        });
    });
}

function appendChordTrackEvents(score, track, totalStepCount) {
    const trackVolume = clampTrackVolume(track);
    let currentChord = null;
    for (let stepIndex = 0; stepIndex < totalStepCount; stepIndex += 1) {
        if (track.chordMap[stepIndex]) currentChord = track.chordMap[stepIndex];
        const duration = track.soundSteps[stepIndex];
        if (!isStepHead(duration) || !currentChord) continue;
        const notes = getResolvedChordNotes(currentChord);
        score[stepIndex] = score[stepIndex] || [];
        score[stepIndex].push({
            trackId: track.id,
            instrument: track.playbackInstrument || 'piano',
            notes: notes.length === 1 ? notes[0] : notes,
            duration,
            volume: trackVolume,
        });
    }
}

function appendMelodicTrackEvents(score, track, totalStepCount) {
    const trackVolume = clampTrackVolume(track);
    const stepNotes = Array.from({ length: totalStepCount }, () => []);
    const stepDurations = Array.from({ length: totalStepCount }, () => null);

    Object.entries(track.stepsMap || {}).forEach(([note, steps]) => {
        steps.forEach((value, stepIndex) => {
            if (!isStepHead(value)) return;
            stepNotes[stepIndex].push(note);
            if (!stepDurations[stepIndex]) stepDurations[stepIndex] = value;
        });
    });

    stepNotes.forEach((notes, stepIndex) => {
        if (notes.length === 0) return;
        score[stepIndex] = score[stepIndex] || [];
        score[stepIndex].push({
            trackId: track.id,
            instrument: track.instrument,
            notes: notes.length === 1 ? notes[0] : notes,
            duration: stepDurations[stepIndex] || '16n',
            volume: trackVolume,
        });
    });
}

export function buildPlaybackScore(tracks, totalStepCount) {
    const score = Array(totalStepCount).fill(null);

    (tracks || []).forEach((track) => {
        if (!track || track.muted) return;
        const instrumentType = INST_TYPE[track.instrument];
        if (instrumentType === 'rhythm') {
            appendRhythmTrackEvents(score, track);
            return;
        }
        if (instrumentType === 'chord') {
            appendChordTrackEvents(score, track, totalStepCount);
            return;
        }
        appendMelodicTrackEvents(score, track, totalStepCount);
    });

    return score;
}

export function resolvePlaybackWindow({ totalStepCount, playRange }) {
    if (!playRange) {
        return {
            startStep: 0,
            endStepExclusive: totalStepCount,
        };
    }

    return {
        startStep: playRange.startMeasure * STEPS_PER_MEASURE,
        endStepExclusive: (playRange.endMeasure + 1) * STEPS_PER_MEASURE,
    };
}
