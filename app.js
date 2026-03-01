// app.js — 状態管理・描画・イベント処理
import { play, stop } from './player.js';
import { DRUM_ROWS, CHROMATIC, BLACK_KEYS, OCTAVE_DEFAULT_BASE, OCT_COLOR, INST_LABEL, INST_TYPE, CHORD_ROOTS, CHORD_TYPES, ROOT_COLORS } from './constants.js';

// コードの構成音を返す（例: getChordNotes('C', 'maj', 4) → ['C4','E4','G4']）
function getChordNotes(root, type, octave) {
    const rootIdx = CHROMATIC.indexOf(root);
    return CHORD_TYPES[type].map(interval => {
        const noteIdx = (rootIdx + interval) % 12;
        const oct = octave + Math.floor((rootIdx + interval) / 12);
        return CHROMATIC[noteIdx] + oct;
    });
}

// -------------------------------------------------------
// 状態
// -------------------------------------------------------
let tracks       = [];
let nextId       = 0;
let activeTrackId = null;

// -------------------------------------------------------
// サイドバー開閉
// -------------------------------------------------------
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');

function openSidebar()  { sidebar.classList.add('open');    overlay.classList.add('open'); }
function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('open'); }

document.getElementById('menuBtn').addEventListener('click', openSidebar);
overlay.addEventListener('click', closeSidebar);

// -------------------------------------------------------
// トラック選択
// -------------------------------------------------------
function selectTrack(id) {
    activeTrackId = id;
    renderEditor();
    renderSidebar();
    closeSidebar();

    const track = tracks.find(t => t.id === id);
    if (track) document.getElementById('topbarTitle').textContent = INST_LABEL[track.instrument];
}

// -------------------------------------------------------
// サイドバー描画
// -------------------------------------------------------
function renderSidebar() {
    const list = document.getElementById('trackList');
    list.innerHTML = '';
    tracks.forEach(track => {
        const li = document.createElement('li');
        li.className = 'track-item' + (track.id === activeTrackId ? ' active' : '');
        li.innerHTML = `
            <span class="track-item-name">${INST_LABEL[track.instrument]}</span>
            <button class="track-item-delete" title="削除">✕</button>
        `;
        li.addEventListener('click', e => {
            if (e.target.classList.contains('track-item-delete')) return;
            selectTrack(track.id);
        });
        li.querySelector('.track-item-delete').addEventListener('click', e => {
            e.stopPropagation();
            deleteTrack(track.id);
        });
        list.appendChild(li);
    });
}

// -------------------------------------------------------
// トラック削除
// -------------------------------------------------------
function deleteTrack(id) {
    tracks = tracks.filter(t => t.id !== id);
    if (activeTrackId === id) {
        activeTrackId = tracks.length > 0 ? tracks[tracks.length - 1].id : null;
        const title = activeTrackId
            ? INST_LABEL[tracks.find(t => t.id === activeTrackId).instrument]
            : '作曲ツール';
        document.getElementById('topbarTitle').textContent = title;
    }
    renderSidebar();
    renderEditor();
}

// -------------------------------------------------------
// トラック追加
// -------------------------------------------------------
function addTrack(instrument) {
    const id = nextId++;
    let track;

    if (INST_TYPE[instrument] === 'rhythm') {
        track = {
            id, instrument,
            rows: DRUM_ROWS.map(r => ({ label: r.label, note: r.note, steps: Array(16).fill(false) })),
        };
    } else if (INST_TYPE[instrument] === 'chord') {
        track = {
            id, instrument,
            chordMap:        Array(16).fill(null),  // コード範囲: { root, type, octave } or null
            soundSteps:      Array(16).fill(false), // 発音トリガー: boolean
            selectedChordRoot:   'C',
            selectedChordType:   'maj',
            selectedChordOctave: 4,
            dividers:        [0, 8],         // ゾーン開始位置配列（0は常に固定）
            selectedDivPos:  null,       // 選択中の区切り線位置（null=未選択）
            selectedDrumRows: new Set(),  // 同期チェック中の row.label
        };
    } else {
        // stepsMap は oct 1〜7 全域を保持（viewBase で表示範囲を選択）
        const stepsMap = {};
        for (let oct = 1; oct <= 7; oct++) {
            CHROMATIC.forEach(n => { stepsMap[`${n}${oct}`] = Array(16).fill(false); });
        }
        const viewBase = OCTAVE_DEFAULT_BASE[instrument] ?? 3;
        track = {
            id, instrument,
            viewBase,
            activeOctave: viewBase + 1, // 中央オクターブをデフォルトで開く
            stepsMap,
        };
    }

    tracks.push(track);
    selectTrack(id);
}

// -------------------------------------------------------
// エディタ描画（ルーター）
// -------------------------------------------------------
function renderEditor() {
    const emptyState = document.getElementById('emptyState');
    const editorEl   = document.getElementById('trackEditor');

    if (activeTrackId === null || tracks.length === 0) {
        emptyState.style.display = '';
        editorEl.style.display   = 'none';
        editorEl.innerHTML       = '';
        return;
    }

    const track = tracks.find(t => t.id === activeTrackId);
    if (!track) return;

    emptyState.style.display = 'none';
    editorEl.style.display   = '';
    editorEl.innerHTML       = '';

    const header = document.createElement('div');
    header.className = 'editor-header';
    header.innerHTML = `<span class="editor-title">${INST_LABEL[track.instrument]}</span>`;
    editorEl.appendChild(header);

    if (INST_TYPE[track.instrument] === 'rhythm') {
        renderDrumEditor(track, editorEl);
    } else if (INST_TYPE[track.instrument] === 'chord') {
        renderChordEditor(track, editorEl);
    } else {
        renderMelodicEditor(track, editorEl);
    }
}

// -------------------------------------------------------
// ドラムエディタ
// -------------------------------------------------------
function renderDrumEditor(track, editorEl) {
    const wrapEl = document.createElement('div');
    wrapEl.className = 'melodic-editor';

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
    for (let i = 0; i < 16; i++) {
        const cell = document.createElement('div');
        cell.className = 'step-header-cell' + (i % 4 === 0 ? ' beat' : '');
        cell.textContent = i % 4 === 0 ? String(i / 4 + 1) : '·';
        hdrEl.appendChild(cell);
    }
    gridEl.appendChild(hdrEl);

    track.rows.forEach(row => {
        const keyEl = document.createElement('div');
        keyEl.className = 'piano-key white-key drum-key';
        keyEl.textContent = row.label;
        keysEl.appendChild(keyEl);

        const rowEl = document.createElement('div');
        rowEl.className = 'steps-row';
        row.steps.forEach((on, stepIdx) => {
            const btn = document.createElement('button');
            btn.className = 'step' + (on ? ' on' : '');
            btn.addEventListener('click', () => {
                row.steps[stepIdx] = !row.steps[stepIdx];
                btn.classList.toggle('on', row.steps[stepIdx]);
            });
            rowEl.appendChild(btn);
        });
        gridEl.appendChild(rowEl);
    });

    gridScrollEl.appendChild(gridEl);
    wrapEl.appendChild(keysEl);
    wrapEl.appendChild(gridScrollEl);
    editorEl.appendChild(wrapEl);
}

// -------------------------------------------------------
// メロディエディタ（オクターブ アコーディオン）
// -------------------------------------------------------
function renderMelodicEditor(track, editorEl) {
    const octaves = [track.viewBase, track.viewBase + 1, track.viewBase + 2];

    // オクターブ範囲シフトコントロール
    const ctrlEl = document.createElement('div');
    ctrlEl.className = 'oct-range-ctrl';

    const downBtn = document.createElement('button');
    downBtn.className = 'oct-range-btn';
    downBtn.textContent = '◀';
    downBtn.disabled = track.viewBase <= 1;
    downBtn.addEventListener('click', () => {
        track.viewBase--;
        if (!octaves.includes(track.activeOctave)) track.activeOctave = null;
        renderEditor();
    });

    const rangeLabel = document.createElement('span');
    rangeLabel.className = 'oct-range-label';
    rangeLabel.textContent = `Oct ${track.viewBase} – ${track.viewBase + 2}`;

    const upBtn = document.createElement('button');
    upBtn.className = 'oct-range-btn';
    upBtn.textContent = '▶';
    upBtn.disabled = track.viewBase >= 5;
    upBtn.addEventListener('click', () => {
        track.viewBase++;
        if (!octaves.includes(track.activeOctave)) track.activeOctave = null;
        renderEditor();
    });

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
        // ミニプレビュー: 12音×16ステップ のグリッド
        const miniEl = document.createElement('div');
        miniEl.className = 'oct-section-mini';
        [...CHROMATIC].reverse().forEach(noteName => {
            const steps = track.stepsMap[`${noteName}${o}`];
            for (let i = 0; i < 16; i++) {
                const cell = document.createElement('span');
                cell.className = 'oct-mini-cell' + (steps[i] ? ' on' : '');
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
            renderEditor();
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
        for (let i = 0; i < 16; i++) {
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

            steps.forEach((on, stepIdx) => {
                const btn = document.createElement('button');
                btn.className = 'step' + (on ? ' on' : '');
                btn.addEventListener('click', () => {
                    steps[stepIdx] = !steps[stepIdx];
                    btn.classList.toggle('on', steps[stepIdx]);
                });
                rowEl.appendChild(btn);
            });
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

// -------------------------------------------------------
// コードエディタ（専用トラックとして表示）
// -------------------------------------------------------

// hex色をrgba(r,g,b,alpha)に変換するヘルパー
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// 選択中の区切り線を1ステップ移動するヘルパー
function moveDivider(track, direction) { // direction: -1 or +1
    if (track.selectedDivPos === null) return;
    const idx = track.dividers.indexOf(track.selectedDivPos);
    if (idx <= 0) return; // pos=0 は固定・移動不可
    const newPos = track.selectedDivPos + direction;
    const prevDiv = track.dividers[idx - 1];
    const nextDiv = track.dividers[idx + 1] ?? 16;
    if (newPos <= prevDiv || newPos >= nextDiv) return; // 範囲外なら無視

    if (direction === 1) {
        // 右移動: 旧位置のステップが左ゾーンに取り込まれる
        track.chordMap[track.selectedDivPos] = track.chordMap[track.selectedDivPos - 1] ?? null;
    } else {
        // 左移動: 新位置のステップが右ゾーンに取り込まれる
        track.chordMap[newPos] = track.chordMap[track.selectedDivPos] ?? null;
    }
    track.dividers[idx] = newPos;
    track.selectedDivPos = newPos;
    renderEditor();
}

// ビートヘッダー行を生成するヘルパー
function buildBeatHeader() {
    const hdrCells = document.createElement('div');
    hdrCells.className = 'chord-steps-cells';
    for (let i = 0; i < 16; i++) {
        const cell = document.createElement('div');
        cell.className = 'chord-step-header-cell' + (i % 4 === 0 ? ' beat' : '');
        cell.textContent = i % 4 === 0 ? String(i / 4 + 1) : '·';
        hdrCells.appendChild(cell);
    }
    return hdrCells;
}

function renderChordEditor(track, editorEl) {
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
    octRow.className = 'chord-selector-row';
    const octLabel = document.createElement('span');
    octLabel.className = 'chord-selector-label';
    octLabel.textContent = 'オクターブ';
    octRow.appendChild(octLabel);
    const octCtrl = document.createElement('div');
    octCtrl.className = 'chord-oct-ctrl';
    const octDown = document.createElement('button');
    octDown.className = 'oct-range-btn';
    octDown.textContent = '◀';
    octDown.disabled = track.selectedChordOctave <= 1;
    octDown.addEventListener('click', () => { track.selectedChordOctave--; renderEditor(); });
    const octVal = document.createElement('span');
    octVal.className = 'oct-range-label';
    octVal.textContent = track.selectedChordOctave;
    const octUp = document.createElement('button');
    octUp.className = 'oct-range-btn';
    octUp.textContent = '▶';
    octUp.disabled = track.selectedChordOctave >= 6;
    octUp.addEventListener('click', () => { track.selectedChordOctave++; renderEditor(); });
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
        track.chordMap = Array(16).fill(null);
        track.dividers = [0];
        track.selectedDivPos = null;
        renderEditor();
    });

    // 区切り削除ボタン（選択中の区切り線を削除）
    const deleteDivBtn = document.createElement('button');
    deleteDivBtn.className = 'chord-div-arrow chord-div-delete';
    deleteDivBtn.textContent = '✕';
    deleteDivBtn.disabled = !canMove;
    deleteDivBtn.addEventListener('click', () => {
        const idx = track.dividers.indexOf(track.selectedDivPos);
        if (idx <= 0) return;
        track.dividers.splice(idx, 1);
        track.selectedDivPos = null;
        renderEditor();
    });

    rangeHeaderEl.appendChild(arrowL);
    rangeHeaderEl.appendChild(arrowR);
    rangeHeaderEl.appendChild(deleteDivBtn);
    rangeHeaderEl.appendChild(rangeTitleEl);
    rangeHeaderEl.appendChild(rangeClearBtn);
    rangeSection.appendChild(rangeHeaderEl);

    // ゾーン取得ヘルパー
    function getZones(divs) {
        return divs.map((pos, d) => ({
            start: pos,
            end: (divs[d + 1] ?? 16) - 1,
            divIdx: d,
        }));
    }

    // コード範囲行（ラベル行 + ドット行のゾーン列）
    const rangeRow = document.createElement('div');
    rangeRow.className = 'chord-range-row';

    const zones = getZones(track.dividers);

    zones.forEach((zone, d) => {
        // ゾーン間区切り線（最初のゾーンの前は不要）
        if (d > 0) {
            const divEl = document.createElement('div');
            const isSelected = track.selectedDivPos === zone.start;
            divEl.className = 'chord-zone-div' + (isSelected ? ' selected' : '');
            divEl.addEventListener('click', () => {
                track.selectedDivPos = (track.selectedDivPos === zone.start) ? null : zone.start;
                renderEditor();
            });
            rangeRow.appendChild(divEl);
        }

        // ゾーンコンテナ（ラベル + ドット列）
        const zoneEl = document.createElement('div');
        zoneEl.className = 'chord-range-zone';
        // step 数に比例した幅になるよう flex 値をインラインで設定
        zoneEl.style.flex = String(zone.end - zone.start + 1);
        zoneEl.style.minWidth = '0';

        const zoneChord = track.chordMap[zone.start];
        const zoneColor = zoneChord ? (ROOT_COLORS[zoneChord.root] ?? '#1a1a1a') : null;

        // ゾーン背景を帯状に色付け
        if (zoneColor) {
            zoneEl.style.background = hexToRgba(zoneColor, 0.13);
            zoneEl.style.borderRadius = '4px';
        }

        // シングルタップ→コード適用 / ダブルタップ→近傍ギャップに分割線追加
        const canSplit = (zone.end - zone.start) >= 1;
        let zoneClickTimer = null;
        zoneEl.addEventListener('click', (e) => {
            if (zoneClickTimer) {
                // ── ダブルタップ ──
                clearTimeout(zoneClickTimer);
                zoneClickTimer = null;
                if (!canSplit) return;
                const rect = zoneEl.getBoundingClientRect();
                const relX = e.clientX - rect.left;
                const zoneSteps = zone.end - zone.start + 1;
                const stepWidth = rect.width / zoneSteps;
                let nearestGap = Math.round(relX / stepWidth);
                nearestGap = Math.max(1, Math.min(zoneSteps - 1, nearestGap));
                const newDivPos = zone.start + nearestGap;
                if (!track.dividers.includes(newDivPos)) {
                    track.dividers.push(newDivPos);
                    track.dividers.sort((a, b) => a - b);
                    renderEditor();
                }
            } else {
                // ── シングルタップ（250ms 後にコード適用） ──
                zoneClickTimer = setTimeout(() => {
                    zoneClickTimer = null;
                    const z = getZones(track.dividers).find(z => zone.start === z.start);
                    if (!z) return;
                    for (let j = z.start; j <= z.end; j++) {
                        track.chordMap[j] = {
                            root: track.selectedChordRoot,
                            type: track.selectedChordType,
                            octave: track.selectedChordOctave,
                        };
                    }
                    renderEditor();
                }, 250);
            }
        });

        // ラベル（コード名）
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

        for (let i = zone.start; i <= zone.end; i++) {
            // 隙間セパレータ（視覚ガイドのみ、操作はゾーン帯のダブルタップで処理）
            if (i > zone.start) {
                const sep = document.createElement('div');
                sep.className = 'chord-dot-sep';
                dotsEl.appendChild(sep);
            }

            // ドットボタン（常に●、コード有無で色が変わる）
            // クリックは zoneEl にバブルアップするため個別ハンドラ不要
            const btn = document.createElement('button');
            btn.className = 'chord-dot-btn';
            btn.textContent = '●';
            btn.style.color = zoneChord ? '#222' : '#d0d0d0';
            dotsEl.appendChild(btn);
        }
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

    // ドラムパターン参照（チェックボックス + 統一同期ボタン）
    const drumTracks = tracks.filter(t => INST_TYPE[t.instrument] === 'rhythm');
    if (drumTracks.length > 0) {
        const drumRefEl = document.createElement('div');
        drumRefEl.className = 'chord-rhythm-ref';
        drumTracks.forEach(dt => {
            dt.rows.forEach(row => {
                const rowEl = document.createElement('div');
                rowEl.className = 'chord-rhythm-row';
                // チェックボックス
                const chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.className = 'chord-drum-check';
                chk.checked = track.selectedDrumRows.has(row.label);
                chk.addEventListener('change', () => {
                    if (chk.checked) track.selectedDrumRows.add(row.label);
                    else track.selectedDrumRows.delete(row.label);
                    // renderEditor() は不要（チェック状態維持のため）
                });
                rowEl.appendChild(chk);
                const lbl = document.createElement('span');
                lbl.className = 'chord-rhythm-row-label';
                lbl.textContent = row.label;
                rowEl.appendChild(lbl);
                const cellsEl = document.createElement('div');
                cellsEl.className = 'chord-rhythm-cells';
                row.steps.forEach(on => {
                    const cell = document.createElement('span');
                    cell.className = 'chord-rhythm-cell' + (on ? ' on' : '');
                    cell.textContent = on ? '●' : '·';
                    cellsEl.appendChild(cell);
                });
                rowEl.appendChild(cellsEl);
                drumRefEl.appendChild(rowEl);
            });
        });
        // 統一同期ボタン（リズム参照エリアの末尾）
        const syncAllBtn = document.createElement('button');
        syncAllBtn.className = 'chord-sync-all-btn';
        syncAllBtn.textContent = '同期';
        syncAllBtn.addEventListener('click', () => {
            drumTracks.forEach(dt => {
                dt.rows.forEach(row => {
                    if (!track.selectedDrumRows.has(row.label)) return;
                    row.steps.forEach((on, i) => { if (on) track.soundSteps[i] = true; });
                });
            });
            renderEditor();
        });
        drumRefEl.appendChild(syncAllBtn);
        soundSection.appendChild(drumRefEl);
    }

    // 各ステップの継承コードを計算（chordMap左端から引き継ぎ）
    const inheritedChords = Array(16).fill(null);
    let inherited = null;
    for (let i = 0; i < 16; i++) {
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
    for (let i = 0; i < 16; i++) {
        const btn = document.createElement('button');
        btn.className = 'chord-sound-btn' + (track.soundSteps[i] ? ' on' : '');
        if (track.soundSteps[i] && inheritedChords[i]) {
            const col = ROOT_COLORS[inheritedChords[i].root] ?? '#111';
            btn.style.background = col;
            btn.style.borderColor = col;
        }
        btn.addEventListener('click', () => {
            track.soundSteps[i] = !track.soundSteps[i];
            btn.classList.toggle('on', track.soundSteps[i]);
            if (track.soundSteps[i] && inheritedChords[i]) {
                const col = ROOT_COLORS[inheritedChords[i].root] ?? '#111';
                btn.style.background = col;
                btn.style.borderColor = col;
            } else {
                btn.style.background = '';
                btn.style.borderColor = '';
            }
        });
        soundCells.appendChild(btn);
    }
    soundRow.appendChild(soundCells);
    soundSection.appendChild(soundRow);
    bodyEl.appendChild(soundSection);

    editorEl.appendChild(bodyEl);
}

// -------------------------------------------------------
// ステップボタン共通ビルダー
// -------------------------------------------------------
function buildSteps(steps, octStyle = null) {
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'steps-scroll';
    const stepsEl = document.createElement('div');
    stepsEl.className = 'steps';

    if (octStyle) {
        stepsEl.style.setProperty('--on-bg',     octStyle.on);
        stepsEl.style.setProperty('--on-border',  octStyle.border);
    }

    steps.forEach((on, stepIdx) => {
        const btn = document.createElement('button');
        btn.className = 'step' + (on ? ' on' : '');
        btn.addEventListener('click', () => {
            steps[stepIdx] = !steps[stepIdx];
            btn.classList.toggle('on', steps[stepIdx]);
        });
        stepsEl.appendChild(btn);
    });

    scrollWrap.appendChild(stepsEl);
    return scrollWrap;
}

// -------------------------------------------------------
// 再生 / 停止
// -------------------------------------------------------
document.getElementById('playBtn').addEventListener('click', async () => {
    const bpm   = Number(document.getElementById('bpmInput').value) || 120;
    const score = Array(16).fill(null);

    tracks.forEach(track => {
        if (INST_TYPE[track.instrument] === 'rhythm') {
            track.rows.forEach(row => {
                row.steps.forEach((on, i) => {
                    if (!on) return;
                    score[i] = score[i] || [];
                    score[i].push({ instrument: track.instrument, notes: row.note });
                });
            });
        } else if (INST_TYPE[track.instrument] === 'chord') {
            // chordMap の最新エントリを引き継ぎながらスキャン
            let currentChord = null;
            for (let i = 0; i < 16; i++) {
                if (track.chordMap[i]) currentChord = track.chordMap[i];
                if (track.soundSteps[i] && currentChord) {
                    const notes = getChordNotes(currentChord.root, currentChord.type, currentChord.octave);
                    score[i] = score[i] || [];
                    score[i].push({ instrument: 'piano', notes: notes.length === 1 ? notes[0] : notes });
                }
            }
        } else {
            // 同ステップの複数ノートを配列にまとめてコードとして発音
            const stepNotes = Array.from({ length: 16 }, () => []);
            Object.entries(track.stepsMap).forEach(([note, steps]) => {
                steps.forEach((on, i) => { if (on) stepNotes[i].push(note); });
            });
            stepNotes.forEach((notes, i) => {
                if (notes.length === 0) return;
                score[i] = score[i] || [];
                score[i].push({ instrument: track.instrument, notes: notes.length === 1 ? notes[0] : notes });
            });
        }
    });

    await play(score, { bpm });
});

document.getElementById('stopBtn').addEventListener('click', () => stop());

// -------------------------------------------------------
// トラック追加モーダル
// -------------------------------------------------------
const modal = document.getElementById('modal');

document.getElementById('addTrackBtn').addEventListener('click', () => {
    closeSidebar();
    modal.classList.add('open');
});
document.getElementById('modalCancel').addEventListener('click', () => modal.classList.remove('open'));
modal.querySelectorAll('[data-inst]').forEach(btn => {
    btn.addEventListener('click', () => {
        addTrack(btn.dataset.inst);
        modal.classList.remove('open');
    });
});

// -------------------------------------------------------
// 初期トラック
// -------------------------------------------------------
addTrack('drums');
addTrack('chord');
addTrack('piano');
