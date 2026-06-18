// app.js — エントリポイント: コールバック登録 + 各モジュール初期化

import { appState, callbacks, clearPendingDeleteNote } from './core/state.js';
import { APP_VERSION } from './core/app-info.js';
import { renderEditor } from './editors/editor-router.js';
import { renderSidebar, closeSidebar, initSidebar } from './ui/track-drawer.js';
import { addTrack, selectTrack } from './features/tracks/tracks-controller.js';
import { initPlayback } from './features/playback/playback-controller.js';
import { initModal } from './ui/instrument-modal.js';
import { initOnboarding } from './ui/onboarding.js';
import { renderTopbarTabs, syncViewToggleButton } from './ui/topbar.js';
import {
    createProject,
    deleteProject,
    deleteProjects,
    exportJSON,
    exportProjectsJSON,
    initProjectStorage,
    initSaveLoad,
    openProject,
    renameProject,
    saveState,
} from './features/project/project-storage.js';
import { prepareAudioPlayback } from './features/bridges/audio-bridge.js';
import { renderProjectHome, setProjectHomeVisible } from './ui/project-home.js';
import { requestProjectImport } from './features/bridges/file-share-bridge.js';
import { getAppRuntime, isWebApp } from './features/bridges/device-bridge.js';
import { applyCanonSample } from './features/project/canon-sample.js';
import { emitTutorialAction } from './core/tutorial-events.js';

let audioWarmupPromise = null;
document.documentElement.dataset.appVersion = APP_VERSION;
document.documentElement.dataset.appRuntime = getAppRuntime();

function setupWebViewportHeight() {
    if (!isWebApp()) return;

    const syncViewportHeight = () => {
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        document.documentElement.style.setProperty('--app-viewport-height', `${Math.round(viewportHeight)}px`);
    };

    syncViewportHeight();
    window.addEventListener('resize', syncViewportHeight, { passive: true });
    window.addEventListener('orientationchange', syncViewportHeight, { passive: true });
    window.visualViewport?.addEventListener('resize', syncViewportHeight, { passive: true });
    window.visualViewport?.addEventListener('scroll', syncViewportHeight, { passive: true });
}

setupWebViewportHeight();

function showBootOverlay() {
    const overlay = document.getElementById('bootOverlay');
    if (!overlay) return;
    overlay.classList.remove('hide');
    overlay.style.display = '';
}

function hideBootOverlay() {
    const overlay = document.getElementById('bootOverlay');
    if (!overlay) return;
    overlay.classList.add('hide');
    // transitionend で完全に消す
    const onEnd = () => {
        overlay.style.display = 'none';
        overlay.removeEventListener('transitionend', onEnd);
    };
    overlay.addEventListener('transitionend', onEnd);
}

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
callbacks.renderProjectHome = () => renderProjectHome(projectHomeHandlers);
callbacks.showProjectHome = () => {
    setProjectHomeVisible(true);
    callbacks.renderProjectHome?.();
};
callbacks.showProjectEditor = () => {
    setProjectHomeVisible(false);
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

async function warmupAudioForPlayback() {
    if (audioWarmupPromise) return audioWarmupPromise;

    appState.isBooting = true;
    showBootOverlay();
    refreshPlaybackAvailabilityUi();

    audioWarmupPromise = (async () => {
        try {
            await prepareAudioPlayback(appState.tracks);
        } catch (error) {
            console.warn('[Audio] playback warmup failed:', error);
        } finally {
            appState.isBooting = false;
            audioWarmupPromise = null;
            hideBootOverlay();
            refreshPlaybackAvailabilityUi();
        }
    })();

    return audioWarmupPromise;
}

function setupPlaybackWarmupLifecycle() {
    window.addEventListener('pageshow', () => {
        if (!appState.activeProjectId || appState.projectHomeVisible) return;
        void warmupAudioForPlayback();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (!appState.activeProjectId || appState.projectHomeVisible) return;
        void warmupAudioForPlayback();
    });
}

function resetComposerState() {
    appState.tracks = [];
    appState.nextId = 0;
    appState.activeTrackId = null;
    appState.lastTouchedTrackId = null;
    appState.numMeasures = 4;
    appState.currentMeasure = 0;
    appState.playheadStep = null;
    appState.isPlaying = false;
    appState.playRangeStartMeasure = null;
    appState.playRangeEndMeasure = null;
    appState.previewMode = true;
    appState.previewActionTrackId = null;
    appState.previewActionMenuOpen = false;
    appState.previewToneTrackId = null;
    appState.previewScrollTop = 0;
    appState.previewRangeMode = null;
    appState.previewRangeStartMeasure = null;
    appState.previewRangeEndMeasure = null;
    appState.clipboard = null;
    appState.repeatStates = {};
    appState.chordDrumSheetOpen = false;
    appState.chordDetailTrackId = null;
    appState.chordDetailStep = null;
    appState.drumAddTrackId = null;
    appState.drumAddOpenGroups = {};
    appState.pendingDeleteNoteId = null;
    appState.noteDrag = null;
    appState.suppressNextNoteClick = false;
    appState.songRoot = 'C';
    appState.songHarmony = 'major';
    appState.songScaleFamily = 'diatonic';
    appState.editorGridMode = 'normal';
    appState.selectedDuration = '16n';
    appState.lastNormalDuration = '16n';
    appState.lastTripletDuration = '8t';
    appState.dottedMode = false;
    appState.tripletMode = false;
    appState.beatConfig = Array.from({ length: appState.numMeasures }, () => [4, 4, 4, 4]);
    const bpmInput = document.getElementById('bpmInput');
    if (bpmInput) bpmInput.value = '120';
}

async function showProjectEditor({
    offerOnboarding = false,
    forceOnboarding = false,
    startOnboardingImmediately = false,
} = {}) {
    setProjectHomeVisible(false);
    appState.previewMode = true;
    syncViewToggleButton(true);
    callbacks.renderSidebar();
    callbacks.renderEditor();
    await warmupAudioForPlayback();
    if (offerOnboarding) {
        initOnboarding({
            force: forceOnboarding,
            startImmediately: startOnboardingImmediately,
        });
    }
}

async function createDefaultProject(name, {
    forceOnboarding = false,
    startOnboardingImmediately = false,
} = {}) {
    await createProject(name);
    resetComposerState();
    addTrack('drums');
    addTrack('chord');
    addTrack('piano');
    applyCanonSample();
    appState.previewMode = true;
    await saveState();
    await showProjectEditor({
        offerOnboarding: true,
        forceOnboarding,
        startOnboardingImmediately,
    });
}

async function openExistingProject(projectId) {
    if (!(await openProject(projectId))) {
        alert('プロジェクトを読み込めませんでした');
        callbacks.renderProjectHome?.();
        return;
    }
    await showProjectEditor();
}

const projectHomeHandlers = {
    onCreateProject: (name) => {
        void createDefaultProject(name);
    },
    onOpenProject: (projectId) => {
        void openExistingProject(projectId);
    },
    onStartTutorial: () => {
        void createDefaultProject('チュートリアル', {
            forceOnboarding: true,
            startOnboardingImmediately: true,
        });
    },
    onRenameProject: (project) => {
        const nextName = window.prompt('プロジェクト名を入力してください', project.name);
        if (nextName === null) return;
        void renameProject(project.id, nextName);
    },
    onDeleteProject: (project) => {
        if (!confirm(`「${project.name}」を削除しますか？`)) return;
        void deleteProject(project.id);
    },
    onEnterProjectSelectionMode: () => {
        appState.projectSelectionMode = true;
        appState.selectedProjectIds = [];
        callbacks.renderProjectHome?.();
    },
    onExitProjectSelectionMode: () => {
        appState.projectSelectionMode = false;
        appState.selectedProjectIds = [];
        callbacks.renderProjectHome?.();
    },
    onToggleProjectSelection: (projectId) => {
        const selected = new Set(appState.selectedProjectIds);
        if (selected.has(projectId)) {
            selected.delete(projectId);
        } else {
            selected.add(projectId);
        }
        appState.selectedProjectIds = [...selected];
        callbacks.renderProjectHome?.();
    },
    onDeleteSelectedProjects: () => {
        const count = appState.selectedProjectIds.length;
        if (count === 0) return;
        if (!confirm(`選択した${count}件のプロジェクトを削除しますか？`)) return;
        void deleteProjects(appState.selectedProjectIds);
    },
    onExportSelectedProjects: () => {
        if (appState.selectedProjectIds.length === 0) return;
        void exportProjectsJSON(appState.selectedProjectIds);
    },
    onImportProject: () => {
        requestProjectImport(document.getElementById('importFile'));
    },
    onExportProject: () => {
        void exportJSON();
    },
};

async function boot() {
    // 各モジュール初期化
    initSidebar();
    initPlayback();
    initModal();
    initSaveLoad();

    document.getElementById('topbarTabs')?.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const tab = target.closest('.topbar-tab-btn');
        if (!(tab instanceof HTMLElement)) return;
        if (tab.dataset.topbarView === 'preview') {
            appState.previewMode = true;
            callbacks.renderEditor();
            emitTutorialAction('preview-view-opened');
            return;
        }
        const trackId = Number(tab.dataset.trackId);
        if (!Number.isFinite(trackId)) return;
        selectTrack(trackId);
    });

    document.addEventListener('click', (event) => {
        if (!appState.pendingDeleteNoteId) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('.timeline-note, .melody-grid-note')) return;
        clearPendingDeleteNote();
        callbacks.renderEditor();
    });

    await initProjectStorage();
    renderTopbarTabs();

    // ライフサイクル監視はプロジェクト選択後の再表示で音源を温め直す
    setupPlaybackWarmupLifecycle();

    // ローディング表示を解除し、本来のempty-stateメッセージに切替
    const emptyIcon = document.getElementById('emptyStateIcon');
    const emptyText = document.getElementById('emptyStateText');
    if (emptyIcon) emptyIcon.classList.remove('loading');
    if (emptyText) emptyText.innerHTML = '☰ メニューを開いて<br>トラックを選択してください';

    appState.isBooting = false;
    hideBootOverlay();
    setProjectHomeVisible(true);
    callbacks.renderProjectHome();
}

boot().catch((error) => {
    appState.isBooting = false;
    audioWarmupPromise = null;
    showBootError(error);
});
