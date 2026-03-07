// editor-router.js — エディタ描画ルーター（シークバー + エディタ振り分け）

import { appState, callbacks } from '../core/state.js';
import { INST_LABEL, INST_TYPE } from '../features/tracks/instrument-map.js';
import { renderDrumEditor } from './drum-editor.js';
import { renderMelodicEditor } from './melodic-editor.js';
import { renderChordEditor } from './chord-editor.js';
import { renderPreview } from './preview-editor.js';
import { buildSeekBar } from '../ui/bottom-bar.js';
import { setTopbarTitle, syncViewToggleButton } from '../ui/topbar.js';
import { addMeasure, removeMeasure } from '../features/tracks/tracks-controller.js';

export function renderEditor() {
    const emptyState = document.getElementById('emptyState');
    const editorEl   = document.getElementById('trackEditor');
    editorEl.classList.remove('melodic-track-editor', 'drum-track-editor', 'chord-track-editor', 'preview-editor');

    // トラックが無い場合
    if (appState.tracks.length === 0) {
        emptyState.style.display = '';
        editorEl.style.display   = 'none';
        editorEl.innerHTML       = '';
        return;
    }

    // プレビューモードまたはトラック未選択
    if (appState.previewMode || appState.activeTrackId === null) {
        emptyState.style.display = 'none';
        editorEl.style.display   = '';
        editorEl.innerHTML       = '';
        editorEl.classList.add('preview-editor');

        setTopbarTitle(getCurrentTrackTitle());
        syncViewToggleButton(true);

        renderPreview(editorEl);

        // シークバーを下部に追加
        const seekRow = buildSeekBar(renderEditor);
        editorEl.appendChild(seekRow);
        return;
    }

    const track = appState.tracks.find(t => t.id === appState.activeTrackId);
    if (!track) return;
    setTopbarTitle(INST_LABEL[track.instrument]);
    syncViewToggleButton(false);

    emptyState.style.display = 'none';
    editorEl.style.display   = '';
    editorEl.innerHTML       = '';

    const header = document.createElement('div');
    header.className = 'editor-header';
    header.style.justifyContent = 'flex-end';
    header.appendChild(buildMeasureActions());
    editorEl.appendChild(header);

    if (INST_TYPE[track.instrument] === 'rhythm') {
        editorEl.classList.add('drum-track-editor');
        renderDrumEditor(track, editorEl);
    } else if (INST_TYPE[track.instrument] === 'chord') {
        editorEl.classList.add('chord-track-editor');
        renderChordEditor(track, editorEl);
    } else {
        editorEl.classList.add('melodic-track-editor');
        renderMelodicEditor(track, editorEl);
    }

    editorEl.appendChild(buildSeekBar(renderEditor));
}

function getCurrentTrackTitle() {
    const track = appState.tracks.find(t => t.id === appState.activeTrackId);
    return track ? INST_LABEL[track.instrument] : '作曲ツール';
}

function buildMeasureActions() {
    const wrap = document.createElement('div');
    wrap.className = 'measure-actions';

    const label = document.createElement('span');
    label.className = 'measure-actions-label';
    label.textContent = '小節';
    wrap.appendChild(label);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'measure-action-btn remove';
    removeBtn.type = 'button';
    removeBtn.textContent = '−';
    removeBtn.title = '小節を削除';
    removeBtn.disabled = appState.numMeasures <= 1;
    removeBtn.addEventListener('click', () => {
        if (confirm(`今見ている ${appState.currentMeasure + 1} 小節目を削除しますか？`)) {
            removeMeasure();
        }
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'measure-action-btn add';
    addBtn.type = 'button';
    addBtn.textContent = '+';
    addBtn.title = '小節を追加';
    addBtn.addEventListener('click', addMeasure);

    wrap.appendChild(removeBtn);
    wrap.appendChild(addBtn);
    return wrap;
}
