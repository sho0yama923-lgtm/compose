import { appState, callbacks, STEPS_PER_MEASURE } from '../../core/state.js';
import { CHORD_ROOTS, ROOT_COLORS } from '../../core/constants.js';
import { INST_TYPE, MELODY_INSTRUMENT_LIST } from '../../features/tracks/instrument-map.js';
import { renderDurationToolbar } from '../duration-toolbar.js';
import { getEditorCells, getEditorGridLineGroup, getMeasureStart } from '../../core/rhythm-grid.js';
import { buildPaletteOctaveControls, buildProgressSection } from './render-chord-parts.js';
import { buildDetailAndSheets } from './render-chord-shell.js';
import { buildTimingSection } from './chord-timing-section.js';
import { appendChordTypeOptions, buildEditorHint, buildLabel } from './chord-shared.js';

export function renderChordEditor(track, editorEl) {
    const measureIndex = appState.currentMeasure;
    const offset = getMeasureStart(measureIndex);
    const mEnd = offset + STEPS_PER_MEASURE;
    const cells = getEditorCells();
    const majorGroup = getEditorGridLineGroup();
    const header = editorEl.querySelector('.editor-header');
    const topbarEl = document.createElement('section');
    topbarEl.className = 'melody-topbar';
    editorEl.insertBefore(topbarEl, header);
    header.remove();

    const toolbarEl = renderDurationToolbar(topbarEl, () => callbacks.renderEditor());
    toolbarEl.classList.add('melody-duration-toolbar');
    if (!appState.chordHintDismissed) {
        topbarEl.appendChild(buildEditorHint(
            'コードを決める',
            '上でコードを選び、先に進行、その下で鳴らすタイミングを決めます。',
            () => {
                appState.chordHintDismissed = true;
                callbacks.renderEditor();
            }
        ));
    }

    const bodyEl = document.createElement('div');
    bodyEl.className = 'chord-panel-body';
    bodyEl.appendChild(buildPalette(track));
    bodyEl.appendChild(buildProgressSection(track, offset, mEnd));
    const timingSectionEl = buildTimingSection(track, offset, mEnd, cells, majorGroup);
    const drumTracks = appState.tracks.filter((item) => INST_TYPE[item.instrument] === 'rhythm');
    if (drumTracks.length > 0) {
        const openBtn = document.createElement('button');
        openBtn.className = 'chord-rhythm-summary';
        openBtn.type = 'button';
        openBtn.textContent = 'ドラムを参照';
        openBtn.addEventListener('click', () => {
            appState.chordDrumSheetOpen = true;
            callbacks.renderEditor();
        });
        timingSectionEl.insertBefore(openBtn, timingSectionEl.lastChild);
    }
    bodyEl.appendChild(timingSectionEl);
    editorEl.appendChild(bodyEl);

    buildDetailAndSheets(track, editorEl, offset, mEnd, cells);
}

function buildPalette(track) {
    const paletteEl = document.createElement('div');
    paletteEl.className = 'chord-palette';

    const paletteRow = document.createElement('div');
    paletteRow.className = 'chord-palette-row';

    const rootRow = document.createElement('div');
    rootRow.className = 'chord-selector-row horizontal chord-select-control';
    rootRow.appendChild(buildLabel('ルート'));
    const rootSelect = document.createElement('select');
    rootSelect.className = 'chord-select-input';
    rootSelect.style.borderColor = ROOT_COLORS[track.selectedChordRoot] ?? '#d0d0d0';
    CHORD_ROOTS.forEach((root) => {
        const option = document.createElement('option');
        option.value = root;
        option.textContent = root;
        option.selected = root === track.selectedChordRoot;
        rootSelect.appendChild(option);
    });
    rootSelect.addEventListener('change', () => {
        track.selectedChordRoot = rootSelect.value;
        rootSelect.style.borderColor = ROOT_COLORS[track.selectedChordRoot] ?? '#d0d0d0';
    });
    rootRow.appendChild(rootSelect);
    paletteRow.appendChild(rootRow);

    const typeRow = document.createElement('div');
    typeRow.className = 'chord-selector-row horizontal chord-select-control';
    typeRow.appendChild(buildLabel('タイプ'));
    const typeSelect = document.createElement('select');
    typeSelect.className = 'chord-select-input';
    appendChordTypeOptions(typeSelect, track.selectedChordType);
    typeSelect.addEventListener('change', () => {
        track.selectedChordType = typeSelect.value;
    });
    typeRow.appendChild(typeSelect);
    paletteRow.appendChild(typeRow);

    paletteRow.appendChild(buildPaletteOctaveControls(track));

    const instrumentRow = document.createElement('div');
    instrumentRow.className = 'chord-palette-row';

    const instrumentWrap = document.createElement('div');
    instrumentWrap.className = 'chord-selector-row horizontal chord-select-control chord-instrument-select';
    instrumentWrap.appendChild(buildLabel('楽器'));

    const instrumentSelect = document.createElement('select');
    instrumentSelect.className = 'chord-select-input';
    instrumentSelect.setAttribute('aria-label', 'コードトラックの楽器');
    MELODY_INSTRUMENT_LIST.forEach((config) => {
        const option = document.createElement('option');
        option.value = config.id;
        option.textContent = config.label;
        option.selected = config.id === (track.playbackInstrument || 'piano');
        instrumentSelect.appendChild(option);
    });
    instrumentSelect.addEventListener('change', () => {
        track.playbackInstrument = instrumentSelect.value;
        callbacks.renderEditor();
    });
    instrumentWrap.appendChild(instrumentSelect);
    instrumentRow.appendChild(instrumentWrap);

    paletteEl.append(paletteRow, instrumentRow);
    return paletteEl;
}
