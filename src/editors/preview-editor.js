// editor-preview.js — 全トラックプレビュー画面

import { appState, STEPS_PER_BEAT, STEPS_PER_MEASURE, callbacks } from '../core/state.js';
import { INST_TYPE, INST_LABEL } from '../features/tracks/instrument-map.js';
import { CHORD_ROOTS, CHROMATIC, ROOT_COLORS, DURATION_CELLS, SCALE_TYPES } from '../core/constants.js';
import { selectTrack } from '../features/tracks/tracks-controller.js';
import { isStepOn, isStepHead } from '../core/duration.js';
import { getMeasureStart } from '../core/rhythm-grid.js';

export function renderPreview(containerEl) {
    const measureIndex = appState.currentMeasure;
    const offset = getMeasureStart(measureIndex);
    const mEnd = offset + STEPS_PER_MEASURE;
    const cells = Array.from({ length: STEPS_PER_MEASURE }, (_, localStep) => ({
        beat: Math.floor(localStep / STEPS_PER_BEAT),
        localStep,
    }));
    const wrapEl = document.createElement('div');
    wrapEl.className = 'preview-wrap';

    if (!appState.previewHintDismissed) {
        const helpEl = document.createElement('div');
        helpEl.className = 'preview-help';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'preview-help-close';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', '案内を閉じる');
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => {
            appState.previewHintDismissed = true;
            callbacks.renderEditor?.();
        });

        const titleEl = document.createElement('strong');
        titleEl.textContent = '全体トラックビュー';

        const bodyEl = document.createElement('span');
        bodyEl.textContent = '各カードをタップすると、そのトラックの編集画面へ移動します。';

        helpEl.append(closeBtn, titleEl, bodyEl);
        wrapEl.appendChild(helpEl);
    }

    wrapEl.appendChild(buildSongSettingsCard());

    appState.tracks.forEach(track => {
        const card = document.createElement('div');
        card.className = 'preview-card';

        // ヘッダー（タップでエディタへ遷移）
        const headerEl = document.createElement('div');
        headerEl.className = 'preview-card-header';
        headerEl.textContent = INST_LABEL[track.instrument];
        headerEl.addEventListener('click', () => selectTrack(track.id));
        card.appendChild(headerEl);

        const gridEl = document.createElement('div');
        gridEl.className = 'preview-grid';

        const type = INST_TYPE[track.instrument];

        if (type === 'rhythm') {
            (track.rows ?? []).forEach(row => {
                gridEl.appendChild(buildPreviewRow(cells, offset, row?.steps, 'rhythm'));
            });
        } else if (type === 'chord') {
            const zoneGrid = document.createElement('div');
            zoneGrid.className = 'preview-chord-zone-grid';
            zoneGrid.style.gridTemplateColumns = `repeat(${STEPS_PER_MEASURE}, minmax(0, 1fr))`;

            const zoneStarts = cells
                .map(cell => offset + cell.localStep)
                .filter(start => track.dividers.includes(start) || start === offset);

            // 継承コード配列を事前計算（0〜mEndまで走査）
            const inheritedChords = [];
            let cur = null;
            const chordMap = Array.isArray(track.chordMap) ? track.chordMap : [];
            for (let i = 0; i < mEnd; i++) {
                if (chordMap[i]) cur = chordMap[i];
                if (i >= offset) inheritedChords.push(cur);
            }

            // ゾーンごとのラベル生成
            for (let z = 0; z < zoneStarts.length; z++) {
                const start = zoneStarts[z];
                const end = zoneStarts[z + 1] ?? mEnd;
                const chord = inheritedChords[start - offset];

                const label = document.createElement('span');
                label.className = 'preview-chord-label';
                const span = cells.filter(cell => {
                    const visibleStart = offset + cell.localStep;
                    return visibleStart >= start && visibleStart < end;
                }).length;
                label.style.gridColumn = `span ${span || 1}`;
                if (z > 0) label.style.borderLeft = '1px solid #999';

                if (chord) {
                    label.textContent = chord.root + chord.type;
                    label.style.background = ROOT_COLORS[chord.root] || '#666';
                } else {
                    label.textContent = '—';
                    label.style.background = '#999';
                }

                zoneGrid.appendChild(label);
            }
            gridEl.appendChild(zoneGrid);

            gridEl.appendChild(buildPreviewRow(cells, offset, track.soundSteps, 'chord'));
        } else {
            const oct = track.activeOctave ?? (track.viewBase + 1);
            [...CHROMATIC].reverse().forEach(noteName => {
                const steps = track.stepsMap?.[`${noteName}${oct}`];
                gridEl.appendChild(buildPreviewRow(cells, offset, steps, 'melody', `${noteName}${oct}`));
            });
        }

        card.appendChild(gridEl);
        wrapEl.appendChild(card);
    });

    containerEl.appendChild(wrapEl);
}

function buildSongSettingsCard() {
    const cardEl = document.createElement('section');
    cardEl.className = 'preview-song-settings';

    const titleEl = document.createElement('strong');
    titleEl.textContent = 'Key/スケール';
    cardEl.appendChild(titleEl);

    const keyRow = document.createElement('div');
    keyRow.className = 'preview-song-settings-row';
    keyRow.appendChild(buildSettingsLabel('Key'));

    const keyRootSelect = document.createElement('select');
    keyRootSelect.className = 'preview-song-select';
    CHORD_ROOTS.forEach((root) => {
        const option = document.createElement('option');
        option.value = root;
        option.textContent = root;
        option.selected = root === appState.songKeyRoot;
        keyRootSelect.appendChild(option);
    });
    keyRootSelect.addEventListener('change', () => {
        appState.songKeyRoot = keyRootSelect.value;
        callbacks.renderEditor?.();
    });
    keyRow.appendChild(keyRootSelect);

    const keyModeBadge = document.createElement('span');
    keyModeBadge.className = 'preview-song-mode-badge';
    keyModeBadge.textContent = appState.songScaleType === 'major' ? 'M' : 'm';
    keyRow.appendChild(keyModeBadge);
    cardEl.appendChild(keyRow);

    const scaleRow = document.createElement('div');
    scaleRow.className = 'preview-song-settings-row scale-row';
    scaleRow.appendChild(buildSettingsLabel('Scale'));

    const scaleTabs = document.createElement('div');
    scaleTabs.className = 'preview-scale-tabs';
    SCALE_TYPES.forEach(({ value, label }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preview-scale-tab' + (appState.songScaleType === value ? ' selected' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => {
            appState.songScaleType = value;
            callbacks.renderEditor?.();
        });
        scaleTabs.appendChild(btn);
    });
    scaleRow.appendChild(scaleTabs);
    cardEl.appendChild(scaleRow);

    return cardEl;
}

function buildSettingsLabel(text) {
    const labelEl = document.createElement('span');
    labelEl.className = 'preview-song-settings-label';
    labelEl.textContent = text;
    return labelEl;
}

function buildPreviewRow(cells, offset, steps, kind, noteLabel = '') {
    const safeSteps = Array.isArray(steps) ? steps : [];
    const rowEl = document.createElement('div');
    rowEl.className = `preview-row-track ${kind}`;

    cells.forEach(({ localStep, beat }) => {
        const cell = document.createElement('span');
        const start = offset + localStep;
        cell.className = 'preview-cell' + (isStepOn(safeSteps[start]) ? ' on' : '') + (localStep % STEPS_PER_BEAT === 0 ? ' beat-start' : '') + ((localStep + 1) % STEPS_PER_BEAT === 0 ? ' beat-end' : '');
        cell.dataset.start = start;
        cell.title = noteLabel ? `${noteLabel} / ${beat + 1}拍` : `${beat + 1}拍`;
        rowEl.appendChild(cell);
    });

    for (let localStep = 0; localStep < STEPS_PER_MEASURE; localStep++) {
        const start = offset + localStep;
        const value = safeSteps[start];
        if (!isStepHead(value)) continue;

        const noteEl = document.createElement('span');
        noteEl.className = `preview-note-bar ${kind}`;
        noteEl.style.left = `${(localStep / STEPS_PER_MEASURE) * 100}%`;
        noteEl.style.width = `${((DURATION_CELLS[value] || 1) / STEPS_PER_MEASURE) * 100}%`;
        rowEl.appendChild(noteEl);
    }

    return rowEl;
}
