// instruments.js

// ==========================================================
// 1. ヘルパー関数
// ==========================================================

function buildUrlsFromFiles(files) {
    return Object.fromEntries(
        files.map(fileName => {
            const toneNote = fileName.replace('.mp3', '').replace(/s/g, '#');
            return [toneNote, fileName];
        })
    );
}

// ==========================================================
// 2. 設定データ
// ==========================================================
//
// sampleType の種類:
//   "range"     : files に列挙したファイルを読み込む
//   "manual"    : ドラム等、音名→ファイル名を手動マッピング
//   null        : 音源なし（chord はピアノを流用）
//
// ==========================================================

export const INSTRUMENT_LIST = [
    {
        id: "drums",
        label: "🥁 Drums",    instType: "rhythm",  octaveBase: null,
        sampleType: "manual",  folder: "sounds/drums/",
        mapping: { "C1": "kick.mp3", "D1": "snare.mp3", "F#1": "hihat.mp3", "G1": "tom1.mp3" },
        drumRows: [
            { label: 'Kick',  note: 'C1'  },
            { label: 'Snare', note: 'D1'  },
            { label: 'HiHat', note: 'F#1' },
            { label: 'Tom',   note: 'G1'  },
        ]
    },
    {
        id: "chord",
        label: "🎼 コード",   instType: "chord",   octaveBase: null,
        sampleType: null  // piano の sampler を流用
    },
    {
        id: "piano",
        label: "🎹 Piano",    instType: "melody",  octaveBase: 3,
        sampleType: "range",  folder: "sounds/piano/",
        files: [
            "A1.mp3", "A2.mp3", "A3.mp3", "A4.mp3", "A5.mp3", "A6.mp3", "A7.mp3",
            "As1.mp3", "As2.mp3", "As3.mp3", "As4.mp3", "As5.mp3", "As6.mp3", "As7.mp3",
            "B1.mp3", "B2.mp3", "B3.mp3", "B4.mp3", "B5.mp3", "B6.mp3", "B7.mp3",
            "C1.mp3", "C2.mp3", "C3.mp3", "C4.mp3", "C5.mp3", "C6.mp3", "C7.mp3", "C8.mp3",
            "Cs1.mp3", "Cs2.mp3", "Cs3.mp3", "Cs4.mp3", "Cs5.mp3", "Cs6.mp3", "Cs7.mp3",
            "D1.mp3", "D2.mp3", "D3.mp3", "D4.mp3", "D5.mp3", "D6.mp3", "D7.mp3",
            "Ds1.mp3", "Ds2.mp3", "Ds3.mp3", "Ds4.mp3", "Ds5.mp3", "Ds6.mp3", "Ds7.mp3",
            "E1.mp3", "E2.mp3", "E3.mp3", "E4.mp3", "E5.mp3", "E6.mp3", "E7.mp3",
            "F1.mp3", "F2.mp3", "F3.mp3", "F4.mp3", "F5.mp3", "F6.mp3", "F7.mp3",
            "Fs1.mp3", "Fs2.mp3", "Fs3.mp3", "Fs4.mp3", "Fs5.mp3", "Fs6.mp3", "Fs7.mp3",
            "G1.mp3", "G2.mp3", "G3.mp3", "G4.mp3", "G5.mp3", "G6.mp3", "G7.mp3",
            "Gs1.mp3", "Gs2.mp3", "Gs3.mp3", "Gs4.mp3", "Gs5.mp3", "Gs6.mp3", "Gs7.mp3"
        ]
    },
    {
        id: "bass",
        label: "🎸 Bass",     instType: "melody",  octaveBase: 1,
        sampleType: "range",  folder: "sounds/bass/",
        files: [
            "As1.mp3", "As2.mp3", "As3.mp3", "As4.mp3",
            "Cs1.mp3", "Cs2.mp3", "Cs3.mp3", "Cs4.mp3", "Cs5.mp3",
            "E1.mp3", "E2.mp3", "E3.mp3", "E4.mp3",
            "G1.mp3", "G2.mp3", "G3.mp3", "G4.mp3"
        ]
    },
    {
        id: "aco_guitar",
        label: "🎵 Acoustic Guitar", instType: "melody", octaveBase: 2,
        sampleType: "range",  folder: "sounds/aco_guitar/",
        files: [
            "A2.mp3", "A3.mp3", "A4.mp3", "As2.mp3", "As3.mp3", "As4.mp3",
            "B2.mp3", "B3.mp3", "B4.mp3",
            "C3.mp3", "C4.mp3", "C5.mp3", "Cs3.mp3", "Cs4.mp3", "Cs5.mp3",
            "D2.mp3", "D3.mp3", "D4.mp3", "D5.mp3", "Ds2.mp3", "Ds3.mp3", "Ds4.mp3",
            "E2.mp3", "E3.mp3", "E4.mp3",
            "F2.mp3", "F3.mp3", "F4.mp3", "Fs2.mp3", "Fs3.mp3", "Fs4.mp3",
            "G2.mp3", "G3.mp3", "G4.mp3", "Gs2.mp3", "Gs3.mp3", "Gs4.mp3"
        ]
    },
    {
        id: "ele_guitar",
        label: "⚡️ Electric Guitar", instType: "melody", octaveBase: 2,
        sampleType: "range",  folder: "sounds/ele_guitar/",
        files: [
            "A2.mp3", "A3.mp3", "A4.mp3", "A5.mp3",
            "C3.mp3", "C4.mp3", "C5.mp3", "C6.mp3", "Cs2.mp3",
            "Ds3.mp3", "Ds4.mp3", "Ds5.mp3",
            "E2.mp3",
            "Fs2.mp3", "Fs3.mp3", "Fs4.mp3", "Fs5.mp3"
        ]
    },
    {
        id: "violin",
        label: "🎻 Violin",   instType: "melody",  octaveBase: 3,
        sampleType: "range",  folder: "sounds/violin/",
        files: [
            "A3.mp3", "A4.mp3", "A5.mp3", "A6.mp3",
            "C4.mp3", "C5.mp3", "C6.mp3", "C7.mp3",
            "E4.mp3", "E5.mp3", "E6.mp3",
            "G3.mp3", "G4.mp3", "G5.mp3", "G6.mp3"
        ]
    },
    {
        id: "trumpet",
        label: "🎺 Trumpet",  instType: "melody",  octaveBase: 3,
        sampleType: "range",  folder: "sounds/trumpet/",
        files: [
            "A3.mp3", "A5.mp3", "As4.mp3", "C4.mp3", "C6.mp3",
            "D5.mp3", "Ds4.mp3",
            "F3.mp3", "F4.mp3", "F5.mp3",
            "G4.mp3"
        ]
    }
];

// ==========================================================
// 3. computed export
// ==========================================================

export const INST_LABEL = Object.fromEntries(INSTRUMENT_LIST.map(c => [c.id, c.label]));
export const INST_TYPE  = Object.fromEntries(INSTRUMENT_LIST.map(c => [c.id, c.instType]));
export const OCTAVE_DEFAULT_BASE = Object.fromEntries(
    INSTRUMENT_LIST.filter(c => c.octaveBase !== null).map(c => [c.id, c.octaveBase])
);

const drumsConfig = INSTRUMENT_LIST.find(c => c.id === 'drums');
export const DRUM_ROWS = drumsConfig ? drumsConfig.drumRows : [];
const INSTRUMENT_CONFIG_MAP = Object.fromEntries(INSTRUMENT_LIST.map((config) => [config.id, config]));
const ToneLib = globalThis.Tone;
const EQ_MIN_DB = -24;
const EQ_MAX_DB = 24;
const EQ_BANDS = ['low', 'mid', 'high'];
const playbackChains = new Map();
let masterBus = null;
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
const TRACK_BUS_CONFIG = {
    low: { frequency: 180, type: 'lowshelf' },
    mid: { frequency: 1400, type: 'peaking', q: 0.85 },
    high: { frequency: 4200, type: 'highshelf' },
    compressor: {
        threshold: -18,
        ratio: 2.5,
        attack: 0.02,
        release: 0.18,
        knee: 12,
    },
    limiter: {
        threshold: -1,
    },
};
const TRACK_MIX_PRESETS = {
    default: { trimDb: -1.5, highpassHz: 50 },
    drums: { trimDb: -0.5, highpassHz: 24 },
    chord: { trimDb: -2.5, highpassHz: 60 },
    piano: { trimDb: -1.5, highpassHz: 48 },
    bass: { trimDb: -3, highpassHz: 22 },
    aco_guitar: { trimDb: -1.5, highpassHz: 85 },
    ele_guitar: { trimDb: -1.5, highpassHz: 80 },
    violin: { trimDb: -2, highpassHz: 120 },
    trumpet: { trimDb: -2.5, highpassHz: 145 },
};
const TRACK_EQ_DEFAULTS = {
    rhythm: { low: 3, mid: -2, high: 2 },
    bass: { low: 4, mid: -2, high: -3 },
    chord: { low: -3, mid: 1, high: 1 },
    melody: { low: -2, mid: 2, high: 1 },
};
const MASTER_BUS_CONFIG = {
    highpass: { frequency: 22, type: 'highpass' },
    lowpass: { frequency: 14500, type: 'lowpass' },
    compressor: {
        threshold: -16,
        ratio: 1.8,
        attack: 0.025,
        release: 0.22,
        knee: 10,
    },
    limiter: {
        threshold: -0.8,
    },
    outputGainDb: -0.5,
};

function normalizeEqValue(value) {
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

function getCompressionSettings(amount) {
    const normalized = Math.max(0, Math.min(100, amount)) / 100;
    return {
        threshold: -10 - normalized * 20,
        ratio: 1 + normalized * 3.75,
        attack: 0.04 - normalized * 0.03,
        release: 0.1 + normalized * 0.2,
        knee: 6 + normalized * 15,
    };
}

function dbToLinearGain(value) {
    return Math.pow(10, value / 20);
}

function getTrackMixPreset(instrumentId) {
    return TRACK_MIX_PRESETS[instrumentId] || TRACK_MIX_PRESETS.default;
}

function disposeMasterBus() {
    if (!masterBus) return;
    masterBus.input?.dispose?.();
    masterBus.highpass?.dispose?.();
    masterBus.lowpass?.dispose?.();
    masterBus.compressor?.dispose?.();
    masterBus.limiter?.dispose?.();
    masterBus.outputGain?.dispose?.();
    masterBus = null;
}

function ensureMasterBus() {
    if (!ToneLib) return null;
    if (masterBus) return masterBus;

    const input = new ToneLib.Gain(1);
    const highpass = new ToneLib.Filter(MASTER_BUS_CONFIG.highpass.frequency, MASTER_BUS_CONFIG.highpass.type);
    const lowpass = new ToneLib.Filter(MASTER_BUS_CONFIG.lowpass.frequency, MASTER_BUS_CONFIG.lowpass.type);
    const compressor = new ToneLib.Compressor(
        MASTER_BUS_CONFIG.compressor.threshold,
        MASTER_BUS_CONFIG.compressor.ratio
    );
    compressor.attack.value = MASTER_BUS_CONFIG.compressor.attack;
    compressor.release.value = MASTER_BUS_CONFIG.compressor.release;
    compressor.knee.value = MASTER_BUS_CONFIG.compressor.knee;

    const limiter = new ToneLib.Limiter(MASTER_BUS_CONFIG.limiter.threshold);
    const outputGain = new ToneLib.Gain(dbToLinearGain(MASTER_BUS_CONFIG.outputGainDb));

    input.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(outputGain);
    outputGain.toDestination();

    masterBus = {
        input,
        highpass,
        lowpass,
        compressor,
        limiter,
        outputGain,
    };
    return masterBus;
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

function resolvePlaybackInstrumentId(instrumentId) {
    return instrumentId === 'chord' ? 'piano' : instrumentId;
}

function getInstrumentUrls(config) {
    if (config.sampleType === 'range') {
        return buildUrlsFromFiles(config.files || []);
    }
    if (config.sampleType === 'manual') {
        return config.mapping || {};
    }
    return {};
}

function applyTrackEq(chain, eq) {
    if (!chain?.lowFilter || !chain?.midFilter || !chain?.highFilter) return;
    chain.lowFilter.gain.value = normalizeEqValue(eq?.low);
    chain.midFilter.gain.value = normalizeEqValue(eq?.mid);
    chain.highFilter.gain.value = normalizeEqValue(eq?.high);
}

function applyTrackTone(chain, tone) {
    if (!chain?.inputGain || !chain?.lowFilter || !chain?.midFilter || !chain?.highFilter || !chain?.compressor) return;
    const normalizedTone = normalizeTrackTone(tone);
    const compression = getCompressionSettings(normalizedTone.compAmount);
    chain.inputGain.gain.value = dbToLinearGain(normalizedTone.gainDb);
    chain.lowFilter.frequency.value = normalizedTone.lowFreq;
    chain.midFilter.frequency.value = normalizedTone.midFreq;
    chain.midFilter.Q.value = normalizedTone.midQ;
    chain.highFilter.frequency.value = normalizedTone.highFreq;
    chain.compressor.threshold.value = compression.threshold;
    chain.compressor.ratio.value = compression.ratio;
    chain.compressor.attack.value = compression.attack;
    chain.compressor.release.value = compression.release;
    chain.compressor.knee.value = compression.knee;
}

function disposePlaybackChain(trackId) {
    const chain = playbackChains.get(trackId);
    if (!chain) return;
    chain.sampler?.dispose?.();
    chain.sourceTrim?.dispose?.();
    chain.preHighpass?.dispose?.();
    chain.inputGain?.dispose?.();
    chain.lowFilter?.dispose?.();
    chain.midFilter?.dispose?.();
    chain.highFilter?.dispose?.();
    chain.compressor?.dispose?.();
    chain.limiter?.dispose?.();
    playbackChains.delete(trackId);
    if (playbackChains.size === 0) {
        disposeMasterBus();
    }
}

function createPlaybackChain(track) {
    if (!ToneLib) {
        console.warn('[Warning] Tone.js の読み込み前のため、音源初期化をスキップします。');
        return null;
    }

    const master = ensureMasterBus();
    if (!master) return null;

    const playbackInstrumentId = resolvePlaybackInstrumentId(track.instrument);
    const config = INSTRUMENT_CONFIG_MAP[playbackInstrumentId];
    if (!config?.sampleType) return null;
    const mixPreset = getTrackMixPreset(track.instrument);

    const urls = getInstrumentUrls(config);
    if (Object.keys(urls).length === 0) {
        console.warn(`[Warning] ${playbackInstrumentId} の音源ファイルが見つかりませんでした。スキップします。`);
        return null;
    }

    const lowFilter = new ToneLib.Filter(TRACK_BUS_CONFIG.low.frequency, TRACK_BUS_CONFIG.low.type);
    const midFilter = new ToneLib.Filter(TRACK_BUS_CONFIG.mid.frequency, TRACK_BUS_CONFIG.mid.type);
    midFilter.Q.value = TRACK_BUS_CONFIG.mid.q;
    const highFilter = new ToneLib.Filter(TRACK_BUS_CONFIG.high.frequency, TRACK_BUS_CONFIG.high.type);

    const compressor = new ToneLib.Compressor(
        TRACK_BUS_CONFIG.compressor.threshold,
        TRACK_BUS_CONFIG.compressor.ratio
    );
    compressor.attack.value = TRACK_BUS_CONFIG.compressor.attack;
    compressor.release.value = TRACK_BUS_CONFIG.compressor.release;
    compressor.knee.value = TRACK_BUS_CONFIG.compressor.knee;

    const limiter = new ToneLib.Limiter(TRACK_BUS_CONFIG.limiter.threshold);

    const sourceTrim = new ToneLib.Gain(dbToLinearGain(mixPreset.trimDb));
    const preHighpass = new ToneLib.Filter(mixPreset.highpassHz, 'highpass');
    const inputGain = new ToneLib.Gain(dbToLinearGain(TRACK_TONE_DEFAULTS.gainDb));
    const sampler = new ToneLib.Sampler({
        urls,
        baseUrl: config.folder,
    });
    sampler.connect(sourceTrim);
    sourceTrim.connect(preHighpass);
    preHighpass.connect(inputGain);
    inputGain.connect(lowFilter);
    lowFilter.connect(midFilter);
    midFilter.connect(highFilter);
    highFilter.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(master.input);

    const chain = {
        trackId: track.id,
        playbackInstrumentId,
        sampler,
        sourceTrim,
        preHighpass,
        inputGain,
        lowFilter,
        midFilter,
        highFilter,
        compressor,
        limiter,
    };
    applyTrackTone(chain, track.tone);
    applyTrackEq(chain, track.eq);
    return chain;
}

export function syncTrackPlaybackChains(tracks = []) {
    const activeTrackIds = new Set();

    tracks.forEach((track) => {
        const playbackInstrumentId = resolvePlaybackInstrumentId(track.instrument);
        const config = INSTRUMENT_CONFIG_MAP[playbackInstrumentId];
        if (!config?.sampleType) return;

        activeTrackIds.add(track.id);
        let chain = playbackChains.get(track.id);
        if (!chain || chain.playbackInstrumentId !== playbackInstrumentId) {
            disposePlaybackChain(track.id);
            chain = createPlaybackChain(track);
            if (!chain) return;
            playbackChains.set(track.id, chain);
        }

        applyTrackTone(chain, track.tone);
        applyTrackEq(chain, track.eq);
    });

    Array.from(playbackChains.keys()).forEach((trackId) => {
        if (!activeTrackIds.has(trackId)) {
            disposePlaybackChain(trackId);
        }
    });
    if (activeTrackIds.size === 0) {
        disposeMasterBus();
    }
}

export function getTrackPlaybackInstrument(trackId, instrumentId) {
    const chain = playbackChains.get(trackId);
    if (!chain) return null;
    if (chain.playbackInstrumentId !== resolvePlaybackInstrumentId(instrumentId)) return null;
    return chain.sampler;
}

export function updateTrackPlaybackChain(track) {
    const chain = playbackChains.get(track.id);
    if (!chain) return;
    applyTrackTone(chain, track.tone);
    applyTrackEq(chain, track.eq);
}
