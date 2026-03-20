// player.js
// Tone.js はグローバル変数として使用（HTMLでCDN読み込み済み）
import { appState, STEPS_PER_BEAT, STEPS_PER_MEASURE } from '../../core/state.js';
import { getTrackPlaybackInstrument, syncTrackPlaybackChains } from '../tracks/instrument-map.js';
import { getDrumSampleDefinition } from '../tracks/instruments/instrument-config.js';
import { prepareTrackPlaybackInstrument } from '../tracks/instruments/playback-chains.js';

// ==========================================================
// スコアのデータ形式
// ==========================================================
//
// score: 長さ N の配列（インデックスが各ステップに対応）
//
// 各ステップ:
//   null            → 無音
//   [ イベント, ... ] → 同時に鳴らす音のリスト
//
// イベントの形式:
//   { instrument: '楽器名', notes: '音階', duration: '4n' }
//
// ==========================================================

let _part = null;
const DRUM_PREVIEW_DURATION_SECONDS = 0.35;
const PREVIEW_SAMPLER_READY_TIMEOUT_MS = 2000;
const PREVIEW_SAMPLER_POLL_MS = 50;

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
            // 個別サンプルが失敗した場合は下の loaded 判定へフォールバックする
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
    if (!globalThis.Tone || !track?.id || !playbackInstrumentId) return false;
    try {
        await Tone.start();
        const sampler = await prepareTrackPlaybackInstrument(track, playbackInstrumentId);
        return await waitForSamplerReady(sampler, PREVIEW_SAMPLER_READY_TIMEOUT_MS);
    } catch (error) {
        console.warn('[Audio] 試聴用音源の先読みをスキップしました。', error);
        return false;
    }
}

/**
 * 音楽を再生する
 * @param {Array} score  - ステップのスコア配列
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
    if (!globalThis.Tone) {
        alert('Tone.js の読み込みに失敗したため、再生できません。ネットワーク接続を確認して再読み込みしてください。');
        return false;
    }

    await Tone.start();

    // 前の再生を停止
    stop();

    Tone.Transport.bpm.value = bpm;
    syncTrackPlaybackChains(tracks);
    if (typeof Tone.loaded === 'function') {
        try {
            await Tone.loaded();
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
        if (onStep) Tone.Draw.schedule(() => onStep(idx), time);

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

    Tone.Transport.position = 0;
    Tone.Transport.start();
    return true;
}

export async function previewDrumSample({
    sampleInstrumentId,
    sampleId,
    trackId,
    tracks = [],
} = {}) {
    if (!globalThis.Tone) {
        alert('Tone.js の読み込みに失敗したため、試聴できません。ネットワーク接続を確認して再読み込みしてください。');
        return false;
    }

    if (Tone.Transport.state === 'started') {
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

    await Tone.start();

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

    const previewVolume = typeof sourceTrack?.volume === 'number'
        ? Math.max(0, Math.min(1, sourceTrack.volume))
        : 1;
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
    if (!globalThis.Tone) {
        alert('Tone.js の読み込みに失敗したため、試聴できません。ネットワーク接続を確認して再読み込みしてください。');
        return false;
    }

    if (appState.isPlaying) {
        console.warn('[Audio] 曲再生中のため、音試聴をスキップしました。');
        return false;
    }

    if (!track || typeof note !== 'string') return false;

    const playbackInstrumentId = track.playbackInstrument || track.instrument;
    if (!playbackInstrumentId) return false;

    await Tone.start();

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

    const previewVolume = typeof track.volume === 'number'
        ? Math.max(0, Math.min(1, track.volume))
        : 1;
    sampler.triggerAttackRelease(note, durationSeconds, Tone.now(), previewVolume);
    return true;
}

/**
 * 再生を停止する
 */
export function stop() {
    Tone.Transport.stop();
    if (_part) {
        _part.stop();
        _part.dispose();
        _part = null;
    }
}
