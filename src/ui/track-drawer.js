// sidebar.js — サイドバー開閉 + トラックリスト描画

import { appState } from '../core/state.js';
import { INST_LABEL } from '../features/tracks/instrument-map.js';
import { selectTrack, deleteTrack } from '../features/tracks/tracks-controller.js';

function getSidebarElements() {
    return {
        sidebarEl: document.getElementById('sidebar'),
        overlayEl: document.getElementById('sidebarOverlay'),
    };
}

export function openSidebar() {
    const { sidebarEl, overlayEl } = getSidebarElements();
    sidebarEl.classList.add('open');
    overlayEl.classList.add('open');
}

export function closeSidebar() {
    const { sidebarEl, overlayEl } = getSidebarElements();
    sidebarEl.classList.remove('open');
    overlayEl.classList.remove('open');
}

export function renderSidebar() {
    const list = document.getElementById('trackList');
    list.innerHTML = '';
    appState.tracks.forEach(track => {
        const li = document.createElement('li');
        li.className = 'track-item' + (track.id === appState.activeTrackId ? ' active' : '');
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

export function initSidebar() {
    const { overlayEl } = getSidebarElements();
    document.getElementById('menuBtn').addEventListener('click', openSidebar);
    overlayEl.addEventListener('click', closeSidebar);
}
