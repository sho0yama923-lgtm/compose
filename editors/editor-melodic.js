// editor-melodic.js — メロディエディタ（縦スクロール式ピアノロール）

import { appState, STEPS_PER_MEASURE, callbacks } from '../core/state.js';
import { CHROMATIC, BLACK_KEYS, DURATION_CELLS } from '../core/constants.js';
import { toggleStep, isStepHead, isStepTie } from '../core/duration-utils.js';
import { renderDurationToolbar, getCurrentDuration } from './duration-toolbar.js';
import {
    getEditorCells,
    getEditorGridColumns,
    getEditorGridLineGroup,
    getMeasureStart,
} from '../core/rhythm-grid.js';

const MELODY_OCTAVES = [7, 6, 5, 4, 3, 2, 1];

export function renderMelodicEditor(track, editorEl) {
    const measureIndex = appState.currentMeasure;
    const offset = getMeasureStart(measureIndex);
    const maxIndex = offset + STEPS_PER_MEASURE;
    const cells = getEditorCells();
    const columns = getEditorGridColumns();
    const majorGroup = getEditorGridLineGroup();

    renderDurationToolbar(editorEl, () => callbacks.renderEditor());

    const ctrlEl = document.createElement('div');
    ctrlEl.className = 'oct-range-ctrl';

    const downBtn = document.createElement('button');
    downBtn.className = 'oct-range-btn';
    downBtn.innerHTML = '◀<span class="btn-guide">低</span>';
    downBtn.disabled = track.viewBase <= 1;
    downBtn.addEventListener('click', () => {
        track.viewBase = Math.max(1, track.viewBase - 1);
        track.activeOctave = track.viewBase + 1;
        callbacks.renderEditor();
    });

    const rangeLabel = document.createElement('span');
    rangeLabel.className = 'oct-range-label';
    rangeLabel.textContent = `縦スクロール  Oct ${track.viewBase} – ${Math.min(track.viewBase + 2, 7)}`;

    const upBtn = document.createElement('button');
    upBtn.className = 'oct-range-btn';
    upBtn.innerHTML = '▶<span class="btn-guide">高</span>';
    upBtn.disabled = track.viewBase >= 5;
    upBtn.addEventListener('click', () => {
        track.viewBase = Math.min(5, track.viewBase + 1);
        track.activeOctave = track.viewBase + 1;
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
    header.appendChild(ctrlEl);

    const wrapEl = document.createElement('div');
    wrapEl.className = 'melodic-editor continuous-roll';

    const keysFrameEl = document.createElement('div');
    keysFrameEl.className = 'piano-keys piano-keys-frame';
    const keysEl = document.createElement('div');
    keysEl.className = 'piano-keys-inner';
    keysEl.appendChild(Object.assign(document.createElement('div'), { className: 'piano-key-spacer' }));

    const gridScrollEl = document.createElement('div');
    gridScrollEl.className = 'steps-grid-scroll melody-grid-scroll';
    const gridEl = document.createElement('div');
    gridEl.className = 'timeline-grid';
    gridEl.dataset.measureStart = String(offset);

    const hdrEl = document.createElement('div');
    hdrEl.className = 'timeline-header';
    hdrEl.style.gridTemplateColumns = columns;
    hdrEl.style.setProperty('--timeline-columns', String(cells.length));
    hdrEl.style.setProperty('--timeline-major', String(majorGroup));
    cells.forEach(cellInfo => {
        const cell = document.createElement('div');
        cell.className = 'timeline-header-cell' + (cellInfo.slot === 0 ? ' beat' : '');
        cell.textContent = cellInfo.slot === 0 ? String(cellInfo.beat + 1) : '';
        hdrEl.appendChild(cell);
    });
    gridEl.appendChild(hdrEl);

    MELODY_OCTAVES.forEach((octave) => {
        keysEl.appendChild(buildOctaveKeyDivider(octave));
        gridEl.appendChild(buildOctaveGridDivider(octave));

        [...CHROMATIC].reverse().forEach(noteName => {
            const isBlack = BLACK_KEYS.has(noteName);
            const fullNote = `${noteName}${octave}`;
            const steps = track.stepsMap[fullNote];

            const keyEl = document.createElement('div');
            keyEl.className = 'piano-key ' + (isBlack ? 'black-key' : 'white-key');
            keyEl.textContent = noteName;
            keysEl.appendChild(keyEl);

            const rowEl = document.createElement('div');
            rowEl.className = 'timeline-row' + (isBlack ? ' black-key' : '');
            rowEl.style.setProperty('--timeline-columns', String(cells.length));
            rowEl.style.setProperty('--timeline-major', String(majorGroup));
            rowEl.dataset.octave = String(octave);
            rowEl.addEventListener('click', (event) => {
                const target = event.target;
                if (target.classList.contains('timeline-note')) return;
                const rect = rowEl.getBoundingClientRect();
                const x = Math.max(0, Math.min(rect.width - 1, event.clientX - rect.left));
                const column = Math.floor((x / rect.width) * cells.length);
                const cellInfo = cells[Math.max(0, Math.min(cells.length - 1, column))];
                track.activeOctave = octave;
                toggleStep(steps, offset + cellInfo.localStep, getCurrentDuration(), maxIndex);
                callbacks.renderEditor();
            });

            for (let localStep = 0; localStep < STEPS_PER_MEASURE; localStep++) {
                const si = offset + localStep;
                const val = steps[si];
                if (isStepTie(val) || !isStepHead(val)) continue;

                const btn = document.createElement('div');
                btn.className = 'timeline-note melodic-note';
                btn.style.left = `${(localStep / STEPS_PER_MEASURE) * 100}%`;
                btn.style.width = `${((DURATION_CELLS[val] || 1) / STEPS_PER_MEASURE) * 100}%`;

                btn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    track.activeOctave = octave;
                    toggleStep(steps, si, getCurrentDuration(), maxIndex);
                    callbacks.renderEditor();
                });
                rowEl.appendChild(btn);
            }

            gridEl.appendChild(rowEl);
        });
    });

    gridEl.appendChild(createPlayheadBar(offset));
    keysFrameEl.appendChild(keysEl);
    gridScrollEl.appendChild(gridEl);
    wrapEl.appendChild(keysFrameEl);
    wrapEl.appendChild(gridScrollEl);
    editorEl.appendChild(wrapEl);

    bindContinuousRoll(track, keysEl, gridScrollEl);
    requestAnimationFrame(() => {
        if (typeof track.melodyScrollTop === 'number') {
            gridScrollEl.scrollTop = track.melodyScrollTop;
            syncKeyColumn(keysEl, track.melodyScrollTop);
            return;
        }
        const targetOctave = Math.min(track.viewBase + 2, 7);
        const target = gridEl.querySelector(`.timeline-octave-divider[data-octave="${targetOctave}"]`);
        if (!target) return;
        gridScrollEl.scrollTop = target.offsetTop;
        syncKeyColumn(keysEl, target.offsetTop);
    });
}

function buildOctaveKeyDivider(octave) {
    const divider = document.createElement('div');
    divider.className = 'piano-octave-divider';
    divider.textContent = `Oct ${octave}`;
    return divider;
}

function buildOctaveGridDivider(octave) {
    const divider = document.createElement('div');
    divider.className = 'timeline-octave-divider';
    divider.dataset.octave = String(octave);
    divider.textContent = `Oct ${octave}`;
    return divider;
}

function bindContinuousRoll(track, keysEl, gridScrollEl) {
    gridScrollEl.addEventListener('scroll', () => {
        track.melodyScrollTop = gridScrollEl.scrollTop;
        syncKeyColumn(keysEl, gridScrollEl.scrollTop);
    });
}

function syncKeyColumn(keysEl, scrollTop) {
    keysEl.style.transform = `translateY(${-scrollTop}px)`;
}

function createPlayheadBar(measureStart) {
    const barEl = document.createElement('div');
    barEl.className = 'playhead-bar';
    barEl.dataset.measureStart = String(measureStart);
    updatePlayheadBar(barEl, measureStart);
    return barEl;
}

function updatePlayheadBar(barEl, measureStart) {
    const step = appState.playheadStep;
    if (step === null || step < measureStart || step >= measureStart + STEPS_PER_MEASURE) {
        barEl.style.display = 'none';
        return;
    }
    const localStep = step - measureStart;
    barEl.style.display = 'block';
    barEl.style.left = `${(localStep / STEPS_PER_MEASURE) * 100}%`;
}
