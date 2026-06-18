import { appState } from '../core/state.js';
import { INST_LABEL, INST_TYPE } from '../features/tracks/instrument-map.js';

function getTopbarTrackLabel(track) {
    if (!track) return 'トラック';
    if (INST_TYPE[track.instrument] === 'chord') return 'コード';
    const baseLabel = INST_LABEL[track.instrument] ?? track.instrument;
    return baseLabel.replace(/^[^\p{Letter}\p{Number}]+/u, '').trim() || baseLabel;
}

export function setTopbarTitle() {
    renderTopbarTabs();
}

export function renderTopbarTabs() {
    const tabsEl = document.getElementById('topbarTabs');
    if (!tabsEl) return;

    const previewSelected = appState.previewMode || appState.activeTrackId === null;
    tabsEl.innerHTML = '';

    const previewButton = document.createElement('button');
    previewButton.className = 'btn topbar-tab-btn' + (previewSelected ? ' is-active' : '');
    previewButton.id = 'viewToggleBtn';
    previewButton.type = 'button';
    previewButton.dataset.topbarView = 'preview';
    previewButton.setAttribute('aria-pressed', String(previewSelected));
    previewButton.setAttribute('aria-label', previewSelected ? '全体表示中' : '全体表示へ切替');
    previewButton.textContent = '全体';
    tabsEl.appendChild(previewButton);

    appState.tracks.forEach((track) => {
        const selected = !previewSelected && appState.activeTrackId === track.id;
        const button = document.createElement('button');
        button.className = 'btn topbar-tab-btn' + (selected ? ' is-active' : '');
        button.type = 'button';
        button.dataset.trackId = String(track.id);
        button.setAttribute('aria-pressed', String(selected));
        button.setAttribute('aria-label', selected ? `${getTopbarTrackLabel(track)}を表示中` : `${getTopbarTrackLabel(track)}へ切替`);
        button.textContent = getTopbarTrackLabel(track);
        tabsEl.appendChild(button);
    });
}

export function syncViewToggleButton() {
    renderTopbarTabs();
}
