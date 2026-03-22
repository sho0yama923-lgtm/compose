import {
    appState,
    totalSteps,
    callbacks,
    STEPS_PER_MEASURE,
    clearPendingDeleteNote,
    clearNoteDrag,
    consumeSuppressedNoteClick,
    isPendingDeleteNote,
    isNoteDragActive,
    setNoteDrag,
    setPendingDeleteNote,
    suppressNextNoteClick,
} from '../../core/state.js';
import { DURATION_CELLS, ROOT_COLORS } from '../../core/constants.js';
import { clearNote, placeNote, toggleStep, isStepHead, isStepTie } from '../../core/duration.js';
import { getCurrentDuration } from '../duration-toolbar.js';
import { createPlayheadBar } from './chord-shared.js';
import { beginNoteDragInteraction } from '../note-drag-session.js';

const NOTE_DRAG_HOLD_MS = 380;

export function buildTimingSection(track, offset, mEnd, cells, majorGroup, options = {}) {
    const { embedded = false } = options;
    const sectionEl = document.createElement('section');
    sectionEl.className = embedded
        ? 'chord-sequencer-timing'
        : 'chord-section chord-timing-section';

    if (!embedded) {
        const titleEl = document.createElement('div');
        titleEl.className = 'chord-section-title';
        titleEl.textContent = '鳴らすタイミング';
        sectionEl.appendChild(titleEl);

        const descEl = document.createElement('div');
        descEl.className = 'chord-section-desc';
        descEl.textContent = 'タイミング: そのコードをどこで鳴らすか';
        sectionEl.appendChild(descEl);
    }

    const soundCells = document.createElement('div');
    soundCells.className = 'chord-steps-cells chord-timing-grid';
    soundCells.dataset.measureStart = String(offset);
    soundCells.style.setProperty('--timeline-columns', String(cells.length));
    soundCells.style.setProperty('--timeline-major', String(majorGroup));
    soundCells.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('timeline-note')) return;
        if (isNoteDragActive()) return;
        clearPendingDeleteNote();
        const rect = soundCells.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width - 1, event.clientX - rect.left));
        const column = Math.floor((x / rect.width) * cells.length);
        const cellInfo = cells[Math.max(0, Math.min(cells.length - 1, column))];
        toggleStep(track.soundSteps, offset + cellInfo.localStep, getCurrentDuration(), mEnd);
        callbacks.renderEditor();
    });

    const inheritedChords = Array(totalSteps()).fill(null);
    let inherited = null;
    for (let i = 0; i < inheritedChords.length; i++) {
        if (track.chordMap[i]) inherited = track.chordMap[i];
        inheritedChords[i] = inherited;
    }

    for (let localStep = 0; localStep < STEPS_PER_MEASURE; localStep++) {
        const si = offset + localStep;
        const val = track.soundSteps[si];
        if (isStepTie(val) || !isStepHead(val)) continue;
        const btn = document.createElement('div');
        btn.className = 'timeline-note chord-note';
        const pendingDeleteId = `chord:${track.id}:${si}`;
        btn.style.left = `calc(${(localStep / STEPS_PER_MEASURE) * 100}% + 1px)`;
        btn.style.width = `calc(${((DURATION_CELLS[val] || 1) / STEPS_PER_MEASURE) * 100}% - 3px)`;
        if (inheritedChords[si]) {
            const color = ROOT_COLORS[inheritedChords[si].root] ?? '#111';
            btn.style.background = color;
            btn.style.borderColor = color;
        }
        if (isPendingDeleteNote(pendingDeleteId)) btn.classList.add('is-delete-pending');
        if (isChordDragOrigin(track.id, si)) btn.style.visibility = 'hidden';
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (consumeSuppressedNoteClick()) return;
            if (isPendingDeleteNote(pendingDeleteId)) {
                clearPendingDeleteNote();
                toggleStep(track.soundSteps, si, getCurrentDuration(), mEnd);
                callbacks.renderEditor();
                return;
            }
            setPendingDeleteNote(pendingDeleteId);
            callbacks.renderEditor();
        });
        btn.addEventListener('pointerdown', (event) => {
            startChordNoteDrag({
                event,
                track,
                soundCells,
                sourceEl: btn,
                cells,
                mEnd,
                sourceIndex: si,
                duration: val,
            });
        });
        soundCells.appendChild(btn);
    }
    appendChordDragPreview(soundCells, track.id);
    soundCells.appendChild(createPlayheadBar(offset));
    sectionEl.appendChild(soundCells);
    return sectionEl;
}

function appendChordDragPreview(soundCells, trackId) {
    const drag = appState.noteDrag;
    if (!drag || drag.type !== 'chord' || drag.trackId !== trackId) return;
    if (drag.targetIndex === null || drag.targetIndex === undefined) return;

    const previewEl = document.createElement('div');
    previewEl.className = 'timeline-note chord-note is-note-drag-preview';
    previewEl.style.left = `calc(${((drag.targetIndex % STEPS_PER_MEASURE) / STEPS_PER_MEASURE) * 100}% + 1px)`;
    previewEl.style.width = `calc(${((DURATION_CELLS[drag.duration] || 1) / STEPS_PER_MEASURE) * 100}% - 3px)`;
    const color = drag.color ?? '#111';
    previewEl.style.background = color;
    previewEl.style.borderColor = color;
    soundCells.appendChild(previewEl);
}

function isChordDragOrigin(trackId, sourceIndex) {
    const drag = appState.noteDrag;
    return !!drag
        && drag.type === 'chord'
        && drag.trackId === trackId
        && drag.sourceIndex === sourceIndex;
}

function startChordNoteDrag({ event, track, soundCells, sourceEl, cells, mEnd, sourceIndex, duration }) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    let holdTimer = null;
    let dragStarted = false;
    let releaseInteraction = null;
    let previewEl = null;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    const inheritedChord = getInheritedChordAtStep(track, sourceIndex);
    const dragColor = inheritedChord ? (ROOT_COLORS[inheritedChord.root] ?? '#111') : '#111';

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
        if (!(soundCells instanceof HTMLElement)) return;
        if (!previewEl) {
            previewEl = document.createElement('div');
            previewEl.className = 'timeline-note chord-note is-note-drag-preview';
            const color = dragColor ?? '#111';
            previewEl.style.background = color;
            previewEl.style.borderColor = color;
            soundCells.appendChild(previewEl);
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
        const activeGridEl = document.querySelector('.chord-timing-grid');
        if (!(activeGridEl instanceof HTMLElement)) return;
        const rect = activeGridEl.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width - 1, moveEvent.clientX - rect.left));
        const column = Math.floor((x / rect.width) * cells.length);
        const cellInfo = cells[Math.max(0, Math.min(cells.length - 1, column))];
        const targetIndex = Number(activeGridEl.dataset.measureStart || 0) + cellInfo.localStep;
        const drag = appState.noteDrag;
        if (!drag || drag.type !== 'chord') return;
        if (drag.targetIndex === targetIndex) return;
        setNoteDrag({ ...drag, targetIndex });
        syncPreview(targetIndex);
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
        if (drag?.type === 'chord' && drag.targetIndex !== null && drag.targetIndex !== sourceIndex) {
            const nextSteps = [...track.soundSteps];
            clearNote(nextSteps, sourceIndex);
            if (placeNote(nextSteps, drag.targetIndex, duration, mEnd)) {
                track.soundSteps = nextSteps;
            }
        }
        callbacks.renderEditor();
    };

    holdTimer = window.setTimeout(() => {
        dragStarted = true;
        releaseInteraction = beginNoteDragInteraction({ sourceEl, pointerId });
        clearPendingDeleteNote();
        setNoteDrag({
            type: 'chord',
            trackId: track.id,
            sourceIndex,
            targetIndex: sourceIndex,
            duration,
            color: dragColor,
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

function getInheritedChordAtStep(track, step) {
    let inherited = null;
    for (let i = 0; i <= step; i++) {
        if (track.chordMap[i]) inherited = track.chordMap[i];
    }
    return inherited;
}
