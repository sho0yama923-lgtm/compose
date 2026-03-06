// editor-preview.js — 全トラックプレビュー画面

import { appState, STEPS_PER_MEASURE } from '../core/state.js';
import { INST_TYPE, INST_LABEL } from '../instruments.js';
import { CHROMATIC, ROOT_COLORS } from '../core/constants.js';
import { selectTrack } from '../track-manager.js';
import { isStepOn } from '../core/duration-utils.js';
import { getMeasureCells, getMeasureGridColumns, getMeasureStart } from '../core/rhythm-grid.js';

export function renderPreview(containerEl) {
    const measureIndex = appState.currentMeasure;
    const offset = getMeasureStart(measureIndex);
    const mEnd = offset + STEPS_PER_MEASURE;
    const cells = getMeasureCells(measureIndex);
    const columns = getMeasureGridColumns(measureIndex);
    const wrapEl = document.createElement('div');
    wrapEl.className = 'preview-wrap';

    appState.tracks.forEach(track => {
        const card = document.createElement('div');
        card.className = 'preview-card';

        // ヘッダー（タップでエディタへ遷移）
        const headerEl = document.createElement('div');
        headerEl.className = 'preview-card-header';
        headerEl.textContent = INST_LABEL[track.instrument];
        headerEl.addEventListener('click', () => selectTrack(track.id));
        card.appendChild(headerEl);

        // ドットグリッド
        const gridEl = document.createElement('div');
        gridEl.className = 'preview-grid';
        gridEl.style.gridTemplateColumns = columns;

        const type = INST_TYPE[track.instrument];

        if (type === 'rhythm') {
            gridEl.style.gridTemplateRows = `repeat(${track.rows.length}, 1fr)`;
            track.rows.forEach(row => {
                cells.forEach(cellInfo => {
                    const cell = document.createElement('span');
                    const start = offset + cellInfo.localStep;
                    cell.className = 'preview-cell' + (isStepOn(row.steps[start]) ? ' on' : '');
                    cell.dataset.start = start;
                    gridEl.appendChild(cell);
                });
            });
        } else if (type === 'chord') {
            // コード: ゾーンラベル行 + soundSteps ドット行
            gridEl.style.gridTemplateRows = 'auto auto';

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

                gridEl.appendChild(label);
            }

            // --- ドット行 ---
            cells.forEach(cellInfo => {
                const cell = document.createElement('span');
                const start = offset + cellInfo.localStep;
                cell.className = 'preview-cell' + (isStepOn(track.soundSteps[start]) ? ' on' : '');
                cell.dataset.start = start;
                gridEl.appendChild(cell);
            });
        } else {
            // メロディ: activeOctave の 12音 × 可変ステップ
            const oct = track.activeOctave ?? (track.viewBase + 1);
            gridEl.style.gridTemplateRows = `repeat(12, 1fr)`;
            [...CHROMATIC].reverse().forEach(noteName => {
                const steps = track.stepsMap[`${noteName}${oct}`];
                cells.forEach(cellInfo => {
                    const cell = document.createElement('span');
                    const start = offset + cellInfo.localStep;
                    cell.className = 'preview-cell' + (isStepOn(steps[start]) ? ' on' : '');
                    cell.dataset.start = start;
                    gridEl.appendChild(cell);
                });
            });
        }

        card.appendChild(gridEl);
        wrapEl.appendChild(card);
    });

    containerEl.appendChild(wrapEl);
}
