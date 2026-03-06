// editor-drum.js — ドラムエディタ描画

import { appState, STEPS_PER_MEASURE, callbacks } from './state.js';
import { toggleStep, isStepHead, isStepTie } from './duration-utils.js';
import { renderDurationToolbar, getCurrentDuration } from './duration-toolbar.js';
import {
    applyBeatSubdivisionChange,
    cycleBeatSubdivision,
    getMeasureCells,
    getMeasureGridColumns,
    getMeasureStart,
    getVisibleSpanCount,
} from './rhythm-grid.js';

export function renderDrumEditor(track, editorEl) {
    const measureIndex = appState.currentMeasure;
    const offset = getMeasureStart(measureIndex);
    const maxIndex = offset + STEPS_PER_MEASURE;
    const cells = getMeasureCells(measureIndex);
    const columns = getMeasureGridColumns(measureIndex);

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
    gridEl.className = 'steps-grid';

    // ビートヘッダー
    const hdrEl = document.createElement('div');
    hdrEl.className = 'steps-header';
    hdrEl.style.gridTemplateColumns = columns;
    cells.forEach(cellInfo => {
        const cell = document.createElement('div');
        cell.className = 'step-header-cell' + (cellInfo.slot === 0 ? ' beat' : '');
        cell.textContent = cellInfo.slot === 0 ? String(cellInfo.beat + 1) : '·';

        if (appState.tripletMode && cellInfo.slot === 0) {
            cell.style.cursor = 'pointer';
            cell.title = `${cellInfo.subs}分割`;
            cell.addEventListener('click', () => {
                applyBeatSubdivisionChange(measureIndex, cellInfo.beat, cycleBeatSubdivision(cellInfo.subs));
                callbacks.renderEditor();
            });
        }

        hdrEl.appendChild(cell);
    });
    gridEl.appendChild(hdrEl);

    track.rows.forEach(row => {
        const keyEl = document.createElement('div');
        keyEl.className = 'piano-key white-key drum-key';
        keyEl.textContent = row.label;
        keysEl.appendChild(keyEl);

        const rowEl = document.createElement('div');
        rowEl.className = 'steps-row';
        rowEl.style.gridTemplateColumns = columns;
        cells.forEach((cellInfo, idx) => {
            const si = offset + cellInfo.localStep;
            const val = row.steps[si];
            const head = isStepHead(val);
            const tie = isStepTie(val);
            if (tie) return;

            const btn = document.createElement('button');
            const span = head ? getVisibleSpanCount(cells, idx, offset, row.steps, si, maxIndex) : 1;

            btn.className = 'step'
                + (head ? ' on' : '')
                + (span > 1 ? ' head-span' : '');
            btn.style.gridColumn = `${idx + 1} / span ${span}`;

            btn.addEventListener('click', () => {
                const dur = getCurrentDuration();
                toggleStep(row.steps, si, dur, maxIndex);
                callbacks.renderEditor();
            });
            rowEl.appendChild(btn);
        });
        gridEl.appendChild(rowEl);
    });

    gridScrollEl.appendChild(gridEl);
    wrapEl.appendChild(keysEl);
    wrapEl.appendChild(gridScrollEl);
    editorEl.appendChild(wrapEl);
}
