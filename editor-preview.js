// editor-preview.js — 全トラックプレビュー画面

import { appState, STEPS_PER_MEASURE } from './state.js';
import { INST_TYPE, INST_LABEL } from './instruments.js';
import { CHROMATIC } from './constants.js';
import { selectTrack } from './track-manager.js';

export function renderPreview(containerEl) {
    const offset = appState.currentMeasure * STEPS_PER_MEASURE;
    const wrapEl = document.createElement('div');
    wrapEl.className = 'preview-wrap';

    appState.tracks.forEach(track => {
        const card = document.createElement('div');
        card.className = 'preview-card';

        // ヘッダー（タップでエディタへ遷移）
        const headerEl = document.createElement('div');
        headerEl.className = 'preview-card-header';
        headerEl.textContent = INST_LABEL[track.instrument];
        headerEl.addEventListener('click', () => selectTrack(track.id));
        card.appendChild(headerEl);

        // ドットグリッド
        const gridEl = document.createElement('div');
        gridEl.className = 'preview-grid';

        const type = INST_TYPE[track.instrument];

        if (type === 'rhythm') {
            // ドラム: rows数 × 16ステップ
            gridEl.style.gridTemplateRows = `repeat(${track.rows.length}, 1fr)`;
            track.rows.forEach(row => {
                for (let i = 0; i < STEPS_PER_MEASURE; i++) {
                    const cell = document.createElement('span');
                    cell.className = 'preview-cell' + (row.steps[offset + i] ? ' on' : '');
                    gridEl.appendChild(cell);
                }
            });
        } else if (type === 'chord') {
            // コード: soundSteps の 1行 × 16ステップ
            gridEl.style.gridTemplateRows = '1fr';
            for (let i = 0; i < STEPS_PER_MEASURE; i++) {
                const cell = document.createElement('span');
                cell.className = 'preview-cell' + (track.soundSteps[offset + i] ? ' on' : '');
                gridEl.appendChild(cell);
            }
        } else {
            // メロディ: activeOctave の 12音 × 16ステップ
            const oct = track.activeOctave ?? (track.viewBase + 1);
            gridEl.style.gridTemplateRows = `repeat(12, 1fr)`;
            [...CHROMATIC].reverse().forEach(noteName => {
                const steps = track.stepsMap[`${noteName}${oct}`];
                for (let i = 0; i < STEPS_PER_MEASURE; i++) {
                    const cell = document.createElement('span');
                    cell.className = 'preview-cell' + (steps[offset + i] ? ' on' : '');
                    gridEl.appendChild(cell);
                }
            });
        }

        card.appendChild(gridEl);
        wrapEl.appendChild(card);
    });

    containerEl.appendChild(wrapEl);
}
