// editor-router.js - editor renderer/router

import { appState, callbacks } from '../core/state.js';
import { INST_LABEL, INST_TYPE } from '../features/tracks/instrument-map.js';
import { syncTrackRepeats } from '../features/tracks/tracks-controller.js';
import { renderDrumEditor } from './drum-editor.js';
import { renderMelodicEditor } from './melodic-editor.js';
import { renderChordEditor } from './chord-editor.js';
import { renderPreview, restorePreviewScroll } from './preview-editor.js';
import { buildSeekBar } from '../ui/bottom-bar.js';
import { setTopbarTitle, syncViewToggleButton } from '../ui/topbar.js';

export function renderEditor() {
    const emptyState = document.getElementById('emptyState');
    const editorEl = document.getElementById('trackEditor');
    syncPreviewScrollSnapshot(editorEl);
    editorEl.classList.remove('melodic-track-editor', 'drum-track-editor', 'chord-track-editor', 'preview-editor');
    syncTrackRepeats();

    if (appState.tracks.length === 0) {
        emptyState.style.display = '';
        editorEl.style.display = 'none';
        editorEl.innerHTML = '';
        return;
    }

    if (appState.previewMode || appState.activeTrackId === null) {
        emptyState.style.display = 'none';
        editorEl.style.display = '';
        editorEl.innerHTML = '';
        editorEl.classList.add('preview-editor');

        setTopbarTitle(getCurrentTrackTitle());
        syncViewToggleButton(true);
        renderPreview(editorEl);
        editorEl.appendChild(buildSeekBar(callbacks.renderEditor || renderEditor));
        restorePreviewScrollSnapshot(editorEl);
        return;
    }

    const track = appState.tracks.find((t) => t.id === appState.activeTrackId);
    if (!track) return;

    setTopbarTitle(INST_LABEL[track.instrument]);
    syncViewToggleButton(false);

    emptyState.style.display = 'none';
    editorEl.style.display = '';
    editorEl.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'editor-header';
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

    editorEl.appendChild(buildSeekBar(callbacks.renderEditor || renderEditor));
}

function getCurrentTrackTitle() {
    const track = appState.tracks.find((t) => t.id === appState.activeTrackId);
    return track ? INST_LABEL[track.instrument] : '作曲ツール';
}

function syncPreviewScrollSnapshot(editorEl) {
    if (!editorEl) return;
    const previewWrap = editorEl.querySelector('.preview-wrap');
    if (!previewWrap) return;
    appState.previewScrollTop = previewWrap.scrollTop;
}

function restorePreviewScrollSnapshot(editorEl) {
    if (!editorEl) return;
    const previewWrap = editorEl.querySelector('.preview-wrap');
    if (!previewWrap) return;

    restorePreviewScroll(previewWrap);
    requestAnimationFrame(() => {
        restorePreviewScroll(previewWrap);
        requestAnimationFrame(() => restorePreviewScroll(previewWrap));
    });
}
