// modal.js — 楽器選択モーダル

import { INSTRUMENT_LIST } from '../features/tracks/instrument-map.js';
import { addTrack } from '../features/tracks/tracks-controller.js';
import { closeSidebar } from './track-drawer.js';

export function initModal() {
    const modal = document.getElementById('modal');
    const modalOptions = document.getElementById('modalOptions');

    // INSTRUMENT_LIST からモーダルボタンを動的生成
    INSTRUMENT_LIST.forEach(config => {
        const btn = document.createElement('button');
        btn.dataset.inst = config.id;
        const [emoji, ...rest] = config.label.split(' ');
        btn.innerHTML = `${emoji}<br>${rest.join(' ')}`;
        btn.addEventListener('click', () => {
            addTrack(config.id);
            modal.classList.remove('open');
        });
        modalOptions.appendChild(btn);
    });

    document.getElementById('addTrackBtn').addEventListener('click', () => {
        closeSidebar();
        modal.classList.add('open');
    });

    document.getElementById('modalCancel').addEventListener('click', () => {
        modal.classList.remove('open');
    });
}
