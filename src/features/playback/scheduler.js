// Web Audio での試聴と再生スケジューリング。
import { appState, STEPS_PER_BEAT, STEPS_PER_MEASURE } from '../../core/state.js';
import { normalizeUnitValue } from '../../core/number-utils.js';
import { getTrackPlaybackInstrument, syncTrackPlaybackChains } from '../tracks/instrument-map.js';
import { getDrumSampleDefinition } from '../tracks/instruments/instrument-config.js';
import { prepareTrackPlaybackInstrument, resetPlaybackChains } from '../tracks/instruments/playback-chains.js';
import {
    Tone,
    ensureToneAudioReady,
    ensureToneAudioReadyWithTimeout,
    markToneAudioContextResetNeeded,
    resetToneAudioContextIfNeeded,
    waitForToneLoaded,
} from './tone-runtime.js';

// score はステップ数ぶんの配列。各要素は null か、同時に鳴るイベント配列。
// イベント例: { trackId, instrument, notes, duration, volume }

let _part = null;
let webPlaybackRecoveryNeeded = false;
const DRUM_PREVIEW_DURATION_SECONDS = 0.35;
const PREVIEW_SAMPLER_READY_TIMEOUT_MS = 2000;
const PREVIEW_SAMPLER_POLL_MS = 50;
const PLAYBACK_WARMUP_TIMEOUT_MS = 2500;
const WEB_AUDIO_CONTEXT_WARMUP_TIMEOUT_MS = 1500;

function getToneTransport() {
    return Tone.getTransport?.() || Tone.Transport;
}

function getToneDraw() {
    return Tone.getDraw?.() || Tone.Draw;
}

async function waitForSamplerReady(sampler, timeoutMs = PREVIEW_SAMPLER_READY_TIMEOUT_MS) {
    if (!sampler) return false;
    if (sampler.loaded) return true;

    if (typeof Tone?.loaded === 'function') {
        try {
            await Promise.race([
                Tone.loaded(),
                new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
            ]);
        } catch {
            // Tone.loaded() が失敗しても、sampler.loaded の個別判定へ進む。
        }
        if (sampler.loaded) return true;
    }

    const deadline = Date.now() + Math.max(0, timeoutMs);
    while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, PREVIEW_SAMPLER_POLL_MS));
        if (sampler.loaded) return true;
    }
    return !!sampler.loaded;
}

export async function warmupPlaybackInstrument(track, playbackInstrumentId) {
    if (!track?.id || !playbackInstrumentId) return false;
    try {
        resetPlaybackChainsIfNeeded();
        const audioReady = await ensureToneAudioReadyWithTimeout(WEB_AUDIO_CONTEXT_WARMUP_TIMEOUT_MS);
        if (!audioReady) {
            console.warn('[Audio] 試聴用Web Audio準備がタイムアウトしました。');
            return false;
        }
        const sampler = await prepareTrackPlaybackInstrument(track, playbackInstrumentId);
        return await waitForSamplerReady(sampler, PREVIEW_SAMPLER_READY_TIMEOUT_MS);
    } catch (error) {
        console.warn('[Audio] 試聴用音源の先読みをスキップしました。', error);
        return false;
    }
}

export async function warmupPlaybackTracks(tracks = []) {
    try {
        resetPlaybackChainsIfNeeded();
        const audioReady = await ensureToneAudioReadyWithTimeout(WEB_AUDIO_CONTEXT_WARMUP_TIMEOUT_MS);
        if (!audioReady) {
            console.warn('[Audio] 再生用Web Audio準備がタイムアウトしました。');
            return false;
        }
        syncTrackPlaybackChains(tracks);
        const loaded = await waitForToneLoaded(PLAYBACK_WARMUP_TIMEOUT_MS);
        if (!loaded) {
            console.warn('[Audio] 再生用音源の先読みがタイムアウトしました。再生時に再確認します。');
        }
        return true;
    } catch (error) {
        console.warn('[Audio] 再生用音源の先読みをスキップしました。', error);
        return false;
    }
}

export function markWebPlaybackRecoveryNeeded() {
    webPlaybackRecoveryNeeded = true;
    markToneAudioContextResetNeeded();
}

function resetPlaybackChainsIfNeeded() {
    if (!webPlaybackRecoveryNeeded) return;
    stop();
    resetPlaybackChains();
    resetToneAudioContextIfNeeded();
    webPlaybackRecoveryNeeded = false;
}

export async function prepareWebPlaybackForUserGesture(timeoutMs = WEB_AUDIO_CONTEXT_WARMUP_TIMEOUT_MS) {
    resetPlaybackChainsIfNeeded();
    return ensureToneAudioReadyWithTimeout(timeoutMs);
}

/**
 * Web Audio でスコアを再生する。
 * @param {Array} score - ステップ単位のスコア配列
 * @param {Object} options
 *   @param {number}  options.bpm  - テンポ（デフォルト: 120）
 *   @param {boolean} options.loop - ループ再生（デフォルト: true）
 *   @param {Function} options.onStep - 再生位置コールバック
 *   @param {Array}   options.tracks - 現在のトラック一覧
 *   @param {number}  options.startStep - 再生開始ステップ
 *   @param {number}  options.endStepExclusive - 再生終了ステップ（exclusive）
 */
export async function play(score, {
    bpm = 120,
    loop = true,
    onStep,
    tracks = [],
    startStep = 0,
    endStepExclusive = score.length,
} = {}) {
    resetPlaybackChainsIfNeeded();
    try {
        await ensureToneAudioReady();
    } catch (error) {
        console.error('[Audio] Web Audioを開始できませんでした。', error);
        alert('ブラウザの音声を開始できませんでした。ページを再読み込みして、もう一度再生してください。');
        return false;
    }

    // 多重再生を避けるため、前回の Transport / Part を止めてから組み直す。
    stop();

    const transport = getToneTransport();
    transport.bpm.value = bpm;
    syncTrackPlaybackChains(tracks);
    if (typeof Tone.loaded === 'function') {
        try {
            await Tone.loaded();
            console.info('[Audio] 再生用音源のロードが完了しました。');
        } catch (error) {
            console.error('[Audio] 音源の読み込みに失敗しました。', error);
            alert('音源の読み込みに失敗したため、再生できませんでした。アプリを再起動してもう一度お試しください。');
            return false;
        }
    }

    const beatDur = Tone.Time('4n').toSeconds();
    const events = [];
    const normalizedStart = Math.max(0, Math.min(startStep, score.length));
    const normalizedEnd = Math.max(normalizedStart + 1, Math.min(endStepExclusive, score.length));
    const missingSamplerWarnings = new Set();
    const unloadedSamplerWarnings = new Set();

    for (let idx = normalizedStart; idx < normalizedEnd; idx++) {
        const relativeStep = idx - normalizedStart;
        const beat = Math.floor(relativeStep / STEPS_PER_BEAT);
        const micro = relativeStep % STEPS_PER_BEAT;
        const time = beat * beatDur + (micro / STEPS_PER_BEAT) * beatDur;
        events.push([time, idx]);
    }

    _part = new Tone.Part((time, idx) => {
        if (onStep) getToneDraw().schedule(() => onStep(idx), time);

        const step = score[idx];
        if (!step) return;

        step.forEach(({ trackId, instrument, notes, duration, volume }) => {
            const inst = getTrackPlaybackInstrument(trackId, instrument);
            if (!inst) {
                if (!missingSamplerWarnings.has(trackId)) {
                    console.warn(`[Audio] トラック ${trackId} (${instrument}) の音源を取得できませんでした。`);
                    missingSamplerWarnings.add(trackId);
                }
                return;
            }
            if (!inst.loaded) {
                if (!unloadedSamplerWarnings.has(trackId)) {
                    console.warn(`[Audio] トラック ${trackId} (${instrument}) の音源ロードが未完了です。`);
                    unloadedSamplerWarnings.add(trackId);
                }
                return;
            }

            const noteArray = Array.isArray(notes) ? notes : [notes];
            inst.triggerAttackRelease(noteArray, duration || '16n', time, volume ?? 1);
        });
    }, events);

    _part.loop = loop;
    _part.loopEnd = ((normalizedEnd - normalizedStart) / STEPS_PER_BEAT) * beatDur;
    _part.start(0);

    transport.position = 0;
    transport.start(Tone.now() + 0.05);
    return true;
}

export async function previewDrumSample({
    sampleInstrumentId,
    sampleId,
    trackId,
    tracks = [],
} = {}) {
    if (getToneTransport().state === 'started') {
        console.warn('[Audio] 曲再生中のため、ドラム試聴をスキップしました。');
        return false;
    }

    const sampleDefinition = getDrumSampleDefinition(sampleId);
    if (!sampleDefinition?.note || !sampleInstrumentId || trackId == null) return false;

    const sourceTrack = tracks.find((track) => track?.id === trackId) || null;
    const previewTrack = sourceTrack || {
        id: trackId,
        instrument: 'drums',
        volume: 1,
        tone: null,
        eq: null,
        rows: [{ sampleInstrumentId, sampleId }],
    };

    resetPlaybackChainsIfNeeded();
    await ensureToneAudioReady();

    let sampler = null;
    try {
        sampler = await prepareTrackPlaybackInstrument(previewTrack, sampleInstrumentId);
    } catch (error) {
        console.error('[Audio] ドラム試聴用の音源ロードに失敗しました。', error);
        return false;
    }

    if (!(await waitForSamplerReady(sampler))) {
        console.warn('[Audio] ドラム試聴用 sampler のロードが未完了です。');
        return false;
    }

    const previewVolume = normalizeUnitValue(sourceTrack?.volume);
    sampler.triggerAttackRelease(
        sampleDefinition.note,
        DRUM_PREVIEW_DURATION_SECONDS,
        Tone.now(),
        previewVolume
    );
    return true;
}

export async function previewTrackNote({
    track,
    note,
    durationSeconds = 0.35,
} = {}) {
    if (appState.isPlaying) {
        console.warn('[Audio] 曲再生中のため、音試聴をスキップしました。');
        return false;
    }

    if (!track || typeof note !== 'string') return false;

    const playbackInstrumentId = track.playbackInstrument || track.instrument;
    if (!playbackInstrumentId) return false;

    resetPlaybackChainsIfNeeded();
    await ensureToneAudioReady();

    let sampler = null;
    try {
        sampler = await prepareTrackPlaybackInstrument(track, playbackInstrumentId);
    } catch (error) {
        console.error('[Audio] 音試聴用の音源ロードに失敗しました。', error);
        return false;
    }

    if (!(await waitForSamplerReady(sampler))) {
        console.warn('[Audio] 音試聴用 sampler のロードが未完了です。');
        return false;
    }

    const previewVolume = normalizeUnitValue(track.volume);
    sampler.triggerAttackRelease(note, durationSeconds, Tone.now(), previewVolume);
    return true;
}

/**
 * 再生を停止する
 */
export function stop() {
    getToneTransport().stop();
    if (_part) {
        _part.stop();
        _part.dispose();
        _part = null;
    }
}
