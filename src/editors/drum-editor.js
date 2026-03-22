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
import {
    DRUM_ROW_CANDIDATES,
    DRUM_SAMPLE_INSTRUMENTS,
    createDrumRow,
    getDrumSampleDefinition,
} from '../features/tracks/instrument-map.js';
import { previewDrumSample, warmupInstruments } from '../features/bridges/audio-bridge.js';
import { beginNoteDragInteraction } from './note-drag-session.js';

const NOTE_DRAG_HOLD_MS = 380;
const DRUM_ROW_DELETE_HOLD_MS = 420;
const DRUM_KEY_WIDTH_PX = 28;
const DRUM_GROUP_SORT_ORDER = Object.fromEntries(
    DRUM_SAMPLE_INSTRUMENTS.map((instrument, index) => [instrument.id, index])
);
const DRUM_SAMPLE_SORT_ORDER = {
    kick: 0,
    snare: 1,
    hihat: 2,
    tom1: 3,
    tom2: 4,
    tom3: 5,
};
const DRUM_GROUP_LABELS = Object.fromEntries(
    DRUM_SAMPLE_INSTRUMENTS.map((instrument) => [instrument.id, instrument.label])
);

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
    wrapEl.style.setProperty('--drum-key-width', `${DRUM_KEY_WIDTH_PX}px`);

    const gridScrollEl = document.createElement('div');
    gridScrollEl.className = 'steps-grid-scroll drum-roll-scroll';
    const gridEl = document.createElement('div');
    gridEl.className = 'timeline-grid drum-roll-content';
    gridEl.dataset.measureStart = String(offset);
    gridEl.style.setProperty('--drum-key-width', `${DRUM_KEY_WIDTH_PX}px`);

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

    const headerLaneEl = document.createElement('div');
    headerLaneEl.className = 'drum-grid-header-row';
    headerLaneEl.style.display = 'grid';
    headerLaneEl.style.gridTemplateColumns = `${DRUM_KEY_WIDTH_PX}px minmax(0, 1fr)`;
    headerLaneEl.style.width = '100%';

    const keySpacerEl = document.createElement('div');
    keySpacerEl.className = 'piano-key-spacer';
    keySpacerEl.style.width = `${DRUM_KEY_WIDTH_PX}px`;
    keySpacerEl.style.minWidth = `${DRUM_KEY_WIDTH_PX}px`;
    headerLaneEl.append(keySpacerEl, hdrEl);
    gridEl.appendChild(headerLaneEl);

    let previousGroupLabel = null;
    getSortedDrumRows(track.rows).forEach((row) => {
        const rowMeta = getDrumRowDisplayMeta(row);
        if (rowMeta.groupLabel !== previousGroupLabel) {
            gridEl.appendChild(buildDrumKitBandRow(rowMeta.groupLabel));
            previousGroupLabel = rowMeta.groupLabel;
        }

        const keyEl = document.createElement('div');
        keyEl.className = 'piano-key white-key drum-key';
        keyEl.replaceChildren(...buildDrumKeyLabel(rowMeta.baseLabel));
        keyEl.style.width = `${DRUM_KEY_WIDTH_PX}px`;
        keyEl.style.minWidth = `${DRUM_KEY_WIDTH_PX}px`;
        keyEl.setAttribute('role', 'button');
        keyEl.tabIndex = 0;
        keyEl.setAttribute('aria-label', `${rowMeta.baseLabel} を試聴`);
        keyEl.title = `${rowMeta.baseLabel} を試聴`;
        let deleteHoldTimer = null;
        let deleteHoldTriggered = false;
        const previewRowSample = () => {
            if (!row.sampleId) return false;
            return previewDrumSample({
                sampleInstrumentId: row.sampleInstrumentId || 'drums_default',
                sampleId: row.sampleId,
                trackId: track.id,
            });
        };
        const clearDeleteHoldTimer = () => {
            if (!deleteHoldTimer) return;
            window.clearTimeout(deleteHoldTimer);
            deleteHoldTimer = null;
        };
        keyEl.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            deleteHoldTriggered = false;
            clearDeleteHoldTimer();
            deleteHoldTimer = window.setTimeout(() => {
                deleteHoldTriggered = true;
                openDrumRowDeleteDialog(track, row, rowMeta.baseLabel);
            }, DRUM_ROW_DELETE_HOLD_MS);
        });
        keyEl.addEventListener('pointerup', clearDeleteHoldTimer);
        keyEl.addEventListener('pointerleave', clearDeleteHoldTimer);
        keyEl.addEventListener('pointercancel', clearDeleteHoldTimer);
        keyEl.addEventListener('click', (event) => {
            event.preventDefault();
            if (deleteHoldTriggered) {
                deleteHoldTriggered = false;
                return;
            }
            void previewRowSample();
        });
        keyEl.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            void previewRowSample();
        });

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
                    rowEl,
                    sourceEl: btn,
                    cells,
                    maxIndex,
                    sourceIndex: si,
                    duration: val,
                });
            });
            rowEl.appendChild(btn);
        }
        appendDrumDragPreview(rowEl, track.id, row.label);

        const laneEl = document.createElement('div');
        laneEl.className = 'drum-lane';
        laneEl.style.display = 'grid';
        laneEl.style.gridTemplateColumns = `${DRUM_KEY_WIDTH_PX}px minmax(0, 1fr)`;
        laneEl.style.width = '100%';
        laneEl.append(keyEl, rowEl);
        gridEl.appendChild(laneEl);
    });

    gridEl.appendChild(createPlayheadBar(offset));
    gridScrollEl.appendChild(gridEl);
    wrapEl.appendChild(gridScrollEl);
    editorEl.appendChild(wrapEl);
    editorEl.appendChild(buildDrumAddPanel(track));
    if (appState.drumAddTrackId === track.id) {
        editorEl.appendChild(buildDrumAddSheet(track));
    }

    bindDrumScroll(track, gridScrollEl);
    requestAnimationFrame(() => {
        const maxScroll = Math.max(0, gridScrollEl.scrollHeight - gridScrollEl.clientHeight);
        gridScrollEl.scrollTop = Math.max(0, Math.min(track.drumScrollTop || 0, maxScroll));
    });
}

function buildDrumKeyLabel(label) {
    const span = document.createElement('span');
    span.className = 'drum-key-line';
    span.textContent = label;
    return [span];
}

function buildDrumKitBandRow(groupLabel) {
    const laneEl = document.createElement('div');
    laneEl.className = 'drum-lane drum-kit-band-lane';
    laneEl.style.display = 'grid';
    laneEl.style.gridTemplateColumns = `${DRUM_KEY_WIDTH_PX}px minmax(0, 1fr)`;
    laneEl.style.width = '100%';

    const spacerEl = document.createElement('div');
    spacerEl.className = 'drum-kit-band-spacer';
    spacerEl.setAttribute('aria-hidden', 'true');

    const bandEl = document.createElement('div');
    bandEl.className = 'drum-kit-band';
    bandEl.textContent = groupLabel;

    laneEl.append(spacerEl, bandEl);
    return laneEl;
}

function getDrumRowDisplayMeta(row) {
    const sampleLabel = getDrumSampleDefinition(row.sampleId)?.label;
    const groupLabel = DRUM_GROUP_LABELS[row.sampleInstrumentId || 'drums_default'] || 'DEFAULT';
    const fallbackLabel = String(row.label || '').trim();
    const baseLabel = sampleLabel || fallbackLabel.replace(/\s*\(.+\)\s*$/, '') || 'Row';
    return { baseLabel, groupLabel };
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

function bindDrumScroll(track, scrollEl) {
    scrollEl.addEventListener('scroll', () => {
        track.drumScrollTop = scrollEl.scrollTop;
    }, { passive: true });
}

function openDrumRowDeleteDialog(track, row, label) {
    document.querySelector('.drum-row-delete-overlay')?.remove();
    window.getSelection?.()?.removeAllRanges();

    const overlayEl = document.createElement('div');
    overlayEl.className = 'drum-row-delete-overlay';
    overlayEl.addEventListener('click', (event) => {
        if (event.target === overlayEl) overlayEl.remove();
    });

    const dialogEl = document.createElement('div');
    dialogEl.className = 'drum-row-delete-dialog';

    const messageEl = document.createElement('p');
    messageEl.className = 'drum-row-delete-message';
    messageEl.textContent = 'この音源を削除しますか？';

    const subEl = document.createElement('p');
    subEl.className = 'drum-row-delete-sub';
    subEl.textContent = '＊全ての小節から削除されます';

    const actionsEl = document.createElement('div');
    actionsEl.className = 'drum-row-delete-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'drum-row-delete-btn';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'キャンセル';
    cancelBtn.addEventListener('click', () => overlayEl.remove());

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'drum-row-delete-btn danger';
    confirmBtn.type = 'button';
    confirmBtn.textContent = 'はい';
    confirmBtn.addEventListener('click', () => {
        const rowIndex = track.rows.indexOf(row);
        if (rowIndex >= 0) {
            track.rows.splice(rowIndex, 1);
        }
        overlayEl.remove();
        callbacks.renderEditor();
    });

    actionsEl.append(cancelBtn, confirmBtn);
    dialogEl.append(messageEl, subEl, actionsEl);
    overlayEl.appendChild(dialogEl);
    document.body.appendChild(overlayEl);
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
        candidateGroups.forEach(([groupLabel, candidates]) => {
            if (candidates.length === 0) return;

            const detailsEl = document.createElement('details');
            detailsEl.className = 'drum-add-group';
            detailsEl.open = isDrumAddGroupOpen(track.id, groupLabel);

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
            detailsEl.addEventListener('toggle', () => {
                setDrumAddGroupOpen(track.id, groupLabel, detailsEl.open);
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

    void warmupInstruments(track, playbackInstrumentIds);
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
        setDrumAddGroupOpen(track.id, candidate.groupLabel, true);
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

function getSortedDrumRows(rows = []) {
    return [...rows].sort((left, right) => {
        const leftGroup = DRUM_GROUP_SORT_ORDER[left.sampleInstrumentId || 'drums_default'] ?? Number.MAX_SAFE_INTEGER;
        const rightGroup = DRUM_GROUP_SORT_ORDER[right.sampleInstrumentId || 'drums_default'] ?? Number.MAX_SAFE_INTEGER;
        if (leftGroup !== rightGroup) return leftGroup - rightGroup;

        const leftSample = DRUM_SAMPLE_SORT_ORDER[left.sampleId || ''] ?? Number.MAX_SAFE_INTEGER;
        const rightSample = DRUM_SAMPLE_SORT_ORDER[right.sampleId || ''] ?? Number.MAX_SAFE_INTEGER;
        if (leftSample !== rightSample) return leftSample - rightSample;

        return String(left.label || '').localeCompare(String(right.label || ''), 'ja');
    });
}

function isDrumAddGroupOpen(trackId, groupLabel) {
    const state = appState.drumAddOpenGroups?.[trackId];
    if (!state) return false;
    return state[groupLabel] === true;
}

function setDrumAddGroupOpen(trackId, groupLabel, isOpen) {
    if (!appState.drumAddOpenGroups) {
        appState.drumAddOpenGroups = {};
    }
    const nextTrackState = {
        ...(appState.drumAddOpenGroups[trackId] || {}),
        [groupLabel]: isOpen,
    };
    appState.drumAddOpenGroups = {
        ...appState.drumAddOpenGroups,
        [trackId]: nextTrackState,
    };
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
    barEl.style.left = `calc(var(--drum-key-width, ${DRUM_KEY_WIDTH_PX}px) + ${(localStep / STEPS_PER_MEASURE).toFixed(6)} * (100% - var(--drum-key-width, ${DRUM_KEY_WIDTH_PX}px)))`;
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
    rowEl,
    sourceEl,
    cells,
    maxIndex,
    sourceIndex,
    duration,
}) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    let holdTimer = null;
    let dragStarted = false;
    let releaseInteraction = null;
    let previewEl = null;
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

    const syncPreview = (targetIndex) => {
        const nextTargetIndex = targetIndex ?? sourceIndex;
        if (!(rowEl instanceof HTMLElement)) return;
        if (!previewEl) {
            previewEl = document.createElement('div');
            previewEl.className = 'timeline-note drum-note is-note-drag-preview';
            rowEl.appendChild(previewEl);
        }
        previewEl.style.left = `calc(${((nextTargetIndex % STEPS_PER_MEASURE) / STEPS_PER_MEASURE) * 100}% + 1px)`;
        previewEl.style.width = `calc(${((DURATION_CELLS[duration] || 1) / STEPS_PER_MEASURE) * 100}% - 3px)`;
    };

    const clearPreview = () => {
        previewEl?.remove();
        previewEl = null;
        if (sourceEl instanceof HTMLElement) {
            sourceEl.style.visibility = '';
        }
    };

    const updateTargetFromEvent = (moveEvent) => {
        if (!(rowEl instanceof HTMLElement)) return;
        const rect = rowEl.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width - 1, moveEvent.clientX - rect.left));
        const column = Math.floor((x / rect.width) * cells.length);
        const cellInfo = cells[Math.max(0, Math.min(cells.length - 1, column))];
        const nextTargetIndex = getMeasureStart(appState.currentMeasure) + cellInfo.localStep;
        const drag = appState.noteDrag;
        if (!drag || drag.type !== 'drum') return;
        if (drag.targetIndex === nextTargetIndex) return;
        setNoteDrag({ ...drag, targetIndex: nextTargetIndex });
        syncPreview(nextTargetIndex);
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
        releaseInteraction?.();
        releaseInteraction = null;
        clearPreview();
        if (!dragStarted) return;

        endEvent.preventDefault();
        suppressNextNoteClick();
        const drag = appState.noteDrag;
        clearNoteDrag();
        if (drag?.type === 'drum' && drag.targetIndex !== null && drag.targetIndex !== sourceIndex) {
            const nextSteps = [...row.steps];
            clearNote(nextSteps, sourceIndex);
            if (placeNote(nextSteps, drag.targetIndex, duration, maxIndex)) {
                row.steps = nextSteps;
            }
        }
        callbacks.renderEditor();
    };

    holdTimer = window.setTimeout(() => {
        dragStarted = true;
        releaseInteraction = beginNoteDragInteraction({ sourceEl, pointerId });
        clearPendingDeleteNote();
        setNoteDrag({
            type: 'drum',
            trackId: track.id,
            rowLabel: row.label,
            sourceIndex,
            targetIndex: sourceIndex,
            duration,
        });
        if (sourceEl instanceof HTMLElement) {
            sourceEl.style.visibility = 'hidden';
        }
        syncPreview(sourceIndex);
    }, NOTE_DRAG_HOLD_MS);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
}
