// playback.js — 再生/停止 + スコア構築

import { appState, STEPS_PER_MEASURE, totalSteps, callbacks, getNormalizedPlayRangeMeasures } from '../../core/state.js';
import { play, stop } from './scheduler.js';
import { INST_TYPE } from '../tracks/instrument-map.js';
import { getChordNotes } from '../../core/constants.js';
import { isStepHead } from '../../core/duration.js';

export function initPlayback() {
    const playToggleBtn = document.getElementById('playToggleBtn');
    setPlaybackButtonState();

    playToggleBtn.addEventListener('click', async () => {
        if (appState.isPlaying) {
            stopPlayback();
            return;
        }

        const bpm   = Number(document.getElementById('bpmInput').value) || 120;
        const ts    = totalSteps();
        const score = Array(ts).fill(null);
        const playRange = getNormalizedPlayRangeMeasures();

        appState.tracks.forEach(track => {
            if (INST_TYPE[track.instrument] === 'rhythm') {
                track.rows.forEach(row => {
                    row.steps.forEach((val, i) => {
                        if (!isStepHead(val)) return;
                        score[i] = score[i] || [];
                        score[i].push({ instrument: track.instrument, notes: row.note, duration: val });
                    });
                });
            } else if (INST_TYPE[track.instrument] === 'chord') {
                let currentChord = null;
                for (let i = 0; i < ts; i++) {
                    if (track.chordMap[i]) currentChord = track.chordMap[i];
                    const dur = track.soundSteps[i];
                    if (isStepHead(dur) && currentChord) {
                        const notes = getChordNotes(currentChord.root, currentChord.type, currentChord.octave);
                        score[i] = score[i] || [];
                        score[i].push({ instrument: 'piano', notes: notes.length === 1 ? notes[0] : notes, duration: dur });
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
                        instrument: track.instrument,
                        notes: notes.length === 1 ? notes[0] : notes,
                        duration: stepDurations[i] || '16n'
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
                appState.currentMeasure = playRange.startMeasure;
                callbacks.renderEditor();
                appState.isPlaying = false;
            }
        }

        appState.isPlaying = true;
        setPlaybackButtonState();
        const started = await play(score, {
            bpm,
            beatConfig: appState.beatConfig,
            numMeasures: appState.numMeasures,
            startStep,
            endStepExclusive,
            onStep(globalStep) {
                appState.playheadStep = globalStep;
                const measure = Math.floor(globalStep / STEPS_PER_MEASURE);

                // 小節が変わったら自動ページ送り
                if (measure !== appState.currentMeasure) {
                    appState.currentMeasure = measure;
                    callbacks.renderEditor();
                }

                // 再生位置ハイライト更新
                document.querySelectorAll('.preview-cell.playing')
                    .forEach(el => el.classList.remove('playing'));
                document.querySelectorAll(`.preview-cell[data-start="${globalStep}"]`)
                    .forEach(el => el.classList.add('playing'));
                updatePlayheadIndicators(globalStep);
            }
        });
        appState.isPlaying = started;
        setPlaybackButtonState();
    });
}

function updatePlayheadIndicators(globalStep) {
    document.querySelectorAll('.playhead-bar').forEach((barEl) => {
        const measureStart = Number(barEl.dataset.measureStart || '0');
        if (globalStep === null || globalStep < measureStart || globalStep >= measureStart + STEPS_PER_MEASURE) {
            barEl.style.display = 'none';
            return;
        }
        const localStep = globalStep - measureStart;
        barEl.style.display = 'block';
        barEl.style.left = `${(localStep / STEPS_PER_MEASURE) * 100}%`;
    });
}

function stopPlayback() {
    stop();
    appState.isPlaying = false;
    appState.playheadStep = null;
    document.querySelectorAll('.preview-cell.playing')
        .forEach(el => el.classList.remove('playing'));
    updatePlayheadIndicators(null);
    setPlaybackButtonState();
}

function setPlaybackButtonState() {
    const playToggleBtn = document.getElementById('playToggleBtn');
    if (!playToggleBtn) return;
    playToggleBtn.textContent = appState.isPlaying ? '||' : '▶';
    playToggleBtn.setAttribute('aria-label', appState.isPlaying ? '停止' : '再生');
    playToggleBtn.classList.toggle('is-playing', appState.isPlaying);
}
