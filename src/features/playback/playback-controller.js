// playback.js — 再生/停止 + スコア構築

import { appState, STEPS_PER_MEASURE, totalSteps, callbacks, getNormalizedPlayRangeMeasures } from '../../core/state.js';
import { playScore, stopScorePlayback } from '../bridges/audio-bridge.js';
import { INST_TYPE } from '../tracks/instrument-map.js';
import { getResolvedChordNotes } from '../../core/constants.js';
import { isStepHead } from '../../core/duration.js';
import { serializeScoreForNativePlayback } from './score-serializer.js';

let playbackRequestId = 0;
let playheadAnimationFrameId = null;
let playheadAnimationState = null;

export function initPlayback() {
    setPlaybackButtonState();
    document.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const playToggleBtn = target.closest('[data-play-toggle="true"]');
        if (!playToggleBtn) return;
        if (appState.isPlaying) {
            stopPlayback();
            return;
        }

        const bpm   = Number(document.getElementById('bpmInput').value) || 120;
        const ts    = totalSteps();
        const score = Array(ts).fill(null);
        const playRange = getNormalizedPlayRangeMeasures();

        appState.tracks.forEach(track => {
            if (track.muted) return;
            const trackVolume = typeof track.volume === 'number'
                ? Math.max(0, Math.min(1, track.volume))
                : 1;

            if (INST_TYPE[track.instrument] === 'rhythm') {
                track.rows.forEach(row => {
                    row.steps.forEach((val, i) => {
                        if (!isStepHead(val)) return;
                        score[i] = score[i] || [];
                        score[i].push({
                            trackId: track.id,
                            instrument: row.sampleInstrumentId || 'drums_default',
                            notes: row.note,
                            duration: val,
                            volume: trackVolume,
                        });
                    });
                });
            } else if (INST_TYPE[track.instrument] === 'chord') {
                let currentChord = null;
                for (let i = 0; i < ts; i++) {
                    if (track.chordMap[i]) currentChord = track.chordMap[i];
                    const dur = track.soundSteps[i];
                    if (isStepHead(dur) && currentChord) {
                        const notes = getResolvedChordNotes(currentChord);
                        score[i] = score[i] || [];
                        score[i].push({
                            trackId: track.id,
                            instrument: track.playbackInstrument || 'piano',
                            notes: notes.length === 1 ? notes[0] : notes,
                            duration: dur,
                            volume: trackVolume,
                        });
                    }
                }
            } else {
                const stepNotes = Array.from({ length: ts }, () => []);
                const stepDurations = Array.from({ length: ts }, () => null);
                Object.entries(track.stepsMap).forEach(([note, steps]) => {
                    steps.forEach((val, i) => {
                        if (isStepHead(val)) {
                            stepNotes[i].push(note);
                            // 同じステップに複数ノートがある場合、最も長いデュレーションを採用
                            if (!stepDurations[i]) stepDurations[i] = val;
                        }
                    });
                });
                stepNotes.forEach((notes, i) => {
                    if (notes.length === 0) return;
                    score[i] = score[i] || [];
                    score[i].push({
                        trackId: track.id,
                        instrument: track.instrument,
                        notes: notes.length === 1 ? notes[0] : notes,
                        duration: stepDurations[i] || '16n',
                        volume: trackVolume,
                    });
                });
            }
        });

        let startStep = 0;
        let endStepExclusive = ts;
        if (playRange) {
            startStep = playRange.startMeasure * STEPS_PER_MEASURE;
            endStepExclusive = (playRange.endMeasure + 1) * STEPS_PER_MEASURE;
            if (appState.currentMeasure !== playRange.startMeasure) {
                appState.isPlaying = true;
                syncPreviewScrollTop();
                appState.currentMeasure = playRange.startMeasure;
                callbacks.renderEditor();
                appState.isPlaying = false;
            }
        }

        const nativePayload = serializeScoreForNativePlayback(score, {
            bpm,
            tracks: appState.tracks,
            startStep,
            endStepExclusive,
            loop: true,
        });

        appState.isPlaying = true;
        setPlaybackButtonState();
        const requestId = ++playbackRequestId;
        const playbackResult = await playScore({
            score,
            nativePayload,
        }, {
            bpm,
            tracks: appState.tracks,
            beatConfig: appState.beatConfig,
            numMeasures: appState.numMeasures,
            startStep,
            endStepExclusive,
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
                bpm,
                startStep,
                endStepExclusive,
                startDelayMs: Number(playbackResult?.startDelayMs) || 0,
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

    if (measure !== appState.currentMeasure) {
        syncPreviewScrollTop();
        appState.currentMeasure = measure;
        callbacks.renderEditor();
    }

    if (stepChanged) {
        appState.playheadStep = globalStep;
        updatePlayingPreviewCells(globalStep);
    }

    updatePlayheadIndicators(globalStepPosition);
}

function beginPlaybackAnimation({
    bpm,
    startStep,
    endStepExclusive,
    startDelayMs = 0,
    loop = true,
}) {
    stopPlaybackAnimation();
    playheadAnimationState = {
        startAtMs: performance.now() + Math.max(0, startDelayMs),
        msPerStep: (60_000 / Math.max(1, bpm)) / 12,
        startStep,
        endStepExclusive,
        cycleSteps: Math.max(1, endStepExclusive - startStep),
        loop,
    };
    tickPlaybackAnimation();
}

function stopPlaybackAnimation() {
    if (playheadAnimationFrameId !== null) {
        cancelAnimationFrame(playheadAnimationFrameId);
        playheadAnimationFrameId = null;
    }
    playheadAnimationState = null;
}

function tickPlaybackAnimation() {
    if (!playheadAnimationState || !appState.isPlaying) {
        playheadAnimationFrameId = null;
        return;
    }

    const {
        startAtMs,
        msPerStep,
        startStep,
        endStepExclusive,
        cycleSteps,
        loop,
    } = playheadAnimationState;

    const now = performance.now();
    if (now < startAtMs) {
        updatePlayheadIndicators(null);
        playheadAnimationFrameId = requestAnimationFrame(tickPlaybackAnimation);
        return;
    }

    const elapsedSteps = Math.max(0, (now - startAtMs) / msPerStep);
    const cycledSteps = loop
        ? (elapsedSteps % cycleSteps)
        : Math.min(elapsedSteps, Math.max(0, cycleSteps - 0.001));
    const globalStepPosition = Math.min(endStepExclusive - 0.001, startStep + cycledSteps);
    const globalStep = Math.min(endStepExclusive - 1, Math.floor(globalStepPosition));

    applyPlaybackUi(globalStep, globalStepPosition);
    playheadAnimationFrameId = requestAnimationFrame(tickPlaybackAnimation);
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
    setPlaybackButtonState();
}

function setPlaybackButtonState() {
    document.querySelectorAll('[data-play-toggle="true"]').forEach((playToggleBtn) => {
        playToggleBtn.textContent = appState.isPlaying ? '||' : '▶';
        playToggleBtn.setAttribute('aria-label', appState.isPlaying ? '停止' : '再生');
        playToggleBtn.setAttribute('aria-pressed', String(appState.isPlaying));
        playToggleBtn.classList.toggle('is-playing', appState.isPlaying);
    });
}
