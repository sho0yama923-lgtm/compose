import { appState, callbacks, clearPreviewCopyState } from '../../core/state.js';
import { INST_TYPE, getTrackDisplayLabel } from '../../features/tracks/instrument-map.js';
import { copyTrackMeasureRange, pasteTrackMeasureRange } from '../../features/tracks/tracks-controller.js';
import repeatLoopIconUrl from '../../assets/repeat_loop_icon.svg';
import { handleRepeatButton, isRepeatButtonActive, isRepeatButtonDisabled, shouldShowRepeatButton } from './preview-repeat.js';
import { emitTutorialAction } from '../../core/tutorial-events.js';
import { createIcon } from '../../ui/icon.js';

export function buildPreviewActionMenu(track) {
    const menuEl = document.createElement('div');
    menuEl.className = 'preview-card-actions';
    menuEl.addEventListener('click', (event) => event.stopPropagation());

    if (appState.previewRangeMode === 'copy') {
        menuEl.appendChild(buildPreviewRangePicker(track));
        return menuEl;
    }

    if (appState.previewRangeMode === 'paste-confirm') {
        menuEl.appendChild(buildPreviewPasteConfirm(track));
        return menuEl;
    }

    const sameTypeClipboard = appState.clipboard
        && appState.clipboard.trackType === INST_TYPE[track.instrument];

    const actionRow = document.createElement('div');
    actionRow.className = 'preview-card-action-row';

    const toneBtn = document.createElement('button');
    toneBtn.type = 'button';
    toneBtn.className = 'preview-card-action-btn';
    toneBtn.textContent = '音作り';
    toneBtn.addEventListener('click', () => {
        appState.previewToneTrackId = track.id;
        closePreviewActions(true);
    });

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
        appState.previewRangeMode = 'paste-confirm';
        callbacks.renderEditor?.();
    });

    actionRow.append(toneBtn, copyBtn, pasteBtn);
    menuEl.appendChild(actionRow);

    return menuEl;
}

function buildPreviewRangePicker(track) {
    const pickerEl = document.createElement('div');
    pickerEl.className = 'preview-range-picker';
    const startMeasure = appState.previewRangeStartMeasure ?? appState.currentMeasure;
    const endMeasure = Math.max(startMeasure, appState.previewRangeEndMeasure ?? startMeasure);

    const titleEl = document.createElement('div');
    titleEl.className = 'preview-range-title';
    titleEl.textContent = getTrackDisplayLabel(track, { showChordPlaybackInstrument: true });
    pickerEl.appendChild(titleEl);

    const statusEl = document.createElement('div');
    statusEl.className = 'preview-range-status';
    statusEl.textContent = `${endMeasure + 1}小節`;
    pickerEl.appendChild(statusEl);

    const currentEl = document.createElement('div');
    currentEl.className = 'preview-range-current';
    currentEl.textContent = `コピー範囲: ${formatMeasureRange(startMeasure, endMeasure)}`;
    pickerEl.appendChild(currentEl);

    const rangeRow = document.createElement('div');
    rangeRow.className = 'preview-range-controls';

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
        closePreviewActions(true);
    });

    rangeRow.append(confirmBtn, cancelBtn);
    pickerEl.appendChild(rangeRow);
    return pickerEl;
}

function buildPreviewPasteConfirm(track) {
    const confirmEl = document.createElement('div');
    confirmEl.className = 'preview-paste-confirm';

    const clipboard = appState.clipboard;
    const sourceStart = (clipboard?.sourceStartMeasure ?? 0) + 1;
    const sourceEnd = (clipboard?.sourceEndMeasure ?? clipboard?.sourceStartMeasure ?? 0) + 1;

    const titleEl = document.createElement('div');
    titleEl.className = 'preview-paste-title';
    titleEl.textContent = `${formatMeasureRange(sourceStart - 1, sourceEnd - 1)}をコピー中`;

    const rowEl = document.createElement('div');
    rowEl.className = 'preview-paste-controls';

    const pasteBtn = document.createElement('button');
    pasteBtn.type = 'button';
    pasteBtn.className = 'preview-card-action-btn confirm';
    pasteBtn.textContent = 'ペースト';
    pasteBtn.addEventListener('click', () => {
        pasteTrackMeasureRange(track, appState.currentMeasure, appState.clipboard);
        closePreviewActions(true);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'preview-card-action-btn';
    cancelBtn.textContent = 'キャンセル';
    cancelBtn.addEventListener('click', () => {
        closePreviewActions(true);
    });

    rowEl.append(pasteBtn, cancelBtn);
    confirmEl.append(titleEl, rowEl);
    return confirmEl;
}

function formatMeasureRange(startMeasure, endMeasure) {
    const startLabel = startMeasure + 1;
    const endLabel = endMeasure + 1;
    return startLabel === endLabel
        ? `${startLabel}小節`
        : `${startLabel}小節から${endLabel}小節まで`;
}

export function closePreviewActions(shouldRender) {
    appState.previewActionTrackId = null;
    appState.previewActionMenuOpen = false;
    clearPreviewCopyState();
    if (shouldRender) callbacks.renderEditor?.();
}

function buildRepeatIcon() {
    const iconEl = document.createElement('img');
    iconEl.className = 'preview-track-repeat-icon';
    iconEl.src = repeatLoopIconUrl;
    iconEl.alt = '';
    iconEl.setAttribute('aria-hidden', 'true');
    return iconEl;
}

export function buildTrackControls(track) {
    const controlsEl = document.createElement('div');
    controlsEl.className = 'preview-track-controls';
    controlsEl.dataset.trackId = String(track.id);
    controlsEl.addEventListener('click', (event) => event.stopPropagation());

    const repeatSlot = document.createElement('div');
    repeatSlot.className = 'preview-track-repeat-slot';

    if (shouldShowRepeatButton(track.id)) {
        const repeatBtn = document.createElement('button');
        repeatBtn.type = 'button';
        repeatBtn.className = 'preview-track-repeat-btn'
            + (isRepeatButtonActive(track.id) ? ' active' : '');
        repeatBtn.title = '繰り返し';
        repeatBtn.setAttribute('aria-label', '繰り返し');
        repeatBtn.disabled = isRepeatButtonDisabled(track.id);
        repeatBtn.appendChild(buildRepeatIcon());
        repeatBtn.addEventListener('click', () => {
            handleRepeatButton(track);
            callbacks.renderEditor?.();
        });
        repeatSlot.appendChild(repeatBtn);
    }

    const toneBtn = document.createElement('button');
    toneBtn.type = 'button';
    toneBtn.className = 'preview-track-tone-btn';
    toneBtn.appendChild(createIcon('more'));
    toneBtn.title = 'オプション';
    toneBtn.setAttribute('aria-label', 'オプション');
    toneBtn.addEventListener('click', () => {
        appState.previewActionTrackId = appState.previewActionMenuOpen
            && appState.previewActionTrackId === track.id
            ? null
            : track.id;
        appState.previewActionMenuOpen = appState.previewActionTrackId !== null;
        appState.previewToneTrackId = null;
        clearPreviewCopyState();
        callbacks.renderEditor?.();
    });
    repeatSlot.appendChild(toneBtn);

    controlsEl.appendChild(repeatSlot);

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

export function buildTrackMuteToggle(track) {
    const muteWrap = document.createElement('label');
    muteWrap.className = 'preview-track-toggle';
    muteWrap.title = '発音';
    muteWrap.setAttribute('aria-label', '発音');
    muteWrap.addEventListener('click', (event) => event.stopPropagation());

    const muteInput = document.createElement('input');
    muteInput.type = 'checkbox';
    muteInput.checked = !track.muted;
    muteInput.addEventListener('change', () => {
        track.muted = !muteInput.checked;
        callbacks.renderEditor?.();
        emitTutorialAction('track-muted-changed', {
            trackId: track.id,
            trackType: INST_TYPE[track.instrument],
            muted: track.muted,
        });
    });

    muteWrap.appendChild(muteInput);
    return muteWrap;
}
