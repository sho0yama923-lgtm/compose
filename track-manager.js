// track-manager.js — トラック管理（追加・削除・選択）+ 小節管理

import { appState, STEPS_PER_MEASURE, totalSteps, callbacks } from './core/state.js';
import { INST_TYPE, OCTAVE_DEFAULT_BASE, DRUM_ROWS, INST_LABEL } from './instruments.js';
import { CHROMATIC } from './core/constants.js';

// -------------------------------------------------------
// トラック選択
// -------------------------------------------------------
export function selectTrack(id) {
    appState.activeTrackId = id;
    appState.previewMode = false;
    callbacks.renderEditor();
    callbacks.renderSidebar();
    callbacks.closeSidebar();

    const track = appState.tracks.find(t => t.id === id);
    if (track) document.getElementById('topbarTitle').textContent = INST_LABEL[track.instrument];
}

// -------------------------------------------------------
// トラック削除
// -------------------------------------------------------
export function deleteTrack(id) {
    appState.tracks = appState.tracks.filter(t => t.id !== id);
    if (appState.activeTrackId === id) {
        appState.activeTrackId = appState.tracks.length > 0
            ? appState.tracks[appState.tracks.length - 1].id
            : null;
        const title = appState.activeTrackId
            ? INST_LABEL[appState.tracks.find(t => t.id === appState.activeTrackId).instrument]
            : '作曲ツール';
        document.getElementById('topbarTitle').textContent = title;
    }
    callbacks.renderSidebar();
    callbacks.renderEditor();
}

// -------------------------------------------------------
// トラック追加
// -------------------------------------------------------
export function addTrack(instrument) {
    const id = appState.nextId++;
    let track;

    const ts = totalSteps();
    if (INST_TYPE[instrument] === 'rhythm') {
        track = {
            id, instrument,
            rows: DRUM_ROWS.map(r => ({ label: r.label, note: r.note, steps: Array(ts).fill(null) })),
        };
    } else if (INST_TYPE[instrument] === 'chord') {
        track = {
            id, instrument,
            chordMap:        Array(ts).fill(null),
            soundSteps:      Array(ts).fill(null),
            selectedChordRoot:   'C',
            selectedChordType:   'M',
            selectedChordOctave: 4,
            dividers:        [0, STEPS_PER_MEASURE / 2],
            selectedDivPos:  null,
            selectedDrumRows: new Set(),
        };
    } else {
        const stepsMap = {};
        for (let oct = 1; oct <= 7; oct++) {
            CHROMATIC.forEach(n => { stepsMap[`${n}${oct}`] = Array(ts).fill(null); });
        }
        const viewBase = OCTAVE_DEFAULT_BASE[instrument] ?? 3;
        track = {
            id, instrument,
            viewBase,
            activeOctave: viewBase + 1,
            stepsMap,
        };
    }

    appState.tracks.push(track);
    selectTrack(id);
}

// -------------------------------------------------------
// 小節の追加・削除
// -------------------------------------------------------
export function addMeasure() {
    appState.numMeasures++;
    // beatConfig に新しい小節を追加（デフォルト: 全拍4分割）
    if (appState.beatConfig.length < appState.numMeasures) {
        appState.beatConfig.push([4, 4, 4, 4]);
    }
    const newStart = (appState.numMeasures - 1) * STEPS_PER_MEASURE;
    appState.tracks.forEach(track => {
        if (INST_TYPE[track.instrument] === 'rhythm') {
            track.rows.forEach(r => r.steps.push(...Array(STEPS_PER_MEASURE).fill(null)));
        } else if (INST_TYPE[track.instrument] === 'chord') {
            track.chordMap.push(...Array(STEPS_PER_MEASURE).fill(null));
            track.soundSteps.push(...Array(STEPS_PER_MEASURE).fill(null));
            if (!track.dividers.includes(newStart)) {
                track.dividers.push(newStart);
                track.dividers.sort((a, b) => a - b);
            }
        } else {
            Object.values(track.stepsMap).forEach(steps =>
                steps.push(...Array(STEPS_PER_MEASURE).fill(null))
            );
        }
    });
    callbacks.renderEditor();
}

export function removeMeasure() {
    if (appState.numMeasures <= 1) return;
    const removeStart = (appState.numMeasures - 1) * STEPS_PER_MEASURE;
    appState.numMeasures--;
    // beatConfig の末尾を削除
    if (appState.beatConfig.length > appState.numMeasures) {
        appState.beatConfig.pop();
    }
    if (appState.currentMeasure >= appState.numMeasures) {
        appState.currentMeasure = appState.numMeasures - 1;
    }
    appState.tracks.forEach(track => {
        if (INST_TYPE[track.instrument] === 'rhythm') {
            track.rows.forEach(r => r.steps.splice(removeStart, STEPS_PER_MEASURE));
        } else if (INST_TYPE[track.instrument] === 'chord') {
            track.chordMap.splice(removeStart, STEPS_PER_MEASURE);
            track.soundSteps.splice(removeStart, STEPS_PER_MEASURE);
            track.dividers = track.dividers.filter(d => d < removeStart);
            if (track.selectedDivPos !== null && track.selectedDivPos >= removeStart) {
                track.selectedDivPos = null;
            }
        } else {
            Object.values(track.stepsMap).forEach(steps =>
                steps.splice(removeStart, STEPS_PER_MEASURE)
            );
        }
    });
    callbacks.renderEditor();
}
