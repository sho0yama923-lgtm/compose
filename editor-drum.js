// editor-drum.js — ドラムエディタ描画

import { appState, STEPS_PER_MEASURE } from './state.js';

export function renderDrumEditor(track, editorEl) {
    const offset = appState.currentMeasure * STEPS_PER_MEASURE;
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
    for (let i = 0; i < STEPS_PER_MEASURE; i++) {
        const cell = document.createElement('div');
        cell.className = 'step-header-cell' + (i % 4 === 0 ? ' beat' : '');
        cell.textContent = i % 4 === 0 ? String(i / 4 + 1) : '·';
        hdrEl.appendChild(cell);
    }
    gridEl.appendChild(hdrEl);

    track.rows.forEach(row => {
        const keyEl = document.createElement('div');
        keyEl.className = 'piano-key white-key drum-key';
        keyEl.textContent = row.label;
        keysEl.appendChild(keyEl);

        const rowEl = document.createElement('div');
        rowEl.className = 'steps-row';
        for (let i = 0; i < STEPS_PER_MEASURE; i++) {
            const si = offset + i;
            const btn = document.createElement('button');
            btn.className = 'step' + (row.steps[si] ? ' on' : '');
            btn.addEventListener('click', () => {
                row.steps[si] = !row.steps[si];
                btn.classList.toggle('on', row.steps[si]);
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
