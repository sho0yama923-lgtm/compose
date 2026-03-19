import { Capacitor, registerPlugin } from '@capacitor/core';
import { appState } from '../../core/state.js';
import {
    play as playSchedulerScore,
    previewDrumSample as previewSchedulerDrumSample,
    stop as stopSchedulerScore,
} from '../playback/scheduler.js';
import { buildNativePlaybackManifest } from '../playback/score-serializer.js';
import { isIosApp } from './device-bridge.js';

const NativePlayback = registerPlugin('NativePlayback');

let preparedManifestKey = null;

function canUseNativePlayback() {
    return isIosApp() && Capacitor.isPluginAvailable('NativePlayback');
}

function getManifestCacheKey(manifests) {
    return JSON.stringify(manifests);
}

export async function prepareAudioPlayback(tracks = []) {
    if (!canUseNativePlayback()) return true;
    const manifests = buildNativePlaybackManifest(tracks);
    const manifestKey = getManifestCacheKey(manifests);
    if (manifestKey === preparedManifestKey) return true;
    await NativePlayback.preload({ instruments: manifests });
    preparedManifestKey = manifestKey;
    return true;
}

export async function playScore(playbackData, options = {}) {
    const { score, nativePayload } = playbackData || {};
    const tracks = options.tracks || [];

    if (canUseNativePlayback() && nativePayload) {
        try {
            stopSchedulerScore();
            await prepareAudioPlayback(tracks);
            const result = await NativePlayback.play({ payload: nativePayload });
            return {
                started: result?.started !== false,
                mode: 'native',
                startDelayMs: Number(result?.startDelayMs) || 180,
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
    };
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

    return previewSchedulerDrumSample({
        sampleInstrumentId,
        sampleId,
        trackId,
        tracks: appState.tracks,
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
