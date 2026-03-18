import { appState, callbacks, clearPreviewCopyState } from '../../core/state.js';
import { INST_TYPE } from '../../features/tracks/instrument-map.js';
import { copyTrackMeasureRange, pasteTrackMeasureRange } from '../../features/tracks/tracks-controller.js';
import { LONG_PRESS_MS } from './preview-shared.js';
import { handleRepeatButton, shouldShowRepeatButton } from './preview-repeat.js';

export function buildPreviewActionMenu(track) {
    const menuEl = document.createElement('div');
    menuEl.className = 'preview-card-actions';
    menuEl.addEventListener('click', (event) => event.stopPropagation());

    const sameTypeClipboard = appState.clipboard
        && appState.clipboard.trackType === INST_TYPE[track.instrument];

    const actionRow = document.createElement('div');
    actionRow.className = 'preview-card-action-row';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'preview-card-action-btn';
    copyBtn.textContent = 'コピー';
    copyBtn.addEventListener('click', () => {
        appState.previewRangeMode = 'copy';
        appState.previewRangeStartMeasure = appState.currentMeasure;
        appState.previewRangeEndMeasure = appState.currentMeasure;
        callbacks.renderEditor?.();
    });

    const pasteBtn = document.createElement('button');
    pasteBtn.type = 'button';
    pasteBtn.className = 'preview-card-action-btn';
    pasteBtn.textContent = 'ペースト';
    pasteBtn.disabled = !sameTypeClipboard;
    pasteBtn.addEventListener('click', () => {
        if (!sameTypeClipboard) return;
        pasteTrackMeasureRange(track, appState.currentMeasure, appState.clipboard);
        closePreviewActions(true);
    });

    actionRow.append(copyBtn, pasteBtn);
    menuEl.appendChild(actionRow);

    if (appState.clipboard?.trackType === INST_TYPE[track.instrument]) {
        menuEl.appendChild(buildClipboardSummary());
    }

    if (appState.previewRangeMode === 'copy') {
        menuEl.appendChild(buildPreviewRangePicker(track));
    }

    return menuEl;
}

function buildPreviewRangePicker(track) {
    const pickerEl = document.createElement('div');
    pickerEl.className = 'preview-range-picker';
    const startMeasure = appState.previewRangeStartMeasure ?? appState.currentMeasure;
    const endMeasure = Math.max(startMeasure, appState.previewRangeEndMeasure ?? startMeasure);

    const titleEl = document.createElement('div');
    titleEl.className = 'preview-range-title';
    titleEl.textContent = 'コピー範囲';
    pickerEl.appendChild(titleEl);

    const statusEl = document.createElement('div');
    statusEl.className = 'preview-range-status';
    statusEl.textContent = `コピー元 ${startMeasure + 1} → ${endMeasure + 1}小節`;
    pickerEl.appendChild(statusEl);

    const currentEl = document.createElement('div');
    currentEl.className = 'preview-range-current';
    currentEl.textContent = endMeasure > appState.numMeasures - 1
        ? `選択中 ${endMeasure + 1}小節（未作成）`
        : `表示中 ${appState.currentMeasure + 1}小節`;
    pickerEl.appendChild(currentEl);

    const rangeRow = document.createElement('div');
    rangeRow.className = 'preview-range-controls';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'preview-card-action-btn compact';
    prevBtn.textContent = '‹';
    prevBtn.disabled = endMeasure <= startMeasure;
    prevBtn.addEventListener('click', () => {
        appState.previewRangeEndMeasure = Math.max(startMeasure, endMeasure - 1);
        appState.currentMeasure = Math.min(appState.previewRangeEndMeasure, appState.numMeasures - 1);
        callbacks.renderEditor?.();
    });

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'preview-card-action-btn compact';
    nextBtn.textContent = '›';
    const maxEndMeasure = appState.numMeasures - 1;
    nextBtn.disabled = endMeasure >= maxEndMeasure;
    nextBtn.addEventListener('click', () => {
        appState.previewRangeEndMeasure = Math.min(maxEndMeasure, endMeasure + 1);
        appState.currentMeasure = Math.min(appState.previewRangeEndMeasure, appState.numMeasures - 1);
        callbacks.renderEditor?.();
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'preview-card-action-btn confirm';
    confirmBtn.textContent = 'コピー実行';
    confirmBtn.addEventListener('click', () => {
        appState.clipboard = copyTrackMeasureRange(track, startMeasure, endMeasure);
        closePreviewActions(true);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'preview-card-action-btn compact';
    cancelBtn.textContent = '中止';
    cancelBtn.addEventListener('click', () => {
        clearPreviewCopyState();
        callbacks.renderEditor?.();
    });

    rangeRow.append(prevBtn, nextBtn, confirmBtn, cancelBtn);
    pickerEl.appendChild(rangeRow);
    return pickerEl;
}

function buildClipboardSummary() {
    const infoEl = document.createElement('div');
    infoEl.className = 'preview-clipboard-summary';

    const typeEl = document.createElement('span');
    typeEl.className = 'preview-clipboard-chip source';
    typeEl.textContent = `型 ${appState.clipboard.sourceStartMeasure + 1}→${appState.clipboard.sourceEndMeasure + 1}`;

    const descEl = document.createElement('span');
    descEl.className = 'preview-clipboard-chip target';
    descEl.textContent = appState.previewActionTrackId === appState.clipboard.sourceTrackId
        ? '同じトラックへすぐペースト'
        : '別トラックにもペースト可能';

    infoEl.append(typeEl, descEl);
    return infoEl;
}

export function attachPreviewCardLongPress(cardEl, trackId) {
    let timerId = null;
    let startX = 0;
    let startY = 0;

    const isInteractiveTarget = (target) => {
        return target instanceof Element && !!target.closest('input, select, textarea, option');
    };

    const clearTimer = () => {
        if (timerId !== null) {
            clearTimeout(timerId);
            timerId = null;
        }
    };

    cardEl.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button, input, select, label, .preview-card-actions')) return;
        startX = event.clientX;
        startY = event.clientY;
        clearTimer();
        timerId = window.setTimeout(() => {
            appState.previewActionTrackId = trackId;
            appState.previewActionMenuOpen = true;
            clearPreviewCopyState();
            callbacks.renderEditor?.();
        }, LONG_PRESS_MS);
    });

    cardEl.addEventListener('pointermove', (event) => {
        if (timerId === null) return;
        if (Math.abs(event.clientX - startX) > 8 || Math.abs(event.clientY - startY) > 8) {
            clearTimer();
        }
    });
    cardEl.addEventListener('pointerup', clearTimer);
    cardEl.addEventListener('pointercancel', clearTimer);
    cardEl.addEventListener('pointerleave', clearTimer);
    cardEl.addEventListener('contextmenu', (event) => {
        if (isInteractiveTarget(event.target)) return;
        event.preventDefault();
    });
    cardEl.addEventListener('selectstart', (event) => {
        if (isInteractiveTarget(event.target)) return;
        event.preventDefault();
    });
}

export function closePreviewActions(shouldRender) {
    appState.previewActionTrackId = null;
    appState.previewActionMenuOpen = false;
    clearPreviewCopyState();
    if (shouldRender) callbacks.renderEditor?.();
}

export function buildTrackControls(track) {
    const controlsEl = document.createElement('div');
    controlsEl.className = 'preview-track-controls';
    controlsEl.dataset.trackId = String(track.id);
    controlsEl.addEventListener('click', (event) => event.stopPropagation());

    const muteRow = document.createElement('div');
    muteRow.className = 'preview-track-toggle-row';

    const muteWrap = document.createElement('label');
    muteWrap.className = 'preview-track-toggle';

    const muteText = document.createElement('span');
    muteText.textContent = '発音';

    const muteInput = document.createElement('input');
    muteInput.type = 'checkbox';
    muteInput.checked = !track.muted;
    muteInput.addEventListener('change', () => {
        track.muted = !muteInput.checked;
        callbacks.renderEditor?.();
    });

    muteWrap.append(muteText, muteInput);
    muteRow.appendChild(muteWrap);

    const repeatSlot = document.createElement('div');
    repeatSlot.className = 'preview-track-repeat-slot';

    if (shouldShowRepeatButton(track.id)) {
        const repeatBtn = document.createElement('button');
        repeatBtn.type = 'button';
        repeatBtn.className = 'preview-track-repeat-btn active';
        repeatBtn.textContent = '⟲';
        repeatBtn.title = '繰り返し';
        repeatBtn.setAttribute('aria-label', '繰り返し');
        repeatBtn.addEventListener('click', () => {
            handleRepeatButton(track);
            callbacks.renderEditor?.();
        });
        repeatSlot.appendChild(repeatBtn);
    }

    const toneBtn = document.createElement('button');
    toneBtn.type = 'button';
    toneBtn.className = 'preview-track-tone-btn';
    toneBtn.textContent = '⚙';
    toneBtn.title = '音作り';
    toneBtn.setAttribute('aria-label', '音作り');
    toneBtn.addEventListener('click', () => {
        appState.previewActionTrackId = null;
        appState.previewActionMenuOpen = false;
        appState.previewToneTrackId = track.id;
        clearPreviewCopyState();
        callbacks.renderEditor?.();
    });
    repeatSlot.appendChild(toneBtn);

    muteRow.appendChild(repeatSlot);
    controlsEl.appendChild(muteRow);

    const volumeWrap = document.createElement('div');
    volumeWrap.className = 'preview-track-volume';

    const volumeLabel = document.createElement('span');
    volumeLabel.className = 'preview-track-volume-label';
    volumeLabel.textContent = `音量 ${Math.round((track.volume ?? 1) * 100)}`;

    const volumeInput = document.createElement('input');
    volumeInput.type = 'range';
    volumeInput.className = 'preview-track-volume-slider';
    volumeInput.min = '0';
    volumeInput.max = '100';
    volumeInput.step = '1';
    volumeInput.value = String(Math.round((track.volume ?? 1) * 100));
    volumeInput.addEventListener('input', () => {
        track.volume = Number(volumeInput.value) / 100;
        volumeLabel.textContent = `音量 ${volumeInput.value}`;
    });
    volumeInput.addEventListener('change', () => {
        callbacks.renderEditor?.();
    });

    volumeWrap.append(volumeLabel, volumeInput);
    controlsEl.appendChild(volumeWrap);

    return controlsEl;
}
