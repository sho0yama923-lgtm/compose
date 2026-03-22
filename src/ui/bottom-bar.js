import {
    appState,
    getNormalizedPlayRangeMeasures,
} from '../core/state.js';
import { addMeasure, clearTrackMeasure, removeMeasure } from '../features/tracks/tracks-controller.js';

export function buildSeekBar(renderEditor) {
    ensureDefaultPlayRangeMeasures();
    const seekShell = document.createElement('div');
    seekShell.className = 'measure-seek-shell';
    const seekCard = document.createElement('div');
    seekCard.className = 'measure-seek-card';
    const seekLabel = document.createElement('span');
    seekLabel.className = 'measure-seek-label';
    updateSeekLabel(seekLabel);

    const timelineSection = buildRangeTimeline(renderEditor, seekLabel);
    seekCard.appendChild(timelineSection);

    const transportRow = document.createElement('div');
    transportRow.className = 'measure-seek transport-row';

    const seekPrev = buildSeekNavButton({
        direction: -1,
        icon: '|◁',
        label: '前小節',
        renderEditor,
    });

    const playToggleBtn = document.createElement('button');
    playToggleBtn.className = 'btn btn-play mb-play-btn';
    playToggleBtn.type = 'button';
    playToggleBtn.dataset.playToggle = 'true';
    playToggleBtn.setAttribute('aria-label', appState.isPlaying ? '停止' : '再生');
    playToggleBtn.setAttribute('aria-pressed', String(appState.isPlaying));
    playToggleBtn.textContent = appState.isPlaying ? '||' : '▶';
    playToggleBtn.classList.toggle('is-playing', appState.isPlaying);
    playToggleBtn.disabled = appState.isBooting;

    const seekNext = buildSeekNavButton({
        direction: 1,
        icon: '▷|',
        label: '次小節',
        renderEditor,
    });

    transportRow.append(seekPrev, playToggleBtn, seekNext);
    const actionRow = document.createElement('div');
    actionRow.className = 'measure-seek action-row';
    actionRow.appendChild(buildMeasureActions(renderEditor));

    seekCard.append(transportRow, actionRow);
    seekShell.appendChild(seekCard);
    return seekShell;
}

export function syncMeasureSeekUI() {
    const seekLabel = document.querySelector('.measure-seek-label');
    if (!seekLabel) return;
    updateSeekLabel(seekLabel);
    const rail = document.querySelector('.measure-range-rail');
    if (rail) {
        rail.style.setProperty('--measure-current-left', `${getCurrentHeadMeasureRatio() * 100}%`);
    }
    document.querySelectorAll('.mb-nav-btn[data-direction="-1"]').forEach((btn) => {
        btn.disabled = appState.currentMeasure <= 0;
    });
    document.querySelectorAll('.mb-nav-btn[data-direction="1"]').forEach((btn) => {
        btn.disabled = appState.currentMeasure >= appState.numMeasures - 1;
    });
}

function updateSeekLabel(seekLabel) {
    const parts = [`小節 ${appState.currentMeasure + 1} / ${appState.numMeasures}`];
    if (appState.previewRangeMode === 'copy' && appState.previewRangeStartMeasure !== null && appState.previewRangeEndMeasure !== null) {
        parts.push(`コピー:${appState.previewRangeStartMeasure + 1}→${appState.previewRangeEndMeasure + 1}`);
    }
    seekLabel.textContent = parts.join('  ');
}

function appendPreviewRangeHighlights(seekWrap) {
    // 下部プレイヤーでは、コピー/繰り返し編集用の型強調は出さず
    // 再生範囲だけを見せる。
    return seekWrap;
}

function getSeekRepeatTrackId() {
    if (!appState.previewMode && appState.activeTrackId !== null) {
        return appState.activeTrackId;
    }

    if (appState.lastTouchedTrackId !== null) {
        return appState.lastTouchedTrackId;
    }

    return appState.activeTrackId;
}

function appendMeasureHighlight(seekWrap, className, startMeasure, endMeasure) {
    if (startMeasure === null || endMeasure === null || endMeasure < startMeasure) return;
    const span = document.createElement('div');
    span.className = `measure-preview-highlight ${className}`;
    span.style.left = `${(startMeasure / appState.numMeasures) * 100}%`;
    span.style.width = `${((endMeasure - startMeasure + 1) / appState.numMeasures) * 100}%`;
    seekWrap.appendChild(span);
}

function buildRangeMarker(type, measure) {
    const marker = document.createElement('div');
    marker.className = `measure-point-marker ${type}`;
    marker.dataset.markerType = type;
    marker.title = type === 'start'
        ? `再生開始: ${measure + 1}小節目`
        : `再生終了: ${measure + 1}小節目`;
    marker.innerHTML = `
        <span class="measure-point-label">
            <span class="measure-repeat-symbol ${type}">
                <span class="measure-repeat-dots"><span></span><span></span></span>
                <span class="measure-repeat-bars"><span></span><span></span></span>
            </span>
        </span>
        <span class="measure-point-stem"></span>
    `;
    return marker;
}

function buildRangeTimeline(renderEditor, seekLabel) {
    const timelineSection = document.createElement('section');
    timelineSection.className = 'measure-range-editor';

    const rail = document.createElement('div');
    rail.className = 'measure-range-rail';
    rail.style.setProperty('--measure-count', String(appState.numMeasures));
    rail.appendChild(buildRailDividers());

    const track = document.createElement('div');
    track.className = 'measure-range-track';
    rail.appendChild(track);

    const rangeBand = document.createElement('div');
    rangeBand.className = 'measure-range-highlight';
    rail.appendChild(rangeBand);

    const currentMarker = document.createElement('div');
    currentMarker.className = 'measure-current-marker';
    rail.appendChild(currentMarker);

    const startMarker = buildRangeMarker('start', appState.playRangeStartMeasure ?? 0);
    const endMarker = buildRangeMarker('end', appState.playRangeEndMeasure ?? Math.max(0, appState.numMeasures - 1));
    rail.append(startMarker, endMarker);

    const meta = document.createElement('div');
    meta.className = 'measure-range-meta';
    meta.appendChild(seekLabel);

    timelineSection.append(rail, meta);

    const refreshTimeline = () => {
        const playRange = getNormalizedPlayRangeMeasures();
        if (!playRange) return;
        const left = (playRange.startMeasure / appState.numMeasures) * 100;
        const width = ((playRange.endMeasure - playRange.startMeasure + 1) / appState.numMeasures) * 100;
        const current = getCurrentHeadMeasureRatio() * 100;
        rail.style.setProperty('--measure-range-left', `${left}%`);
        rail.style.setProperty('--measure-range-width', `${width}%`);
        rail.style.setProperty('--measure-current-left', `${current}%`);
        startMarker.style.left = `${left}%`;
        endMarker.style.left = `${((playRange.endMeasure + 1) / appState.numMeasures) * 100}%`;
        startMarker.title = `再生開始: ${playRange.startMeasure + 1}小節目`;
        endMarker.title = `再生終了: ${playRange.endMeasure + 1}小節目`;
        updateSeekLabel(seekLabel);
    };

    const onRailPointerDown = (event) => {
        if (event.target.closest('.measure-point-marker')) return;
        if (event.target.closest('.measure-current-marker')) return;
        const rect = rail.getBoundingClientRect();
        const nextMeasure = clampMeasure(Math.floor(((event.clientX - rect.left) / rect.width) * appState.numMeasures));
        if (appState.currentMeasure !== nextMeasure) {
            appState.currentMeasure = nextMeasure;
            appState.playheadStep = nextMeasure * 48;
            refreshTimeline();
            renderEditor();
        }
    };
    rail.addEventListener('pointerdown', onRailPointerDown);

    startMarker.addEventListener('pointerdown', (event) => {
        startRangeDrag({
            event,
            type: 'start',
            rail,
            refreshTimeline,
            renderEditor,
        });
    });
    endMarker.addEventListener('pointerdown', (event) => {
        startRangeDrag({
            event,
            type: 'end',
            rail,
            refreshTimeline,
            renderEditor,
        });
    });
    currentMarker.addEventListener('pointerdown', (event) => {
        startHeadDrag({
            event,
            rail,
            refreshTimeline,
            renderEditor,
        });
    });

    refreshTimeline();
    return timelineSection;
}

function startRangeDrag({ event, type, rail, refreshTimeline, renderEditor }) {
    event.preventDefault();
    event.stopPropagation();
    const tooltip = buildDragTooltip(rail);

    const onMove = (moveEvent) => {
        const rect = rail.getBoundingClientRect();
        if (!rect.width) return;
        const ratio = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
        if (type === 'start') {
            const nextStart = clampMeasure(Math.floor(ratio * appState.numMeasures));
            appState.playRangeStartMeasure = Math.min(nextStart, appState.playRangeEndMeasure ?? nextStart);
            updateDragTooltip(tooltip, appState.playRangeStartMeasure, (appState.playRangeStartMeasure / appState.numMeasures) * 100);
        } else {
            const nextEnd = clampMeasure(Math.ceil(ratio * appState.numMeasures) - 1);
            appState.playRangeEndMeasure = Math.max(nextEnd, appState.playRangeStartMeasure ?? nextEnd);
            updateDragTooltip(tooltip, appState.playRangeEndMeasure, ((appState.playRangeEndMeasure + 1) / appState.numMeasures) * 100);
        }
        refreshTimeline();
    };

    const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        tooltip.remove();
        renderEditor();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
}

function startHeadDrag({ event, rail, refreshTimeline, renderEditor }) {
    if (appState.isPlaying) return;
    event.preventDefault();
    event.stopPropagation();
    const tooltip = buildDragTooltip(rail);

    const onMove = (moveEvent) => {
        const rect = rail.getBoundingClientRect();
        if (!rect.width) return;
        const ratio = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
        const nextMeasure = clampMeasure(Math.round(ratio * Math.max(0, appState.numMeasures - 1)));
        appState.currentMeasure = nextMeasure;
        appState.playheadStep = nextMeasure * 48;
        updateDragTooltip(tooltip, nextMeasure, getMeasureRatio(nextMeasure) * 100);
        refreshTimeline();
    };

    const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        tooltip.remove();
        renderEditor();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
}

function ensureDefaultPlayRangeMeasures() {
    const lastMeasure = Math.max(0, appState.numMeasures - 1);
    if (appState.playRangeStartMeasure === null) {
        appState.playRangeStartMeasure = 0;
    }
    if (appState.playRangeEndMeasure === null) {
        appState.playRangeEndMeasure = lastMeasure;
    }
    appState.playRangeStartMeasure = clampMeasure(appState.playRangeStartMeasure);
    appState.playRangeEndMeasure = clampMeasure(appState.playRangeEndMeasure);
}

function clampMeasure(measure) {
    return Math.max(0, Math.min(Math.max(0, appState.numMeasures - 1), measure));
}

function buildMeasureActions(renderEditor) {
    const wrap = document.createElement('div');
    wrap.className = 'measure-actions seek-measure-actions';

    const addBtn = document.createElement('button');
    addBtn.className = 'measure-action-btn add';
    addBtn.type = 'button';
    addBtn.innerHTML = '<span class="measure-action-icon">+</span><span class="measure-action-text">小節追加</span>';
    addBtn.title = '小節を追加';
    addBtn.addEventListener('click', () => {
        addMeasure();
        renderEditor();
    });

    const moreBtn = document.createElement('button');
    moreBtn.className = 'measure-action-btn more';
    moreBtn.type = 'button';
    moreBtn.setAttribute('aria-label', 'その他');
    moreBtn.textContent = '⋯';
    moreBtn.addEventListener('click', () => {
        openMeasureActionsSheet(renderEditor);
    });

    wrap.append(addBtn, moreBtn);
    return wrap;
}

function openMeasureActionsSheet(renderEditor) {
    document.querySelector('.measure-actions-sheet-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'measure-actions-sheet-overlay';

    const sheet = document.createElement('div');
    sheet.className = 'measure-actions-sheet';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'measure-sheet-btn';
    resetBtn.type = 'button';
    resetBtn.textContent = '範囲をリセット';
    resetBtn.addEventListener('click', () => {
        appState.playRangeStartMeasure = 0;
        appState.playRangeEndMeasure = Math.max(0, appState.numMeasures - 1);
        overlay.remove();
        renderEditor();
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'measure-sheet-btn danger';
    removeBtn.type = 'button';
    removeBtn.textContent = '小節を削除';
    const activeTrack = !appState.previewMode && appState.activeTrackId !== null
        ? appState.tracks.find((track) => track.id === appState.activeTrackId)
        : null;
    const clearsTrackOnly = Boolean(activeTrack);
    removeBtn.disabled = clearsTrackOnly ? false : appState.numMeasures <= 1;
    removeBtn.addEventListener('click', () => {
        const message = clearsTrackOnly
            ? `今見ている ${appState.currentMeasure + 1} 小節目のこのトラック内容を削除しますか？`
            : `今見ている ${appState.currentMeasure + 1} 小節目を削除しますか？`;
        if (!confirm(message)) return;
        if (clearsTrackOnly) {
            clearTrackMeasure(activeTrack, appState.currentMeasure);
        } else {
            removeMeasure();
        }
        overlay.remove();
        renderEditor();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'measure-sheet-btn';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'キャンセル';
    cancelBtn.addEventListener('click', () => overlay.remove());

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) overlay.remove();
    });

    sheet.append(resetBtn, removeBtn, cancelBtn);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
}

function buildSeekNavButton({ direction, icon, label, renderEditor }) {
    const button = document.createElement('button');
    button.className = 'mb-btn mb-nav-btn';
    button.dataset.direction = String(direction);
    button.innerHTML = `${icon}<span class="mb-btn-guide">${label}</span>`;
    button.disabled = direction < 0
        ? appState.currentMeasure <= 0
        : appState.currentMeasure >= appState.numMeasures - 1;
    button.addEventListener('click', () => {
        moveCurrentMeasure(direction, renderEditor);
    });

    let holdTimeout = null;
    let holdInterval = null;
    const clearHold = () => {
        if (holdTimeout) window.clearTimeout(holdTimeout);
        if (holdInterval) window.clearInterval(holdInterval);
        holdTimeout = null;
        holdInterval = null;
    };
    button.addEventListener('pointerdown', () => {
        if (button.disabled) return;
        holdTimeout = window.setTimeout(() => {
            holdInterval = window.setInterval(() => {
                if (!moveCurrentMeasure(direction, renderEditor)) clearHold();
            }, 200);
        }, 500);
    });
    button.addEventListener('pointerup', clearHold);
    button.addEventListener('pointerleave', clearHold);
    button.addEventListener('pointercancel', clearHold);
    return button;
}

function moveCurrentMeasure(direction, renderEditor) {
    const nextMeasure = clampMeasure(appState.currentMeasure + direction);
    if (nextMeasure === appState.currentMeasure) return false;
    appState.currentMeasure = nextMeasure;
    appState.playheadStep = nextMeasure * 48;
    renderEditor();
    return true;
}

function getCurrentHeadMeasureRatio() {
    return getMeasureRatio(getCurrentHeadMeasure());
}

function getCurrentHeadMeasure() {
    if (typeof appState.playheadStep === 'number') {
        return clampMeasure(Math.floor(appState.playheadStep / 48));
    }
    return clampMeasure(appState.currentMeasure);
}

function getMeasureRatio(measure) {
    return clampMeasure(measure) / Math.max(1, appState.numMeasures);
}

function buildRailDividers() {
    const wrap = document.createElement('div');
    wrap.className = 'measure-range-dividers';
    wrap.style.gridTemplateColumns = `repeat(${appState.numMeasures}, minmax(0, 1fr))`;
    for (let measure = 0; measure < appState.numMeasures; measure += 1) {
        const divider = document.createElement('div');
        divider.className = 'measure-range-divider';
        wrap.appendChild(divider);
    }
    return wrap;
}

function buildDragTooltip(rail) {
    rail.querySelector('.measure-drag-tooltip')?.remove();
    const tooltip = document.createElement('div');
    tooltip.className = 'measure-drag-tooltip';
    rail.appendChild(tooltip);
    return tooltip;
}

function updateDragTooltip(tooltip, measure, leftPct) {
    tooltip.textContent = `小節 ${measure + 1}`;
    tooltip.style.left = `${leftPct}%`;
}
