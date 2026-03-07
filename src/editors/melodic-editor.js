import { appState, STEPS_PER_BEAT, STEPS_PER_MEASURE, callbacks } from '../core/state.js';
import { CHROMATIC, BLACK_KEYS, DURATION_CELLS } from '../core/constants.js';
import { toggleStep, isStepHead, isStepTie } from '../core/duration.js';
import { renderDurationToolbar, getCurrentDuration } from './duration-toolbar.js';
import { getChordPitchClasses, getEffectiveChordAtStep, getScalePitchClasses } from '../core/music-theory.js';
import {
    getEditorCells,
    getEditorGridColumns,
    getEditorGridLineGroup,
    getMeasureStart,
} from '../core/rhythm-grid.js';

export function renderMelodicEditor(track, editorEl) {
    const measureIndex = appState.currentMeasure;
    const offset = getMeasureStart(measureIndex);
    const maxIndex = offset + STEPS_PER_MEASURE;
    const cells = getEditorCells();
    const columns = getEditorGridColumns();
    const majorGroup = getEditorGridLineGroup();
    const visibleOctaves = getVisibleOctaves(track.viewBase);
    const scalePitchClasses = getScalePitchClasses(appState.songKeyRoot, appState.songScaleType);
    const chordPitchClassesByBeat = Array.from({ length: 4 }, (_, beat) => {
        const chord = getEffectiveChordAtStep(offset + beat * STEPS_PER_BEAT, appState.tracks);
        return chord ? getChordPitchClasses(chord.root, chord.type) : null;
    });
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

    const headerRowEl = document.createElement('div');
    headerRowEl.className = 'melody-roll-header';
    applyLaneLayout(headerRowEl);

    const keySpacerEl = document.createElement('div');
    keySpacerEl.className = 'melody-key-header-spacer';
    keySpacerEl.style.width = '28px';
    keySpacerEl.style.minWidth = '28px';

    const hdrEl = document.createElement('div');
    hdrEl.className = 'melody-grid-header';
    hdrEl.style.display = 'grid';
    hdrEl.style.gridTemplateColumns = columns;
    hdrEl.style.setProperty('--timeline-columns', String(cells.length));
    hdrEl.style.setProperty('--timeline-major', String(majorGroup));
    cells.forEach((cellInfo) => {
        const cell = document.createElement('div');
        cell.className = 'melody-grid-header-cell' + (cellInfo.slot === 0 ? ' beat' : '');
        cell.textContent = cellInfo.slot === 0 ? String(cellInfo.beat + 1) : '';
        hdrEl.appendChild(cell);
    });
    headerRowEl.append(keySpacerEl, hdrEl);
    contentEl.appendChild(headerRowEl);

    visibleOctaves.forEach((octave) => {
        const dividerRowEl = document.createElement('div');
        dividerRowEl.className = 'melody-lane-divider';
        applyLaneLayout(dividerRowEl);

        const keyDividerEl = document.createElement('div');
        keyDividerEl.className = 'melody-key-octave-divider';
        keyDividerEl.textContent = `Oct ${octave}`;
        keyDividerEl.style.width = '28px';
        keyDividerEl.style.minWidth = '28px';

        const gridDividerEl = document.createElement('div');
        gridDividerEl.className = 'melody-grid-octave-divider';
        gridDividerEl.textContent = `Oct ${octave}`;

        dividerRowEl.append(keyDividerEl, gridDividerEl);
        contentEl.appendChild(dividerRowEl);

        [...CHROMATIC].reverse().forEach((noteName) => {
            const isBlack = BLACK_KEYS.has(noteName);
            const fullNote = `${noteName}${octave}`;
            const steps = track.stepsMap[fullNote];
            const isScaleTone = scalePitchClasses.has(noteName);
            const chordToneBeats = chordPitchClassesByBeat.map(set => Boolean(set?.has(noteName)));

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
            rowEl.dataset.octave = String(octave);
            rowEl.addEventListener('click', (event) => {
                const target = event.target;
                if (target.classList.contains('melody-grid-note')) return;
                const rect = rowEl.getBoundingClientRect();
                const x = Math.max(0, Math.min(rect.width - 1, event.clientX - rect.left));
                const column = Math.floor((x / rect.width) * cells.length);
                const cellInfo = cells[Math.max(0, Math.min(cells.length - 1, column))];
                track.activeOctave = octave;
                toggleStep(steps, offset + cellInfo.localStep, getCurrentDuration(), maxIndex);
                callbacks.renderEditor();
            });

            chordToneBeats.forEach((matches, beat) => {
                if (matches) rowEl.appendChild(buildChordToneSegment(beat));
            });

            for (let localStep = 0; localStep < STEPS_PER_MEASURE; localStep++) {
                const si = offset + localStep;
                const val = steps[si];
                if (isStepTie(val) || !isStepHead(val)) continue;

                const noteEl = document.createElement('div');
                noteEl.className = 'melody-grid-note';
                noteEl.style.left = `${(localStep / STEPS_PER_MEASURE) * 100}%`;
                noteEl.style.width = `${((DURATION_CELLS[val] || 1) / STEPS_PER_MEASURE) * 100}%`;
                noteEl.addEventListener('click', (event) => {
                    event.stopPropagation();
                    track.activeOctave = octave;
                    toggleStep(steps, si, getCurrentDuration(), maxIndex);
                    callbacks.renderEditor();
                });
                rowEl.appendChild(noteEl);
            }

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

function buildChordToneSegment(beat) {
    const el = document.createElement('div');
    el.className = 'melody-chord-tone-segment';
    el.style.left = `${(beat * STEPS_PER_BEAT / STEPS_PER_MEASURE) * 100}%`;
    el.style.width = `${(STEPS_PER_BEAT / STEPS_PER_MEASURE) * 100}%`;
    return el;
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
