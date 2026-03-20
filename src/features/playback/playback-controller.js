// playback.js — 再生/停止 + スコア構築

import { appState, STEPS_PER_MEASURE, totalSteps, callbacks, getNormalizedPlayRangeMeasures } from '../../core/state.js';
import { getCurrentBpm } from '../../core/bpm.js';
import { getNativePlaybackState, playScore, stopScorePlayback } from '../bridges/audio-bridge.js';
import { serializeScoreForNativePlayback } from './score-serializer.js';
import { buildPlaybackScore, resolvePlaybackWindow } from './score-builder.js';

let playbackRequestId = 0;
let playheadAnimationFrameId = null;
let playheadAnimationState = null;
let pendingPlaybackRenderFrameId = null;
let nativePlaybackSyncTimeoutId = null;

const NATIVE_PLAYBACK_SYNC_INTERVAL_MS = 80;

function primePlaybackStartUi(step) {
    appState.playheadStep = step;
    callbacks.renderEditor();
    updatePlayingPreviewCells(step);
    updatePlayheadIndicators(step);
    requestAnimationFrame(() => {
        updatePlayingPreviewCells(step);
        updatePlayheadIndicators(step);
    });
}

function computePlaybackAnchorAtMs({
    nowPerformance = performance.now(),
    nowWallClock = Date.now(),
    startDelayMs = 0,
    startedAtMs = null,
}) {
    const useNativeStartTime = typeof startedAtMs === 'number' && Number.isFinite(startedAtMs);
    const elapsedSinceNativeStartMs = useNativeStartTime
        ? Math.max(0, nowWallClock - startedAtMs)
        : 0;
    const computedAnchorAtMs = useNativeStartTime
        ? nowPerformance - elapsedSinceNativeStartMs
        : nowPerformance + Math.max(0, startDelayMs);

    return Math.min(nowPerformance, computedAnchorAtMs);
}

export function initPlayback() {
    setPlaybackButtonState();
    document.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const playToggleBtn = target.closest('[data-play-toggle="true"]');
        if (!playToggleBtn) return;
        if (appState.isBooting) return;
        if (appState.isPlaying) {
            stopPlayback();
            return;
        }

        const bpm   = getCurrentBpm();
        const ts    = totalSteps();
        const playRange = getNormalizedPlayRangeMeasures();
        const score = buildPlaybackScore(appState.tracks, ts);
        const { startStep, endStepExclusive } = resolvePlaybackWindow({
            totalStepCount: ts,
            playRange,
        });

        const playbackStartMeasure = Math.floor(startStep / STEPS_PER_MEASURE);
        if (appState.currentMeasure !== playbackStartMeasure) {
            appState.isPlaying = true;
            syncPreviewScrollTop();
            appState.currentMeasure = playbackStartMeasure;
            callbacks.renderEditor();
            appState.isPlaying = false;
        }

        const nativePayload = serializeScoreForNativePlayback(score, {
            bpm,
            tracks: appState.tracks,
            startStep,
            endStepExclusive,
            loop: true,
        });

        const requestId = ++playbackRequestId;
        appState.isPlaying = true;
        setPlaybackButtonState();
        beginPlaybackAnimation({
            mode: 'pending',
            bpm,
            startStep,
            endStepExclusive,
            playbackRequestId: requestId,
            startDelayMs: 0,
            startedAtMs: null,
            loop: true,
        });
        const playbackResult = await playScore({
            score,
            nativePayload,
        }, {
            tracks: appState.tracks,
        });
        if (requestId !== playbackRequestId) {
            stopPlaybackAnimation();
            return;
        }
        const started = typeof playbackResult === 'object'
            ? !!playbackResult?.started
            : !!playbackResult;
        appState.isPlaying = started;
        if (started) {
            beginPlaybackAnimation({
                mode: playbackResult?.mode || 'web',
                bpm,
                startStep,
                endStepExclusive,
                playbackRequestId: requestId,
                startDelayMs: Number(playbackResult?.startDelayMs) || 0,
                startedAtMs: Number(playbackResult?.startedAtMs) || null,
                loop: true,
            });
        } else {
            stopPlaybackAnimation();
        }
        setPlaybackButtonState();
    });
}

function updatePlayheadIndicators(globalStepPosition) {
    document.querySelectorAll('.playhead-bar').forEach((barEl) => {
        const measureStart = Number(barEl.dataset.measureStart || '0');
        if (
            globalStepPosition === null
            || globalStepPosition < measureStart
            || globalStepPosition >= measureStart + STEPS_PER_MEASURE
        ) {
            barEl.style.display = 'none';
            return;
        }
        const localStep = globalStepPosition - measureStart;
        barEl.style.display = 'block';
        barEl.style.left = `${(localStep / STEPS_PER_MEASURE) * 100}%`;
    });
}

function updatePlayingPreviewCells(globalStep) {
    document.querySelectorAll('.preview-cell.playing')
        .forEach((el) => el.classList.remove('playing'));
    document.querySelectorAll(`.preview-cell[data-start="${globalStep}"]`)
        .forEach((el) => el.classList.add('playing'));
}

function applyPlaybackUi(globalStep, globalStepPosition = globalStep) {
    const measure = Math.floor(globalStep / STEPS_PER_MEASURE);
    const stepChanged = appState.playheadStep !== globalStep;
    let measureChanged = false;

    if (measure !== appState.currentMeasure) {
        syncPreviewScrollTop();
        appState.currentMeasure = measure;
        measureChanged = true;
    }

    if (stepChanged) {
        appState.playheadStep = globalStep;
        updatePlayingPreviewCells(globalStep);
    }

    updatePlayheadIndicators(globalStepPosition);

    if (!measureChanged || pendingPlaybackRenderFrameId !== null) return;
    pendingPlaybackRenderFrameId = requestAnimationFrame(() => {
        pendingPlaybackRenderFrameId = null;
        callbacks.renderEditor();
    });
}

function beginPlaybackAnimation({
    mode = 'web',
    bpm,
    startStep,
    endStepExclusive,
    playbackRequestId: requestId,
    startDelayMs = 0,
    startedAtMs = null,
    loop = true,
}) {
    const nowPerformance = performance.now();
    const nextState = {
        mode,
        playbackRequestId: requestId,
        anchorAtMs: computePlaybackAnchorAtMs({
            nowPerformance,
            nowWallClock: Date.now(),
            startDelayMs,
            startedAtMs,
        }),
        anchorStepPosition: startStep,
        msPerStep: (60_000 / Math.max(1, bpm)) / 12,
        startStep,
        endStepExclusive,
        cycleSteps: Math.max(1, endStepExclusive - startStep),
        loop,
    };

    const shouldRestartLoop = !playheadAnimationState || playheadAnimationState.playbackRequestId !== requestId;
    if (shouldRestartLoop) {
        stopPlaybackAnimation();
    }
    playheadAnimationState = nextState;
    primePlaybackStartUi(startStep);
    applyPlaybackUi(startStep, startStep);
    if (mode === 'pending') {
        playheadAnimationFrameId = null;
        return;
    }
    if (mode === 'native') {
        scheduleNativePlaybackStateSync(requestId);
    }
    if (shouldRestartLoop || playheadAnimationFrameId === null) {
        tickPlaybackAnimation();
    }
}

function stopPlaybackAnimation() {
    if (playheadAnimationFrameId !== null) {
        cancelAnimationFrame(playheadAnimationFrameId);
        playheadAnimationFrameId = null;
    }
    if (pendingPlaybackRenderFrameId !== null) {
        cancelAnimationFrame(pendingPlaybackRenderFrameId);
        pendingPlaybackRenderFrameId = null;
    }
    if (nativePlaybackSyncTimeoutId !== null) {
        clearTimeout(nativePlaybackSyncTimeoutId);
        nativePlaybackSyncTimeoutId = null;
    }
    playheadAnimationState = null;
}

function tickPlaybackAnimation() {
    if (!playheadAnimationState || !appState.isPlaying) {
        playheadAnimationFrameId = null;
        return;
    }

    const {
        anchorAtMs,
        anchorStepPosition,
        msPerStep,
        startStep,
        endStepExclusive,
        cycleSteps,
        loop,
    } = playheadAnimationState;

    const now = performance.now();
    if (now < anchorAtMs) {
        applyPlaybackUi(startStep, startStep);
        playheadAnimationFrameId = requestAnimationFrame(tickPlaybackAnimation);
        return;
    }

    const anchorOffsetSteps = Math.max(0, Number(anchorStepPosition) - startStep);
    const elapsedSteps = anchorOffsetSteps + Math.max(0, (now - anchorAtMs) / msPerStep);
    const cycledSteps = loop
        ? (elapsedSteps % cycleSteps)
        : Math.min(elapsedSteps, Math.max(0, cycleSteps - 0.001));
    const globalStepPosition = Math.min(endStepExclusive - 0.001, startStep + cycledSteps);
    const globalStep = Math.min(endStepExclusive - 1, Math.floor(globalStepPosition));

    applyPlaybackUi(globalStep, globalStepPosition);
    playheadAnimationFrameId = requestAnimationFrame(tickPlaybackAnimation);
}

function scheduleNativePlaybackStateSync(requestId) {
    if (nativePlaybackSyncTimeoutId !== null) {
        clearTimeout(nativePlaybackSyncTimeoutId);
        nativePlaybackSyncTimeoutId = null;
    }

    const sync = async () => {
        if (!appState.isPlaying || requestId !== playbackRequestId) return;

        const state = await getNativePlaybackState();
        if (!appState.isPlaying || requestId !== playbackRequestId) return;

        if (!state) {
            nativePlaybackSyncTimeoutId = window.setTimeout(sync, NATIVE_PLAYBACK_SYNC_INTERVAL_MS);
            return;
        }

        if (state.playing === false) {
            stopPlayback();
            return;
        }

        const positionStep = Number(state.positionStep);
        if (playheadAnimationState && Number.isFinite(positionStep)) {
            playheadAnimationState.anchorStepPosition = positionStep;
            playheadAnimationState.anchorAtMs = performance.now();
            if (Number.isFinite(Number(state.startStep))) {
                playheadAnimationState.startStep = Number(state.startStep);
            }
            if (Number.isFinite(Number(state.endStepExclusive))) {
                playheadAnimationState.endStepExclusive = Number(state.endStepExclusive);
                playheadAnimationState.cycleSteps = Math.max(
                    1,
                    playheadAnimationState.endStepExclusive - playheadAnimationState.startStep
                );
            }
        }

        nativePlaybackSyncTimeoutId = window.setTimeout(sync, NATIVE_PLAYBACK_SYNC_INTERVAL_MS);
    };

    void sync();
}

function syncPreviewScrollTop() {
    const previewWrap = document.querySelector('.preview-wrap');
    if (!previewWrap) return;
    appState.previewScrollTop = previewWrap.scrollTop;
}

function stopPlayback() {
    playbackRequestId += 1;
    stopScorePlayback();
    stopPlaybackAnimation();
    appState.isPlaying = false;
    appState.playheadStep = null;
    document.querySelectorAll('.preview-cell.playing')
        .forEach(el => el.classList.remove('playing'));
    updatePlayheadIndicators(null);
    callbacks.renderEditor();
    setPlaybackButtonState();
}

function setPlaybackButtonState() {
    document.querySelectorAll('[data-play-toggle="true"]').forEach((playToggleBtn) => {
        playToggleBtn.textContent = appState.isPlaying ? '||' : '▶';
        playToggleBtn.setAttribute('aria-label', appState.isPlaying ? '停止' : '再生');
        playToggleBtn.setAttribute('aria-pressed', String(appState.isPlaying));
        playToggleBtn.classList.toggle('is-playing', appState.isPlaying);
        playToggleBtn.disabled = appState.isBooting;
    });
}
