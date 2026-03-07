import { appState, STEPS_PER_MEASURE, callbacks } from '../core/state.js';
import { DURATION_CELLS } from '../core/constants.js';
import { toggleStep, isStepHead, isStepTie } from '../core/duration.js';
import { renderDurationToolbar, getCurrentDuration } from './duration-toolbar.js';
import {
    getEditorCells,
    getEditorGridColumns,
    getEditorGridLineGroup,
    getGridModeLabel,
    getMeasureStart,
} from '../core/rhythm-grid.js';

export function renderDrumEditor(track, editorEl) {
    const measureIndex = appState.currentMeasure;
    const offset = getMeasureStart(measureIndex);
    const maxIndex = offset + STEPS_PER_MEASURE;
    const cells = getEditorCells();
    const columns = getEditorGridColumns();
    const majorGroup = getEditorGridLineGroup();

    const header = editorEl.querySelector('.editor-header');
    const topbarEl = document.createElement('section');
    topbarEl.className = 'melody-topbar';
    editorEl.insertBefore(topbarEl, header);
    topbarEl.appendChild(header);

    const toolbarEl = renderDurationToolbar(topbarEl, () => callbacks.renderEditor());
    toolbarEl.classList.add('melody-duration-toolbar');

    if (!appState.drumHintDismissed) {
        topbarEl.appendChild(buildEditorHint(
            'リズムを作る',
            '行をタップして音を置きます。黒いブロックの切れ目で拍を確認できます。',
            () => {
                appState.drumHintDismissed = true;
                callbacks.renderEditor();
            }
        ));
    }

    header.classList.add('melody-editor-header');
    header.style.removeProperty('justify-content');
    header.replaceChildren(buildCompactHeaderActions([
        `${measureIndex + 1}小節/${appState.numMeasures}小節`,
        `Rows ${track.rows.length}`,
    ], header.querySelector('.measure-actions')));

    const wrapEl = document.createElement('div');
    wrapEl.className = 'melodic-editor drum-editor';

    const keysEl = document.createElement('div');
    keysEl.className = 'piano-keys';
    keysEl.appendChild(Object.assign(document.createElement('div'), { className: 'piano-key-spacer' }));

    const gridScrollEl = document.createElement('div');
    gridScrollEl.className = 'steps-grid-scroll';
    const gridEl = document.createElement('div');
    gridEl.className = 'timeline-grid';
    gridEl.dataset.measureStart = String(offset);

    const hdrEl = document.createElement('div');
    hdrEl.className = 'timeline-header';
    hdrEl.style.gridTemplateColumns = columns;
    hdrEl.style.setProperty('--timeline-columns', String(cells.length));
    hdrEl.style.setProperty('--timeline-major', String(majorGroup));
    const modeLabel = getGridModeLabel();
    cells.forEach((cellInfo) => {
        const cell = document.createElement('div');
        cell.className = 'timeline-header-cell' + (cellInfo.slot === 0 ? ' beat' : '');
        cell.textContent = cellInfo.slot === 0 ? `${cellInfo.beat + 1}` : '';
        cell.title = `${modeLabel} ${cellInfo.beat + 1}`;
        hdrEl.appendChild(cell);
    });
    gridEl.appendChild(hdrEl);

    track.rows.forEach((row) => {
        const keyEl = document.createElement('div');
        keyEl.className = 'piano-key white-key drum-key';
        keyEl.textContent = row.label;
        keysEl.appendChild(keyEl);

        const rowEl = document.createElement('div');
        rowEl.className = 'timeline-row';
        rowEl.style.setProperty('--timeline-columns', String(cells.length));
        rowEl.style.setProperty('--timeline-major', String(majorGroup));
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
            btn.style.left = `${leftPct}%`;
            btn.style.width = `${widthPct}%`;

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

    gridEl.appendChild(createPlayheadBar(offset));
    gridScrollEl.appendChild(gridEl);
    wrapEl.appendChild(keysEl);
    wrapEl.appendChild(gridScrollEl);
    editorEl.appendChild(wrapEl);
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

function buildEditorHint(title, body, onDismiss) {
    const el = document.createElement('div');
    el.className = 'editor-help';
    if (typeof onDismiss === 'function') {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'editor-help-close';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', '案内を閉じる');
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', onDismiss);
        el.appendChild(closeBtn);
    }

    const titleEl = document.createElement('strong');
    titleEl.textContent = title;

    const bodyEl = document.createElement('span');
    bodyEl.textContent = body;

    el.append(titleEl, bodyEl);
    return el;
}

function buildCompactHeaderActions(chips, measureActions) {
    const wrap = document.createElement('div');
    wrap.className = 'melody-header-actions';
    chips.forEach((text) => {
        const chip = document.createElement('span');
        chip.className = 'melody-header-chip';
        chip.textContent = text;
        wrap.appendChild(chip);
    });
    if (measureActions) wrap.appendChild(measureActions);
    return wrap;
}
