import {
    appState,
    STEPS_PER_MEASURE,
    callbacks,
    clearPendingDeleteNote,
    clearNoteDrag,
    consumeSuppressedNoteClick,
    isPendingDeleteNote,
    isNoteDragActive,
    setNoteDrag,
    setPendingDeleteNote,
    suppressNextNoteClick,
} from '../core/state.js';
import { DURATION_CELLS } from '../core/constants.js';
import { clearNote, placeNote, toggleStep, isStepHead, isStepTie } from '../core/duration.js';
import { renderDurationToolbar, getCurrentDuration } from './duration-toolbar.js';
import {
    getEditorCells,
    getEditorGridColumns,
    getEditorGridLineGroup,
    getGridModeLabel,
    getMeasureStart,
} from '../core/rhythm-grid.js';

const NOTE_DRAG_HOLD_MS = 380;

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
    header.remove();

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
        rowEl.dataset.rowLabel = row.label;
        rowEl.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('timeline-note')) return;
            if (isNoteDragActive()) return;
            clearPendingDeleteNote();
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
            const pendingDeleteId = `drum:${track.id}:${row.label}:${si}`;
            btn.style.left = `${leftPct}%`;
            btn.style.width = `${widthPct}%`;
            if (isPendingDeleteNote(pendingDeleteId)) btn.classList.add('is-delete-pending');
            if (isDrumDragOrigin(track.id, row.label, si)) btn.style.visibility = 'hidden';

            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                if (consumeSuppressedNoteClick()) return;
                if (isPendingDeleteNote(pendingDeleteId)) {
                    clearPendingDeleteNote();
                    const dur = getCurrentDuration();
                    toggleStep(row.steps, si, dur, maxIndex);
                    callbacks.renderEditor();
                    return;
                }
                setPendingDeleteNote(pendingDeleteId);
                callbacks.renderEditor();
            });
            btn.addEventListener('pointerdown', (event) => {
                startDrumNoteDrag({
                    event,
                    track,
                    row,
                    rowEl,
                    cells,
                    maxIndex,
                    sourceIndex: si,
                    duration: val,
                });
            });
            rowEl.appendChild(btn);
        }
        appendDrumDragPreview(rowEl, track.id, row.label);
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

function isDrumDragOrigin(trackId, rowLabel, sourceIndex) {
    const drag = appState.noteDrag;
    return !!drag
        && drag.type === 'drum'
        && drag.trackId === trackId
        && drag.rowLabel === rowLabel
        && drag.sourceIndex === sourceIndex;
}

function appendDrumDragPreview(rowEl, trackId, rowLabel) {
    const drag = appState.noteDrag;
    if (!drag || drag.type !== 'drum' || drag.trackId !== trackId || drag.rowLabel !== rowLabel) return;
    if (drag.targetIndex === null || drag.targetIndex === undefined) return;

    const previewEl = document.createElement('div');
    previewEl.className = 'timeline-note drum-note is-note-drag-preview';
    previewEl.style.left = `${((drag.targetIndex % STEPS_PER_MEASURE) / STEPS_PER_MEASURE) * 100}%`;
    previewEl.style.width = `${((DURATION_CELLS[drag.duration] || 1) / STEPS_PER_MEASURE) * 100}%`;
    rowEl.appendChild(previewEl);
}

function startDrumNoteDrag({
    event,
    track,
    row,
    rowEl,
    cells,
    maxIndex,
    sourceIndex,
    duration,
}) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    let holdTimer = null;
    let dragStarted = false;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;

    const clearListeners = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerEnd);
        window.removeEventListener('pointercancel', handlePointerEnd);
    };

    const clearHoldTimer = () => {
        if (!holdTimer) return;
        window.clearTimeout(holdTimer);
        holdTimer = null;
    };

    const updateTargetFromEvent = (moveEvent) => {
        const activeRowEl = document.querySelector(`.timeline-row[data-row-label="${CSS.escape(row.label)}"]`);
        if (!(activeRowEl instanceof HTMLElement)) return;
        const rect = activeRowEl.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width - 1, moveEvent.clientX - rect.left));
        const column = Math.floor((x / rect.width) * cells.length);
        const cellInfo = cells[Math.max(0, Math.min(cells.length - 1, column))];
        const nextTargetIndex = getMeasureStart(appState.currentMeasure) + cellInfo.localStep;
        const drag = appState.noteDrag;
        if (!drag || drag.type !== 'drum') return;
        if (drag.targetIndex === nextTargetIndex) return;
        setNoteDrag({ ...drag, targetIndex: nextTargetIndex });
        callbacks.renderEditor();
    };

    const handlePointerMove = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        if (!dragStarted) {
            const movedX = Math.abs(moveEvent.clientX - startX);
            const movedY = Math.abs(moveEvent.clientY - startY);
            if (Math.max(movedX, movedY) > 8) clearHoldTimer();
            return;
        }
        moveEvent.preventDefault();
        updateTargetFromEvent(moveEvent);
    };

    const handlePointerEnd = (endEvent) => {
        if (endEvent.pointerId !== pointerId) return;
        clearHoldTimer();
        clearListeners();
        if (!dragStarted) return;

        endEvent.preventDefault();
        suppressNextNoteClick();
        const drag = appState.noteDrag;
        clearNoteDrag();
        if (drag?.type === 'drum' && drag.targetIndex !== null && drag.targetIndex !== sourceIndex) {
            clearNote(row.steps, sourceIndex);
            placeNote(row.steps, drag.targetIndex, duration, maxIndex);
        }
        callbacks.renderEditor();
    };

    holdTimer = window.setTimeout(() => {
        dragStarted = true;
        clearPendingDeleteNote();
        setNoteDrag({
            type: 'drum',
            trackId: track.id,
            rowLabel: row.label,
            sourceIndex,
            targetIndex: sourceIndex,
            duration,
        });
        callbacks.renderEditor();
    }, NOTE_DRAG_HOLD_MS);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
}
