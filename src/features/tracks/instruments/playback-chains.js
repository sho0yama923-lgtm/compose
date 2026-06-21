import {
    INSTRUMENT_CONFIG_MAP,
    getInstrumentBaseUrl,
    getInstrumentBufferBaseUrl,
    getInstrumentUrls,
} from './instrument-config.js';
import { clampNumber } from '../../../core/number-utils.js';
import { TRACK_TONE_DEFAULTS, normalizeEqValue, normalizeTrackTone } from './track-tone.js';
import { Tone, waitForToneLoaded } from '../../playback/tone-runtime.js';

const playbackChains = new Map();
let masterBus = null;
const PREVIEW_PREPARE_TIMEOUT_MS = 2000;
const NOTE_RE = /^([A-G])(#?)(-?\d+)$/;
const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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
    limiter: { threshold: -1 },
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
    limiter: { threshold: -0.8 },
    outputGainDb: -0.5,
};

function getCompressionSettings(amount) {
    const normalized = clampNumber(amount, 0, 100) / 100;
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

function getPlaybackChainKey(trackId, playbackInstrumentId) {
    return `${trackId}:${playbackInstrumentId}`;
}

function normalizeNoteList(notes = []) {
    return Array.from(
        new Set(
            (Array.isArray(notes) ? notes : [notes])
                .flat()
                .filter((note) => typeof note === 'string' && note.trim())
                .map((note) => note.trim())
        )
    );
}

function noteToMidi(note) {
    const match = NOTE_RE.exec(note);
    if (!match) return null;
    const [, letter, sharp, octaveText] = match;
    const noteIndex = CHROMATIC_NOTES.indexOf(`${letter}${sharp}`);
    const octave = Number(octaveText);
    if (noteIndex < 0 || !Number.isFinite(octave)) return null;
    return (octave + 1) * 12 + noteIndex;
}

function getNearestAvailableNote(targetNote, availableNotes = []) {
    const targetMidi = noteToMidi(targetNote);
    if (targetMidi === null || availableNotes.length === 0) return null;
    return availableNotes.reduce((nearest, note) => {
        const nearestMidi = noteToMidi(nearest);
        const noteMidi = noteToMidi(note);
        if (noteMidi === null) return nearest;
        if (nearestMidi === null) return note;
        return Math.abs(noteMidi - targetMidi) < Math.abs(nearestMidi - targetMidi) ? note : nearest;
    }, availableNotes[0]);
}

function selectInstrumentUrls(config, requiredNotes = []) {
    const allUrls = getInstrumentUrls(config);
    const entries = Object.entries(allUrls);
    if (entries.length === 0) return {};

    if (config.sampleType === 'manual') {
        const notes = normalizeNoteList(requiredNotes);
        if (notes.length === 0) return allUrls;
        const selected = Object.fromEntries(
            notes
                .filter((note) => allUrls[note])
                .map((note) => [note, allUrls[note]])
        );
        return Object.keys(selected).length > 0 ? selected : allUrls;
    }

    const availableNotes = entries.map(([note]) => note);
    const notes = normalizeNoteList(requiredNotes);
    const selectedNotes = new Set();
    if (notes.length === 0) {
        selectedNotes.add(getNearestAvailableNote('C4', availableNotes) || availableNotes[0]);
    } else {
        notes.forEach((note) => {
            selectedNotes.add(allUrls[note] ? note : getNearestAvailableNote(note, availableNotes));
        });
    }

    return Object.fromEntries(
        Array.from(selectedNotes)
            .filter((note) => note && allUrls[note])
            .map((note) => [note, allUrls[note]])
    );
}

function buildSampleKey(urls) {
    return Object.entries(urls)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([note, fileName]) => `${note}:${fileName}`)
        .join('|');
}

function getRequiredNotesForChain(requiredNotesByChain, chainKey) {
    const notes = requiredNotesByChain?.get?.(chainKey) || requiredNotesByChain?.[chainKey] || [];
    return normalizeNoteList(Array.from(notes));
}

function getTrackPlaybackInstrumentIds(track) {
    if (track.instrument === 'chord') return [track.playbackInstrument || 'piano'];
    if (track.instrument !== 'drums') return [track.instrument];
    return Array.from(
        new Set(
            (track.rows || [])
                .map((row) => row.sampleInstrumentId || 'drums_default')
                .filter(Boolean)
        )
    );
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
    if (masterBus) return masterBus;

    const input = new Tone.Gain(1);
    const highpass = new Tone.Filter(MASTER_BUS_CONFIG.highpass.frequency, MASTER_BUS_CONFIG.highpass.type);
    const lowpass = new Tone.Filter(MASTER_BUS_CONFIG.lowpass.frequency, MASTER_BUS_CONFIG.lowpass.type);
    const compressor = new Tone.Compressor(
        MASTER_BUS_CONFIG.compressor.threshold,
        MASTER_BUS_CONFIG.compressor.ratio
    );
    compressor.attack.value = MASTER_BUS_CONFIG.compressor.attack;
    compressor.release.value = MASTER_BUS_CONFIG.compressor.release;
    compressor.knee.value = MASTER_BUS_CONFIG.compressor.knee;

    const limiter = new Tone.Limiter(MASTER_BUS_CONFIG.limiter.threshold);
    const outputGain = new Tone.Gain(dbToLinearGain(MASTER_BUS_CONFIG.outputGainDb));

    input.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(outputGain);
    outputGain.toDestination();

    masterBus = { input, highpass, lowpass, compressor, limiter, outputGain };
    return masterBus;
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

function disposePlaybackChain(chainKey) {
    const chain = playbackChains.get(chainKey);
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
    playbackChains.delete(chainKey);
    if (playbackChains.size === 0) disposeMasterBus();
}

function createPlaybackChain(track, playbackInstrumentId, requiredNotes = []) {
    const master = ensureMasterBus();
    if (!master) return null;

    const config = INSTRUMENT_CONFIG_MAP[playbackInstrumentId];
    if (!config?.sampleType) return null;
    const mixPreset = getTrackMixPreset(track.instrument);

    const selectedUrls = selectInstrumentUrls(config, requiredNotes);
    const urls = Object.fromEntries(
        Object.entries(selectedUrls).map(([note, fileName]) => [note, `${fileName}.bin`])
    );
    if (Object.keys(urls).length === 0) {
        console.warn(`[Warning] ${playbackInstrumentId} の音源ファイルが見つかりませんでした。スキップします。`);
        return null;
    }
    const baseUrl = getInstrumentBufferBaseUrl(config);
    const sampleEntries = Object.entries(urls);
    const firstSampleEntry = sampleEntries[0] || null;
    if (firstSampleEntry) {
        console.info(`[Audio] ${playbackInstrumentId} sample bufferUrl: ${baseUrl}${firstSampleEntry[1]}`);
        console.info(
            `[Audio] ${playbackInstrumentId} original asset path: ${getInstrumentBaseUrl(config)}${Object.values(selectedUrls)[0] || ''}`
        );
    }

    const lowFilter = new Tone.Filter(TRACK_BUS_CONFIG.low.frequency, TRACK_BUS_CONFIG.low.type);
    const midFilter = new Tone.Filter(TRACK_BUS_CONFIG.mid.frequency, TRACK_BUS_CONFIG.mid.type);
    midFilter.Q.value = TRACK_BUS_CONFIG.mid.q;
    const highFilter = new Tone.Filter(TRACK_BUS_CONFIG.high.frequency, TRACK_BUS_CONFIG.high.type);

    const compressor = new Tone.Compressor(
        TRACK_BUS_CONFIG.compressor.threshold,
        TRACK_BUS_CONFIG.compressor.ratio
    );
    compressor.attack.value = TRACK_BUS_CONFIG.compressor.attack;
    compressor.release.value = TRACK_BUS_CONFIG.compressor.release;
    compressor.knee.value = TRACK_BUS_CONFIG.compressor.knee;

    const limiter = new Tone.Limiter(TRACK_BUS_CONFIG.limiter.threshold);
    const sourceTrim = new Tone.Gain(dbToLinearGain(mixPreset.trimDb));
    const preHighpass = new Tone.Filter(mixPreset.highpassHz, 'highpass');
    const inputGain = new Tone.Gain(dbToLinearGain(TRACK_TONE_DEFAULTS.gainDb));
    const sampler = new Tone.Sampler({
        urls,
        baseUrl,
        release: 0.03,
        onload: () => {
            console.info(`[Audio] ${playbackInstrumentId} の音源ロードが完了しました。`);
        },
        onerror: (error) => {
            console.error(`[Audio] ${playbackInstrumentId} の音源ロードに失敗しました。`, error);
        },
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
        sampleKey: buildSampleKey(urls),
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

function ensurePlaybackChain(track, playbackInstrumentId, requiredNotes = []) {
    if (track?.id == null || !playbackInstrumentId) return null;

    const config = INSTRUMENT_CONFIG_MAP[playbackInstrumentId];
    if (!config?.sampleType) return null;
    const selectedUrls = selectInstrumentUrls(config, requiredNotes);
    const expectedSampleKey = buildSampleKey(
        Object.fromEntries(
            Object.entries(selectedUrls).map(([note, fileName]) => [note, `${fileName}.bin`])
        )
    );

    const chainKey = getPlaybackChainKey(track.id, playbackInstrumentId);
    let chain = playbackChains.get(chainKey);
    if (
        !chain
        || chain.playbackInstrumentId !== playbackInstrumentId
        || chain.sampleKey !== expectedSampleKey
    ) {
        disposePlaybackChain(chainKey);
        chain = createPlaybackChain(track, playbackInstrumentId, requiredNotes);
        if (!chain) return null;
        playbackChains.set(chainKey, chain);
    }

    applyTrackTone(chain, track.tone);
    applyTrackEq(chain, track.eq);
    return chain;
}

export function syncTrackPlaybackChains(tracks = [], { requiredNotesByChain = new Map() } = {}) {
    const activeChainKeys = new Set();

    tracks.forEach((track) => {
        getTrackPlaybackInstrumentIds(track).forEach((playbackInstrumentId) => {
            const chainKey = getPlaybackChainKey(track.id, playbackInstrumentId);
            activeChainKeys.add(chainKey);

            ensurePlaybackChain(
                track,
                playbackInstrumentId,
                getRequiredNotesForChain(requiredNotesByChain, chainKey)
            );
        });
    });

    Array.from(playbackChains.keys()).forEach((chainKey) => {
        if (!activeChainKeys.has(chainKey)) {
            disposePlaybackChain(chainKey);
        }
    });

    if (activeChainKeys.size === 0) disposeMasterBus();
}

export function resetPlaybackChains() {
    Array.from(playbackChains.keys()).forEach((chainKey) => {
        disposePlaybackChain(chainKey);
    });
    disposeMasterBus();
}

export function getTrackPlaybackInstrument(trackId, instrumentId) {
    const chain = playbackChains.get(getPlaybackChainKey(trackId, instrumentId));
    return chain?.sampler || null;
}

export async function prepareTrackPlaybackInstrument(track, playbackInstrumentId, requiredNotes = []) {
    if (track?.id == null || !playbackInstrumentId) return null;
    const chain = ensurePlaybackChain(track, playbackInstrumentId, requiredNotes);
    if (!chain?.sampler) return null;
    const loaded = await waitForToneLoaded(PREVIEW_PREPARE_TIMEOUT_MS);
    if (!loaded) {
        console.warn(`[Audio] ${playbackInstrumentId} の音源準備がタイムアウトしました。`);
    }
    return chain.sampler;
}

export function updateTrackPlaybackChain(track) {
    Array.from(playbackChains.entries()).forEach(([chainKey, chain]) => {
        if (!chainKey.startsWith(`${track.id}:`)) return;
        applyTrackTone(chain, track.tone);
        applyTrackEq(chain, track.eq);
    });
}
