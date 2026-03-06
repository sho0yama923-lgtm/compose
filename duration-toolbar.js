// duration-toolbar.js — デュレーション選択ツールバー

import { appState } from './state.js';
import { DURATION_LIST } from './constants.js';
import { getEffectiveDuration } from './duration-utils.js';

/**
 * デュレーションツールバーを生成してコンテナに追加
 * @param {HTMLElement} containerEl - ツールバーを追加する親要素
 * @param {Function} onUpdate - ツールバー変更時のコールバック（再描画用）
 */
export function renderDurationToolbar(containerEl, onUpdate) {
    const toolbar = document.createElement('div');
    toolbar.className = 'duration-toolbar';

    const modeTabs = document.createElement('div');
    modeTabs.className = 'grid-mode-tabs';
    [
        { value: 'normal', label: '通常' },
        { value: 'triplet', label: '3連' },
    ].forEach(({ value, label }) => {
        const btn = document.createElement('button');
        btn.className = 'grid-mode-tab' + (appState.editorGridMode === value ? ' selected' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => {
            appState.editorGridMode = value;
            if (value === 'triplet' && !appState.selectedDuration.endsWith('t')) {
                appState.selectedDuration = '8t';
            }
            if (value === 'normal' && appState.selectedDuration.endsWith('t')) {
                appState.selectedDuration = '16n';
            }
            appState.dottedMode = false;
            if (onUpdate) onUpdate();
        });
        modeTabs.appendChild(btn);
    });
    toolbar.appendChild(modeTabs);

    // --- 音価ボタン ---
    getVisibleDurations().forEach(({ value, label }) => {
        const btn = document.createElement('button');
        btn.className = 'dur-btn' + (appState.selectedDuration === value ? ' selected' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => {
            appState.selectedDuration = value;
            if (value.endsWith('t')) {
                appState.dottedMode = false;
            } else {
                appState.dottedMode = false; // 音価変更時は付点リセット
            }
            if (onUpdate) onUpdate();
        });
        toolbar.appendChild(btn);
    });

    // --- 付点ボタン ---
    const canDot = appState.editorGridMode === 'normal' && ['8n', '4n', '2n'].includes(appState.selectedDuration);
    const dotBtn = document.createElement('button');
    dotBtn.className = 'dur-btn dotted' + (appState.dottedMode ? ' selected' : '');
    dotBtn.textContent = '付点';
    dotBtn.disabled = !canDot;
    dotBtn.addEventListener('click', () => {
        appState.dottedMode = !appState.dottedMode;
        if (onUpdate) onUpdate();
    });
    toolbar.appendChild(dotBtn);

    containerEl.appendChild(toolbar);
    return toolbar;
}

/**
 * 現在の実効デュレーションを返す
 * @returns {string} 実効音価
 */
export function getCurrentDuration() {
    return getEffectiveDuration(appState.selectedDuration, appState.dottedMode);
}

function getVisibleDurations() {
    if (appState.editorGridMode === 'triplet') {
        return DURATION_LIST.filter(({ value }) => value.endsWith('t'));
    }
    return DURATION_LIST.filter(({ value }) => !value.endsWith('t'));
}
