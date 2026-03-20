import {
    appState,
    getNormalizedPlayRangeMeasures,
    clearPreviewCopyState,
} from '../core/state.js';
import { addMeasure, clearTrackMeasure, removeMeasure } from '../features/tracks/tracks-controller.js';

export function buildSeekBar(renderEditor) {
    const seekShell = document.createElement('div');
    seekShell.className = 'measure-seek-shell';
    const seekCard = document.createElement('div');
    seekCard.className = 'measure-seek-card';
    const seekMeta = document.createElement('div');
    seekMeta.className = 'measure-seek-meta';
    const seekDesc = document.createElement('span');
    seekDesc.className = 'measure-seek-title';
    seekDesc.textContent = '小節';
    const seekLabel = document.createElement('span');
    seekLabel.className = 'measure-seek-label';
    seekMeta.appendChild(seekDesc);
    seekMeta.appendChild(seekLabel);
    seekMeta.appendChild(buildMeasureActions(renderEditor));
    seekCard.appendChild(seekMeta);

    const transportRow = document.createElement('div');
    transportRow.className = 'measure-seek transport-row';
    const playRange = getNormalizedPlayRangeMeasures();

    const seekStart = document.createElement('button');
    seekStart.className = 'mb-btn mb-range-btn range-start' + (appState.playRangeStartMeasure === appState.currentMeasure ? ' selected' : '');
    seekStart.innerHTML = 'A<span class="mb-btn-guide">開始</span>';
    seekStart.title = '再生開始小節';
    seekStart.addEventListener('click', () => {
        appState.playRangeStartMeasure = appState.playRangeStartMeasure === appState.currentMeasure
            ? null
            : appState.currentMeasure;
        renderEditor();
    });

    const seekEnd = document.createElement('button');
    seekEnd.className = 'mb-btn mb-range-btn range-end' + (appState.playRangeEndMeasure === appState.currentMeasure ? ' selected' : '');
    seekEnd.innerHTML = 'B<span class="mb-btn-guide">終了</span>';
    seekEnd.title = '再生停止小節';
    seekEnd.addEventListener('click', () => {
        appState.playRangeEndMeasure = appState.playRangeEndMeasure === appState.currentMeasure
            ? null
            : appState.currentMeasure;
        renderEditor();
    });

    const rangeCluster = document.createElement('div');
    rangeCluster.className = 'measure-transport-cluster range-cluster';
    rangeCluster.append(seekStart, seekEnd);

    const seekPrev = document.createElement('button');
    seekPrev.className = 'mb-btn mb-nav-btn';
    seekPrev.textContent = '‹';
    seekPrev.disabled = appState.currentMeasure <= 0;
    seekPrev.addEventListener('click', () => {
        appState.currentMeasure--;
        renderEditor();
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

    const seekSlider = document.createElement('input');
    seekSlider.type = 'range';
    seekSlider.className = 'measure-slider';
    seekSlider.min = 0;
    seekSlider.max = Math.max(1, appState.numMeasures - 1);
    seekSlider.value = appState.currentMeasure;

    updateSeekSliderVisual(seekSlider, appState.currentMeasure);
    updateSeekLabel(seekLabel);

    seekSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (appState.currentMeasure !== v) {
            appState.currentMeasure = v;
            updateSeekSliderVisual(seekSlider, v);
            updateSeekLabel(seekLabel);
        }
    });
    seekSlider.addEventListener('change', () => {
        renderEditor();
    });

    const seekWrap = document.createElement('div');
    seekWrap.className = 'mb-slider-wrap';
    if (playRange) {
        const rangeSpan = playRange.endMeasure - playRange.startMeasure + 1;
        seekWrap.style.setProperty('--measure-range-left', `${(playRange.startMeasure / appState.numMeasures) * 100}%`);
        seekWrap.style.setProperty('--measure-range-width', `${(rangeSpan / appState.numMeasures) * 100}%`);
        seekWrap.classList.add('has-play-range');
    }

    const seekRange = document.createElement('div');
    seekRange.className = 'measure-range-highlight';
    seekWrap.appendChild(seekRange);
    appendPreviewRangeHighlights(seekWrap);
    if (appState.playRangeStartMeasure !== null) {
        seekWrap.appendChild(buildRangeMarker('start', appState.playRangeStartMeasure));
    }
    if (appState.playRangeEndMeasure !== null) {
        seekWrap.appendChild(buildRangeMarker('end', appState.playRangeEndMeasure));
    }
    seekWrap.appendChild(seekSlider);

    const seekNext = document.createElement('button');
    seekNext.className = 'mb-btn mb-nav-btn';
    seekNext.textContent = '›';
    seekNext.disabled = appState.currentMeasure >= appState.numMeasures - 1;
    seekNext.addEventListener('click', () => {
        appState.currentMeasure++;
        renderEditor();
    });

    const navCluster = document.createElement('div');
    navCluster.className = 'measure-transport-cluster nav-cluster';
    navCluster.append(seekPrev, seekNext);

    transportRow.append(rangeCluster, playToggleBtn, navCluster);

    const sliderRow = document.createElement('div');
    sliderRow.className = 'measure-seek slider-row';
    sliderRow.appendChild(seekWrap);

    seekCard.append(transportRow, sliderRow);
    seekShell.appendChild(seekCard);
    return seekShell;
}

export function syncMeasureSeekUI() {
    const seekSlider = document.querySelector('.measure-slider');
    const seekLabel = document.querySelector('.measure-seek-label');
    if (!seekSlider || !seekLabel) return;
    seekSlider.value = String(appState.currentMeasure);
    updateSeekSliderVisual(seekSlider, appState.currentMeasure);
    updateSeekLabel(seekLabel);
}

function updateSeekSliderVisual(seekSlider, measure) {
    const pct = appState.numMeasures <= 1 ? 0
        : (measure / (appState.numMeasures - 1)) * 100;
    seekSlider.style.backgroundSize = `${pct}% 100%`;
}

function updateSeekLabel(seekLabel) {
    const parts = [`${appState.currentMeasure + 1} / ${appState.numMeasures}`];
    if (appState.previewRangeMode === 'copy' && appState.previewRangeStartMeasure !== null && appState.previewRangeEndMeasure !== null) {
        parts.push(`コピー:${appState.previewRangeStartMeasure + 1}→${appState.previewRangeEndMeasure + 1}`);
    }
    if (appState.playRangeStartMeasure !== null) parts.push(`開始:${appState.playRangeStartMeasure + 1}`);
    if (appState.playRangeEndMeasure !== null) parts.push(`終了:${appState.playRangeEndMeasure + 1}`);
    seekLabel.textContent = parts.join('  ');
}

function appendPreviewRangeHighlights(seekWrap) {
    if (appState.previewRangeMode === 'copy'
        && appState.previewRangeStartMeasure !== null
        && appState.previewRangeEndMeasure !== null) {
        appendMeasureHighlight(
            seekWrap,
            'copy',
            Math.min(appState.previewRangeStartMeasure, appState.previewRangeEndMeasure),
            Math.min(appState.numMeasures - 1, Math.max(appState.previewRangeStartMeasure, appState.previewRangeEndMeasure))
        );
    }

    const repeatTrackId = getSeekRepeatTrackId();
    if (repeatTrackId === null) return;

    const repeatState = appState.repeatStates?.[repeatTrackId];
    if (
        !repeatState
        || repeatState.sourceStartMeasure === null
        || repeatState.sourceEndMeasure === null
    ) {
        return;
    }

    const sourceStart = repeatState.sourceStartMeasure;
    const sourceEnd = repeatState.sourceEndMeasure;
    const targetEnd = Math.max(sourceEnd, repeatState.targetEndMeasure ?? sourceEnd);
    appendMeasureHighlight(
        seekWrap,
        'repeat',
        sourceStart,
        Math.min(appState.numMeasures - 1, targetEnd)
    );
    appendMeasureHighlight(
        seekWrap,
        'source',
        sourceStart,
        Math.min(appState.numMeasures - 1, sourceEnd)
    );
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
    const boundary = type === 'start'
        ? (measure / appState.numMeasures)
        : ((measure + 1) / appState.numMeasures);
    marker.style.left = `${boundary * 100}%`;
    marker.textContent = type === 'start' ? 'A' : 'B';
    marker.title = type === 'start'
        ? `再生開始: ${measure + 1}小節目`
        : `再生停止: ${measure + 1}小節目`;
    return marker;
}

function buildMeasureActions(renderEditor) {
    const wrap = document.createElement('div');
    wrap.className = 'measure-actions seek-measure-actions';

    const label = document.createElement('span');
    label.className = 'measure-actions-label';
    label.textContent = '小節';
    wrap.appendChild(label);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'measure-action-btn remove';
    removeBtn.type = 'button';
    removeBtn.textContent = '削除';
    const activeTrack = !appState.previewMode && appState.activeTrackId !== null
        ? appState.tracks.find((track) => track.id === appState.activeTrackId)
        : null;
    const clearsTrackOnly = Boolean(activeTrack);
    removeBtn.title = clearsTrackOnly
        ? '今見ている小節のこのトラック内容を削除'
        : '今見ている小節を削除';
    removeBtn.disabled = clearsTrackOnly ? false : appState.numMeasures <= 1;
    removeBtn.addEventListener('click', () => {
        const message = clearsTrackOnly
            ? `今見ている ${appState.currentMeasure + 1} 小節目のこのトラック内容を削除しますか？`
            : `今見ている ${appState.currentMeasure + 1} 小節目を削除しますか？`;
        if (!confirm(message)) return;
        if (clearsTrackOnly) {
            clearTrackMeasure(activeTrack, appState.currentMeasure);
            return;
        }
        removeMeasure();
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'measure-action-btn add';
    addBtn.type = 'button';
    addBtn.textContent = '追加';
    addBtn.title = '小節を追加';
    addBtn.addEventListener('click', () => {
        addMeasure();
    });

    wrap.append(removeBtn, addBtn);
    return wrap;
}
