import { STEPS_PER_BEAT, STEPS_PER_MEASURE } from '../../core/state.js';
import { DURATION_CELLS } from '../../core/constants.js';
import { isStepOn, isStepHead } from '../../core/duration.js';

export function buildPreviewRow(cells, offset, steps, kind, noteLabel = '') {
    const safeSteps = Array.isArray(steps) ? steps : [];
    const rowEl = document.createElement('div');
    rowEl.className = `preview-row-track ${kind}`;

    cells.forEach(({ localStep, beat }) => {
        const cell = document.createElement('span');
        const start = offset + localStep;
        cell.className = 'preview-cell'
            + (isStepOn(safeSteps[start]) ? ' on' : '')
            + (localStep % STEPS_PER_BEAT === 0 ? ' beat-start' : '')
            + ((localStep + 1) % STEPS_PER_BEAT === 0 ? ' beat-end' : '');
        cell.dataset.start = start;
        cell.title = noteLabel ? `${noteLabel} / ${beat + 1}拍` : `${beat + 1}拍`;
        rowEl.appendChild(cell);
    });

    for (let localStep = 0; localStep < STEPS_PER_MEASURE; localStep++) {
        const start = offset + localStep;
        const value = safeSteps[start];
        if (!isStepHead(value)) continue;

        const noteEl = document.createElement('span');
        noteEl.className = `preview-note-bar ${kind}`;
        noteEl.style.left = `${(localStep / STEPS_PER_MEASURE) * 100}%`;
        noteEl.style.width = `${((DURATION_CELLS[value] || 1) / STEPS_PER_MEASURE) * 100}%`;
        rowEl.appendChild(noteEl);
    }

    return rowEl;
}
