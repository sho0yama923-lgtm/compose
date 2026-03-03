// sidebar.js — サイドバー開閉 + トラックリスト描画

import { appState } from './state.js';
import { INST_LABEL } from './instruments.js';
import { selectTrack, deleteTrack } from './track-manager.js';

const sidebarEl = document.getElementById('sidebar');
const overlayEl = document.getElementById('sidebarOverlay');

export function openSidebar() {
    sidebarEl.classList.add('open');
    overlayEl.classList.add('open');
}

export function closeSidebar() {
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
    document.getElementById('menuBtn').addEventListener('click', openSidebar);
    overlayEl.addEventListener('click', closeSidebar);
}
