// duration-toolbar.js — デュレーション選択ツールバー

import { appState } from './state.js';
import { DURATION_LIST } from './constants.js';
import { getEffectiveDuration } from './duration-utils.js';
import {
    applyBeatSubdivisionChange,
    cycleBeatSubdivision,
    getMeasureBeatConfig,
} from './rhythm-grid.js';

/**
 * デュレーションツールバーを生成してコンテナに追加
 * @param {HTMLElement} containerEl - ツールバーを追加する親要素
 * @param {Function} onUpdate - ツールバー変更時のコールバック（再描画用）
 */
export function renderDurationToolbar(containerEl, onUpdate) {
    const toolbar = document.createElement('div');
    toolbar.className = 'duration-toolbar';

    // --- 音価ボタン ---
    DURATION_LIST.forEach(({ value, label }) => {
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
    const canDot = ['8n', '4n', '2n'].includes(appState.selectedDuration);
    const dotBtn = document.createElement('button');
    dotBtn.className = 'dur-btn dotted' + (appState.dottedMode ? ' selected' : '');
    dotBtn.textContent = '付点';
    dotBtn.disabled = !canDot;
    dotBtn.addEventListener('click', () => {
        appState.dottedMode = !appState.dottedMode;
        if (onUpdate) onUpdate();
    });
    toolbar.appendChild(dotBtn);

    // --- 3連符ボタン ---
    const tripBtn = document.createElement('button');
    tripBtn.className = 'dur-btn triplet' + (appState.tripletMode ? ' selected' : '');
    tripBtn.textContent = '3連編集';
    tripBtn.addEventListener('click', () => {
        appState.tripletMode = !appState.tripletMode;
        if (appState.tripletMode) {
            appState.dottedMode = false;
        }
        if (onUpdate) onUpdate();
    });
    toolbar.appendChild(tripBtn);

    containerEl.appendChild(toolbar);

    if (appState.tripletMode) {
        renderTripletEditor(containerEl, onUpdate);
    }
}

/**
 * 現在の実効デュレーションを返す
 * @returns {string} 実効音価
 */
export function getCurrentDuration() {
    return getEffectiveDuration(appState.selectedDuration, appState.dottedMode);
}

function renderTripletEditor(containerEl, onUpdate) {
    const editor = document.createElement('div');
    editor.className = 'triplet-editor';

    const label = document.createElement('div');
    label.className = 'triplet-editor-label';
    label.textContent = '拍ごとの分割';
    editor.appendChild(label);

    const beatConfig = getMeasureBeatConfig(appState.currentMeasure);
    beatConfig.forEach((subs, beatIndex) => {
        const btn = document.createElement('button');
        btn.className = 'triplet-beat-btn';
        btn.textContent = `${beatIndex + 1}: ${formatSubdivisionLabel(subs)}`;
        btn.addEventListener('click', () => {
            applyBeatSubdivisionChange(appState.currentMeasure, beatIndex, cycleBeatSubdivision(subs));
            if (onUpdate) onUpdate();
        });
        editor.appendChild(btn);
    });

    containerEl.appendChild(editor);
}

function formatSubdivisionLabel(subs) {
    if (subs === 3) return '1拍3連';
    if (subs === 6) return '半拍3連';
    return '4分割';
}
