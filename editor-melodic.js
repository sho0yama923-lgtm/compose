// editor-melodic.js — メロディエディタ（オクターブ アコーディオン）

import { appState, STEPS_PER_MEASURE, callbacks } from './state.js';
import { CHROMATIC, BLACK_KEYS, OCT_COLOR, DURATION_CELLS } from './constants.js';
import { toggleStep, isStepHead, isStepTie } from './duration-utils.js';
import { renderDurationToolbar, getCurrentDuration } from './duration-toolbar.js';
import {
    getEditorCells,
    getEditorGridColumns,
    getMeasureStart,
} from './rhythm-grid.js';

export function renderMelodicEditor(track, editorEl) {
    const measureIndex = appState.currentMeasure;
    const offset = getMeasureStart(measureIndex);
    const maxIndex = offset + STEPS_PER_MEASURE;
    const cells = getEditorCells();
    const columns = getEditorGridColumns();
    const octaves = [track.viewBase, track.viewBase + 1, track.viewBase + 2];

    // --- デュレーションツールバー ---
    const toolbarEl = renderDurationToolbar(editorEl, () => callbacks.renderEditor());

    // オクターブ範囲シフトコントロール
    const ctrlEl = document.createElement('div');
    ctrlEl.className = 'oct-range-ctrl';

    const downBtn = document.createElement('button');
    downBtn.className = 'oct-range-btn';
    downBtn.innerHTML = '◀<span class="btn-guide">低</span>';
    downBtn.disabled = track.viewBase <= 1;
    downBtn.addEventListener('click', () => {
        track.viewBase--;
        if (!octaves.includes(track.activeOctave)) track.activeOctave = null;
        callbacks.renderEditor();
    });

    const rangeLabel = document.createElement('span');
    rangeLabel.className = 'oct-range-label';
    rangeLabel.textContent = `Oct ${track.viewBase} – ${track.viewBase + 2}`;

    const upBtn = document.createElement('button');
    upBtn.className = 'oct-range-btn';
    upBtn.innerHTML = '▶<span class="btn-guide">高</span>';
    upBtn.disabled = track.viewBase >= 5;
    upBtn.addEventListener('click', () => {
        track.viewBase++;
        if (!octaves.includes(track.activeOctave)) track.activeOctave = null;
        callbacks.renderEditor();
    });

    const octTitle = document.createElement('span');
    octTitle.className = 'ctrl-title';
    octTitle.textContent = '音程';
    ctrlEl.appendChild(octTitle);
    ctrlEl.appendChild(downBtn);
    ctrlEl.appendChild(rangeLabel);
    ctrlEl.appendChild(upBtn);
    const header = editorEl.querySelector('.editor-header');
    const modeTabs = toolbarEl.querySelector('.grid-mode-tabs');
    if (modeTabs) {
        header.appendChild(modeTabs);
    }
    header.appendChild(ctrlEl);

    const accordionEl = document.createElement('div');
    accordionEl.className = 'oct-accordion';

    // 高オクターブが上になるよう逆順
    [...octaves].reverse().forEach(o => {
        const isOpen   = o === track.activeOctave;
        const octStyle = OCT_COLOR[o];

        const sectionEl = document.createElement('div');
        sectionEl.className = 'oct-section' + (isOpen ? ' open' : '');

        // ヘッダー（クリックで開閉）
        const headerEl = document.createElement('button');
        headerEl.className = 'oct-section-header';
        headerEl.style.setProperty('--oct-color', octStyle.on);
        // ミニプレビュー: 12音×16ステップ のグリッド（現在小節分）
        const miniEl = document.createElement('div');
        miniEl.className = 'oct-section-mini';
        miniEl.style.gridTemplateColumns = columns;
        [...CHROMATIC].reverse().forEach(noteName => {
            const steps = track.stepsMap[`${noteName}${o}`];
            cells.forEach(cellInfo => {
                const val = steps[offset + cellInfo.localStep];
                const cell = document.createElement('span');
                cell.className = 'oct-mini-cell' + (val ? ' on' : '');
                miniEl.appendChild(cell);
            });
        });

        const labelEl = document.createElement('span');
        labelEl.className = 'oct-section-label';
        labelEl.textContent = octStyle.label;

        const arrowEl = document.createElement('span');
        arrowEl.className = 'oct-section-arrow';
        arrowEl.textContent = isOpen ? '▼' : '▶';

        headerEl.appendChild(labelEl);
        headerEl.appendChild(miniEl);
        headerEl.appendChild(arrowEl);
        headerEl.addEventListener('click', () => {
            track.activeOctave = (track.activeOctave === o) ? null : o;
            callbacks.renderEditor();
        });
        sectionEl.appendChild(headerEl);

        // ボディ（展開時のみ表示）
        const bodyEl = document.createElement('div');
        bodyEl.className = 'oct-section-body';

        // ピアノ鍵盤 + グリッドのラッパー
        const melodicEl = document.createElement('div');
        melodicEl.className = 'melodic-editor';

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
        cells.forEach(cellInfo => {
            const cell = document.createElement('div');
            cell.className = 'timeline-header-cell' + (cellInfo.slot === 0 ? ' beat' : '');
            cell.textContent = cellInfo.slot === 0 ? String(cellInfo.beat + 1) : '';
            if (cellInfo.slot === 0) cell.style.color = octStyle.on;
            hdrEl.appendChild(cell);
        });
        gridEl.appendChild(hdrEl);

        // 12音行（B→C = 高→低）
        [...CHROMATIC].reverse().forEach(noteName => {
            const isBlack  = BLACK_KEYS.has(noteName);
            const fullNote = `${noteName}${o}`;
            const steps    = track.stepsMap[fullNote];

            const keyEl = document.createElement('div');
            keyEl.className = 'piano-key ' + (isBlack ? 'black-key' : 'white-key');
            keyEl.textContent = noteName;
            keysEl.appendChild(keyEl);

            const rowEl = document.createElement('div');
            rowEl.className = 'timeline-row' + (isBlack ? ' black-key' : '');
            rowEl.style.setProperty('--timeline-columns', String(cells.length));
            rowEl.addEventListener('click', (event) => {
                const target = event.target;
                if (target.classList.contains('timeline-note')) return;
                const rect = rowEl.getBoundingClientRect();
                const x = Math.max(0, Math.min(rect.width - 1, event.clientX - rect.left));
                const column = Math.floor((x / rect.width) * cells.length);
                const cellInfo = cells[Math.max(0, Math.min(cells.length - 1, column))];
                const dur = getCurrentDuration();
                toggleStep(steps, offset + cellInfo.localStep, dur, maxIndex);
                callbacks.renderEditor();
            });

            for (let localStep = 0; localStep < STEPS_PER_MEASURE; localStep++) {
                const si = offset + localStep;
                const val = steps[si];
                if (isStepTie(val) || !isStepHead(val)) continue;

                const btn = document.createElement('div');
                btn.className = 'timeline-note melodic-note';
                const widthPct = ((DURATION_CELLS[val] || 1) / STEPS_PER_MEASURE) * 100;
                const leftPct = (localStep / STEPS_PER_MEASURE) * 100;
                btn.style.left = `calc(${leftPct}% + 1px)`;
                btn.style.width = `calc(${widthPct}% - 2px)`;

                btn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const dur = getCurrentDuration();
                    toggleStep(steps, si, dur, maxIndex);
                    callbacks.renderEditor();
                });
                rowEl.appendChild(btn);
            }
            gridEl.appendChild(rowEl);
        });

        gridScrollEl.appendChild(gridEl);
        melodicEl.appendChild(keysEl);
        melodicEl.appendChild(gridScrollEl);
        bodyEl.appendChild(melodicEl);
        sectionEl.appendChild(bodyEl);
        accordionEl.appendChild(sectionEl);
    });

    editorEl.appendChild(accordionEl);
}
