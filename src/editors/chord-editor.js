// editor-chord.js — コードエディタ（初心者向け拍ベースUI）

import { appState, STEPS_PER_BEAT, STEPS_PER_MEASURE, totalSteps, callbacks } from '../core/state.js';
import { CHORD_ROOTS, CHORD_TYPES, ROOT_COLORS, DURATION_CELLS } from '../core/constants.js';
import { INST_TYPE } from '../features/tracks/instrument-map.js';
import { toggleStep, isStepHead, isStepTie } from '../core/duration.js';
import { renderDurationToolbar, getCurrentDuration } from './duration-toolbar.js';
import { getEditorCells, getEditorGridLineGroup, getMeasureStart } from '../core/rhythm-grid.js';

const CHORD_TYPE_ORDER = ['M', 'm', 'M7', 'm7', '7', 'dim', 'sus4', 'sus2', 'aug'];

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
    topbarEl.appendChild(header);

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
    header.classList.add('melody-editor-header');
    header.style.removeProperty('justify-content');
    header.replaceChildren(buildCompactHeaderActions([
        `${measureIndex + 1}小節/${appState.numMeasures}小節`,
        `${track.selectedChordRoot}${track.selectedChordType}`,
        `Oct ${track.selectedChordOctave}`,
    ], header.querySelector('.measure-actions')));
    editorEl.appendChild(buildEditorHint('コードを決める', '上でコードを選び、先に進行、その下で鳴らすタイミングを決めます。'));

    const bodyEl = document.createElement('div');
    bodyEl.className = 'chord-panel-body';

    bodyEl.appendChild(buildPalette(track));
    bodyEl.appendChild(buildProgressSection(track, offset, mEnd));
    bodyEl.appendChild(buildTimingSection(track, offset, mEnd, cells, majorGroup));

    editorEl.appendChild(bodyEl);
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
    CHORD_TYPE_ORDER.filter(type => type in CHORD_TYPES).forEach((type) => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        option.selected = type === track.selectedChordType;
        typeSelect.appendChild(option);
    });
    Object.keys(CHORD_TYPES)
        .filter(type => !CHORD_TYPE_ORDER.includes(type))
        .forEach((type) => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            option.selected = type === track.selectedChordType;
            typeSelect.appendChild(option);
        });
    typeSelect.addEventListener('change', () => {
        track.selectedChordType = typeSelect.value;
    });
    typeRow.appendChild(typeSelect);
    paletteRow.appendChild(typeRow);

    const octRow = document.createElement('div');
    octRow.className = 'chord-selector-row horizontal chord-oct-row';
    octRow.appendChild(buildLabel('オクターブ'));
    const octCtrl = document.createElement('div');
    octCtrl.className = 'chord-oct-ctrl';

    const octDown = document.createElement('button');
    octDown.className = 'oct-range-btn';
    octDown.innerHTML = '◀<span class="btn-guide">低</span>';
    octDown.disabled = track.selectedChordOctave <= 1;
    octDown.addEventListener('click', () => {
        track.selectedChordOctave--;
        callbacks.renderEditor();
    });

    const octVal = document.createElement('span');
    octVal.className = 'oct-range-label';
    octVal.textContent = track.selectedChordOctave;

    const octUp = document.createElement('button');
    octUp.className = 'oct-range-btn';
    octUp.innerHTML = '▶<span class="btn-guide">高</span>';
    octUp.disabled = track.selectedChordOctave >= 6;
    octUp.addEventListener('click', () => {
        track.selectedChordOctave++;
        callbacks.renderEditor();
    });

    octCtrl.appendChild(octDown);
    octCtrl.appendChild(octVal);
    octCtrl.appendChild(octUp);
    octRow.appendChild(octCtrl);
    paletteRow.appendChild(octRow);

    paletteEl.appendChild(paletteRow);
    return paletteEl;
}

function buildProgressSection(track, offset, mEnd) {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'chord-section chord-progress-section';

    const titleEl = document.createElement('div');
    titleEl.className = 'chord-section-title';
    titleEl.textContent = 'コード進行';
    sectionEl.appendChild(titleEl);

    const descEl = document.createElement('div');
    descEl.className = 'chord-section-desc';
    descEl.textContent = '進行: どの拍でコードを変えるか';
    sectionEl.appendChild(descEl);

    const headEl = document.createElement('div');
    headEl.className = 'chord-progress-head';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'chord-quick-btn danger';
    clearBtn.textContent = '全クリア';
    clearBtn.addEventListener('click', () => {
        for (let i = offset; i < mEnd; i++) track.chordMap[i] = null;
        callbacks.renderEditor();
    });
    headEl.appendChild(clearBtn);
    sectionEl.appendChild(headEl);

    const gridEl = document.createElement('div');
    gridEl.className = 'chord-progress-grid';

    for (let beat = 0; beat < 4; beat++) {
        const beatStart = offset + beat * STEPS_PER_BEAT;
        const beatEnd = beatStart + STEPS_PER_BEAT;
        const beatChord = track.chordMap[beatStart];
        const beatCell = document.createElement('button');
        beatCell.className = 'chord-progress-cell' + (beatChord ? ' on' : '');
        beatCell.type = 'button';

        if (beatChord) {
            const color = ROOT_COLORS[beatChord.root] ?? '#111';
            beatCell.style.setProperty('--chord-accent', color);
        }

        const beatNo = document.createElement('span');
        beatNo.className = 'chord-progress-beat';
        beatNo.textContent = `${beat + 1}拍`;
        beatCell.appendChild(beatNo);

        const beatName = document.createElement('span');
        beatName.className = 'chord-progress-name';
        beatName.textContent = beatChord
            ? `${beatChord.root}${beatChord.type}`
            : 'タップで設定';
        beatCell.appendChild(beatName);

        beatCell.addEventListener('click', () => {
            const selected = {
                root: track.selectedChordRoot,
                type: track.selectedChordType,
                octave: track.selectedChordOctave,
            };
            const sameChord = beatChord
                && beatChord.root === selected.root
                && beatChord.type === selected.type
                && beatChord.octave === selected.octave;

            for (let i = beatStart; i < beatEnd; i++) {
                track.chordMap[i] = sameChord ? null : { ...selected };
            }
            callbacks.renderEditor();
        });

        gridEl.appendChild(beatCell);
    }

    sectionEl.appendChild(gridEl);
    return sectionEl;
}

function buildTimingSection(track, offset, mEnd, cells, majorGroup) {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'chord-section chord-timing-section';

    const titleEl = document.createElement('div');
    titleEl.className = 'chord-section-title';
    titleEl.textContent = '鳴らすタイミング';
    sectionEl.appendChild(titleEl);

    const descEl = document.createElement('div');
    descEl.className = 'chord-section-desc';
    descEl.textContent = 'タイミング: そのコードをどこで鳴らすか';
    sectionEl.appendChild(descEl);

    const drumTracks = appState.tracks.filter(t => INST_TYPE[t.instrument] === 'rhythm');
    if (drumTracks.length > 0) {
        const detailsEl = document.createElement('details');
        detailsEl.className = 'chord-rhythm-details';
        const summaryEl = document.createElement('summary');
        summaryEl.className = 'chord-rhythm-summary';
        summaryEl.textContent = 'ドラムを参照';
        detailsEl.appendChild(summaryEl);

        const drumRefEl = document.createElement('div');
        drumRefEl.className = 'chord-rhythm-ref';
        drumTracks.forEach(dt => {
            dt.rows.forEach(row => {
                const rowEl = document.createElement('div');
                rowEl.className = 'chord-rhythm-row';

                const chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.className = 'chord-drum-check';
                chk.checked = track.selectedDrumRows.has(row.label);
                chk.addEventListener('change', () => {
                    if (chk.checked) track.selectedDrumRows.add(row.label);
                    else track.selectedDrumRows.delete(row.label);
                });
                rowEl.appendChild(chk);

                const lbl = document.createElement('span');
                lbl.className = 'chord-rhythm-row-label';
                lbl.textContent = row.label;
                rowEl.appendChild(lbl);

                const cellsEl = document.createElement('div');
                cellsEl.className = 'chord-rhythm-cells';
                cellsEl.style.gridTemplateColumns = `repeat(${cells.length}, minmax(0, 1fr))`;
                cells.forEach(cellInfo => {
                    const cell = document.createElement('span');
                    const on = isStepHead(row.steps[offset + cellInfo.localStep]);
                    cell.className = 'chord-rhythm-cell' + (on ? ' on' : '');
                    cell.textContent = on ? '●' : '·';
                    cellsEl.appendChild(cell);
                });
                rowEl.appendChild(cellsEl);
                drumRefEl.appendChild(rowEl);
            });
        });

        const syncBtn = document.createElement('button');
        syncBtn.className = 'chord-sync-all-btn';
        syncBtn.textContent = '同期';
        syncBtn.addEventListener('click', () => {
            track.soundSteps.fill(null, offset, mEnd);
            drumTracks.forEach(dt => {
                dt.rows.forEach(row => {
                    if (!track.selectedDrumRows.has(row.label)) return;
                    row.steps.forEach((val, i) => {
                        if (i >= offset && i < mEnd && isStepHead(val)) {
                            track.soundSteps[i] = '16n';
                        }
                    });
                });
            });
            callbacks.renderEditor();
        });
        drumRefEl.appendChild(syncBtn);
        detailsEl.appendChild(drumRefEl);
        sectionEl.appendChild(detailsEl);
    }

    const ts = totalSteps();
    const inheritedChords = Array(ts).fill(null);
    let inherited = null;
    for (let i = 0; i < ts; i++) {
        if (track.chordMap[i]) inherited = track.chordMap[i];
        inheritedChords[i] = inherited;
    }

    const soundCells = document.createElement('div');
    soundCells.className = 'chord-steps-cells chord-timing-grid';
    soundCells.dataset.measureStart = String(offset);
    soundCells.style.setProperty('--timeline-columns', String(cells.length));
    soundCells.style.setProperty('--timeline-major', String(majorGroup));
    soundCells.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('timeline-note')) return;
        const rect = soundCells.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width - 1, event.clientX - rect.left));
        const column = Math.floor((x / rect.width) * cells.length);
        const cellInfo = cells[Math.max(0, Math.min(cells.length - 1, column))];
        toggleStep(track.soundSteps, offset + cellInfo.localStep, getCurrentDuration(), mEnd);
        callbacks.renderEditor();
    });

    for (let localStep = 0; localStep < STEPS_PER_MEASURE; localStep++) {
        const si = offset + localStep;
        const val = track.soundSteps[si];
        if (isStepTie(val) || !isStepHead(val)) continue;
        const btn = document.createElement('div');
        btn.className = 'timeline-note chord-note';
        btn.style.left = `${(localStep / STEPS_PER_MEASURE) * 100}%`;
        btn.style.width = `${((DURATION_CELLS[val] || 1) / STEPS_PER_MEASURE) * 100}%`;
        if (inheritedChords[si]) {
            const color = ROOT_COLORS[inheritedChords[si].root] ?? '#111';
            btn.style.background = color;
            btn.style.borderColor = color;
        }
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleStep(track.soundSteps, si, getCurrentDuration(), mEnd);
            callbacks.renderEditor();
        });
        soundCells.appendChild(btn);
    }

    soundCells.appendChild(createPlayheadBar(offset));
    sectionEl.appendChild(soundCells);
    return sectionEl;
}

function buildLabel(text) {
    const el = document.createElement('span');
    el.className = 'chord-selector-label';
    el.textContent = text;
    return el;
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
