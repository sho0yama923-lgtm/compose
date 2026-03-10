// editor-preview.js — 全トラックプレビュー画面

import {
    appState,
    STEPS_PER_BEAT,
    STEPS_PER_MEASURE,
    callbacks,
    clearPreviewCopyState,
    clearRepeatState,
} from '../core/state.js';
import {
    INST_TYPE,
    INST_LABEL,
    TRACK_TONE_LIMITS,
    createDefaultTrackEq,
    createDefaultTrackTone,
    normalizeTrackEq,
    normalizeTrackTone,
    updateTrackPlaybackChain,
} from '../features/tracks/instrument-map.js';
import {
    CHORD_ROOTS,
    CHROMATIC,
    ROOT_COLORS,
    DURATION_CELLS,
    HARMONY_TYPES,
    getAvailableScaleFamilies,
    normalizeSongSettings,
} from '../core/constants.js';
import { copyTrackMeasureRange, pasteTrackMeasureRange, repeatTrackMeasureRange, selectTrack } from '../features/tracks/tracks-controller.js';
import { isStepOn, isStepHead } from '../core/duration.js';
import { getMeasureStart } from '../core/rhythm-grid.js';

const LONG_PRESS_MS = 420;
const SVG_NS = 'http://www.w3.org/2000/svg';
const EQ_MIN_DB = -24;
const EQ_MAX_DB = 24;
const EQ_GRAPH_MIN_FREQ = 80;
const EQ_GRAPH_MAX_FREQ = 9000;
const EQ_GRAPH_BANDS = [
    { key: 'low', label: 'Low', freqKey: 'lowFreq', color: '#2f6fed' },
    { key: 'mid', label: 'Mid', freqKey: 'midFreq', color: '#059669' },
    { key: 'high', label: 'High', freqKey: 'highFreq', color: '#ef6c00' },
];
const EQ_GRAPH_DB_TICKS = [-24, -12, 0, 12, 24];
const EQ_GRAPH_FREQ_TICKS = [100, 200, 500, 1000, 2000, 5000];
const TONE_CONTROL_CONFIG = [
    { key: 'gainDb', label: 'Gain', unit: 'dB', format: formatSignedValue },
    { key: 'compAmount', label: 'Comp', unit: '%', format: formatIntegerValue },
    { key: 'midQ', label: 'Mid Q', unit: '', format: formatFixedValue },
];

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
    bindPreviewScroll(wrapEl);

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
        card.dataset.trackId = String(track.id);
        card.dataset.instrument = track.instrument;
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

    const toneTrack = appState.tracks.find((track) => track.id === appState.previewToneTrackId);
    if (toneTrack) {
        containerEl.appendChild(buildTrackToneSheet(toneTrack));
    }
}

function bindPreviewScroll(wrapEl) {
    wrapEl.addEventListener('scroll', () => {
        appState.previewScrollTop = wrapEl.scrollTop;
    });
}

function clampPreviewScrollTop(wrapEl) {
    const maxScroll = Math.max(0, wrapEl.scrollHeight - wrapEl.clientHeight);
    return Math.max(0, Math.min(appState.previewScrollTop || 0, maxScroll));
}

export function restorePreviewScroll(wrapEl) {
    if (!wrapEl) return;
    wrapEl.scrollTop = clampPreviewScrollTop(wrapEl);
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

function normalizeEqValue(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, Math.round(value)));
}

function ensureTrackEq(track) {
    const normalizedEq = normalizeTrackEq(track.eq, track.instrument);
    track.eq = normalizedEq;
    return normalizedEq;
}

function ensureTrackTone(track) {
    const normalizedTone = normalizeTrackTone(track.tone);
    track.tone = normalizedTone;
    return normalizedTone;
}

function formatFrequency(freq) {
    const rounded = Math.round(freq);
    if (rounded >= 1000) {
        const kilo = rounded / 1000;
        return Number.isInteger(kilo) ? `${kilo}k` : `${kilo.toFixed(1)}k`;
    }
    return `${rounded}`;
}

function formatDbTick(db) {
    if (db > 0) return `+${db}`;
    return `${db}`;
}

function freqToGraphX(freq, left, graphWidth) {
    const clamped = Math.max(EQ_GRAPH_MIN_FREQ, Math.min(EQ_GRAPH_MAX_FREQ, freq));
    const min = Math.log10(EQ_GRAPH_MIN_FREQ);
    const max = Math.log10(EQ_GRAPH_MAX_FREQ);
    const value = Math.log10(clamped);
    return left + ((value - min) / (max - min)) * graphWidth;
}

function xToFrequency(x, left, graphWidth) {
    const clampedX = Math.max(left, Math.min(left + graphWidth, x));
    const ratio = (clampedX - left) / graphWidth;
    const min = Math.log10(EQ_GRAPH_MIN_FREQ);
    const max = Math.log10(EQ_GRAPH_MAX_FREQ);
    return Math.pow(10, min + ratio * (max - min));
}

function dbToGraphY(db, top, graphHeight) {
    const clamped = Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, db));
    const ratio = (EQ_MAX_DB - clamped) / (EQ_MAX_DB - EQ_MIN_DB);
    return top + ratio * graphHeight;
}

function yToDb(y, top, graphHeight) {
    const clampedY = Math.max(top, Math.min(top + graphHeight, y));
    const ratio = (clampedY - top) / graphHeight;
    return EQ_MAX_DB - ratio * (EQ_MAX_DB - EQ_MIN_DB);
}

function clampToneFrequencyForBand(freqKey, value) {
    const limits = TRACK_TONE_LIMITS[freqKey];
    if (!limits) return value;
    return Math.max(limits.min, Math.min(limits.max, Math.round(value)));
}

function closeTrackToneSheet(shouldRender = true) {
    appState.previewToneTrackId = null;
    if (shouldRender) callbacks.renderEditor?.();
}

function buildTrackToneSheet(track) {
    const tone = ensureTrackTone(track);
    const eq = ensureTrackEq(track);
    const overlayEl = document.createElement('div');
    overlayEl.className = 'preview-tone-sheet-overlay';
    overlayEl.addEventListener('click', (event) => {
        if (event.target !== overlayEl) return;
        closeTrackToneSheet(true);
    });

    const sheetEl = document.createElement('section');
    sheetEl.className = 'preview-tone-sheet';

    const handleEl = document.createElement('div');
    handleEl.className = 'preview-tone-sheet-handle';
    sheetEl.appendChild(handleEl);

    const titleEl = document.createElement('div');
    titleEl.className = 'preview-tone-sheet-title';
    titleEl.textContent = `${INST_LABEL[track.instrument]} の音作り`;
    sheetEl.appendChild(titleEl);

    const descEl = document.createElement('div');
    descEl.className = 'preview-tone-sheet-desc';
    descEl.textContent = '横ドラッグで周波数、縦ドラッグで dB を動かします。Comp と Mid Q は下の補助コントロールで調整します。';
    sheetEl.appendChild(descEl);

    sheetEl.appendChild(buildEqGraphEditor(track, eq, tone));

    const listEl = document.createElement('div');
    listEl.className = 'preview-tone-sheet-list';
    TONE_CONTROL_CONFIG.forEach((control) => {
        listEl.appendChild(buildToneControlRow(track, tone, control));
    });
    sheetEl.appendChild(listEl);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'preview-tone-sheet-actions';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'preview-tone-sheet-btn secondary';
    resetBtn.textContent = '初期化';
    resetBtn.addEventListener('click', () => {
        track.eq = createDefaultTrackEq(track.instrument);
        track.tone = createDefaultTrackTone();
        updateTrackPlaybackChain(track);
        callbacks.renderEditor?.();
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'preview-tone-sheet-btn primary';
    closeBtn.textContent = '閉じる';
    closeBtn.addEventListener('click', () => {
        closeTrackToneSheet(true);
    });

    actionsEl.append(resetBtn, closeBtn);
    sheetEl.appendChild(actionsEl);
    overlayEl.appendChild(sheetEl);
    return overlayEl;
}

function buildEqGraphEditor(track, eq, tone) {
    const graphEl = document.createElement('section');
    graphEl.className = 'preview-tone-graph';

    const headerEl = document.createElement('div');
    headerEl.className = 'preview-tone-graph-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'preview-tone-graph-title';
    titleEl.textContent = 'EQ';

    const legendEl = document.createElement('div');
    legendEl.className = 'preview-tone-graph-legend';
    const legendValues = new Map();

    EQ_GRAPH_BANDS.forEach((band) => {
        const chipEl = document.createElement('div');
        chipEl.className = `preview-tone-band-chip ${band.key}`;
        chipEl.dataset.eqBand = band.key;

        const labelEl = document.createElement('span');
        labelEl.className = 'preview-tone-band-chip-label';
        labelEl.textContent = band.label;

        const valueEl = document.createElement('span');
        valueEl.className = 'preview-tone-band-chip-value';
        chipEl.append(labelEl, valueEl);
        legendEl.appendChild(chipEl);
        legendValues.set(band.key, valueEl);
    });

    headerEl.append(titleEl, legendEl);
    graphEl.appendChild(headerEl);

    const svgWrapEl = document.createElement('div');
    svgWrapEl.className = 'preview-tone-graph-svg-wrap';
    const svgEl = document.createElementNS(SVG_NS, 'svg');
    svgEl.setAttribute('class', 'preview-tone-graph-svg');
    svgEl.setAttribute('viewBox', '0 0 320 176');
    svgEl.setAttribute('preserveAspectRatio', 'none');

    const left = 34;
    const right = 18;
    const top = 14;
    const bottom = 26;
    const graphWidth = 320 - left - right;
    const graphHeight = 176 - top - bottom;

    const bgEl = document.createElementNS(SVG_NS, 'rect');
    bgEl.setAttribute('x', String(left));
    bgEl.setAttribute('y', String(top));
    bgEl.setAttribute('width', String(graphWidth));
    bgEl.setAttribute('height', String(graphHeight));
    bgEl.setAttribute('rx', '12');
    bgEl.setAttribute('class', 'preview-tone-graph-bg');
    svgEl.appendChild(bgEl);

    EQ_GRAPH_DB_TICKS.forEach((db) => {
        const y = dbToGraphY(db, top, graphHeight);
        const lineEl = document.createElementNS(SVG_NS, 'line');
        lineEl.setAttribute('x1', String(left));
        lineEl.setAttribute('x2', String(left + graphWidth));
        lineEl.setAttribute('y1', String(y));
        lineEl.setAttribute('y2', String(y));
        lineEl.setAttribute('class', db === 0 ? 'preview-tone-grid-line zero' : 'preview-tone-grid-line');
        svgEl.appendChild(lineEl);

        const labelEl = document.createElementNS(SVG_NS, 'text');
        labelEl.setAttribute('x', String(left - 8));
        labelEl.setAttribute('y', String(y + 4));
        labelEl.setAttribute('text-anchor', 'end');
        labelEl.setAttribute('class', 'preview-tone-axis-label');
        labelEl.textContent = formatDbTick(db);
        svgEl.appendChild(labelEl);
    });

    EQ_GRAPH_FREQ_TICKS.forEach((freq) => {
        const x = freqToGraphX(freq, left, graphWidth);
        const lineEl = document.createElementNS(SVG_NS, 'line');
        lineEl.setAttribute('x1', String(x));
        lineEl.setAttribute('x2', String(x));
        lineEl.setAttribute('y1', String(top));
        lineEl.setAttribute('y2', String(top + graphHeight));
        lineEl.setAttribute('class', 'preview-tone-grid-line vertical');
        svgEl.appendChild(lineEl);

        const labelEl = document.createElementNS(SVG_NS, 'text');
        labelEl.setAttribute('x', String(x));
        labelEl.setAttribute('y', String(top + graphHeight + 18));
        labelEl.setAttribute('text-anchor', 'middle');
        labelEl.setAttribute('class', 'preview-tone-axis-label');
        labelEl.textContent = formatFrequency(freq);
        svgEl.appendChild(labelEl);
    });

    const curveEl = document.createElementNS(SVG_NS, 'path');
    curveEl.setAttribute('class', 'preview-tone-curve');
    svgEl.appendChild(curveEl);

    const handleMap = new Map();
    const labelMap = new Map();

    EQ_GRAPH_BANDS.forEach((band) => {
        const groupEl = document.createElementNS(SVG_NS, 'g');
        groupEl.setAttribute('class', `preview-tone-band ${band.key}`);
        groupEl.dataset.eqBand = band.key;

        const focusRingEl = document.createElementNS(SVG_NS, 'circle');
        focusRingEl.setAttribute('class', 'preview-tone-handle-focus');
        groupEl.appendChild(focusRingEl);

        const hitEl = document.createElementNS(SVG_NS, 'circle');
        hitEl.setAttribute('r', '14');
        hitEl.setAttribute('class', 'preview-tone-handle-hit');
        hitEl.dataset.eqBand = band.key;
        groupEl.appendChild(hitEl);

        const handleEl = document.createElementNS(SVG_NS, 'circle');
        handleEl.setAttribute('r', '5.5');
        handleEl.setAttribute('class', 'preview-tone-handle');
        handleEl.dataset.eqBand = band.key;
        groupEl.appendChild(handleEl);

        const pointLabelEl = document.createElementNS(SVG_NS, 'text');
        pointLabelEl.setAttribute('class', 'preview-tone-point-label');
        pointLabelEl.setAttribute('text-anchor', 'middle');
        pointLabelEl.dataset.eqBand = band.key;
        pointLabelEl.textContent = band.label;
        groupEl.appendChild(pointLabelEl);

        svgEl.appendChild(groupEl);
        handleMap.set(band.key, { focusRingEl, hitEl, handleEl });
        labelMap.set(band.key, pointLabelEl);
    });

    svgWrapEl.appendChild(svgEl);
    graphEl.appendChild(svgWrapEl);

    const renderGraph = () => {
        const points = EQ_GRAPH_BANDS.map((band) => {
            const x = freqToGraphX(tone[band.freqKey], left, graphWidth);
            const y = dbToGraphY(eq[band.key], top, graphHeight);
            return { band, x, y };
        });

        const path = [
            `M ${left} ${points[0].y}`,
            ...points.map((point) => `L ${point.x} ${point.y}`),
            `L ${left + graphWidth} ${points[points.length - 1].y}`,
        ].join(' ');
        curveEl.setAttribute('d', path);

        points.forEach(({ band, x, y }) => {
            const handles = handleMap.get(band.key);
            const labelEl = labelMap.get(band.key);
            handles.focusRingEl.setAttribute('cx', String(x));
            handles.focusRingEl.setAttribute('cy', String(y));
            handles.focusRingEl.setAttribute('r', '10');
            handles.hitEl.setAttribute('cx', String(x));
            handles.hitEl.setAttribute('cy', String(y));
            handles.handleEl.setAttribute('cx', String(x));
            handles.handleEl.setAttribute('cy', String(y));
            labelEl.setAttribute('x', String(x));
            labelEl.setAttribute('y', String(y - 12));
            legendValues.get(band.key).textContent = `${formatFrequency(tone[band.freqKey])} / ${formatSignedValue(eq[band.key], 'dB')}`;
        });
    };

    const startDrag = (band, event) => {
        event.preventDefault();
        const pointerId = event.pointerId;

        const updateFromPointer = (clientX, clientY) => {
            const rect = svgEl.getBoundingClientRect();
            const localX = ((clientX - rect.left) / rect.width) * 320;
            const localY = ((clientY - rect.top) / rect.height) * 176;
            const nextFreq = clampToneFrequencyForBand(
                band.freqKey,
                xToFrequency(localX, left, graphWidth)
            );
            const nextDb = normalizeEqValue(yToDb(localY, top, graphHeight));

            track.tone = normalizeTrackTone({
                ...track.tone,
                [band.freqKey]: nextFreq,
            });
            track.eq = {
                ...track.eq,
                [band.key]: nextDb,
            };

            tone[band.freqKey] = track.tone[band.freqKey];
            eq[band.key] = track.eq[band.key];
            updateTrackPlaybackChain(track);
            renderGraph();
        };

        const handleMove = (moveEvent) => {
            if (moveEvent.pointerId !== pointerId) return;
            updateFromPointer(moveEvent.clientX, moveEvent.clientY);
        };

        const handleEnd = (endEvent) => {
            if (endEvent.pointerId !== pointerId) return;
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleEnd);
            window.removeEventListener('pointercancel', handleEnd);
            callbacks.renderEditor?.();
        };

        updateFromPointer(event.clientX, event.clientY);
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleEnd);
        window.addEventListener('pointercancel', handleEnd);
    };

    EQ_GRAPH_BANDS.forEach((band) => {
        const handles = handleMap.get(band.key);
        handles.hitEl.addEventListener('pointerdown', (event) => startDrag(band, event));
        handles.handleEl.addEventListener('pointerdown', (event) => startDrag(band, event));
    });

    renderGraph();
    return graphEl;
}

function buildToneControlRow(track, tone, control) {
    const rowEl = document.createElement('div');
    rowEl.className = 'preview-tone-control';

    const topEl = document.createElement('div');
    topEl.className = 'preview-tone-control-top';

    const labelEl = document.createElement('span');
    labelEl.className = 'preview-tone-control-label';
    labelEl.textContent = control.label;

    const valueEl = document.createElement('span');
    valueEl.className = 'preview-tone-control-value';
    valueEl.dataset.toneKey = control.key;
    valueEl.textContent = formatToneControlValue(control, tone[control.key]);

    topEl.append(labelEl, valueEl);

    const inputEl = document.createElement('input');
    inputEl.type = 'range';
    inputEl.className = 'preview-tone-control-slider';
    inputEl.dataset.toneKey = control.key;
    inputEl.min = String(TRACK_TONE_LIMITS[control.key].min);
    inputEl.max = String(TRACK_TONE_LIMITS[control.key].max);
    inputEl.step = String(TRACK_TONE_LIMITS[control.key].step);
    inputEl.value = String(tone[control.key]);
    inputEl.setAttribute('aria-label', `${INST_LABEL[track.instrument]} ${control.label}`);
    inputEl.addEventListener('input', () => {
        const nextTone = normalizeTrackTone({
            ...track.tone,
            [control.key]: Number(inputEl.value),
        });
        track.tone = nextTone;
        valueEl.textContent = formatToneControlValue(control, nextTone[control.key]);
        updateTrackPlaybackChain(track);
    });
    inputEl.addEventListener('change', () => {
        callbacks.renderEditor?.();
    });

    rowEl.append(topEl, inputEl);
    return rowEl;
}

function formatToneControlValue(control, value) {
    return control.format(value, control.unit);
}

function formatSignedValue(value, unit) {
    const normalized = typeof value === 'number' ? value : 0;
    const sign = normalized > 0 ? `+${normalized}` : `${normalized}`;
    return unit ? `${sign} ${unit}` : sign;
}

function formatIntegerValue(value, unit) {
    const normalized = typeof value === 'number' ? Math.round(value) : 0;
    return unit ? `${normalized} ${unit}` : `${normalized}`;
}

function formatFixedValue(value, unit) {
    const normalized = typeof value === 'number' ? value.toFixed(2) : '0.00';
    return unit ? `${normalized} ${unit}` : normalized;
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
    const scaleFamilyOptions = getAvailableScaleFamilies(appState.songHarmony);
    const cardEl = document.createElement('section');
    cardEl.className = 'preview-song-settings';

    const titleEl = document.createElement('strong');
    titleEl.textContent = 'ルート / スケール';
    cardEl.appendChild(titleEl);

    const keyRow = document.createElement('div');
    keyRow.className = 'preview-song-settings-row';
    keyRow.appendChild(buildSettingsLabel('Root'));

    const keyRootSelect = document.createElement('select');
    keyRootSelect.className = 'preview-song-select preview-song-root-select';
    CHORD_ROOTS.forEach((root) => {
        const option = document.createElement('option');
        option.value = root;
        option.textContent = root;
        option.selected = root === appState.songRoot;
        keyRootSelect.appendChild(option);
    });
    keyRootSelect.addEventListener('change', () => {
        const normalized = normalizeSongSettings(
            keyRootSelect.value,
            appState.songHarmony,
            appState.songScaleFamily
        );
        appState.songRoot = normalized.root;
        appState.songHarmony = normalized.harmony;
        appState.songScaleFamily = normalized.scaleFamily;
        callbacks.renderEditor?.();
    });
    keyRow.appendChild(keyRootSelect);
    cardEl.appendChild(keyRow);

    const scaleRow = document.createElement('div');
    scaleRow.className = 'preview-song-settings-row scale-row';
    scaleRow.appendChild(buildSettingsLabel('Scale'));

    const harmonyControls = document.createElement('div');
    harmonyControls.className = 'preview-harmony-segmented';
    HARMONY_TYPES.forEach(({ value, label }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'preview-harmony-btn' + (appState.songHarmony === value ? ' selected' : '');
        button.dataset.harmony = value;
        button.textContent = label;
        button.addEventListener('click', () => {
            const normalized = normalizeSongSettings(
                appState.songRoot,
                value,
                appState.songScaleFamily
            );
            appState.songRoot = normalized.root;
            appState.songHarmony = normalized.harmony;
            appState.songScaleFamily = normalized.scaleFamily;
            callbacks.renderEditor?.();
        });
        harmonyControls.appendChild(button);
    });

    const scaleSelect = document.createElement('select');
    scaleSelect.className = 'preview-song-select preview-song-family-select';
    scaleSelect.setAttribute('aria-label', 'Scale Family');
    scaleFamilyOptions.forEach(({ value, label }) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.selected = appState.songScaleFamily === value;
        scaleSelect.appendChild(option);
    });
    scaleSelect.addEventListener('change', () => {
        const normalized = normalizeSongSettings(
            appState.songRoot,
            appState.songHarmony,
            scaleSelect.value
        );
        appState.songRoot = normalized.root;
        appState.songHarmony = normalized.harmony;
        appState.songScaleFamily = normalized.scaleFamily;
        callbacks.renderEditor?.();
    });
    scaleRow.appendChild(harmonyControls);
    scaleRow.appendChild(scaleSelect);
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
