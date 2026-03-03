// app.js — エントリポイント: コールバック登録 + 各モジュール初期化

import { appState, callbacks } from './state.js';
import { renderEditor } from './editor-router.js';
import { renderSidebar, closeSidebar, initSidebar } from './sidebar.js';
import { addTrack } from './track-manager.js';
import { initPlayback } from './playback.js';
import { initModal } from './modal.js';
import { initSwipe } from './swipe.js';

// 循環依存を回避するコールバック登録
callbacks.renderEditor = renderEditor;
callbacks.renderSidebar = renderSidebar;
callbacks.closeSidebar = closeSidebar;

// 各モジュール初期化
initSidebar();
initPlayback();
initModal();
initSwipe();

// トップバータイトルクリックでプレビュー画面トグル
document.getElementById('topbarTitle').addEventListener('click', () => {
    appState.previewMode = !appState.previewMode;
    callbacks.renderEditor();
});

// 初期トラック
addTrack('drums');
addTrack('chord');
addTrack('piano');

// 起動時はプレビュー画面を表示
appState.previewMode = true;
callbacks.renderEditor();
