// editor-preview.js — 全トラックプレビュー画面

import {
    appState,
    STEPS_PER_BEAT,
    STEPS_PER_MEASURE,
    callbacks,
    clearPreviewCopyState,
    clearRepeatState,
} from '../core/state.js';
import { INST_TYPE, INST_LABEL } from '../features/tracks/instrument-map.js';
import { CHORD_ROOTS, CHROMATIC, ROOT_COLORS, DURATION_CELLS, SCALE_TYPES } from '../core/constants.js';
import { copyTrackMeasureRange, pasteTrackMeasureRange, repeatTrackMeasureRange, selectTrack } from '../features/tracks/tracks-controller.js';
import { isStepOn, isStepHead } from '../core/duration.js';
import { getMeasureStart } from '../core/rhythm-grid.js';

const LONG_PRESS_MS = 420;

export function renderPreview(containerEl) {
    const measureIndex = appState.currentMeasure;
    const offset = getMeasureStart(measureIndex);
    const mEnd = offset + STEPS_PER_MEASURE;
    const cells = Array.from({ length: STEPS_PER_MEASURE }, (_, localStep) => ({
        beat: Math.floor(localStep / STEPS_PER_BEAT),
        localStep,
    }));
    const wrapEl = document.createElement('div');
    wrapEl.className = 'preview-wrap';

    wrapEl.appendChild(buildSongSettingsCard());

    wrapEl.addEventListener('click', (event) => {
        if (!appState.previewActionMenuOpen) return;
        if (event.target.closest('.preview-card-actions')) return;
        closePreviewActions(true);
    });

    appState.tracks.forEach(track => {
        const card = document.createElement('div');
        card.className = 'preview-card'
            + getRepeatCardStateClass(track.id)
            + (track.muted ? ' is-muted' : '');
        attachPreviewCardLongPress(card, track.id);
        if (shouldShowRepeatStartRail(track.id)) {
            card.appendChild(buildRepeatSelectionRail(track, 'start'));
        }

        // ヘッダー（タップでエディタへ遷移）
        const headerEl = document.createElement('div');
        headerEl.className = 'preview-card-header';
        headerEl.addEventListener('click', (event) => {
            if (event.target.closest('.preview-card-actions, .preview-track-controls')) return;
            if (appState.previewActionMenuOpen && appState.previewActionTrackId === track.id) {
                closePreviewActions(true);
                return;
            }
            selectTrack(track.id);
        });

        const titleEl = document.createElement('span');
        titleEl.className = 'preview-card-title';
        titleEl.textContent = INST_LABEL[track.instrument];
        headerEl.appendChild(titleEl);

        headerEl.appendChild(buildTrackControls(track));
        card.appendChild(headerEl);
        if (appState.previewActionMenuOpen && appState.previewActionTrackId === track.id) {
            card.appendChild(buildPreviewActionMenu(track));
        }
        if (shouldShowRepeatEndRail(track.id)) {
            card.appendChild(buildRepeatSelectionRail(track, 'end'));
        }
        const gridEl = document.createElement('div');
        gridEl.className = 'preview-grid' + getRepeatGridStateClass(track.id);

        const type = INST_TYPE[track.instrument];

        if (type === 'rhythm') {
            (track.rows ?? []).forEach(row => {
                gridEl.appendChild(buildPreviewRow(cells, offset, row?.steps, 'rhythm'));
            });
        } else if (type === 'chord') {
            const zoneGrid = document.createElement('div');
            zoneGrid.className = 'preview-chord-zone-grid';
            zoneGrid.style.gridTemplateColumns = `repeat(${STEPS_PER_MEASURE}, minmax(0, 1fr))`;

            const chordMap = Array.isArray(track.chordMap) ? track.chordMap : [];
            let inheritedChord = null;
            for (let step = 0; step <= offset; step++) {
                if (chordMap[step]) inheritedChord = chordMap[step];
            }
            for (let beat = 0; beat < 4; beat++) {
                const start = offset + beat * STEPS_PER_BEAT;
                const end = Math.min(start + STEPS_PER_BEAT, mEnd);
                for (let step = Math.max(offset + 1, start - STEPS_PER_BEAT + 1); step <= start; step++) {
                    if (chordMap[step]) inheritedChord = chordMap[step];
                }

                const label = document.createElement('span');
                label.className = 'preview-chord-label';
                const span = Math.max(1, end - start);
                label.style.gridColumn = `span ${span || 1}`;
                if (beat > 0) label.style.borderLeft = '1px solid #999';

                if (inheritedChord) {
                    label.textContent = inheritedChord.root + inheritedChord.type;
                    label.style.background = ROOT_COLORS[inheritedChord.root] || '#666';
                } else {
                    label.textContent = '—';
                    label.style.background = '#999';
                }

                zoneGrid.appendChild(label);
            }
            gridEl.appendChild(zoneGrid);

            gridEl.appendChild(buildPreviewRow(cells, offset, track.soundSteps, 'chord'));
        } else {
            const oct = track.activeOctave ?? (track.viewBase + 1);
            [...CHROMATIC].reverse().forEach(noteName => {
                const steps = track.stepsMap?.[`${noteName}${oct}`];
                gridEl.appendChild(buildPreviewRow(cells, offset, steps, 'melody', `${noteName}${oct}`));
            });
        }

        card.appendChild(gridEl);
        wrapEl.appendChild(card);
    });

    containerEl.appendChild(wrapEl);
}

function buildPreviewActionMenu(track) {
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

function buildRepeatSelectionRail(track, side) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `preview-repeat-rail ${side}`
        + (isRepeatRailActive(track.id, side) ? ' active' : '');
    btn.setAttribute('aria-label', side === 'start' ? '繰り返し開始' : '繰り返し終了');
    btn.title = side === 'start' ? '繰り返し開始' : '繰り返し終了';
    btn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (side === 'start') {
            handleRepeatStartRail(track.id);
        } else {
            handleRepeatEndRail(track.id);
        }
        callbacks.renderEditor?.();
    });
    return btn;
}

function attachPreviewCardLongPress(cardEl, trackId) {
    let timerId = null;
    let startX = 0;
    let startY = 0;

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
}

function closePreviewActions(shouldRender) {
    appState.previewActionTrackId = null;
    appState.previewActionMenuOpen = false;
    clearPreviewCopyState();
    if (shouldRender) callbacks.renderEditor?.();
}

function buildTrackControls(track) {
    const controlsEl = document.createElement('div');
    controlsEl.className = 'preview-track-controls';
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

function startRepeatFlow(trackId) {
    appState.previewActionTrackId = null;
    appState.previewActionMenuOpen = false;
    clearPreviewCopyState();
    const repeatState = ensureRepeatState(trackId);
    repeatState.sourceStartMeasure = appState.currentMeasure;
    repeatState.sourceEndMeasure = null;
    repeatState.targetEndMeasure = null;
    repeatState.modeStep = 'source-end';
    repeatState.restoreMeasures = {};
    repeatState.sourceSnapshot = null;
}

function handleRepeatStartRail(trackId) {
    appState.lastTouchedTrackId = trackId;
    const repeatState = getRepeatState(trackId);
    if (repeatState && repeatState.sourceStartMeasure !== null) {
        const track = appState.tracks.find((item) => item.id === trackId);
        if (track) {
            restoreRepeatedMeasuresFrom(
                track,
                repeatState,
                (repeatState.sourceEndMeasure ?? appState.currentMeasure) + 1
            );
        }
        clearRepeatState(trackId);
        return;
    }
    startRepeatFlow(trackId);
}

function handleRepeatEndRail(trackId) {
    appState.lastTouchedTrackId = trackId;
    const repeatState = getRepeatState(trackId);
    if (!repeatState || repeatState.sourceStartMeasure === null) return;
    if (repeatState.sourceEndMeasure === null) {
        finalizeRepeatSource(trackId);
        return;
    }
    const track = appState.tracks.find((item) => item.id === trackId);
    if (track) {
        restoreRepeatedMeasuresFrom(track, repeatState, repeatState.sourceEndMeasure + 1);
    }
    repeatState.sourceEndMeasure = null;
    repeatState.targetEndMeasure = null;
    repeatState.modeStep = 'source-end';
    repeatState.sourceSnapshot = null;
}

function finalizeRepeatSource(trackId) {
    const repeatState = getRepeatState(trackId);
    if (!repeatState || repeatState.sourceStartMeasure === null) return;
    const track = appState.tracks.find((item) => item.id === trackId);
    const sourceStart = repeatState.sourceStartMeasure;
    const sourceEnd = Math.max(sourceStart, appState.currentMeasure);
    repeatState.sourceEndMeasure = sourceEnd;
    repeatState.targetEndMeasure = sourceEnd;
    repeatState.modeStep = 'ready';
    repeatState.sourceSnapshot = track
        ? copyTrackMeasureRange(track, sourceStart, sourceEnd)
        : null;
}

function extendRepeatByOneMeasure(track) {
    if (!isRepeatAppendReady(track.id)) return;
    const repeatState = getRepeatState(track.id);
    if (!repeatState) return;
    const nextEnd = getRepeatPendingMeasure(repeatState);
    if (nextEnd === null) return;
    saveRepeatMeasureSnapshot(track, repeatState, nextEnd);
    repeatTrackMeasureRange(
        track,
        repeatState.sourceStartMeasure,
        repeatState.sourceEndMeasure,
        nextEnd
    );
    repeatState.targetEndMeasure = nextEnd;
    repeatState.sourceSnapshot = copyTrackMeasureRange(
        track,
        repeatState.sourceStartMeasure,
        repeatState.sourceEndMeasure
    );
}

function shouldShowRepeatEndRail(trackId) {
    const repeatState = getRepeatState(trackId);
    if (!repeatState || repeatState.sourceStartMeasure === null) return false;
    if (repeatState.sourceEndMeasure !== null && appState.currentMeasure !== repeatState.sourceEndMeasure) return false;
    const endMeasure = repeatState.sourceEndMeasure === null
        ? Math.max(repeatState.sourceStartMeasure, appState.currentMeasure)
        : repeatState.sourceEndMeasure;
    return appState.currentMeasure === endMeasure;
}

function shouldShowRepeatStartRail(trackId) {
    const repeatState = getRepeatState(trackId);
    if (!repeatState || repeatState.sourceStartMeasure === null) return true;
    return appState.currentMeasure === repeatState.sourceStartMeasure;
}

function isRepeatReady(trackId) {
    const repeatState = getRepeatState(trackId);
    return Boolean(
        repeatState
        && repeatState.sourceStartMeasure !== null
        && repeatState.sourceEndMeasure !== null
        && repeatState.modeStep === 'ready'
    );
}

function isRepeatAppendReady(trackId) {
    const repeatState = getRepeatState(trackId);
    const pendingMeasure = getRepeatPendingMeasure(repeatState);
    return isRepeatReady(trackId)
        && pendingMeasure !== null
        && appState.currentMeasure === pendingMeasure;
}

function isRepeatClearReady(trackId) {
    const repeatState = getRepeatState(trackId);
    if (!isRepeatReady(trackId) || !repeatState) return false;
    const sourceEnd = repeatState.sourceEndMeasure;
    const targetEnd = repeatState.targetEndMeasure;
    if (sourceEnd === null || targetEnd === null || targetEnd <= sourceEnd) return false;
    return appState.currentMeasure > sourceEnd && appState.currentMeasure <= targetEnd;
}

function isRepeatRailActive(trackId, side) {
    const repeatState = getRepeatState(trackId);
    if (!repeatState || repeatState.sourceStartMeasure === null) return false;
    if (side === 'start') {
        return appState.currentMeasure === repeatState.sourceStartMeasure;
    }
    return repeatState.sourceEndMeasure !== null && shouldShowRepeatEndRail(trackId);
}

function shouldShowRepeatButton(trackId) {
    return isRepeatAppendReady(trackId) || isRepeatClearReady(trackId);
}

function handleRepeatButton(track) {
    appState.lastTouchedTrackId = track.id;
    const repeatState = getRepeatState(track.id);
    if (!repeatState) return;
    if (isRepeatAppendReady(track.id)) {
        extendRepeatByOneMeasure(track);
        return;
    }
    if (isRepeatClearReady(track.id)) {
        restoreRepeatedMeasuresFrom(track, repeatState, appState.currentMeasure);
    }
}

function saveRepeatMeasureSnapshot(track, repeatState, measure) {
    if (measure === null) return;
    if (!repeatState.restoreMeasures) {
        repeatState.restoreMeasures = {};
    }
    if (repeatState.restoreMeasures[measure]) return;
    repeatState.restoreMeasures[measure] = copyTrackMeasureRange(track, measure, measure);
}

function restoreRepeatedMeasuresFrom(track, repeatState, startMeasure) {
    const sourceEnd = repeatState.sourceEndMeasure;
    const targetEnd = repeatState.targetEndMeasure;
    if (sourceEnd === null || targetEnd === null) return;
    const restoreStart = Math.max(sourceEnd + 1, startMeasure);
    if (restoreStart > targetEnd) return;
    for (let measure = restoreStart; measure <= targetEnd; measure++) {
        const clipboard = repeatState.restoreMeasures?.[measure];
        if (clipboard) {
            pasteTrackMeasureRange(track, measure, clipboard);
            delete repeatState.restoreMeasures[measure];
        }
    }
    repeatState.targetEndMeasure = restoreStart - 1;
}

function getRepeatCardStateClass(trackId) {
    const tone = getRepeatCardTone(trackId);
    return tone ? ` ${tone}` : '';
}

function getRepeatGridStateClass(trackId) {
    const tone = getRepeatCardTone(trackId);
    return tone ? ` ${tone}` : '';
}

function getRepeatCardTone(trackId) {
    const repeatState = getRepeatState(trackId);
    if (!repeatState || repeatState.sourceStartMeasure === null || repeatState.sourceEndMeasure === null) return '';
    const measure = appState.currentMeasure;
    const sourceStart = repeatState.sourceStartMeasure;
    const sourceEnd = repeatState.sourceEndMeasure;
    const targetEnd = Math.max(sourceEnd, repeatState.targetEndMeasure ?? sourceEnd);

    if (measure >= sourceStart && measure <= sourceEnd) return 'repeat-source';
    if (measure > sourceEnd && measure <= targetEnd) return 'repeat-target';
    return '';
}

function getRepeatPendingMeasure(repeatState) {
    if (!repeatState || repeatState.sourceEndMeasure === null) return null;
    return Math.max(repeatState.sourceEndMeasure, repeatState.targetEndMeasure ?? repeatState.sourceEndMeasure) + 1;
}

function getRepeatState(trackId) {
    return appState.repeatStates?.[trackId] ?? null;
}

function ensureRepeatState(trackId) {
    if (!appState.repeatStates) {
        appState.repeatStates = {};
    }
    if (!appState.repeatStates[trackId]) {
        appState.repeatStates[trackId] = {
            sourceStartMeasure: null,
            sourceEndMeasure: null,
            targetEndMeasure: null,
            modeStep: null,
            restoreMeasures: {},
            sourceSnapshot: null,
        };
    }
    return appState.repeatStates[trackId];
}

function buildSongSettingsCard() {
    const cardEl = document.createElement('section');
    cardEl.className = 'preview-song-settings';

    const titleEl = document.createElement('strong');
    titleEl.textContent = 'Key/スケール';
    cardEl.appendChild(titleEl);

    const keyRow = document.createElement('div');
    keyRow.className = 'preview-song-settings-row';
    keyRow.appendChild(buildSettingsLabel('Key'));

    const keyRootSelect = document.createElement('select');
    keyRootSelect.className = 'preview-song-select';
    CHORD_ROOTS.forEach((root) => {
        const option = document.createElement('option');
        option.value = root;
        option.textContent = root;
        option.selected = root === appState.songKeyRoot;
        keyRootSelect.appendChild(option);
    });
    keyRootSelect.addEventListener('change', () => {
        appState.songKeyRoot = keyRootSelect.value;
        callbacks.renderEditor?.();
    });
    keyRow.appendChild(keyRootSelect);

    const keyModeBadge = document.createElement('span');
    keyModeBadge.className = 'preview-song-mode-badge';
    keyModeBadge.textContent = appState.songScaleType === 'major' ? 'M' : 'm';
    keyRow.appendChild(keyModeBadge);
    cardEl.appendChild(keyRow);

    const scaleRow = document.createElement('div');
    scaleRow.className = 'preview-song-settings-row scale-row';
    scaleRow.appendChild(buildSettingsLabel('Scale'));

    const scaleTabs = document.createElement('div');
    scaleTabs.className = 'preview-scale-tabs';
    SCALE_TYPES.forEach(({ value, label }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preview-scale-tab' + (appState.songScaleType === value ? ' selected' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => {
            appState.songScaleType = value;
            callbacks.renderEditor?.();
        });
        scaleTabs.appendChild(btn);
    });
    scaleRow.appendChild(scaleTabs);
    cardEl.appendChild(scaleRow);

    return cardEl;
}

function buildSettingsLabel(text) {
    const labelEl = document.createElement('span');
    labelEl.className = 'preview-song-settings-label';
    labelEl.textContent = text;
    return labelEl;
}

function buildPreviewRow(cells, offset, steps, kind, noteLabel = '') {
    const safeSteps = Array.isArray(steps) ? steps : [];
    const rowEl = document.createElement('div');
    rowEl.className = `preview-row-track ${kind}`;

    cells.forEach(({ localStep, beat }) => {
        const cell = document.createElement('span');
        const start = offset + localStep;
        cell.className = 'preview-cell' + (isStepOn(safeSteps[start]) ? ' on' : '') + (localStep % STEPS_PER_BEAT === 0 ? ' beat-start' : '') + ((localStep + 1) % STEPS_PER_BEAT === 0 ? ' beat-end' : '');
        cell.dataset.start = start;
        cell.title = noteLabel ? `${noteLabel} / ${beat + 1}拍` : `${beat + 1}拍`;
        rowEl.appendChild(cell);
    });

    for (let localStep = 0; localStep < STEPS_PER_MEASURE; localStep++) {
        const start = offset + localStep;
        const value = safeSteps[start];
        if (!isStepHead(value)) continue;

        const noteEl = document.createElement('span');
        noteEl.className = `preview-note-bar ${kind}`;
        noteEl.style.left = `${(localStep / STEPS_PER_MEASURE) * 100}%`;
        noteEl.style.width = `${((DURATION_CELLS[value] || 1) / STEPS_PER_MEASURE) * 100}%`;
        rowEl.appendChild(noteEl);
    }

    return rowEl;
}
