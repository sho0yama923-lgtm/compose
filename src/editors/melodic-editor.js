import {
    appState,
    STEPS_PER_BEAT,
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
import { CHROMATIC, BLACK_KEYS, DURATION_CELLS, ROOT_COLORS } from '../core/constants.js';
import { clearNote, placeNote, toggleStep, isStepHead, isStepTie } from '../core/duration.js';
import { renderDurationToolbar, getCurrentDuration } from './duration-toolbar.js';
import { getChordPitchClasses, getEffectiveChordAtStep, getScalePitchClasses } from '../core/music-theory.js';
import {
    getEditorCells,
    getEditorGridLineGroup,
    getMeasureStart,
} from '../core/rhythm-grid.js';

const NOTE_DRAG_HOLD_MS = 380;

export function renderMelodicEditor(track, editorEl) {
    const measureIndex = appState.currentMeasure;
    const offset = getMeasureStart(measureIndex);
    const maxIndex = offset + STEPS_PER_MEASURE;
    const cells = getEditorCells();
    const majorGroup = getEditorGridLineGroup();
    const visibleOctaves = getVisibleOctaves(track.viewBase);
    const scalePitchClasses = getScalePitchClasses(
        appState.songRoot,
        appState.songHarmony,
        appState.songScaleFamily
    );
    const chordsByBeat = Array.from({ length: 4 }, (_, beat) => (
        getEffectiveChordAtStep(offset + beat * STEPS_PER_BEAT, appState.tracks)
    ));
    const chordPitchClassesByBeat = chordsByBeat.map((chord) => (
        chord ? getChordPitchClasses(chord.root, chord.type) : null
    ));
    const header = editorEl.querySelector('.editor-header');
    const topbarEl = document.createElement('section');
    topbarEl.className = 'melody-topbar';
    editorEl.insertBefore(topbarEl, header);
    header.remove();

    const toolbarEl = renderDurationToolbar(topbarEl, () => callbacks.renderEditor());
    toolbarEl.classList.add('melody-duration-toolbar');

    if (!appState.melodicHintDismissed) {
        topbarEl.appendChild(buildEditorHint(
            'メロディを置く',
            '音程ボタンで表示オクターブを切り替え、グリッドをタップして音符を置きます。',
            () => {
                appState.melodicHintDismissed = true;
                callbacks.renderEditor();
            }
        ));
    }

    const ctrlEl = document.createElement('div');
    ctrlEl.className = 'oct-range-ctrl';

    const downBtn = document.createElement('button');
    downBtn.className = 'oct-range-btn';
    downBtn.type = 'button';
    downBtn.innerHTML = '&lt;<span class="btn-guide">低</span>';
    downBtn.disabled = track.viewBase <= 1;
    downBtn.addEventListener('click', () => {
        track.viewBase = Math.max(1, track.viewBase - 1);
        track.activeOctave = track.viewBase + 1;
        track.melodyScrollTop = 0;
        callbacks.renderEditor();
    });

    const rangeLabel = document.createElement('span');
    rangeLabel.className = 'oct-range-label';
    rangeLabel.textContent = `表示 ${track.viewBase} - ${Math.min(track.viewBase + 2, 7)}`;

    const upBtn = document.createElement('button');
    upBtn.className = 'oct-range-btn';
    upBtn.type = 'button';
    upBtn.innerHTML = '&gt;<span class="btn-guide">高</span>';
    upBtn.disabled = track.viewBase >= 5;
    upBtn.addEventListener('click', () => {
        track.viewBase = Math.min(5, track.viewBase + 1);
        track.activeOctave = track.viewBase + 1;
        track.melodyScrollTop = 0;
        callbacks.renderEditor();
    });

    const octTitle = document.createElement('span');
    octTitle.className = 'ctrl-title';
    octTitle.textContent = '';
    ctrlEl.append(octTitle, downBtn, rangeLabel, upBtn);
    rebuildMelodyToolbar(toolbarEl, ctrlEl);

    const wrapEl = document.createElement('div');
    wrapEl.className = 'melodic-editor melody-roll continuous-roll';

    const scrollEl = document.createElement('div');
    scrollEl.className = 'melody-roll-scroll';

    const contentEl = document.createElement('div');
    contentEl.className = 'melody-roll-content';
    contentEl.style.setProperty('--timeline-columns', String(cells.length));
    contentEl.style.setProperty('--timeline-major', String(majorGroup));

    visibleOctaves.forEach((octave) => {
        const dividerRowEl = document.createElement('div');
        dividerRowEl.className = 'melody-lane-divider';
        applyLaneLayout(dividerRowEl);

        const keyDividerEl = document.createElement('div');
        keyDividerEl.className = 'melody-key-octave-divider';
        keyDividerEl.textContent = `Oct ${octave}`;
        keyDividerEl.style.width = '28px';
        keyDividerEl.style.minWidth = '28px';

        const gridDividerEl = buildChordHeaderStrip(chordsByBeat);
        gridDividerEl.classList.add('melody-grid-octave-divider');

        dividerRowEl.append(keyDividerEl, gridDividerEl);
        contentEl.appendChild(dividerRowEl);

        [...CHROMATIC].reverse().forEach((noteName) => {
            const isBlack = BLACK_KEYS.has(noteName);
            const fullNote = `${noteName}${octave}`;
            const steps = track.stepsMap[fullNote];
            const isScaleTone = scalePitchClasses.has(noteName);
            const chordToneBeats = chordsByBeat.map((chord, beat) => (
                chordPitchClassesByBeat[beat]?.has(noteName) ? chord : null
            ));

            const laneEl = document.createElement('div');
            laneEl.className = 'melody-lane';
            applyLaneLayout(laneEl);

            const keyEl = document.createElement('div');
            keyEl.className = 'piano-key melody-tone-key ' + (isBlack ? 'black-key' : 'white-key');
            keyEl.textContent = noteName;
            keyEl.style.width = '28px';
            keyEl.style.minWidth = '28px';

            const rowEl = document.createElement('div');
            rowEl.className = 'melody-grid-row';
            rowEl.classList.add(isScaleTone ? 'is-scale-tone' : 'is-non-scale-tone');
            rowEl.style.setProperty('--timeline-columns', String(cells.length));
            rowEl.style.setProperty('--timeline-major', String(majorGroup));
            rowEl.dataset.noteName = noteName;
            rowEl.dataset.octave = String(octave);
            rowEl.addEventListener('click', (event) => {
                const target = event.target;
                if (target.classList.contains('melody-grid-note')) return;
                if (isNoteDragActive()) return;
                clearPendingDeleteNote();
                const rect = rowEl.getBoundingClientRect();
                const x = Math.max(0, Math.min(rect.width - 1, event.clientX - rect.left));
                const column = Math.floor((x / rect.width) * cells.length);
                const cellInfo = cells[Math.max(0, Math.min(cells.length - 1, column))];
                track.activeOctave = octave;
                toggleStep(steps, offset + cellInfo.localStep, getCurrentDuration(), maxIndex);
                callbacks.renderEditor();
            });

            chordToneBeats.forEach((chord, beat) => {
                if (chord) rowEl.appendChild(buildChordToneSegment(beat, chord));
            });

            for (let localStep = 0; localStep < STEPS_PER_MEASURE; localStep++) {
                const si = offset + localStep;
                const val = steps[si];
                if (isStepTie(val) || !isStepHead(val)) continue;

                const noteEl = document.createElement('div');
                noteEl.className = 'melody-grid-note';
                const pendingDeleteId = `melody:${track.id}:${fullNote}:${si}`;
                noteEl.style.left = `${(localStep / STEPS_PER_MEASURE) * 100}%`;
                noteEl.style.width = `${((DURATION_CELLS[val] || 1) / STEPS_PER_MEASURE) * 100}%`;
                if (isPendingDeleteNote(pendingDeleteId)) noteEl.classList.add('is-delete-pending');
                if (isMelodyDragOrigin(track.id, fullNote, si)) continue;
                noteEl.addEventListener('click', (event) => {
                    event.stopPropagation();
                    if (consumeSuppressedNoteClick()) return;
                    if (isPendingDeleteNote(pendingDeleteId)) {
                        clearPendingDeleteNote();
                        track.activeOctave = octave;
                        toggleStep(steps, si, getCurrentDuration(), maxIndex);
                        callbacks.renderEditor();
                        return;
                    }
                    setPendingDeleteNote(pendingDeleteId);
                    track.activeOctave = octave;
                    callbacks.renderEditor();
                });
                noteEl.addEventListener('pointerdown', (event) => {
                    startMelodyNoteDrag({
                        event,
                        track,
                        scrollEl,
                        rowEl,
                        cells,
                        maxIndex,
                        fullNote,
                        octave,
                        steps,
                        sourceIndex: si,
                        duration: val,
                    });
                });
                rowEl.appendChild(noteEl);
            }

            appendMelodyDragPreview(rowEl, track.id, fullNote);

            laneEl.append(keyEl, rowEl);
            contentEl.appendChild(laneEl);
        });
    });

    contentEl.appendChild(createPlayheadBar(offset));
    scrollEl.appendChild(contentEl);
    wrapEl.appendChild(scrollEl);
    editorEl.appendChild(wrapEl);

    bindMelodyScroll(track, scrollEl);
    requestAnimationFrame(() => {
        const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
        scrollEl.scrollTop = Math.max(0, Math.min(track.melodyScrollTop || 0, maxScroll));
    });
}

function applyLaneLayout(el) {
    el.style.display = 'grid';
    el.style.gridTemplateColumns = '28px minmax(0, 1fr)';
    el.style.width = '100%';
}

function getVisibleOctaves(viewBase) {
    const top = Math.min(viewBase + 2, 7);
    const bottom = Math.max(viewBase, 1);
    const octaves = [];
    for (let octave = top; octave >= bottom; octave--) octaves.push(octave);
    return octaves;
}

function rebuildMelodyToolbar(toolbarEl, octCtrlEl) {
    const modeRow = toolbarEl.querySelector('.duration-mode-row');
    const valueRow = toolbarEl.querySelector('.duration-value-row');
    if (!modeRow || !valueRow) return;

    const primaryRow = document.createElement('div');
    primaryRow.className = 'melody-toolbar-primary';

    const divider = document.createElement('span');
    divider.className = 'melody-toolbar-divider';
    divider.textContent = '|';

    const octRow = document.createElement('div');
    octRow.className = 'melody-oct-row';
    const octLabel = document.createElement('span');
    octLabel.className = 'duration-row-label';
    octLabel.textContent = 'oct';
    octRow.append(octLabel, octCtrlEl);

    primaryRow.append(modeRow, divider, octRow);
    toolbarEl.replaceChildren(primaryRow, valueRow);
}

function buildChordToneSegment(beat, chord) {
    const el = document.createElement('div');
    el.className = 'melody-chord-tone-segment';
    el.dataset.beat = String(beat + 1);
    el.style.left = `${(beat * STEPS_PER_BEAT / STEPS_PER_MEASURE) * 100}%`;
    el.style.width = `${(STEPS_PER_BEAT / STEPS_PER_MEASURE) * 100}%`;
    el.style.backgroundColor = withAlpha(ROOT_COLORS[chord.root] ?? '#ff9800', 0.14);
    return el;
}

function withAlpha(hex, alpha) {
    const normalized = String(hex).replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
        return `rgba(255, 152, 0, ${alpha})`;
    }
    const red = parseInt(normalized.slice(0, 2), 16);
    const green = parseInt(normalized.slice(2, 4), 16);
    const blue = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function appendMelodyDragPreview(rowEl, trackId, fullNote) {
    const drag = appState.noteDrag;
    if (!drag || drag.type !== 'melody' || drag.trackId !== trackId || drag.targetFullNote !== fullNote) return;
    if (drag.targetIndex === null || drag.targetIndex === undefined) return;

    const previewEl = document.createElement('div');
    previewEl.className = 'melody-grid-note is-note-drag-preview';
    previewEl.style.left = `${((drag.targetIndex % STEPS_PER_MEASURE) / STEPS_PER_MEASURE) * 100}%`;
    previewEl.style.width = `${((DURATION_CELLS[drag.duration] || 1) / STEPS_PER_MEASURE) * 100}%`;
    rowEl.appendChild(previewEl);
}

function isMelodyDragOrigin(trackId, sourceFullNote, sourceIndex) {
    const drag = appState.noteDrag;
    return !!drag
        && drag.type === 'melody'
        && drag.trackId === trackId
        && drag.sourceFullNote === sourceFullNote
        && drag.sourceIndex === sourceIndex;
}

function startMelodyNoteDrag({
    event,
    track,
    scrollEl,
    rowEl,
    cells,
    maxIndex,
    fullNote,
    octave,
    steps,
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

    const resolveTarget = (moveEvent) => {
        const hoveredEl = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const targetRow = hoveredEl?.closest('.melody-grid-row');
        if (!(targetRow instanceof HTMLElement)) return null;

        const targetNoteName = targetRow.dataset.noteName;
        const targetOctave = targetRow.dataset.octave;
        if (!targetNoteName || !targetOctave) return null;

        const rect = targetRow.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width - 1, moveEvent.clientX - rect.left));
        const column = Math.floor((x / rect.width) * cells.length);
        const cellInfo = cells[Math.max(0, Math.min(cells.length - 1, column))];
        const targetIndex = getMeasureStart(appState.currentMeasure) + cellInfo.localStep;
        const targetFullNote = `${targetNoteName}${targetOctave}`;
        return { targetIndex, targetFullNote };
    };

    const updateTargetFromEvent = (moveEvent) => {
        const nextTarget = resolveTarget(moveEvent);
        const drag = appState.noteDrag;
        if (!drag || drag.type !== 'melody') return;
        const targetIndex = nextTarget?.targetIndex ?? drag.sourceIndex;
        const targetFullNote = nextTarget?.targetFullNote ?? drag.sourceFullNote;
        if (drag.targetIndex === targetIndex && drag.targetFullNote === targetFullNote) return;
        setNoteDrag({ ...drag, targetIndex, targetFullNote });
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
        if (drag?.type === 'melody'
            && (drag.targetIndex !== sourceIndex || drag.targetFullNote !== fullNote)) {
            const targetSteps = track.stepsMap[drag.targetFullNote];
            if (Array.isArray(targetSteps)) {
                clearNote(steps, sourceIndex);
                placeNote(targetSteps, drag.targetIndex, duration, maxIndex);
                track.activeOctave = Number.parseInt(drag.targetFullNote.slice(-1), 10) || octave;
            }
        }
        callbacks.renderEditor();
    };

    holdTimer = window.setTimeout(() => {
        dragStarted = true;
        clearPendingDeleteNote();
        setNoteDrag({
            type: 'melody',
            trackId: track.id,
            sourceFullNote: fullNote,
            sourceIndex,
            targetFullNote: fullNote,
            targetIndex: sourceIndex,
            duration,
        });
        callbacks.renderEditor();
    }, NOTE_DRAG_HOLD_MS);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    void scrollEl;
}

function buildChordHeaderStrip(chordsByBeat) {
    const headerEl = document.createElement('div');
    headerEl.className = 'melody-chord-header';
    headerEl.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';

    chordsByBeat.forEach((chord, beat) => {
        headerEl.appendChild(buildChordHeaderCell(chord, beat));
    });

    return headerEl;
}

function buildChordHeaderCell(chord, beat) {
    const cellEl = document.createElement('div');
    cellEl.className = 'melody-chord-header-cell' + (chord ? ' has-chord' : ' is-empty');
    cellEl.dataset.beat = String(beat + 1);
    const beatEl = document.createElement('span');
    beatEl.className = 'melody-chord-header-beat';
    beatEl.textContent = String(beat + 1);

    const nameEl = document.createElement('span');
    nameEl.className = 'melody-chord-header-name';
    nameEl.textContent = chord ? `${chord.root}${chord.type}` : '—';
    cellEl.append(beatEl, nameEl);
    if (chord) {
        cellEl.style.setProperty('--chord-accent', ROOT_COLORS[chord.root] ?? '#333');
    }
    return cellEl;
}

function bindMelodyScroll(track, scrollEl) {
    scrollEl.addEventListener('scroll', () => {
        track.melodyScrollTop = scrollEl.scrollTop;
    }, { passive: true });
}

function createPlayheadBar(measureStart) {
    const barEl = document.createElement('div');
    barEl.className = 'playhead-bar melody-playhead';
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
    barEl.style.left = `calc(var(--melody-key-width) + ${(localStep / STEPS_PER_MEASURE).toFixed(6)} * (100% - var(--melody-key-width)))`;
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
