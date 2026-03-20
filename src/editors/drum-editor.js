import {
    appState,
    STEPS_PER_MEASURE,
    totalSteps,
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
import { DRUM_ROW_CANDIDATES, createDrumRow } from '../features/tracks/instrument-map.js';
import { previewDrumSample } from '../features/bridges/audio-bridge.js';
import { warmupPlaybackInstrument } from '../features/playback/scheduler.js';

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
        keyEl.setAttribute('role', 'button');
        keyEl.tabIndex = 0;
        keyEl.setAttribute('aria-label', `${row.label} を試聴`);
        keyEl.title = `${row.label} を試聴`;
        const previewRowSample = () => {
            if (!row.sampleId) return false;
            return previewDrumSample({
                sampleInstrumentId: row.sampleInstrumentId || 'drums_default',
                sampleId: row.sampleId,
                trackId: track.id,
            });
        };
        keyEl.addEventListener('click', (event) => {
            event.preventDefault();
            void previewRowSample();
        });
        keyEl.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            void previewRowSample();
        });
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

        for (let localStep = 0; localStep < STEPS_PER_MEASURE; localStep += 1) {
            const si = offset + localStep;
            const val = row.steps[si];
            if (isStepTie(val) || !isStepHead(val)) continue;

            const btn = document.createElement('div');
            btn.className = 'timeline-note drum-note';
            const widthPct = ((DURATION_CELLS[val] || 1) / STEPS_PER_MEASURE) * 100;
            const leftPct = (localStep / STEPS_PER_MEASURE) * 100;
            const pendingDeleteId = `drum:${track.id}:${row.label}:${si}`;
            btn.style.left = `calc(${leftPct}% + 1px)`;
            btn.style.width = `calc(${widthPct}% - 3px)`;
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
    editorEl.appendChild(buildDrumAddPanel(track));
    if (appState.drumAddTrackId === track.id) {
        editorEl.appendChild(buildDrumAddSheet(track));
    }
}

function buildDrumAddPanel(track) {
    const panelEl = document.createElement('section');
    panelEl.className = 'drum-add-panel';

    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'drum-add-panel-trigger';
    triggerBtn.type = 'button';
    triggerBtn.textContent = '音源を追加';
    triggerBtn.addEventListener('click', () => {
        appState.drumAddTrackId = appState.drumAddTrackId === track.id ? null : track.id;
        callbacks.renderEditor();
    });
    panelEl.appendChild(triggerBtn);
    return panelEl;
}

function buildDrumAddSheet(track) {
    const overlayEl = document.createElement('div');
    overlayEl.className = 'drum-add-sheet-overlay';
    overlayEl.addEventListener('click', (event) => {
        if (event.target !== overlayEl) return;
        appState.drumAddTrackId = null;
        callbacks.renderEditor();
    });

    const sheetEl = document.createElement('section');
    sheetEl.className = 'drum-add-sheet';
    overlayEl.appendChild(sheetEl);

    const handleEl = document.createElement('div');
    handleEl.className = 'drum-add-sheet-handle';
    sheetEl.appendChild(handleEl);

    const titleEl = document.createElement('div');
    titleEl.className = 'drum-add-sheet-title';
    titleEl.textContent = '音源を追加';
    sheetEl.appendChild(titleEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'drum-add-sheet-body';
    sheetEl.appendChild(bodyEl);

    const candidateGroups = groupDrumRowCandidates(track);
    warmupDrumPreviewCandidates(track, candidateGroups);
    if (candidateGroups.length === 0) {
        const emptyEl = document.createElement('p');
        emptyEl.className = 'drum-add-panel-empty';
        emptyEl.textContent = '追加できる音源はありません。';
        bodyEl.appendChild(emptyEl);
    } else {
        const detailsEls = [];
        candidateGroups.forEach(([groupLabel, candidates]) => {
            if (candidates.length === 0) return;

            const detailsEl = document.createElement('details');
            detailsEl.className = 'drum-add-group';
            detailsEls.push(detailsEl);

            const summaryEl = document.createElement('summary');
            summaryEl.className = 'drum-add-group-summary';
            summaryEl.textContent = groupLabel;
            detailsEl.appendChild(summaryEl);

            const listEl = document.createElement('div');
            listEl.className = 'drum-add-group-list';
            candidates.forEach((candidate) => {
                listEl.appendChild(buildDrumAddCandidateRow(track, candidate));
            });
            detailsEl.appendChild(listEl);
            bodyEl.appendChild(detailsEl);
        });

        detailsEls.forEach((detailsEl) => {
            detailsEl.addEventListener('toggle', () => {
                if (!detailsEl.open) return;
                detailsEls.forEach((otherEl) => {
                    if (otherEl === detailsEl) return;
                    otherEl.open = false;
                });
            });
        });
    }

    const actionsEl = document.createElement('div');
    actionsEl.className = 'drum-add-sheet-actions';
    sheetEl.appendChild(actionsEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'drum-add-sheet-close';
    closeBtn.type = 'button';
    closeBtn.textContent = '閉じる';
    closeBtn.addEventListener('click', () => {
        appState.drumAddTrackId = null;
        callbacks.renderEditor();
    });
    actionsEl.appendChild(closeBtn);

    return overlayEl;
}

function warmupDrumPreviewCandidates(track, candidateGroups) {
    const playbackInstrumentIds = Array.from(
        new Set(
            candidateGroups
                .flatMap(([, candidates]) => candidates)
                .map((candidate) => candidate.sampleInstrumentId)
                .filter(Boolean)
        )
    );

    playbackInstrumentIds.forEach((playbackInstrumentId) => {
        void warmupPlaybackInstrument(track, playbackInstrumentId);
    });
}

function buildDrumAddCandidateRow(track, candidate) {
    const rowEl = document.createElement('div');
    rowEl.className = 'drum-add-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'drum-add-row-label';
    labelEl.textContent = candidate.label;
    rowEl.appendChild(labelEl);

    const previewBtn = document.createElement('button');
    previewBtn.className = 'drum-add-row-preview';
    previewBtn.type = 'button';
    previewBtn.textContent = '▶︎';
    previewBtn.setAttribute('aria-label', `${candidate.label} を再生`);
    previewBtn.title = '再生';
    previewBtn.addEventListener('click', async () => {
        previewBtn.disabled = true;
        try {
            await previewDrumSample({
                sampleInstrumentId: candidate.sampleInstrumentId,
                sampleId: candidate.sampleId,
                trackId: track.id,
            });
        } finally {
            previewBtn.disabled = false;
        }
    });
    rowEl.appendChild(previewBtn);

    const addBtn = document.createElement('button');
    addBtn.className = 'drum-add-row-add';
    addBtn.type = 'button';
    addBtn.textContent = '→';
    addBtn.setAttribute('aria-label', `${candidate.label} を追加`);
    addBtn.title = '追加';
    addBtn.addEventListener('click', () => {
        track.rows.push(createDrumRow(candidate.sampleInstrumentId, candidate.sampleId, {
            label: candidate.label,
            steps: Array(totalSteps()).fill(null),
        }));
        callbacks.renderEditor();
    });
    rowEl.appendChild(addBtn);

    return rowEl;
}

function groupDrumRowCandidates(track) {
    const existingRowIds = new Set(
        (track.rows || []).map((row) => `${row.sampleInstrumentId || 'drums_default'}:${row.sampleId || ''}`)
    );
    const grouped = new Map();

    DRUM_ROW_CANDIDATES.forEach((candidate) => {
        if (existingRowIds.has(candidate.id)) return;
        if (!grouped.has(candidate.groupLabel)) {
            grouped.set(candidate.groupLabel, []);
        }
        grouped.get(candidate.groupLabel).push(candidate);
    });

    return Array.from(grouped.entries());
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
    previewEl.style.left = `calc(${((drag.targetIndex % STEPS_PER_MEASURE) / STEPS_PER_MEASURE) * 100}% + 1px)`;
    previewEl.style.width = `calc(${((DURATION_CELLS[drag.duration] || 1) / STEPS_PER_MEASURE) * 100}% - 3px)`;
    rowEl.appendChild(previewEl);
}

function startDrumNoteDrag({
    event,
    track,
    row,
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
