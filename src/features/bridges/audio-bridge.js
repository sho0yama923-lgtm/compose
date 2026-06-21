import { registerPlugin } from '@capacitor/core';
import { normalizeFiniteNumber, normalizeUnitValue } from '../../core/number-utils.js';
import { appState } from '../../core/state.js';
import {
    play as playSchedulerScore,
    markWebPlaybackRecoveryNeeded,
    prepareWebPlaybackForUserGesture,
    previewDrumSample as previewSchedulerDrumSample,
    previewTrackNote as previewSchedulerTrackNote,
    stop as stopSchedulerScore,
    warmupPlaybackInstrument as warmupSchedulerInstrument,
    warmupPlaybackTracks as warmupSchedulerTracks,
} from '../playback/scheduler.js';
import { buildNativePlaybackManifest, buildNativePlaybackManifestForInstrumentIds } from '../playback/score-serializer.js';
import { getDrumSampleDefinition } from '../tracks/instrument-map.js';
import { canUseIosNativePlayback } from './device-bridge.js';

const NativePlayback = registerPlugin('NativePlayback');

let preparedManifestKey = null;
let nativePlaybackStateErrorLogged = false;
const NATIVE_READY_POLL_INTERVAL_MS = 60;
const NATIVE_READY_TIMEOUT_MS = 2500;
const WEB_AUDIO_CONTEXT_WARMUP_TIMEOUT_MS = 1500;

function normalizeStartDelayMs(value) {
    const parsed = normalizeFiniteNumber(value, 0);
    return parsed > 0 ? parsed : 0;
}

function normalizeStartedAtMs(value) {
    const parsed = normalizeFiniteNumber(value, null);
    return parsed !== null && parsed > 0 ? parsed : null;
}

function normalizePositionStep(value) {
    return normalizeFiniteNumber(value, null);
}

function canUseNativePlayback() {
    return canUseIosNativePlayback();
}

function getManifestCacheKey(manifests) {
    return JSON.stringify(manifests);
}

function mergeNativePlaybackManifests(...manifestGroups) {
    const merged = new Map();
    manifestGroups
        .flat()
        .filter(Boolean)
        .forEach((manifest) => {
            if (!manifest?.instrumentId || !manifest?.samples) return;
            const currentSamples = merged.get(manifest.instrumentId)?.samples || {};
            merged.set(manifest.instrumentId, {
                instrumentId: manifest.instrumentId,
                samples: {
                    ...currentSamples,
                    ...manifest.samples,
                },
            });
        });

    return Array.from(merged.values()).sort((left, right) => left.instrumentId.localeCompare(right.instrumentId));
}

function buildNativePreviewManifest(extraInstrumentIds = []) {
    return mergeNativePlaybackManifests(
        buildNativePlaybackManifest(appState.tracks),
        buildNativePlaybackManifestForInstrumentIds(extraInstrumentIds)
    );
}

async function prepareNativePlaybackManifests(manifests = []) {
    if (!canUseNativePlayback()) return true;
    if (typeof NativePlayback.recover === 'function') {
        await NativePlayback.recover();
    }
    const manifestKey = getManifestCacheKey(manifests);
    if (manifestKey !== preparedManifestKey) {
        await NativePlayback.preload({ instruments: manifests });
        preparedManifestKey = manifestKey;
    }
    await NativePlayback.warmup();
    await waitForNativePlaybackReady();
    return true;
}

export function invalidateNativePlaybackPreparation() {
    preparedManifestKey = null;
    nativePlaybackStateErrorLogged = false;
}

export function markWebAudioPlaybackRecoveryNeeded() {
    if (canUseNativePlayback()) return;
    markWebPlaybackRecoveryNeeded();
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
    if (!canUseNativePlayback()) {
        return warmupSchedulerTracks(tracks);
    }
    return prepareNativePlaybackManifests(buildNativePlaybackManifest(tracks));
}

export async function prepareAudioContextForUserGesture() {
    if (canUseNativePlayback()) return true;
    try {
        const ready = await prepareWebPlaybackForUserGesture(WEB_AUDIO_CONTEXT_WARMUP_TIMEOUT_MS);
        if (!ready) {
            console.warn('[Audio] Web Audio context warmup timed out.');
        }
        return ready;
    } catch (error) {
        console.warn('[Audio] Web Audio context warmup skipped.', error);
        return false;
    }
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
            startStep: normalizeFiniteNumber(result?.startStep, null),
            endStepExclusive: normalizeFiniteNumber(result?.endStepExclusive, null),
            currentStep: normalizeFiniteNumber(result?.currentStep, null),
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
                    buildNativePreviewManifest([sampleInstrumentId])
                );
                const result = await NativePlayback.preview({
                    instrumentId: sampleInstrumentId,
                    note,
                    durationSeconds: 0.35,
                    volume: normalizeUnitValue(track?.volume),
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
                buildNativePreviewManifest([playbackInstrumentId])
            );
            const result = await NativePlayback.preview({
                instrumentId: playbackInstrumentId,
                note,
                durationSeconds,
                volume: normalizeUnitValue(track?.volume),
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

export async function warmupInstruments(track, instrumentIds = []) {
    if (!Array.isArray(instrumentIds) || instrumentIds.length === 0) return;

    if (canUseNativePlayback()) {
        try {
            await prepareNativePlaybackManifests(buildNativePreviewManifest(instrumentIds));
        } catch (error) {
            console.warn('[Audio] native instrument warmup failed.', error);
        }
        return;
    }

    instrumentIds.forEach((playbackInstrumentId) => {
        void warmupSchedulerInstrument(track, playbackInstrumentId);
    });
}
