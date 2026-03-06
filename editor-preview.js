// editor-preview.js — 全トラックプレビュー画面

import { appState, STEPS_PER_MEASURE } from './state.js';
import { INST_TYPE, INST_LABEL } from './instruments.js';
import { CHROMATIC, ROOT_COLORS } from './constants.js';
import { selectTrack } from './track-manager.js';

export function renderPreview(containerEl) {
    const offset = appState.currentMeasure * STEPS_PER_MEASURE;
    const mEnd = offset + STEPS_PER_MEASURE;
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

        const type = INST_TYPE[track.instrument];

        if (type === 'rhythm') {
            // ドラム: rows数 × 16ステップ
            gridEl.style.gridTemplateRows = `repeat(${track.rows.length}, 1fr)`;
            track.rows.forEach(row => {
                for (let i = 0; i < STEPS_PER_MEASURE; i++) {
                    const cell = document.createElement('span');
                    cell.className = 'preview-cell' + (row.steps[offset + i] ? ' on' : '');
                    cell.dataset.step = i;
                    gridEl.appendChild(cell);
                }
            });
        } else if (type === 'chord') {
            // コード: ゾーンラベル行 + soundSteps ドット行
            gridEl.style.gridTemplateRows = 'auto auto';

            // --- ゾーン計算 ---
            // この小節に含まれるdivider位置を抽出（ローカルステップ）
            const localDivs = new Set([0]);
            for (const d of track.dividers) {
                const local = d - offset;
                if (local > 0 && local < STEPS_PER_MEASURE) localDivs.add(local);
            }
            const sortedDivs = [...localDivs].sort((a, b) => a - b);

            // 継承コード配列を事前計算（0〜mEndまで走査）
            const inheritedChords = [];
            let cur = null;
            for (let i = 0; i < mEnd; i++) {
                if (track.chordMap[i]) cur = track.chordMap[i];
                if (i >= offset) inheritedChords.push(cur);
            }

            // ゾーンごとのラベル生成
            for (let z = 0; z < sortedDivs.length; z++) {
                const start = sortedDivs[z];
                const end = (z + 1 < sortedDivs.length) ? sortedDivs[z + 1] : STEPS_PER_MEASURE;
                const chord = inheritedChords[start];

                const label = document.createElement('span');
                label.className = 'preview-chord-label';
                label.style.gridColumn = `span ${end - start}`;
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
            for (let i = 0; i < STEPS_PER_MEASURE; i++) {
                const cell = document.createElement('span');
                cell.className = 'preview-cell' + (track.soundSteps[offset + i] ? ' on' : '');
                cell.dataset.step = i;
                gridEl.appendChild(cell);
            }
        } else {
            // メロディ: activeOctave の 12音 × 16ステップ
            const oct = track.activeOctave ?? (track.viewBase + 1);
            gridEl.style.gridTemplateRows = `repeat(12, 1fr)`;
            [...CHROMATIC].reverse().forEach(noteName => {
                const steps = track.stepsMap[`${noteName}${oct}`];
                for (let i = 0; i < STEPS_PER_MEASURE; i++) {
                    const cell = document.createElement('span');
                    cell.className = 'preview-cell' + (steps[offset + i] ? ' on' : '');
                    cell.dataset.step = i;
                    gridEl.appendChild(cell);
                }
            });
        }

        card.appendChild(gridEl);
        wrapEl.appendChild(card);
    });

    containerEl.appendChild(wrapEl);
}
