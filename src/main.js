// app.js — エントリポイント: コールバック登録 + 各モジュール初期化

import { appState, callbacks, clearPendingDeleteNote } from './core/state.js';
import { renderEditor } from './editors/editor-router.js';
import { renderSidebar, closeSidebar, initSidebar } from './ui/track-drawer.js';
import { addTrack } from './features/tracks/tracks-controller.js';
import { initPlayback } from './features/playback/playback-controller.js';
import { initModal } from './ui/instrument-modal.js';
import { initOnboarding } from './ui/onboarding.js';
import { syncViewToggleButton } from './ui/topbar.js';
import { saveState, loadState, initSaveLoad } from './features/project/project-storage.js';
import { prepareAudioPlayback } from './features/bridges/audio-bridge.js';

let audioWarmupPromise = null;
let audioWarmupUnlockAt = 0;

const AUDIO_BOOT_MIN_LOCK_MS = 1200;
const AUDIO_RESUME_MIN_LOCK_MS = 800;

// 循環依存を回避するコールバック登録（自動保存フック付き）
callbacks.renderEditor = (...args) => {
    renderEditor(...args);
    if (!appState.isPlaying) void saveState();
};
callbacks.renderSidebar = (...args) => {
    renderSidebar(...args);
    if (!appState.isPlaying) void saveState();
};
callbacks.closeSidebar = closeSidebar;
callbacks.saveState = () => {
    if (!appState.isPlaying) void saveState();
};

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

function refreshPlaybackAvailabilityUi() {
    callbacks.renderSidebar?.();
    callbacks.renderEditor?.();
}

function wait(ms) {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

async function warmupAudioForPlayback({ minimumLockMs = AUDIO_BOOT_MIN_LOCK_MS } = {}) {
    audioWarmupUnlockAt = Math.max(audioWarmupUnlockAt, performance.now() + minimumLockMs);
    if (audioWarmupPromise) return audioWarmupPromise;

    appState.isBooting = true;
    refreshPlaybackAvailabilityUi();

    audioWarmupPromise = (async () => {
        try {
            await prepareAudioPlayback(appState.tracks);
        } catch (error) {
            console.warn('[Audio] playback warmup failed:', error);
        } finally {
            await wait(audioWarmupUnlockAt - performance.now());
            appState.isBooting = false;
            audioWarmupPromise = null;
            audioWarmupUnlockAt = 0;
            refreshPlaybackAvailabilityUi();
        }
    })();

    return audioWarmupPromise;
}

function setupPlaybackWarmupLifecycle() {
    window.addEventListener('pageshow', () => {
        void warmupAudioForPlayback({
            minimumLockMs: AUDIO_RESUME_MIN_LOCK_MS,
        });
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        void warmupAudioForPlayback({
            minimumLockMs: AUDIO_RESUME_MIN_LOCK_MS,
        });
    });
}

async function boot() {
    // 各モジュール初期化
    initSidebar();
    initPlayback();
    initModal();
    initSaveLoad();
    setupPlaybackWarmupLifecycle();

    document.getElementById('trackModeBtn').addEventListener('click', () => {
        if (appState.activeTrackId === null) return;
        appState.previewMode = false;
        callbacks.renderEditor();
    });
    document.getElementById('viewToggleBtn').addEventListener('click', () => {
        appState.previewMode = true;
        callbacks.renderEditor();
    });

    document.addEventListener('click', (event) => {
        if (!appState.pendingDeleteNoteId) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('.timeline-note, .melody-grid-note')) return;
        clearPendingDeleteNote();
        callbacks.renderEditor();
    });

    // 起動時: 保存データがあれば復元、なければデフォルトトラック生成
    // (loadState成功でもトラック0件ならデフォルト作成)
    if (!(await loadState()) || appState.tracks.length === 0) {
        // beatConfig 初期化（全小節デフォルト [4,4,4,4]）
        appState.beatConfig = Array.from({ length: appState.numMeasures }, () => [4, 4, 4, 4]);
        addTrack('drums');
        addTrack('chord');
        addTrack('piano');
    }

    await warmupAudioForPlayback({
        minimumLockMs: AUDIO_BOOT_MIN_LOCK_MS,
    });

    // ローディング表示を解除し、本来のempty-stateメッセージに切替
    const emptyIcon = document.getElementById('emptyStateIcon');
    const emptyText = document.getElementById('emptyStateText');
    if (emptyIcon) emptyIcon.classList.remove('loading');
    if (emptyText) emptyText.innerHTML = '☰ メニューを開いて<br>トラックを選択してください';

    // 起動時はプレビュー画面を表示
    appState.previewMode = true;
    syncViewToggleButton(true);
    callbacks.renderSidebar();
    callbacks.renderEditor();
    initOnboarding();
}

boot().catch((error) => {
    appState.isBooting = false;
    audioWarmupPromise = null;
    showBootError(error);
});
