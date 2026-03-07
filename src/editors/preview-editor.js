// editor-preview.js — 全トラックプレビュー画面

import { appState, STEPS_PER_BEAT, STEPS_PER_MEASURE } from '../core/state.js';
import { INST_TYPE, INST_LABEL } from '../features/tracks/instrument-map.js';
import { CHROMATIC, ROOT_COLORS, DURATION_CELLS } from '../core/constants.js';
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

    const helpEl = document.createElement('div');
    helpEl.className = 'preview-help';
    helpEl.innerHTML = '<strong>全体トラックビュー</strong><span>各カードをタップすると、そのトラックの編集画面へ移動します。</span>';
    wrapEl.appendChild(helpEl);

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
            track.rows.forEach(row => {
                gridEl.appendChild(buildPreviewRow(cells, offset, row.steps, 'rhythm'));
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
            for (let i = 0; i < mEnd; i++) {
                if (track.chordMap[i]) cur = track.chordMap[i];
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
                const steps = track.stepsMap[`${noteName}${oct}`];
                gridEl.appendChild(buildPreviewRow(cells, offset, steps, 'melody', `${noteName}${oct}`));
            });
        }

        card.appendChild(gridEl);
        wrapEl.appendChild(card);
    });

    containerEl.appendChild(wrapEl);
}

function buildPreviewRow(cells, offset, steps, kind, noteLabel = '') {
    const rowEl = document.createElement('div');
    rowEl.className = `preview-row-track ${kind}`;

    cells.forEach(({ localStep, beat }) => {
        const cell = document.createElement('span');
        const start = offset + localStep;
        cell.className = 'preview-cell' + (isStepOn(steps[start]) ? ' on' : '') + (localStep % STEPS_PER_BEAT === 0 ? ' beat-start' : '') + ((localStep + 1) % STEPS_PER_BEAT === 0 ? ' beat-end' : '');
        cell.dataset.start = start;
        cell.title = noteLabel ? `${noteLabel} / ${beat + 1}拍` : `${beat + 1}拍`;
        rowEl.appendChild(cell);
    });

    for (let localStep = 0; localStep < STEPS_PER_MEASURE; localStep++) {
        const start = offset + localStep;
        const value = steps[start];
        if (!isStepHead(value)) continue;

        const noteEl = document.createElement('span');
        noteEl.className = `preview-note-bar ${kind}`;
        noteEl.style.left = `${(localStep / STEPS_PER_MEASURE) * 100}%`;
        noteEl.style.width = `${((DURATION_CELLS[value] || 1) / STEPS_PER_MEASURE) * 100}%`;
        rowEl.appendChild(noteEl);
    }

    return rowEl;
}
