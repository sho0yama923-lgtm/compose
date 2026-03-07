// app.js — エントリポイント: コールバック登録 + 各モジュール初期化

import { appState, callbacks } from './core/state.js';
import { renderEditor } from './editors/editor-router.js';
import { renderSidebar, closeSidebar, initSidebar } from './ui/track-drawer.js';
import { addTrack } from './features/tracks/tracks-controller.js';
import { initPlayback } from './features/playback/playback-controller.js';
import { initModal } from './ui/instrument-modal.js';
import { initOnboarding } from './ui/onboarding.js';
import { syncViewToggleButton } from './ui/topbar.js';
import { saveState, loadState, initSaveLoad } from './features/project/project-storage.js';

// 循環依存を回避するコールバック登録（自動保存フック付き）
callbacks.renderEditor = (...args) => {
    renderEditor(...args);
    if (!appState.isPlaying) saveState();
};
callbacks.renderSidebar = (...args) => {
    renderSidebar(...args);
    if (!appState.isPlaying) saveState();
};
callbacks.closeSidebar = closeSidebar;

function showBootError(error) {
    console.error('boot failed:', error);
    const emptyIcon = document.getElementById('emptyStateIcon');
    const emptyText = document.getElementById('emptyStateText');
    if (emptyIcon) {
        emptyIcon.classList.remove('loading');
        emptyIcon.textContent = '⚠';
    }
    if (emptyText) {
        emptyText.innerHTML = '初期化に失敗しました。<br>ブラウザを再読み込みしてください';
    }
}

try {
    // 各モジュール初期化
    initSidebar();
    initPlayback();
    initModal();
    initSaveLoad();

    document.getElementById('trackModeBtn').addEventListener('click', () => {
        if (appState.activeTrackId === null) return;
        appState.previewMode = false;
        callbacks.renderEditor();
    });
    document.getElementById('viewToggleBtn').addEventListener('click', () => {
        appState.previewMode = true;
        callbacks.renderEditor();
    });

    // 起動時: 保存データがあれば復元、なければデフォルトトラック生成
    // (loadState成功でもトラック0件ならデフォルト作成)
    if (!loadState() || appState.tracks.length === 0) {
        // beatConfig 初期化（全小節デフォルト [4,4,4,4]）
        appState.beatConfig = Array.from({ length: appState.numMeasures }, () => [4, 4, 4, 4]);
        addTrack('drums');
        addTrack('chord');
        addTrack('piano');
    }

    // ローディング表示を解除し、本来のempty-stateメッセージに切替
    const emptyIcon = document.getElementById('emptyStateIcon');
    const emptyText = document.getElementById('emptyStateText');
    if (emptyIcon) emptyIcon.classList.remove('loading');
    if (emptyText) emptyText.innerHTML = '☰ メニューを開いて<br>トラックを選択してください';

    // 起動時はプレビュー画面を表示
    appState.previewMode = true;
    syncViewToggleButton(true);
    callbacks.renderEditor();
    initOnboarding();
} catch (error) {
    showBootError(error);
}
