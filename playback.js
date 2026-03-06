// playback.js — 再生/停止 + スコア構築

import { appState, STEPS_PER_MEASURE, totalSteps, callbacks } from './state.js';
import { play, stop } from './player.js';
import { INST_TYPE } from './instruments.js';
import { getChordNotes } from './constants.js';
import { isStepHead } from './duration-utils.js';

export function initPlayback() {
    document.getElementById('playBtn').addEventListener('click', async () => {
        const bpm   = Number(document.getElementById('bpmInput').value) || 120;
        const ts    = totalSteps();
        const score = Array(ts).fill(null);

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

        // beatConfig を渡す
        await play(score, {
            bpm,
            beatConfig: appState.beatConfig,
            numMeasures: appState.numMeasures,
            onStep(globalStep) {
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
            }
        });
    });

    document.getElementById('stopBtn').addEventListener('click', () => {
        stop();
        document.querySelectorAll('.preview-cell.playing')
            .forEach(el => el.classList.remove('playing'));
    });
}
