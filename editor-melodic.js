// editor-melodic.js — メロディエディタ（オクターブ アコーディオン）

import { appState, STEPS_PER_MEASURE, callbacks } from './state.js';
import { CHROMATIC, BLACK_KEYS, OCT_COLOR } from './constants.js';

export function renderMelodicEditor(track, editorEl) {
    const offset = appState.currentMeasure * STEPS_PER_MEASURE;
    const octaves = [track.viewBase, track.viewBase + 1, track.viewBase + 2];

    // オクターブ範囲シフトコントロール
    const ctrlEl = document.createElement('div');
    ctrlEl.className = 'oct-range-ctrl';

    const downBtn = document.createElement('button');
    downBtn.className = 'oct-range-btn';
    downBtn.innerHTML = '◀<span class="btn-guide">低</span>';
    downBtn.disabled = track.viewBase <= 1;
    downBtn.addEventListener('click', () => {
        track.viewBase--;
        if (!octaves.includes(track.activeOctave)) track.activeOctave = null;
        callbacks.renderEditor();
    });

    const rangeLabel = document.createElement('span');
    rangeLabel.className = 'oct-range-label';
    rangeLabel.textContent = `Oct ${track.viewBase} – ${track.viewBase + 2}`;

    const upBtn = document.createElement('button');
    upBtn.className = 'oct-range-btn';
    upBtn.innerHTML = '▶<span class="btn-guide">高</span>';
    upBtn.disabled = track.viewBase >= 5;
    upBtn.addEventListener('click', () => {
        track.viewBase++;
        if (!octaves.includes(track.activeOctave)) track.activeOctave = null;
        callbacks.renderEditor();
    });

    const octTitle = document.createElement('span');
    octTitle.className = 'ctrl-title';
    octTitle.textContent = '音程';
    ctrlEl.appendChild(octTitle);
    ctrlEl.appendChild(downBtn);
    ctrlEl.appendChild(rangeLabel);
    ctrlEl.appendChild(upBtn);
    // 楽器名ヘッダーの右側に配置
    editorEl.querySelector('.editor-header').appendChild(ctrlEl);

    const accordionEl = document.createElement('div');
    accordionEl.className = 'oct-accordion';

    // 高オクターブが上になるよう逆順
    [...octaves].reverse().forEach(o => {
        const isOpen   = o === track.activeOctave;
        const octStyle = OCT_COLOR[o];

        const sectionEl = document.createElement('div');
        sectionEl.className = 'oct-section' + (isOpen ? ' open' : '');

        // ヘッダー（クリックで開閉）
        const headerEl = document.createElement('button');
        headerEl.className = 'oct-section-header';
        headerEl.style.setProperty('--oct-color', octStyle.on);
        // ミニプレビュー: 12音×16ステップ のグリッド（現在小節分）
        const miniEl = document.createElement('div');
        miniEl.className = 'oct-section-mini';
        [...CHROMATIC].reverse().forEach(noteName => {
            const steps = track.stepsMap[`${noteName}${o}`];
            for (let i = 0; i < STEPS_PER_MEASURE; i++) {
                const cell = document.createElement('span');
                cell.className = 'oct-mini-cell' + (steps[offset + i] ? ' on' : '');
                miniEl.appendChild(cell);
            }
        });

        const labelEl = document.createElement('span');
        labelEl.className = 'oct-section-label';
        labelEl.textContent = octStyle.label;

        const arrowEl = document.createElement('span');
        arrowEl.className = 'oct-section-arrow';
        arrowEl.textContent = isOpen ? '▼' : '▶';

        headerEl.appendChild(labelEl);
        headerEl.appendChild(miniEl);
        headerEl.appendChild(arrowEl);
        headerEl.addEventListener('click', () => {
            track.activeOctave = (track.activeOctave === o) ? null : o;
            callbacks.renderEditor();
        });
        sectionEl.appendChild(headerEl);

        // ボディ（展開時のみ表示）
        const bodyEl = document.createElement('div');
        bodyEl.className = 'oct-section-body';

        // ピアノ鍵盤 + グリッドのラッパー
        const melodicEl = document.createElement('div');
        melodicEl.className = 'melodic-editor';

        const keysEl = document.createElement('div');
        keysEl.className = 'piano-keys';
        keysEl.appendChild(Object.assign(document.createElement('div'), { className: 'piano-key-spacer' }));

        const gridScrollEl = document.createElement('div');
        gridScrollEl.className = 'steps-grid-scroll';
        const gridEl = document.createElement('div');
        gridEl.className = 'steps-grid';

        // ビートヘッダー
        const hdrEl = document.createElement('div');
        hdrEl.className = 'steps-header';
        for (let i = 0; i < STEPS_PER_MEASURE; i++) {
            const cell = document.createElement('div');
            cell.className = 'step-header-cell' + (i % 4 === 0 ? ' beat' : '');
            cell.textContent = i % 4 === 0 ? String(i / 4 + 1) : '·';
            if (i % 4 === 0) cell.style.color = octStyle.on;
            hdrEl.appendChild(cell);
        }
        gridEl.appendChild(hdrEl);

        // 12音行（B→C = 高→低）
        [...CHROMATIC].reverse().forEach(noteName => {
            const isBlack  = BLACK_KEYS.has(noteName);
            const fullNote = `${noteName}${o}`;
            const steps    = track.stepsMap[fullNote];

            const keyEl = document.createElement('div');
            keyEl.className = 'piano-key ' + (isBlack ? 'black-key' : 'white-key');
            keyEl.textContent = noteName;
            keysEl.appendChild(keyEl);

            const rowEl = document.createElement('div');
            rowEl.className = 'steps-row' + (isBlack ? ' black-key' : '');

            for (let i = 0; i < STEPS_PER_MEASURE; i++) {
                const si = offset + i;
                const btn = document.createElement('button');
                btn.className = 'step' + (steps[si] ? ' on' : '');
                btn.addEventListener('click', () => {
                    steps[si] = !steps[si];
                    btn.classList.toggle('on', steps[si]);
                });
                rowEl.appendChild(btn);
            }
            gridEl.appendChild(rowEl);
        });

        gridScrollEl.appendChild(gridEl);
        melodicEl.appendChild(keysEl);
        melodicEl.appendChild(gridScrollEl);
        bodyEl.appendChild(melodicEl);
        sectionEl.appendChild(bodyEl);
        accordionEl.appendChild(sectionEl);
    });

    editorEl.appendChild(accordionEl);
}
