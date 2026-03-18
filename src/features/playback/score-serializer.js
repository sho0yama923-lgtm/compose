import { DURATION_CELLS } from '../../core/constants.js';
import { STEPS_PER_BEAT, STEPS_PER_MEASURE } from '../../core/state.js';
import { INSTRUMENT_CONFIG_MAP, getInstrumentUrls } from '../tracks/instruments/instrument-config.js';

function resolvePlaybackInstrumentId(track) {
    if (track.instrument === 'chord') {
        return track.playbackInstrument || 'piano';
    }
    return track.instrument;
}

function normalizeNotes(notes) {
    if (Array.isArray(notes)) {
        return notes.filter((note) => typeof note === 'string');
    }
    return typeof notes === 'string' ? [notes] : [];
}

function resolveDurationSteps(duration) {
    return DURATION_CELLS[duration] || DURATION_CELLS['16n'];
}

function resolveInstrumentAssetPath(instrumentId, fileName) {
    const config = INSTRUMENT_CONFIG_MAP[instrumentId];
    if (!config?.folder || !fileName) return null;
    const folder = config.folder.replace(/^\/+/, '');
    return `${folder}${fileName}`;
}

export function serializeScoreForNativePlayback(score, {
    bpm,
    tracks = [],
    startStep = 0,
    endStepExclusive = score.length,
    loop = true,
} = {}) {
    const normalizedStart = Math.max(0, Math.min(startStep, score.length));
    const normalizedEnd = Math.max(normalizedStart + 1, Math.min(endStepExclusive, score.length));
    const trackPayload = tracks.map((track) => ({
        trackId: track.id,
        instrument: track.instrument,
        playbackInstrument: track.instrument === 'chord' ? (track.playbackInstrument || 'piano') : null,
        volume: typeof track.volume === 'number' ? Math.max(0, Math.min(1, track.volume)) : 1,
        muted: !!track.muted,
    }));

    const events = [];
    for (let step = normalizedStart; step < normalizedEnd; step += 1) {
        const stepEvents = score[step];
        if (!Array.isArray(stepEvents)) continue;

        stepEvents.forEach((event) => {
            const notes = normalizeNotes(event.notes);
            if (notes.length === 0) return;
            events.push({
                step,
                trackId: event.trackId,
                instrument: event.instrument,
                playbackInstrument: event.instrument === 'chord'
                    ? (trackPayload.find((track) => track.trackId === event.trackId)?.playbackInstrument || 'piano')
                    : null,
                notes,
                durationSteps: resolveDurationSteps(event.duration),
                volume: typeof event.volume === 'number' ? Math.max(0, Math.min(1, event.volume)) : 1,
            });
        });
    }

    return {
        bpm,
        stepsPerBeat: STEPS_PER_BEAT,
        stepsPerMeasure: STEPS_PER_MEASURE,
        startStep: normalizedStart,
        endStepExclusive: normalizedEnd,
        loop,
        tracks: trackPayload,
        events,
    };
}

export function buildNativePlaybackManifest(tracks = []) {
    const seenInstrumentIds = new Set();
    const manifests = [];

    tracks.forEach((track) => {
        const instrumentId = resolvePlaybackInstrumentId(track);
        if (seenInstrumentIds.has(instrumentId)) return;
        seenInstrumentIds.add(instrumentId);

        const config = INSTRUMENT_CONFIG_MAP[instrumentId];
        const sampleMap = getInstrumentUrls(config);
        const sampleEntries = Object.entries(sampleMap)
            .map(([note, fileName]) => {
                const path = resolveInstrumentAssetPath(instrumentId, fileName);
                return path ? [note, path] : null;
            })
            .filter(Boolean)
            .sort((left, right) => left[0].localeCompare(right[0]));

        if (sampleEntries.length === 0) return;

        manifests.push({
            instrumentId,
            samples: Object.fromEntries(sampleEntries),
        });
    });

    return manifests.sort((left, right) => left.instrumentId.localeCompare(right.instrumentId));
}
