// 音価、付点、通常 / 3連モードを選ぶツールバー。

import { appState } from '../core/state.js';
import { DURATION_LIST } from '../core/constants.js';
import { getEffectiveDuration } from '../core/duration.js';
import wholeNoteIconUrl from '../assets/全音符.svg';
import halfNoteIconUrl from '../assets/二分音符.svg';
import quarterNoteIconUrl from '../assets/四分音符.svg';
import eighthNoteIconUrl from '../assets/八分音符.svg';
import sixteenthNoteIconUrl from '../assets/十六分音符.svg';

/**
 * 音価ツールバーを生成してコンテナに追加する。
 * @param {HTMLElement} containerEl - ツールバーを追加する親要素
 * @param {Function} onUpdate - ツールバー変更時のコールバック（再描画用）
 */
export function renderDurationToolbar(containerEl, onUpdate) {
    const toolbar = document.createElement('div');
    toolbar.className = 'duration-toolbar';

    const modeRow = document.createElement('div');
    modeRow.className = 'duration-mode-row';

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

    const valueButtons = document.createElement('div');
    valueButtons.className = 'duration-value-buttons';

    // 音価ボタン
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

        btn.appendChild(iconWrap);
        btn.addEventListener('click', () => {
            appState.selectedDuration = value;
            if (value.endsWith('t')) appState.lastTripletDuration = value;
            else appState.lastNormalDuration = value;
            if (value.endsWith('t')) {
                appState.dottedMode = false;
            } else {
                appState.dottedMode = false;
            }
            if (onUpdate) onUpdate();
        });
        valueButtons.appendChild(btn);
    });

    // 付点ボタン
    const canDot = appState.editorGridMode === 'normal' && ['8n', '4n', '2n'].includes(appState.selectedDuration);
    if (canDot) {
        const dotBtn = document.createElement('button');
        dotBtn.className = 'dur-btn dotted' + (appState.dottedMode ? ' selected' : '');
        dotBtn.type = 'button';
        dotBtn.title = '付点';
        dotBtn.setAttribute('aria-label', '付点');
        dotBtn.innerHTML = '<span class="dur-icon-wrap"><span class="dur-icon">.</span></span>';
        dotBtn.addEventListener('click', () => {
            appState.dottedMode = !appState.dottedMode;
            if (onUpdate) onUpdate();
        });
        valueButtons.appendChild(dotBtn);
    }

    valueRow.appendChild(valueButtons);
    toolbar.appendChild(valueRow);

    containerEl.appendChild(toolbar);
    return toolbar;
}

/**
 * 付点モードを反映した現在の音価を返す。
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
        '4n': { kind: 'quarter' },
        '8n': { kind: 'eighth' },
        '16n': { kind: 'sixteenth' },
        '8t': { kind: 'eighth', badge: '3' },
        '16t': { kind: 'sixteenth', badge: '3' },
    };
    return map[value] ?? { kind: 'eighth' };
}

function buildDurationIcon(meta) {
    const iconEl = document.createElement('img');
    iconEl.className = `dur-icon note-svg-icon ${meta.kind || 'eighth'}-note-icon`;
    iconEl.src = getDurationIconUrl(meta.kind);
    iconEl.alt = '';
    iconEl.setAttribute('aria-hidden', 'true');
    return iconEl;
}

function getDurationIconUrl(kind = 'eighth') {
    const map = {
        whole: wholeNoteIconUrl,
        half: halfNoteIconUrl,
        quarter: quarterNoteIconUrl,
        eighth: eighthNoteIconUrl,
        sixteenth: sixteenthNoteIconUrl,
    };
    return map[kind] ?? eighthNoteIconUrl;
}
