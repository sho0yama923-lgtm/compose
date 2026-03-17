import { appState, STEPS_PER_MEASURE } from '../../core/state.js';
import { CHORD_TYPES } from '../../core/constants.js';

export const CHORD_TYPE_ORDER = ['M', 'm', 'M7', 'm7', '7', 'dim', 'sus4', 'sus2', 'aug'];
export const LONG_PRESS_MS = 420;
export const CHORD_OCTAVE_MIN = 1;
export const CHORD_OCTAVE_MAX = 6;
export const CHORD_KEYBOARD_OCTAVES = [1, 2, 3, 4, 5, 6, 7];
export const CHORD_BLACK_KEY_POSITIONS = [1, 3, 6, 8, 10];

export function appendChordTypeOptions(selectEl, selectedType) {
    CHORD_TYPE_ORDER.filter((type) => type in CHORD_TYPES).forEach((type) => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        option.selected = type === selectedType;
        selectEl.appendChild(option);
    });
    Object.keys(CHORD_TYPES)
        .filter((type) => !CHORD_TYPE_ORDER.includes(type))
        .forEach((type) => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            option.selected = type === selectedType;
            selectEl.appendChild(option);
        });
}

export function buildLabel(text) {
    const el = document.createElement('span');
    el.className = 'chord-selector-label';
    el.textContent = text;
    return el;
}

export function buildEditorHint(title, body, onDismiss) {
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

export function createPlayheadBar(measureStart) {
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
