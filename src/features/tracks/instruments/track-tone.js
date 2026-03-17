import { INST_LABEL } from './instrument-config.js';

const EQ_MIN_DB = -24;
const EQ_MAX_DB = 24;
const EQ_BANDS = ['low', 'mid', 'high'];

export const TRACK_TONE_DEFAULTS = {
    gainDb: 0,
    compAmount: 40,
    lowFreq: 180,
    midFreq: 1400,
    midQ: 0.85,
    highFreq: 4200,
};

export const TRACK_TONE_LIMITS = {
    gainDb: { min: -18, max: 18, step: 0.5 },
    compAmount: { min: 0, max: 100, step: 1 },
    lowFreq: { min: 80, max: 360, step: 10 },
    midFreq: { min: 450, max: 2400, step: 10 },
    midQ: { min: 0.4, max: 2.4, step: 0.05 },
    highFreq: { min: 2600, max: 9000, step: 50 },
};

const TRACK_EQ_DEFAULTS = {
    rhythm: { low: 3, mid: -2, high: 2 },
    bass: { low: 4, mid: -2, high: -3 },
    chord: { low: -3, mid: 1, high: 1 },
    melody: { low: -2, mid: 2, high: 1 },
};

export function getTrackDisplayLabel(track, options = {}) {
    if (!track) return '作曲ツール';
    const baseLabel = INST_LABEL[track.instrument] ?? track.instrument;
    if (!options.showChordPlaybackInstrument || track.instrument !== 'chord') {
        return baseLabel;
    }
    const playbackLabel = INST_LABEL[track.playbackInstrument || 'piano'] ?? track.playbackInstrument ?? 'piano';
    return `${baseLabel} / ${playbackLabel}`;
}

export function normalizeEqValue(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, Math.round(value)));
}

function resolveEqProfile(instrumentId) {
    if (instrumentId === 'drums') return TRACK_EQ_DEFAULTS.rhythm;
    if (instrumentId === 'bass') return TRACK_EQ_DEFAULTS.bass;
    if (instrumentId === 'chord') return TRACK_EQ_DEFAULTS.chord;
    return TRACK_EQ_DEFAULTS.melody;
}

function clampToneValue(key, value) {
    const limit = TRACK_TONE_LIMITS[key];
    if (!limit || typeof value !== 'number' || Number.isNaN(value)) {
        return TRACK_TONE_DEFAULTS[key];
    }
    if (key === 'midQ') {
        return Math.max(limit.min, Math.min(limit.max, Math.round(value * 100) / 100));
    }
    if (key === 'gainDb') {
        return Math.max(limit.min, Math.min(limit.max, Math.round(value * 2) / 2));
    }
    return Math.max(limit.min, Math.min(limit.max, Math.round(value)));
}

export function createDefaultTrackTone() {
    return { ...TRACK_TONE_DEFAULTS };
}

export function createDefaultTrackEq(instrumentId) {
    return { ...resolveEqProfile(instrumentId) };
}

export function normalizeTrackEq(eq, instrumentId) {
    const source = eq && typeof eq === 'object' ? eq : {};
    const fallback = createDefaultTrackEq(instrumentId);
    return Object.fromEntries(
        EQ_BANDS.map((band) => [
            band,
            typeof source[band] === 'number' && !Number.isNaN(source[band])
                ? normalizeEqValue(source[band])
                : fallback[band],
        ])
    );
}

export function normalizeTrackTone(tone) {
    const source = tone && typeof tone === 'object' ? tone : {};
    return {
        gainDb: clampToneValue('gainDb', source.gainDb),
        compAmount: clampToneValue('compAmount', source.compAmount),
        lowFreq: clampToneValue('lowFreq', source.lowFreq),
        midFreq: clampToneValue('midFreq', source.midFreq),
        midQ: clampToneValue('midQ', source.midQ),
        highFreq: clampToneValue('highFreq', source.highFreq),
    };
}
