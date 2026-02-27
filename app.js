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
        const allOctaves = OCTAVE_RANGE[instrument];
        const stepsMap   = {};
        allOctaves.forEach(oct => {
            CHROMATIC.forEach(n => { stepsMap[`${n}${oct}`] = Array(16).fill(false); });
        });
        // デフォルト: 中央を軸に最大3オクターブを表示
        const mid            = Math.floor(allOctaves.length / 2);
        const half           = Math.floor(Math.min(3, allOctaves.length) / 2);
        const startIdx       = Math.max(0, mid - half);
        const visibleOctaves = allOctaves.slice(startIdx, startIdx + Math.min(3, allOctaves.length));
        track = {
            id, instrument,
            activeOctave: visibleOctaves[Math.floor(visibleOctaves.length / 2)],
            visibleOctaves,
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
// メロディエディタ（オクターブセレクター + アコーディオン）
// -------------------------------------------------------
function renderMelodicEditor(track, editorEl) {
    const allOctaves = OCTAVE_RANGE[track.instrument];

    // ----- オクターブセレクター -----
    const selectorEl = document.createElement('div');
    selectorEl.className = 'oct-selector';

    allOctaves.forEach(o => {
        const btn = document.createElement('button');
        btn.className = 'oct-selector-btn' + (track.visibleOctaves.includes(o) ? ' selected' : '');
        btn.textContent = OCT_COLOR[o].label;
        btn.style.setProperty('--oct-color', OCT_COLOR[o].on);
        btn.addEventListener('click', () => {
            if (track.visibleOctaves.includes(o)) {
                if (track.visibleOctaves.length <= 1) return; // 最低1つは残す
                track.visibleOctaves = track.visibleOctaves.filter(v => v !== o);
                if (track.activeOctave === o) track.activeOctave = track.visibleOctaves[0];
            } else {
                // 元の順序を維持して追加
                track.visibleOctaves = allOctaves.filter(v => track.visibleOctaves.includes(v) || v === o);
            }
            renderEditor();
        });
        selectorEl.appendChild(btn);
    });
    editorEl.appendChild(selectorEl);

    // ----- アコーディオン -----
    const accordionEl = document.createElement('div');
    accordionEl.className = 'oct-accordion';

    track.visibleOctaves.forEach(o => {
        const isActive = o === track.activeOctave;
        const octStyle = OCT_COLOR[o];

        const section = document.createElement('div');
        section.className = 'oct-section' + (isActive ? ' active' : '');

        // ヘッダーバー
        const headerEl = document.createElement('div');
        headerEl.className = 'oct-section-header';
        headerEl.style.setProperty('--oct-color', octStyle.on);

        const labelEl = document.createElement('span');
        labelEl.className = 'oct-section-label';
        labelEl.textContent = octStyle.label;
        headerEl.appendChild(labelEl);

        if (!isActive) {
            // ミニプレゼンスストリップ（どのステップに音があるか）
            const miniStrip = document.createElement('div');
            miniStrip.className = 'oct-mini-strip';
            for (let i = 0; i < 16; i++) {
                const hasNote = CHROMATIC.some(n => track.stepsMap[`${n}${o}`]?.[i]);
                const cell = document.createElement('div');
                cell.className = 'oct-mini-cell' + (hasNote ? ' on' : '');
                if (hasNote) cell.style.background = octStyle.on;
                miniStrip.appendChild(cell);
            }
            headerEl.appendChild(miniStrip);

            // タップで展開、現在のアクティブを閉じる
            headerEl.addEventListener('click', () => {
                track.activeOctave = o;
                renderEditor();
            });
        }

        section.appendChild(headerEl);
        if (isActive) section.appendChild(buildOctaveGrid(track, o));
        accordionEl.appendChild(section);
    });

    editorEl.appendChild(accordionEl);
}

// -------------------------------------------------------
// 単一オクターブ グリッド（ピアノ鍵盤 + ステップ16列）
// -------------------------------------------------------
function buildOctaveGrid(track, octave) {
    const octStyle  = OCT_COLOR[octave];
    const melodicEl = document.createElement('div');
    melodicEl.className = 'melodic-editor';

    // 左: ピアノ鍵盤列
    const keysEl = document.createElement('div');
    keysEl.className = 'piano-keys';
    keysEl.appendChild(Object.assign(document.createElement('div'), { className: 'piano-key-spacer' }));

    // 右: ステップグリッド
    const gridScrollEl = document.createElement('div');
    gridScrollEl.className = 'steps-grid-scroll';
    const gridEl = document.createElement('div');
    gridEl.className = 'steps-grid';

    // ヘッダー行（ビート番号 1〜4）
    const headerEl = document.createElement('div');
    headerEl.className = 'steps-header';
    const headerGroup = document.createElement('div');
    headerGroup.className = 'step-group';
    for (let i = 0; i < 16; i++) {
        const cell = document.createElement('div');
        cell.className = 'step-header-cell' + (i % 4 === 0 ? ' beat' : '');
        cell.textContent = i % 4 === 0 ? String(i / 4 + 1) : '·';
        if (i % 4 === 0) cell.style.color = octStyle.on;
        headerGroup.appendChild(cell);
    }
    headerEl.appendChild(headerGroup);
    gridEl.appendChild(headerEl);

    // 12音行（B〜C）— 高音が上
    [...CHROMATIC].reverse().forEach(noteName => {
        const isBlack = BLACK_KEYS.has(noteName);

        const keyEl = document.createElement('div');
        keyEl.className = 'piano-key ' + (isBlack ? 'black-key' : 'white-key');
        keyEl.textContent = noteName;
        keysEl.appendChild(keyEl);

        const rowEl = document.createElement('div');
        rowEl.className = 'steps-row' + (isBlack ? ' black-key' : '');

        const steps     = track.stepsMap[`${noteName}${octave}`];
        const noteGroup = document.createElement('div');
        noteGroup.className = 'step-group';
        noteGroup.style.setProperty('--on-bg',     octStyle.on);
        noteGroup.style.setProperty('--on-border', octStyle.border);

        steps.forEach((on, stepIdx) => {
            const btn = document.createElement('button');
            btn.className = 'step' + (on ? ' on' : '');
            btn.addEventListener('click', () => {
                steps[stepIdx] = !steps[stepIdx];
                btn.classList.toggle('on', steps[stepIdx]);
            });
            noteGroup.appendChild(btn);
        });
        rowEl.appendChild(noteGroup);
        gridEl.appendChild(rowEl);
    });

    gridScrollEl.appendChild(gridEl);
    melodicEl.appendChild(keysEl);
    melodicEl.appendChild(gridScrollEl);
    return melodicEl;
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
