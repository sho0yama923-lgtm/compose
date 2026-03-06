// editor-chord.js — コードエディタ（専用トラックとして表示）

import { appState, STEPS_PER_MEASURE, totalSteps, callbacks } from './state.js';
import { CHORD_ROOTS, CHORD_TYPES, ROOT_COLORS } from './constants.js';
import { INST_TYPE } from './instruments.js';
import { toggleStep, isStepHead, isStepTie } from './duration-utils.js';
import { renderDurationToolbar, getCurrentDuration } from './duration-toolbar.js';
import { getMeasureCells, getMeasureGridColumns, getMeasureStart, getVisibleSpanCount } from './rhythm-grid.js';

// hex色をrgba(r,g,b,alpha)に変換するヘルパー
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// 選択中の区切り線を1ステップ移動するヘルパー
function moveDivider(track, direction) {
    if (track.selectedDivPos === null) return;
    const idx = track.dividers.indexOf(track.selectedDivPos);
    if (idx <= 0) return;
    const measureIndex = appState.currentMeasure;
    const measureStart = getMeasureStart(measureIndex);
    const visibleStarts = getMeasureCells(measureIndex).map(cell => measureStart + cell.localStep);
    const visibleIdx = visibleStarts.indexOf(track.selectedDivPos);
    if (visibleIdx < 0) return;
    const newPos = visibleStarts[visibleIdx + direction];
    if (newPos === undefined) return;
    const prevDiv = track.dividers[idx - 1];
    const mEnd = (appState.currentMeasure + 1) * STEPS_PER_MEASURE;
    const nextDiv = track.dividers[idx + 1] ?? mEnd;
    if (newPos <= prevDiv || newPos >= nextDiv) return;

    if (direction === 1) {
        track.chordMap[track.selectedDivPos] = track.chordMap[track.selectedDivPos - 1] ?? null;
    } else {
        track.chordMap[newPos] = track.chordMap[track.selectedDivPos] ?? null;
    }
    track.dividers[idx] = newPos;
    track.selectedDivPos = newPos;
    callbacks.renderEditor();
}

// ビートヘッダー行を生成するヘルパー
function buildBeatHeader() {
    const hdrCells = document.createElement('div');
    hdrCells.className = 'chord-steps-cells';
    for (let i = 0; i < STEPS_PER_MEASURE; i++) {
        const cell = document.createElement('div');
        cell.className = 'chord-step-header-cell' + (i % 4 === 0 ? ' beat' : '');
        cell.textContent = i % 4 === 0 ? String(i / 4 + 1) : '·';
        hdrCells.appendChild(cell);
    }
    return hdrCells;
}

export function renderChordEditor(track, editorEl) {
    const measureIndex = appState.currentMeasure;
    const offset = getMeasureStart(measureIndex);
    const mEnd   = offset + STEPS_PER_MEASURE;
    const cells = getMeasureCells(measureIndex);
    const columns = getMeasureGridColumns(measureIndex);
    const visibleStarts = cells.map(cell => offset + cell.localStep);

    // --- デュレーションツールバー ---
    renderDurationToolbar(editorEl, () => callbacks.renderEditor());

    const bodyEl = document.createElement('div');
    bodyEl.className = 'chord-panel-body';

    // ===== パレット（ルート / タイプ / オクターブ）=====
    const paletteEl = document.createElement('div');
    paletteEl.className = 'chord-palette';

    // ルート選択
    const rootRow = document.createElement('div');
    rootRow.className = 'chord-selector-row';
    const rootLabel = document.createElement('span');
    rootLabel.className = 'chord-selector-label';
    rootLabel.textContent = 'ルート';
    rootRow.appendChild(rootLabel);
    const rootList = document.createElement('div');
    rootList.className = 'chord-root-list';
    CHORD_ROOTS.forEach(r => {
        const btn = document.createElement('button');
        const isSelected = r === track.selectedChordRoot;
        btn.className = 'chord-root-btn' + (isSelected ? ' selected' : '');
        btn.textContent = r;
        if (isSelected) {
            const col = ROOT_COLORS[r] ?? '#111';
            btn.style.background = col;
            btn.style.borderColor = col;
            btn.style.color = '#fff';
        }
        btn.addEventListener('click', () => {
            track.selectedChordRoot = r;
            rootList.querySelectorAll('.chord-root-btn').forEach(b => {
                const sel = b.textContent === r;
                b.classList.toggle('selected', sel);
                const col = ROOT_COLORS[b.textContent] ?? '#111';
                b.style.background = sel ? col : '';
                b.style.borderColor = sel ? col : '';
                b.style.color = sel ? '#fff' : '';
            });
        });
        rootList.appendChild(btn);
    });
    rootRow.appendChild(rootList);
    paletteEl.appendChild(rootRow);

    // タイプ選択
    const typeRow = document.createElement('div');
    typeRow.className = 'chord-selector-row';
    const typeLabel = document.createElement('span');
    typeLabel.className = 'chord-selector-label';
    typeLabel.textContent = 'タイプ';
    typeRow.appendChild(typeLabel);
    const typeList = document.createElement('div');
    typeList.className = 'chord-type-list';
    Object.keys(CHORD_TYPES).forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'chord-type-btn' + (t === track.selectedChordType ? ' selected' : '');
        btn.textContent = t;
        btn.addEventListener('click', () => {
            track.selectedChordType = t;
            typeList.querySelectorAll('.chord-type-btn').forEach(b => b.classList.toggle('selected', b.textContent === t));
        });
        typeList.appendChild(btn);
    });
    typeRow.appendChild(typeList);
    paletteEl.appendChild(typeRow);

    // オクターブ選択
    const octRow = document.createElement('div');
    octRow.className = 'chord-selector-row horizontal';
    const octLabel = document.createElement('span');
    octLabel.className = 'chord-selector-label';
    octLabel.textContent = 'オクターブ';
    octRow.appendChild(octLabel);
    const octCtrl = document.createElement('div');
    octCtrl.className = 'chord-oct-ctrl';
    const octDown = document.createElement('button');
    octDown.className = 'oct-range-btn';
    octDown.innerHTML = '◀<span class="btn-guide">低</span>';
    octDown.disabled = track.selectedChordOctave <= 1;
    octDown.addEventListener('click', () => { track.selectedChordOctave--; callbacks.renderEditor(); });
    const octVal = document.createElement('span');
    octVal.className = 'oct-range-label';
    octVal.textContent = track.selectedChordOctave;
    const octUp = document.createElement('button');
    octUp.className = 'oct-range-btn';
    octUp.innerHTML = '▶<span class="btn-guide">高</span>';
    octUp.disabled = track.selectedChordOctave >= 6;
    octUp.addEventListener('click', () => { track.selectedChordOctave++; callbacks.renderEditor(); });
    octCtrl.appendChild(octDown);
    octCtrl.appendChild(octVal);
    octCtrl.appendChild(octUp);
    octRow.appendChild(octCtrl);
    paletteEl.appendChild(octRow);

    bodyEl.appendChild(paletteEl);

    // ===== コード範囲セクション =====
    const rangeSection = document.createElement('div');
    rangeSection.className = 'chord-section';

    // セクションヘッダー: [◀][▶] コード範囲 [全クリア]
    const rangeHeaderEl = document.createElement('div');
    rangeHeaderEl.className = 'chord-section-header';

    const canMove = track.selectedDivPos !== null && track.dividers.indexOf(track.selectedDivPos) > 0;

    const arrowL = document.createElement('button');
    arrowL.className = 'chord-div-arrow';
    arrowL.textContent = '◀';
    arrowL.disabled = !canMove;
    arrowL.addEventListener('click', () => moveDivider(track, -1));

    const arrowR = document.createElement('button');
    arrowR.className = 'chord-div-arrow';
    arrowR.textContent = '▶';
    arrowR.disabled = !canMove;
    arrowR.addEventListener('click', () => moveDivider(track, 1));

    const rangeTitleEl = document.createElement('span');
    rangeTitleEl.className = 'chord-section-title';
    rangeTitleEl.style.flex = '1';
    rangeTitleEl.textContent = 'コード範囲';

    const rangeClearBtn = document.createElement('button');
    rangeClearBtn.className = 'chord-quick-btn danger';
    rangeClearBtn.textContent = '全クリア';
    rangeClearBtn.addEventListener('click', () => {
        for (let i = offset; i < mEnd; i++) track.chordMap[i] = null;
        track.dividers = track.dividers.filter(d => d < offset || d >= mEnd);
        track.dividers.push(offset);
        track.dividers.sort((a, b) => a - b);
        track.selectedDivPos = null;
        callbacks.renderEditor();
    });

    // 区切り削除ボタン
    const deleteDivBtn = document.createElement('button');
    deleteDivBtn.className = 'chord-div-arrow chord-div-delete';
    deleteDivBtn.textContent = '✕';
    deleteDivBtn.disabled = !canMove;
    deleteDivBtn.addEventListener('click', () => {
        const idx = track.dividers.indexOf(track.selectedDivPos);
        if (idx <= 0) return;
        track.dividers.splice(idx, 1);
        track.selectedDivPos = null;
        callbacks.renderEditor();
    });

    rangeHeaderEl.appendChild(arrowL);
    rangeHeaderEl.appendChild(arrowR);
    rangeHeaderEl.appendChild(deleteDivBtn);
    rangeHeaderEl.appendChild(rangeTitleEl);
    rangeHeaderEl.appendChild(rangeClearBtn);
    rangeSection.appendChild(rangeHeaderEl);

    // 現在小節内のディバイダーを取得（小節先頭を保証）
    let measureDividers = track.dividers.filter(d => d >= offset && d < mEnd && visibleStarts.includes(d));
    if (!measureDividers.includes(offset)) measureDividers.unshift(offset);
    measureDividers.sort((a, b) => a - b);

    // ゾーン取得ヘルパー
    function getZones(divs) {
        return divs.map((pos, d) => ({
            start: pos,
            end: divs[d + 1] ?? mEnd,
            divIdx: d,
        }));
    }

    // コード範囲行
    const rangeRow = document.createElement('div');
    rangeRow.className = 'chord-range-row';

    const zones = getZones(measureDividers);

    zones.forEach((zone, d) => {
        // ゾーン間区切り線
        if (d > 0) {
            const divEl = document.createElement('div');
            const isSelected = track.selectedDivPos === zone.start;
            divEl.className = 'chord-zone-div' + (isSelected ? ' selected' : '');
            divEl.addEventListener('click', () => {
                track.selectedDivPos = (track.selectedDivPos === zone.start) ? null : zone.start;
                callbacks.renderEditor();
            });
            rangeRow.appendChild(divEl);
        }

        // ゾーンコンテナ
        const zoneEl = document.createElement('div');
        zoneEl.className = 'chord-range-zone';
        const zoneStarts = visibleStarts.filter(start => start >= zone.start && start < zone.end);
        zoneEl.style.flex = String(zoneStarts.length || 1);
        zoneEl.style.minWidth = '0';

        const zoneChord = track.chordMap[zone.start];
        const zoneColor = zoneChord ? (ROOT_COLORS[zoneChord.root] ?? '#1a1a1a') : null;

        if (zoneColor) {
            zoneEl.style.background = hexToRgba(zoneColor, 0.13);
            zoneEl.style.borderRadius = '4px';
        }

        // シングルタップ→コード適用 / ダブルタップ→分割線追加
        const canSplit = (zone.end - zone.start) >= 1;
        let zoneClickTimer = null;
        zoneEl.addEventListener('click', (e) => {
            if (zoneClickTimer) {
                clearTimeout(zoneClickTimer);
                zoneClickTimer = null;
                if (!canSplit || zoneStarts.length < 2) return;
                const rect = zoneEl.getBoundingClientRect();
                const relX = e.clientX - rect.left;
                const gapWidth = rect.width / zoneStarts.length;
                let nearestGap = Math.round(relX / gapWidth);
                nearestGap = Math.max(1, Math.min(zoneStarts.length - 1, nearestGap));
                const newDivPos = zoneStarts[nearestGap];
                if (!track.dividers.includes(newDivPos)) {
                    track.dividers.push(newDivPos);
                    track.dividers.sort((a, b) => a - b);
                    callbacks.renderEditor();
                }
            } else {
                zoneClickTimer = setTimeout(() => {
                    zoneClickTimer = null;
                    const localDivs = track.dividers.filter(d => d >= offset && d < mEnd && visibleStarts.includes(d));
                    if (!localDivs.includes(offset)) localDivs.unshift(offset);
                    localDivs.sort((a, b) => a - b);
                    const z = getZones(localDivs).find(z => zone.start === z.start);
                    if (!z) return;
                    for (let j = z.start; j < z.end; j++) {
                        track.chordMap[j] = {
                            root: track.selectedChordRoot,
                            type: track.selectedChordType,
                            octave: track.selectedChordOctave,
                        };
                    }
                    callbacks.renderEditor();
                }, 250);
            }
        });

        // ラベル
        const labelEl = document.createElement('div');
        labelEl.className = 'chord-zone-label';
        if (zoneChord) {
            labelEl.textContent = `${zoneChord.root}${zoneChord.type}`;
            labelEl.style.color = zoneColor;
        }
        zoneEl.appendChild(labelEl);

        // ドット行
        const dotsEl = document.createElement('div');
        dotsEl.className = 'chord-zone-dots';

        zoneStarts.forEach((stepStart, idx) => {
            if (idx > 0) {
                const sep = document.createElement('div');
                sep.className = 'chord-dot-sep';
                dotsEl.appendChild(sep);
            }
            const btn = document.createElement('button');
            btn.className = 'chord-dot-btn';
            btn.textContent = '●';
            btn.style.color = zoneChord ? '#222' : '#d0d0d0';
            dotsEl.appendChild(btn);
        });
        zoneEl.appendChild(dotsEl);
        rangeRow.appendChild(zoneEl);
    });

    rangeSection.appendChild(rangeRow);

    // ガイドテキスト
    const rangeGuide = document.createElement('div');
    rangeGuide.className = 'chord-range-guide';
    rangeGuide.textContent = '帯タップでコード適用 ／ 隙間ダブルタップで分割 ／ 分割線タップ→✕で削除・◀▶で移動';
    rangeSection.appendChild(rangeGuide);

    bodyEl.appendChild(rangeSection);

    // ===== 発音セクション =====
    const soundSection = document.createElement('div');
    soundSection.className = 'chord-section';

    const soundTitleEl = document.createElement('div');
    soundTitleEl.className = 'chord-section-title';
    soundTitleEl.textContent = '発音';
    soundSection.appendChild(soundTitleEl);

    // ドラムパターン参照
    const drumTracks = appState.tracks.filter(t => INST_TYPE[t.instrument] === 'rhythm');
    if (drumTracks.length > 0) {
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
                cellsEl.style.gridTemplateColumns = columns;
                cells.forEach(cellInfo => {
                    const val = row.steps[offset + cellInfo.localStep];
                    const on = isStepHead(val);
                    const cell = document.createElement('span');
                    cell.className = 'chord-rhythm-cell' + (on ? ' on' : '');
                    cell.textContent = on ? '●' : '·';
                    cellsEl.appendChild(cell);
                });
                rowEl.appendChild(cellsEl);
                drumRefEl.appendChild(rowEl);
            });
        });
        // 統一同期ボタン
        const syncAllBtn = document.createElement('button');
        syncAllBtn.className = 'chord-sync-all-btn';
        syncAllBtn.textContent = '同期';
        syncAllBtn.addEventListener('click', () => {
            drumTracks.forEach(dt => {
                dt.rows.forEach(row => {
                    if (!track.selectedDrumRows.has(row.label)) return;
                    row.steps.forEach((val, i) => {
                        if (isStepHead(val)) track.soundSteps[i] = '16n';
                    });
                });
            });
            callbacks.renderEditor();
        });
        drumRefEl.appendChild(syncAllBtn);
        soundSection.appendChild(drumRefEl);
    }

    // 各ステップの継承コードを計算
    const ts = totalSteps();
    const inheritedChords = Array(ts).fill(null);
    let inherited = null;
    for (let i = 0; i < ts; i++) {
        if (track.chordMap[i]) inherited = track.chordMap[i];
        inheritedChords[i] = inherited;
    }

    // 発音ステップ行
    const soundRow = document.createElement('div');
    soundRow.className = 'chord-steps-row';
    const soundRowLbl = document.createElement('span');
    soundRowLbl.className = 'chord-steps-label';
    soundRowLbl.textContent = '発音';
    soundRow.appendChild(soundRowLbl);
    const soundCells = document.createElement('div');
    soundCells.className = 'chord-steps-cells';
    soundCells.style.gridTemplateColumns = columns;
    cells.forEach((cellInfo, idx) => {
        const si = offset + cellInfo.localStep;
        const val = track.soundSteps[si];
        const head = isStepHead(val);
        const tie = isStepTie(val);
        if (tie) return;
        const btn = document.createElement('button');
        const span = head ? getVisibleSpanCount(cells, idx, offset, track.soundSteps, si, mEnd) : 1;
        btn.className = 'chord-sound-btn'
            + (head ? ' on' : '')
            + (span > 1 ? ' head-span' : '');
        btn.style.gridColumn = `${idx + 1} / span ${span}`;
        if (head && inheritedChords[si]) {
            const col = ROOT_COLORS[inheritedChords[si].root] ?? '#111';
            btn.style.background = col;
            btn.style.borderColor = col;
        }
        btn.addEventListener('click', () => {
            const dur = getCurrentDuration();
            toggleStep(track.soundSteps, si, dur, mEnd);
            callbacks.renderEditor();
        });
        soundCells.appendChild(btn);
    });
    soundRow.appendChild(soundCells);
    soundSection.appendChild(soundRow);
    bodyEl.appendChild(soundSection);

    editorEl.appendChild(bodyEl);
}
