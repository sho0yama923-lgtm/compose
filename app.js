// app.js — 状態管理・描画・イベント処理
import { play, stop } from './player.js';
import { DRUM_ROWS, CHROMATIC, BLACK_KEYS, OCTAVE_RANGE, OCT_COLOR, INST_LABEL } from './constants.js';

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

    if (instrument === 'drums') {
        track = {
            id, instrument,
            rows: DRUM_ROWS.map(r => ({ label: r.label, note: r.note, steps: Array(16).fill(false) })),
        };
    } else {
        const octaves  = OCTAVE_RANGE[instrument];
        const stepsMap = {};
        octaves.forEach(oct => {
            CHROMATIC.forEach(n => { stepsMap[`${n}${oct}`] = Array(16).fill(false); });
        });
        track = {
            id, instrument,
            activeOctave: octaves[Math.floor(octaves.length / 2)],
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

    if (track.instrument === 'drums') {
        renderDrumEditor(track, editorEl);
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
    const octaves = OCTAVE_RANGE[track.instrument];

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
            Object.entries(track.stepsMap).forEach(([note, steps]) => {
                steps.forEach((on, i) => {
                    if (!on) return;
                    score[i] = score[i] || [];
                    score[i].push({ instrument: track.instrument, notes: note });
                });
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
