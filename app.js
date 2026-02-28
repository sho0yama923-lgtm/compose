// app.js — 状態管理・描画・イベント処理
import { play, stop } from './player.js';
import { DRUM_ROWS, CHROMATIC, BLACK_KEYS, OCTAVE_DEFAULT_BASE, OCT_COLOR, INST_LABEL, INST_TYPE, CHORD_ROOTS, CHORD_TYPES } from './constants.js';

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
            // コード入力パネル状態
            chordMode: false,
            selectedChordRoot: 'C',
            selectedChordType: 'maj',
            selectedChordOctave: 4,
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
    } else {
        renderChordPanel(track, editorEl);
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
// コード入力パネル
// -------------------------------------------------------
function renderChordPanel(track, editorEl) {
    const panelEl = document.createElement('div');
    panelEl.className = 'chord-panel';

    // ── ヘッダー（折りたたみトグル） ──
    const headerBtn = document.createElement('button');
    headerBtn.className = 'chord-panel-header';
    headerBtn.innerHTML = `<span>🎵 コード入力</span><span class="chord-panel-arrow">${track.chordMode ? '▼' : '▶'}</span>`;
    headerBtn.addEventListener('click', () => {
        track.chordMode = !track.chordMode;
        renderEditor();
    });
    panelEl.appendChild(headerBtn);

    if (!track.chordMode) {
        editorEl.appendChild(panelEl);
        return;
    }

    // ── パネル本体 ──
    const bodyEl = document.createElement('div');
    bodyEl.className = 'chord-panel-body';

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
        btn.className = 'chord-root-btn' + (r === track.selectedChordRoot ? ' selected' : '');
        btn.textContent = r;
        btn.addEventListener('click', () => {
            track.selectedChordRoot = r;
            rootList.querySelectorAll('.chord-root-btn').forEach(b => b.classList.toggle('selected', b.textContent === r));
        });
        rootList.appendChild(btn);
    });
    rootRow.appendChild(rootList);
    bodyEl.appendChild(rootRow);

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
    bodyEl.appendChild(typeRow);

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
    bodyEl.appendChild(octRow);

    // ドラムパターン参照（リズムと同期）
    const drumTracks = tracks.filter(t => INST_TYPE[t.instrument] === 'rhythm');
    if (drumTracks.length > 0) {
        const drumRefEl = document.createElement('div');
        drumRefEl.className = 'chord-rhythm-ref';
        const refLabel = document.createElement('div');
        refLabel.className = 'chord-rhythm-title';
        refLabel.textContent = 'リズム参照';
        drumRefEl.appendChild(refLabel);
        drumTracks.forEach(dt => {
            dt.rows.forEach(row => {
                const rowEl = document.createElement('div');
                rowEl.className = 'chord-rhythm-row';
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
        bodyEl.appendChild(drumRefEl);
    }

    // コードステップ行
    const stepsSection = document.createElement('div');
    stepsSection.className = 'chord-steps-section';

    // ビートヘッダー
    const stepsHdr = document.createElement('div');
    stepsHdr.className = 'chord-steps-header';
    const hdrSpacer = document.createElement('span');
    hdrSpacer.className = 'chord-steps-label-spacer';
    stepsHdr.appendChild(hdrSpacer);
    const hdrCells = document.createElement('div');
    hdrCells.className = 'chord-steps-cells';
    for (let i = 0; i < 16; i++) {
        const cell = document.createElement('div');
        cell.className = 'chord-step-header-cell' + (i % 4 === 0 ? ' beat' : '');
        cell.textContent = i % 4 === 0 ? String(i / 4 + 1) : '·';
        hdrCells.appendChild(cell);
    }
    stepsHdr.appendChild(hdrCells);
    stepsSection.appendChild(stepsHdr);

    // コードステップボタン行
    const stepsRow = document.createElement('div');
    stepsRow.className = 'chord-steps-row';
    const rowLbl = document.createElement('span');
    rowLbl.className = 'chord-steps-label';
    rowLbl.textContent = 'コード';
    stepsRow.appendChild(rowLbl);
    const stepCells = document.createElement('div');
    stepCells.className = 'chord-steps-cells';

    // 各ステップのコード情報を track.stepsMap から検出
    // （コードを示す追加データは持たず、ステップ上のノートから判定する）
    // コード状態は track.chordSteps に保存
    if (!track.chordSteps) track.chordSteps = Array(16).fill(null);

    for (let i = 0; i < 16; i++) {
        const chord = track.chordSteps[i];
        const btn = document.createElement('button');
        btn.className = 'chord-step-btn' + (chord ? ' on' : '');
        btn.textContent = chord ? `${chord.root}${chord.type}` : '';
        btn.addEventListener('click', () => {
            if (chord) {
                // クリア: このステップのコード構成音をstepsMapからオフにする
                const notes = getChordNotes(chord.root, chord.type, chord.octave);
                notes.forEach(n => { if (track.stepsMap[n]) track.stepsMap[n][i] = false; });
                track.chordSteps[i] = null;
            } else {
                // 適用: このステップの全ノートをクリアしてからコード音をオン
                Object.values(track.stepsMap).forEach(s => { s[i] = false; });
                const notes = getChordNotes(track.selectedChordRoot, track.selectedChordType, track.selectedChordOctave);
                notes.forEach(n => { if (track.stepsMap[n]) track.stepsMap[n][i] = true; });
                track.chordSteps[i] = { root: track.selectedChordRoot, type: track.selectedChordType, octave: track.selectedChordOctave };
            }
            renderEditor();
        });
        stepCells.appendChild(btn);
    }
    stepsRow.appendChild(stepCells);
    stepsSection.appendChild(stepsRow);
    bodyEl.appendChild(stepsSection);

    panelEl.appendChild(bodyEl);
    editorEl.appendChild(panelEl);
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
        if (track.instrument === 'drums') {
            track.rows.forEach(row => {
                row.steps.forEach((on, i) => {
                    if (!on) return;
                    score[i] = score[i] || [];
                    score[i].push({ instrument: track.instrument, notes: row.note });
                });
            });
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
addTrack('piano');
