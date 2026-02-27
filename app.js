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

    if (!activeTrackId || tracks.length === 0) {
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
    track.rows.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'row';

        const rowHeader = document.createElement('div');
        rowHeader.className = 'row-header';
        const lbl = document.createElement('span');
        lbl.className = 'row-label';
        lbl.textContent = row.label;
        rowHeader.appendChild(lbl);
        rowEl.appendChild(rowHeader);

        rowEl.appendChild(buildSteps(row.steps));
        editorEl.appendChild(rowEl);
    });
}

// -------------------------------------------------------
// メロディエディタ（オクターブタブ + 12行）
// -------------------------------------------------------
function renderMelodicEditor(track, editorEl) {
    const oct      = track.activeOctave;
    const octStyle = OCT_COLOR[oct];

    // オクターブタブ
    const tabsEl = document.createElement('div');
    tabsEl.className = 'oct-tabs';
    OCTAVE_RANGE[track.instrument].forEach(o => {
        const tab = document.createElement('button');
        tab.className = 'oct-tab' + (o === oct ? ' active' : '');
        tab.textContent = OCT_COLOR[o].label;
        tab.style.setProperty('--tab-color', OCT_COLOR[o].on);
        tab.addEventListener('click', () => { track.activeOctave = o; renderEditor(); });
        tabsEl.appendChild(tab);
    });
    editorEl.appendChild(tabsEl);

    // 12音行（C〜B）
    CHROMATIC.forEach(noteName => {
        const fullNote = `${noteName}${oct}`;
        const steps    = track.stepsMap[fullNote];
        const isBlack  = BLACK_KEYS.has(noteName);

        const rowEl = document.createElement('div');
        rowEl.className = 'note-row' + (isBlack ? ' black-key' : '');

        const label = document.createElement('span');
        label.className = 'note-label';
        label.textContent = fullNote;
        rowEl.appendChild(label);

        rowEl.appendChild(buildSteps(steps, octStyle));
        editorEl.appendChild(rowEl);
    });
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
