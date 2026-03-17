import { appState, callbacks, STEPS_PER_BEAT, STEPS_PER_MEASURE } from '../../core/state.js';
import {
    CHORD_ROOTS,
    CHROMATIC,
    ROOT_COLORS,
    getChordNotes,
    getResolvedChordNotes,
    midiToNote,
    normalizeChordCustomNotes,
    noteToMidi,
} from '../../core/constants.js';
import { INST_LABEL } from '../../features/tracks/instrument-map.js';
import {
    CHORD_OCTAVE_MIN,
    CHORD_OCTAVE_MAX,
    CHORD_KEYBOARD_OCTAVES,
    CHORD_BLACK_KEY_POSITIONS,
    appendChordTypeOptions,
} from './chord-shared.js';

export function buildChordDetailSheet(track) {
    if (appState.chordDetailTrackId !== track.id || typeof appState.chordDetailStep !== 'number') return null;
    const chord = track.chordMap[appState.chordDetailStep];
    if (!chord) {
        closeChordDetail(false);
        return null;
    }

    const overlayEl = document.createElement('div');
    overlayEl.className = 'chord-detail-sheet-overlay';
    overlayEl.addEventListener('click', (event) => {
        if (event.target !== overlayEl) return;
        closeChordDetail(true);
    });

    const sheetEl = document.createElement('section');
    sheetEl.className = 'chord-detail-sheet';

    const handleEl = document.createElement('div');
    handleEl.className = 'chord-detail-sheet-handle';
    sheetEl.appendChild(handleEl);

    const descEl = document.createElement('div');
    descEl.className = 'chord-detail-sheet-desc';
    descEl.textContent = `${getChordPositionLabel(appState.chordDetailStep)} / 再生 ${INST_LABEL[track.playbackInstrument || 'piano']}`;
    sheetEl.appendChild(descEl);

    sheetEl.appendChild(buildChordDetailHarmonyControls(track, appState.chordDetailStep, chord));
    sheetEl.appendChild(buildChordDetailNoteSummary(chord));
    sheetEl.appendChild(buildChordDetailKeyboard(track, appState.chordDetailStep, chord));

    const actionsEl = document.createElement('div');
    actionsEl.className = 'chord-detail-sheet-actions';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'chord-quick-btn';
    resetBtn.textContent = '標準に戻す';
    resetBtn.disabled = !normalizeChordCustomNotes(chord.customNotes);
    resetBtn.addEventListener('click', () => {
        updateChordBeat(track, appState.chordDetailStep, (entry) => ({
            ...entry,
            customNotes: null,
        }));
        callbacks.renderEditor();
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'chord-sync-all-btn';
    closeBtn.textContent = '閉じる';
    closeBtn.addEventListener('click', () => closeChordDetail(true));

    actionsEl.append(resetBtn, closeBtn);
    sheetEl.appendChild(actionsEl);
    overlayEl.appendChild(sheetEl);
    return overlayEl;
}

function buildChordDetailHarmonyControls(track, step, chord) {
    const controlsEl = document.createElement('div');
    controlsEl.className = 'chord-detail-harmony-controls';

    const rootRowEl = document.createElement('div');
    rootRowEl.className = 'chord-detail-select-row';

    const rootFieldEl = document.createElement('label');
    rootFieldEl.className = 'chord-detail-select-field';

    const rootLabelEl = document.createElement('span');
    rootLabelEl.className = 'chord-detail-row-label';
    rootLabelEl.textContent = 'ルート';

    const rootSelectEl = document.createElement('select');
    rootSelectEl.className = 'chord-select-input chord-detail-select';
    rootSelectEl.setAttribute('aria-label', 'コードのルート');
    rootSelectEl.style.borderColor = ROOT_COLORS[chord.root] ?? '#d0d0d0';
    CHORD_ROOTS.forEach((root) => {
        const option = document.createElement('option');
        option.value = root;
        option.textContent = root;
        option.selected = root === chord.root;
        rootSelectEl.appendChild(option);
    });
    rootSelectEl.addEventListener('change', () => {
        rootSelectEl.style.borderColor = ROOT_COLORS[rootSelectEl.value] ?? '#d0d0d0';
        updateChordDetailHarmony(track, step, {
            root: rootSelectEl.value,
            type: chord.type,
            octave: chord.octave,
        });
    });

    rootFieldEl.append(rootLabelEl, rootSelectEl);
    rootRowEl.append(rootFieldEl, buildChordDetailOctaveControl(track, step, chord));

    const typeRowEl = document.createElement('label');
    typeRowEl.className = 'chord-detail-select-row';

    const typeLabelEl = document.createElement('span');
    typeLabelEl.className = 'chord-detail-row-label';
    typeLabelEl.textContent = 'タイプ';

    const typeSelectEl = document.createElement('select');
    typeSelectEl.className = 'chord-select-input chord-detail-select';
    typeSelectEl.setAttribute('aria-label', 'コードのタイプ');
    appendChordTypeOptions(typeSelectEl, chord.type);
    typeSelectEl.addEventListener('change', () => {
        updateChordDetailHarmony(track, step, {
            root: rootSelectEl.value,
            type: typeSelectEl.value,
            octave: chord.octave,
        });
    });

    typeRowEl.append(typeLabelEl, typeSelectEl);
    controlsEl.append(rootRowEl, typeRowEl);
    return controlsEl;
}

function buildChordDetailOctaveControl(track, step, chord) {
    const rowEl = document.createElement('label');
    rowEl.className = 'chord-detail-select-field chord-detail-oct-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'chord-detail-row-label';
    labelEl.textContent = 'オクターブ';

    const ctrlEl = document.createElement('div');
    ctrlEl.className = 'chord-detail-oct-ctrl';

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'oct-range-btn';
    downBtn.innerHTML = '◀<span class="btn-guide">低</span>';
    downBtn.disabled = chord.octave <= CHORD_OCTAVE_MIN;
    downBtn.setAttribute('aria-label', 'コードのオクターブを下げる');
    downBtn.addEventListener('click', () => {
        shiftChordDetailOctave(track, step, -1);
    });

    const valueEl = document.createElement('span');
    valueEl.className = 'chord-detail-oct-value';
    valueEl.dataset.chordDetailOctave = 'true';
    valueEl.textContent = String(chord.octave);

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'oct-range-btn';
    upBtn.innerHTML = '▶<span class="btn-guide">高</span>';
    upBtn.disabled = chord.octave >= CHORD_OCTAVE_MAX;
    upBtn.setAttribute('aria-label', 'コードのオクターブを上げる');
    upBtn.addEventListener('click', () => {
        shiftChordDetailOctave(track, step, 1);
    });

    ctrlEl.append(downBtn, valueEl, upBtn);
    rowEl.append(labelEl, ctrlEl);
    return rowEl;
}

function updateChordDetailHarmony(track, step, { root, type, octave }) {
    updateChordBeat(track, step, (entry) => ({
        ...entry,
        root,
        type,
        octave,
        customNotes: null,
    }));
    callbacks.renderEditor();
}

function buildChordDetailNoteSummary(chord) {
    const notesEl = document.createElement('div');
    notesEl.className = 'chord-detail-note-summary';

    const labelEl = document.createElement('span');
    labelEl.className = 'chord-detail-note-summary-label';
    labelEl.textContent = 'コードトーン';

    const valueEl = document.createElement('span');
    valueEl.className = 'chord-detail-note-summary-value';
    valueEl.textContent = getResolvedChordNotes(chord).join(' - ');

    notesEl.append(labelEl, valueEl);
    return notesEl;
}

function buildChordDetailKeyboard(track, step, chord) {
    const keyboardEl = document.createElement('div');
    keyboardEl.className = 'chord-detail-keyboard';

    const shellEl = document.createElement('div');
    shellEl.className = 'chord-detail-keyboard-shell';

    const guideEl = document.createElement('div');
    guideEl.className = 'chord-detail-keyboard-guide';
    guideEl.textContent = '鍵盤を左右にスワイプして移動';
    shellEl.appendChild(guideEl);

    const viewportEl = document.createElement('div');
    viewportEl.className = 'chord-detail-keyboard-viewport';
    viewportEl.dataset.chordDetailKeyboard = 'true';

    const stageEl = document.createElement('div');
    stageEl.className = 'chord-detail-piano-stage';
    const whiteRowEl = document.createElement('div');
    whiteRowEl.className = 'chord-detail-white-row';
    const blackRowEl = document.createElement('div');
    blackRowEl.className = 'chord-detail-black-row';
    const selectedNotes = new Set(getResolvedChordNotes(chord));

    CHORD_KEYBOARD_OCTAVES.forEach((octave, octaveIndex) => {
        const whiteRunEl = document.createElement('div');
        whiteRunEl.className = 'chord-detail-octave-white-run';
        const blackRunEl = document.createElement('div');
        blackRunEl.className = 'chord-detail-octave-black-run';

        CHROMATIC.forEach((noteName, noteIndex) => {
            const whiteKeyIndex = countWhiteKeysBeforeIndex(noteIndex);
            const note = `${noteName}${octave}`;
            if (isChordKeyboardBlackKey(noteIndex)) {
                const blackKeyEl = buildChordDetailKeyButton(track, step, note, 'black', selectedNotes.has(note));
                blackKeyEl.style.left = `calc(var(--chord-detail-white-key-step, 54px) * ${whiteKeyIndex})`;
                blackRunEl.appendChild(blackKeyEl);
                return;
            }
            const whiteKeyEl = buildChordDetailKeyButton(track, step, note, 'white', selectedNotes.has(note));
            if (noteName === 'C') {
                whiteKeyEl.dataset.octaveAnchor = String(octaveIndex);
            }
            whiteRunEl.appendChild(whiteKeyEl);
        });

        whiteRowEl.appendChild(whiteRunEl);
        blackRowEl.appendChild(blackRunEl);
    });

    stageEl.append(whiteRowEl, blackRowEl);
    viewportEl.appendChild(stageEl);
    requestAnimationFrame(() => {
        const activeAnchor = viewportEl.querySelector(`.chord-detail-key.white-key[data-note="C${chord.octave}"]`)
            || viewportEl.querySelector(`.chord-detail-key.white-key[data-octave-anchor="${Math.max(0, chord.octave - 1)}"]`);
        if (activeAnchor) {
            activeAnchor.scrollIntoView({ block: 'nearest', inline: 'center' });
        }
    });

    shellEl.appendChild(viewportEl);
    keyboardEl.appendChild(shellEl);
    return keyboardEl;
}

function isChordKeyboardBlackKey(noteIndex) {
    return CHORD_BLACK_KEY_POSITIONS.includes(noteIndex);
}

function countWhiteKeysBeforeIndex(noteIndex) {
    return CHROMATIC.slice(0, noteIndex).filter((_, index) => !isChordKeyboardBlackKey(index)).length;
}

function buildChordDetailKeyButton(track, step, note, keyType, isActive) {
    const keyEl = document.createElement('button');
    keyEl.type = 'button';
    keyEl.className = `chord-detail-key ${keyType}-key` + (isActive ? ' is-active' : '');
    keyEl.dataset.note = note;
    keyEl.setAttribute('aria-pressed', String(isActive));
    keyEl.addEventListener('click', () => toggleChordDetailNote(track, step, note));

    const noteTextEl = document.createElement('span');
    noteTextEl.className = 'chord-detail-key-label';
    noteTextEl.textContent = note;

    keyEl.appendChild(noteTextEl);
    return keyEl;
}

function toggleChordDetailNote(track, step, note) {
    const chord = track.chordMap[step];
    if (!chord) return;
    const currentNotes = getResolvedChordNotes(chord);
    const nextNotes = currentNotes.includes(note)
        ? (currentNotes.length > 1 ? currentNotes.filter((item) => item !== note) : currentNotes)
        : [...currentNotes, note];
    if (currentNotes.length === nextNotes.length && currentNotes.every((item, index) => item === nextNotes[index])) {
        return;
    }
    updateChordBeat(track, step, (entry) => applyChordCustomNotes(entry, nextNotes));
    if (!syncChordDetailSelectionUI(track, step)) {
        callbacks.renderEditor();
        return;
    }
    callbacks.saveState?.();
}

function shiftChordDetailOctave(track, step, delta) {
    const chord = track.chordMap[step];
    if (!chord) return;
    const nextOctave = Math.max(CHORD_OCTAVE_MIN, Math.min(CHORD_OCTAVE_MAX, chord.octave + delta));
    if (nextOctave === chord.octave) return;

    updateChordBeat(track, step, (entry) => {
        const updated = {
            ...entry,
            octave: nextOctave,
            customNotes: Array.isArray(entry.customNotes) ? [...entry.customNotes] : null,
        };
        const customNotes = normalizeChordCustomNotes(entry.customNotes);
        if (!customNotes) {
            updated.customNotes = null;
            return updated;
        }
        const shiftedNotes = customNotes
            .map((note) => {
                const midi = noteToMidi(note);
                return midi === null ? null : midiToNote(midi + delta * 12);
            })
            .filter(Boolean);
        return applyChordCustomNotes(updated, shiftedNotes);
    });
    callbacks.renderEditor();
}

function applyChordCustomNotes(chord, notes) {
    const normalizedNotes = normalizeChordCustomNotes(notes);
    const defaultNotes = getChordNotes(chord.root, chord.type, chord.octave);
    return {
        ...chord,
        customNotes: areNoteListsEqual(normalizedNotes, defaultNotes) ? null : normalizedNotes,
    };
}

function areNoteListsEqual(left, right) {
    const leftList = Array.isArray(left) ? left : [];
    const rightList = Array.isArray(right) ? right : [];
    if (leftList.length !== rightList.length) return false;
    return leftList.every((item, index) => item === rightList[index]);
}

function syncChordDetailSelectionUI(track, step) {
    const editorEl = document.getElementById('trackEditor');
    if (!editorEl || appState.activeTrackId !== track.id) return false;
    const chord = track.chordMap[step];
    if (!chord) return false;

    const detailSheetEl = editorEl.querySelector('.chord-detail-sheet');
    if (!detailSheetEl) return false;

    const selectedNotes = new Set(getResolvedChordNotes(chord));
    const summaryValueEl = detailSheetEl.querySelector('.chord-detail-note-summary-value');
    if (summaryValueEl) {
        summaryValueEl.textContent = [...selectedNotes].join(' - ');
    }

    detailSheetEl.querySelectorAll('.chord-detail-key').forEach((keyEl) => {
        const isActive = selectedNotes.has(keyEl.dataset.note);
        keyEl.classList.toggle('is-active', isActive);
        keyEl.setAttribute('aria-pressed', String(isActive));
    });

    const resetBtn = detailSheetEl.querySelector('.chord-quick-btn');
    if (resetBtn) {
        resetBtn.disabled = !normalizeChordCustomNotes(chord.customNotes);
    }

    syncChordProgressCellUI(editorEl, step, chord);
    return true;
}

function syncChordProgressCellUI(editorEl, step, chord) {
    const beatStart = Math.floor(step / STEPS_PER_BEAT) * STEPS_PER_BEAT;
    const progressCellEl = editorEl.querySelector(`.chord-progress-cell[data-step="${beatStart}"]`);
    if (!progressCellEl) return;

    const customNotes = normalizeChordCustomNotes(chord?.customNotes);
    progressCellEl.classList.toggle('is-customized', Boolean(customNotes));

    let badgeEl = progressCellEl.querySelector('.chord-progress-badge');
    if (customNotes && !badgeEl) {
        badgeEl = document.createElement('span');
        badgeEl.className = 'chord-progress-badge';
        badgeEl.textContent = '編集';
        progressCellEl.appendChild(badgeEl);
    } else if (!customNotes && badgeEl) {
        badgeEl.remove();
    }
}

export function updateChordBeat(track, step, transform) {
    if (typeof transform !== 'function') return;
    const beatStart = Math.floor(step / STEPS_PER_BEAT) * STEPS_PER_BEAT;
    const beatEnd = Math.min(track.chordMap.length, beatStart + STEPS_PER_BEAT);
    const current = track.chordMap[step];
    if (!current) return;
    const next = transform({
        ...current,
        customNotes: Array.isArray(current.customNotes) ? [...current.customNotes] : null,
    });
    for (let index = beatStart; index < beatEnd; index++) {
        track.chordMap[index] = next ? {
            ...next,
            customNotes: Array.isArray(next.customNotes) ? [...next.customNotes] : null,
        } : null;
    }
}

function getChordPositionLabel(step) {
    const measure = Math.floor(step / STEPS_PER_MEASURE) + 1;
    const beat = Math.floor((step % STEPS_PER_MEASURE) / STEPS_PER_BEAT) + 1;
    return `${measure}小節 ${beat}拍`;
}

export function closeChordDetail(shouldRender) {
    appState.chordDetailTrackId = null;
    appState.chordDetailStep = null;
    if (shouldRender) callbacks.renderEditor();
}
