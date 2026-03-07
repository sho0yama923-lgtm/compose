// duration-toolbar.js — デュレーション選択ツールバー

import { appState } from '../core/state.js';
import { DURATION_LIST } from '../core/constants.js';
import { getEffectiveDuration } from '../core/duration.js';

/**
 * デュレーションツールバーを生成してコンテナに追加
 * @param {HTMLElement} containerEl - ツールバーを追加する親要素
 * @param {Function} onUpdate - ツールバー変更時のコールバック（再描画用）
 */
export function renderDurationToolbar(containerEl, onUpdate) {
    const toolbar = document.createElement('div');
    toolbar.className = 'duration-toolbar';

    const modeRow = document.createElement('div');
    modeRow.className = 'duration-mode-row';

    const modeLabel = document.createElement('span');
    modeLabel.className = 'duration-row-label';
    modeLabel.textContent = '編集線';
    modeRow.appendChild(modeLabel);

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
            if (appState.editorGridMode === 'normal' && !appState.selectedDuration.endsWith('t')) {
                appState.lastNormalDuration = appState.selectedDuration;
            }
            if (appState.editorGridMode === 'triplet' && appState.selectedDuration.endsWith('t')) {
                appState.lastTripletDuration = appState.selectedDuration;
            }
            appState.editorGridMode = value;
            appState.selectedDuration = value === 'triplet'
                ? appState.lastTripletDuration
                : appState.lastNormalDuration;
            appState.dottedMode = false;
            if (onUpdate) onUpdate();
        });
        modeTabs.appendChild(btn);
    });
    modeRow.appendChild(modeTabs);
    toolbar.appendChild(modeRow);

    const valueRow = document.createElement('div');
    valueRow.className = 'duration-value-row';

    const valueLabel = document.createElement('span');
    valueLabel.className = 'duration-row-label';
    valueLabel.textContent = '長さ';
    valueRow.appendChild(valueLabel);

    const valueButtons = document.createElement('div');
    valueButtons.className = 'duration-value-buttons';

    // --- 音価ボタン ---
    getVisibleDurations().forEach(({ value, label }) => {
        const btn = document.createElement('button');
        btn.className = 'dur-btn' + (appState.selectedDuration === value ? ' selected' : '');
        btn.type = 'button';
        btn.title = label;
        btn.setAttribute('aria-label', label);

        const meta = getDurationButtonMeta(value);
        const iconWrap = document.createElement('span');
        iconWrap.className = 'dur-icon-wrap';

        const iconEl = buildDurationIcon(meta);
        iconWrap.appendChild(iconEl);

        if (meta.badge) {
            const badgeEl = document.createElement('span');
            badgeEl.className = 'dur-badge';
            badgeEl.textContent = meta.badge;
            iconWrap.appendChild(badgeEl);
        }

        const labelEl = document.createElement('span');
        labelEl.className = 'dur-label';
        labelEl.textContent = label;

        btn.appendChild(iconWrap);
        btn.appendChild(labelEl);
        btn.addEventListener('click', () => {
            appState.selectedDuration = value;
            if (value.endsWith('t')) appState.lastTripletDuration = value;
            else appState.lastNormalDuration = value;
            if (value.endsWith('t')) {
                appState.dottedMode = false;
            } else {
                appState.dottedMode = false; // 音価変更時は付点リセット
            }
            if (onUpdate) onUpdate();
        });
        valueButtons.appendChild(btn);
    });

    // --- 付点ボタン ---
    const canDot = appState.editorGridMode === 'normal' && ['8n', '4n', '2n'].includes(appState.selectedDuration);
    const dotBtn = document.createElement('button');
    dotBtn.className = 'dur-btn dotted' + (appState.dottedMode ? ' selected' : '');
    dotBtn.type = 'button';
    dotBtn.title = '付点';
    dotBtn.innerHTML = '<span class="dur-icon-wrap"><span class="dur-icon">.</span></span><span class="dur-label">付点</span>';
    dotBtn.disabled = !canDot;
    dotBtn.addEventListener('click', () => {
        appState.dottedMode = !appState.dottedMode;
        if (onUpdate) onUpdate();
    });
    valueButtons.appendChild(dotBtn);

    valueRow.appendChild(valueButtons);
    toolbar.appendChild(valueRow);

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

function getDurationButtonMeta(value) {
    const map = {
        '1n': { kind: 'whole' },
        '2n': { kind: 'half' },
        '4n': { icon: '♩' },
        '8n': { icon: '♪' },
        '16n': { icon: '♬' },
        '8t': { icon: '♪', badge: '3' },
        '16t': { icon: '♬', badge: '3' },
    };
    return map[value] ?? { icon: '♪' };
}

function buildDurationIcon(meta) {
    if (meta.kind === 'whole') {
        const el = document.createElement('span');
        el.className = 'dur-icon whole-note-icon';
        el.innerHTML = '<span class="note-head"></span>';
        return el;
    }

    if (meta.kind === 'half') {
        const el = document.createElement('span');
        el.className = 'dur-icon half-note-icon';
        el.innerHTML = '<span class="note-head"></span><span class="note-stem"></span>';
        return el;
    }

    const el = document.createElement('span');
    el.className = 'dur-icon';
    el.textContent = meta.icon;
    return el;
}
