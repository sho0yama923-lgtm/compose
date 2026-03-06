// editor-drum.js — ドラムエディタ描画

import { appState, STEPS_PER_MEASURE, callbacks } from './state.js';
import { DURATION_CELLS } from './constants.js';
import { toggleStep, isStepHead, isStepTie } from './duration-utils.js';
import { renderDurationToolbar, getCurrentDuration } from './duration-toolbar.js';
import {
    getEditorCells,
    getEditorGridColumns,
    getGridModeLabel,
    getMeasureStart,
} from './rhythm-grid.js';

export function renderDrumEditor(track, editorEl) {
    const measureIndex = appState.currentMeasure;
    const offset = getMeasureStart(measureIndex);
    const maxIndex = offset + STEPS_PER_MEASURE;
    const cells = getEditorCells();
    const columns = getEditorGridColumns();

    // --- デュレーションツールバー ---
    renderDurationToolbar(editorEl, () => callbacks.renderEditor());

    const wrapEl = document.createElement('div');
    wrapEl.className = 'melodic-editor';

    const keysEl = document.createElement('div');
    keysEl.className = 'piano-keys';
    keysEl.appendChild(Object.assign(document.createElement('div'), { className: 'piano-key-spacer' }));

    const gridScrollEl = document.createElement('div');
    gridScrollEl.className = 'steps-grid-scroll';
    const gridEl = document.createElement('div');
    gridEl.className = 'timeline-grid';

    // ビートヘッダー
    const hdrEl = document.createElement('div');
    hdrEl.className = 'timeline-header';
    hdrEl.style.gridTemplateColumns = columns;
    const modeLabel = getGridModeLabel();
    cells.forEach(cellInfo => {
        const cell = document.createElement('div');
        cell.className = 'timeline-header-cell' + (cellInfo.slot === 0 ? ' beat' : '');
        cell.textContent = cellInfo.slot === 0 ? `${cellInfo.beat + 1}` : '';
        cell.title = `${modeLabel} ${cellInfo.beat + 1}`;
        hdrEl.appendChild(cell);
    });
    gridEl.appendChild(hdrEl);

    track.rows.forEach(row => {
        const keyEl = document.createElement('div');
        keyEl.className = 'piano-key white-key drum-key';
        keyEl.textContent = row.label;
        keysEl.appendChild(keyEl);

        const rowEl = document.createElement('div');
        rowEl.className = 'timeline-row';
        rowEl.style.setProperty('--timeline-columns', String(cells.length));
        rowEl.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('timeline-note')) return;
            const rect = rowEl.getBoundingClientRect();
            const x = Math.max(0, Math.min(rect.width - 1, event.clientX - rect.left));
            const column = Math.floor((x / rect.width) * cells.length);
            const cellInfo = cells[Math.max(0, Math.min(cells.length - 1, column))];
            const dur = getCurrentDuration();
            toggleStep(row.steps, offset + cellInfo.localStep, dur, maxIndex);
            callbacks.renderEditor();
        });

        for (let localStep = 0; localStep < STEPS_PER_MEASURE; localStep++) {
            const si = offset + localStep;
            const val = row.steps[si];
            if (isStepTie(val) || !isStepHead(val)) continue;

            const btn = document.createElement('div');
            btn.className = 'timeline-note drum-note';
            const widthPct = ((DURATION_CELLS[val] || 1) / STEPS_PER_MEASURE) * 100;
            const leftPct = (localStep / STEPS_PER_MEASURE) * 100;
            btn.style.left = `calc(${leftPct}% + 1px)`;
            btn.style.width = `calc(${widthPct}% - 2px)`;

            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const dur = getCurrentDuration();
                toggleStep(row.steps, si, dur, maxIndex);
                callbacks.renderEditor();
            });
            rowEl.appendChild(btn);
        }
        gridEl.appendChild(rowEl);
    });

    gridScrollEl.appendChild(gridEl);
    wrapEl.appendChild(keysEl);
    wrapEl.appendChild(gridScrollEl);
    editorEl.appendChild(wrapEl);
}
