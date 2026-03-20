import { Capacitor, registerPlugin } from '@capacitor/core';
import { appState } from '../../core/state.js';
import {
    play as playSchedulerScore,
    previewDrumSample as previewSchedulerDrumSample,
    previewTrackNote as previewSchedulerTrackNote,
    stop as stopSchedulerScore,
} from '../playback/scheduler.js';
import { buildNativePlaybackManifest, buildNativePlaybackManifestForInstrumentIds } from '../playback/score-serializer.js';
import { getDrumSampleDefinition } from '../tracks/instrument-map.js';
import { isIosApp } from './device-bridge.js';

const NativePlayback = registerPlugin('NativePlayback');

let preparedManifestKey = null;
let nativePlaybackStateErrorLogged = false;
const NATIVE_READY_POLL_INTERVAL_MS = 60;
const NATIVE_READY_TIMEOUT_MS = 2500;

function normalizeStartDelayMs(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeStartedAtMs(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizePositionStep(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function canUseNativePlayback() {
    return isIosApp() && Capacitor.isPluginAvailable('NativePlayback');
}

function getManifestCacheKey(manifests) {
    return JSON.stringify(manifests);
}

async function prepareNativePlaybackManifests(manifests = []) {
    if (!canUseNativePlayback()) return true;
    const manifestKey = getManifestCacheKey(manifests);
    if (manifestKey !== preparedManifestKey) {
        await NativePlayback.preload({ instruments: manifests });
        preparedManifestKey = manifestKey;
    }
    await NativePlayback.warmup();
    await waitForNativePlaybackReady();
    return true;
}

function wait(ms) {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

async function waitForNativePlaybackReady({
    timeoutMs = NATIVE_READY_TIMEOUT_MS,
    intervalMs = NATIVE_READY_POLL_INTERVAL_MS,
} = {}) {
    if (!canUseNativePlayback()) return true;

    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
        const status = await NativePlayback.getStatus();
        if (status?.ready === true) return true;

        const readyAtMs = Number(status?.readyAtMs);
        const waitMs = Number.isFinite(readyAtMs)
            ? Math.max(intervalMs, Math.min(readyAtMs - Date.now(), 200))
            : intervalMs;
        await wait(waitMs);
    }

    return false;
}

export async function prepareAudioPlayback(tracks = []) {
    return prepareNativePlaybackManifests(buildNativePlaybackManifest(tracks));
}

export async function playScore(playbackData, options = {}) {
    const { score, nativePayload } = playbackData || {};
    const tracks = options.tracks || [];

    if (canUseNativePlayback() && nativePayload) {
        try {
            stopSchedulerScore();
            await prepareAudioPlayback(tracks);
            const result = await NativePlayback.play({
                payloadJson: JSON.stringify(nativePayload),
            });
            return {
                started: result?.started !== false,
                mode: 'native',
                startDelayMs: normalizeStartDelayMs(result?.startDelayMs),
                startedAtMs: normalizeStartedAtMs(result?.startedAtMs),
            };
        } catch (error) {
            console.warn('[Audio] native playback failed, falling back to Tone.js.', error);
        }
    }

    const started = await playSchedulerScore(score, options);
    return {
        started,
        mode: 'web',
        startDelayMs: 0,
        startedAtMs: null,
    };
}

export async function getNativePlaybackState() {
    if (!canUseNativePlayback()) return null;

    try {
        nativePlaybackStateErrorLogged = false;
        const result = await NativePlayback.getStatus();
        return {
            playing: result?.playing === true,
            ready: result?.ready === true,
            readyAtMs: normalizeStartedAtMs(result?.readyAtMs),
            loop: result?.loop !== false,
            startStep: Number.isFinite(Number(result?.startStep)) ? Number(result.startStep) : null,
            endStepExclusive: Number.isFinite(Number(result?.endStepExclusive)) ? Number(result.endStepExclusive) : null,
            currentStep: Number.isFinite(Number(result?.currentStep)) ? Number(result.currentStep) : null,
            positionStep: normalizePositionStep(result?.positionStep),
            startedAtMs: normalizeStartedAtMs(result?.startedAtMs),
        };
    } catch (error) {
        if (!nativePlaybackStateErrorLogged) {
            console.warn('[Audio] native playback state sync failed.', error);
            nativePlaybackStateErrorLogged = true;
        }
        return null;
    }
}

export async function previewDrumSample({
    sampleInstrumentId,
    sampleId,
    trackId,
} = {}) {
    if (appState.isPlaying) {
        console.warn('[Audio] 曲再生中のため、ドラム試聴をスキップしました。');
        return false;
    }

    if (canUseNativePlayback() && sampleInstrumentId) {
        try {
            const track = appState.tracks.find((item) => item?.id === trackId) || null;
            const note = track?.rows?.find((row) => (
                row.sampleId === sampleId
                && (row.sampleInstrumentId || 'drums_default') === sampleInstrumentId
            ))?.note || getDrumSampleDefinition(sampleId)?.note;
            if (note) {
                await prepareNativePlaybackManifests(
                    buildNativePlaybackManifestForInstrumentIds([sampleInstrumentId])
                );
                const result = await NativePlayback.preview({
                    instrumentId: sampleInstrumentId,
                    note,
                    durationSeconds: 0.35,
                    volume: typeof track?.volume === 'number'
                        ? Math.max(0, Math.min(1, track.volume))
                        : 1,
                });
                if (result?.started !== false) return true;
            }
        } catch (error) {
            console.warn('[Audio] native drum preview failed, falling back to Tone.js.', error);
        }
    }

    return previewSchedulerDrumSample({
        sampleInstrumentId,
        sampleId,
        trackId,
        tracks: appState.tracks,
    });
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

    const playbackInstrumentId = track?.playbackInstrument || track?.instrument;
    if (canUseNativePlayback() && playbackInstrumentId && note) {
        try {
            await prepareNativePlaybackManifests(
                buildNativePlaybackManifestForInstrumentIds([playbackInstrumentId])
            );
            const result = await NativePlayback.preview({
                instrumentId: playbackInstrumentId,
                note,
                durationSeconds,
                volume: typeof track?.volume === 'number'
                    ? Math.max(0, Math.min(1, track.volume))
                    : 1,
            });
            if (result?.started !== false) return true;
        } catch (error) {
            console.warn('[Audio] native note preview failed, falling back to Tone.js.', error);
        }
    }

    return previewSchedulerTrackNote({
        track,
        note,
        durationSeconds,
    });
}

export function stopScorePlayback() {
    if (canUseNativePlayback()) {
        void NativePlayback.stop().catch((error) => {
            console.warn('[Audio] native stop failed:', error);
        });
    }
    stopSchedulerScore();
}
