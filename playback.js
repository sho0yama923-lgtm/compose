// playback.js — 再生/停止 + スコア構築

import { appState, totalSteps } from './state.js';
import { play, stop } from './player.js';
import { INST_TYPE } from './instruments.js';
import { getChordNotes } from './constants.js';

export function initPlayback() {
    document.getElementById('playBtn').addEventListener('click', async () => {
        const bpm   = Number(document.getElementById('bpmInput').value) || 120;
        const ts    = totalSteps();
        const score = Array(ts).fill(null);

        appState.tracks.forEach(track => {
            if (INST_TYPE[track.instrument] === 'rhythm') {
                track.rows.forEach(row => {
                    row.steps.forEach((on, i) => {
                        if (!on) return;
                        score[i] = score[i] || [];
                        score[i].push({ instrument: track.instrument, notes: row.note });
                    });
                });
            } else if (INST_TYPE[track.instrument] === 'chord') {
                let currentChord = null;
                for (let i = 0; i < ts; i++) {
                    if (track.chordMap[i]) currentChord = track.chordMap[i];
                    if (track.soundSteps[i] && currentChord) {
                        const notes = getChordNotes(currentChord.root, currentChord.type, currentChord.octave);
                        score[i] = score[i] || [];
                        score[i].push({ instrument: 'piano', notes: notes.length === 1 ? notes[0] : notes });
                    }
                }
            } else {
                const stepNotes = Array.from({ length: ts }, () => []);
                Object.entries(track.stepsMap).forEach(([note, steps]) => {
                    steps.forEach((on, i) => { if (on) stepNotes[i].push(note); });
                });
                stepNotes.forEach((notes, i) => {
                    if (notes.length === 0) return;
                    score[i] = score[i] || [];
                    score[i].push({ instrument: track.instrument, notes: notes.length === 1 ? notes[0] : notes });
                });
            }
        });

        await play(score, { bpm });
    });

    document.getElementById('stopBtn').addEventListener('click', () => stop());
}
