// editor-router.js — エディタ描画ルーター（シークバー + エディタ振り分け）

import { appState, STEPS_PER_MEASURE, callbacks, getNormalizedPlayRangeMeasures } from '../core/state.js';
import { INST_TYPE } from '../instruments.js';
import { renderDrumEditor } from './editor-drum.js';
import { renderMelodicEditor } from './editor-melodic.js';
import { renderChordEditor } from './editor-chord.js';
import { renderPreview } from './editor-preview.js';
import { addMeasure, removeMeasure } from '../track-manager.js';

export function renderEditor() {
    const emptyState = document.getElementById('emptyState');
    const editorEl   = document.getElementById('trackEditor');
    editorEl.classList.remove('melodic-track-editor', 'drum-track-editor', 'chord-track-editor', 'preview-editor');

    // トラックが無い場合
    if (appState.tracks.length === 0) {
        emptyState.style.display = '';
        editorEl.style.display   = 'none';
        editorEl.innerHTML       = '';
        return;
    }

    // プレビューモードまたはトラック未選択
    if (appState.previewMode || appState.activeTrackId === null) {
        emptyState.style.display = 'none';
        editorEl.style.display   = '';
        editorEl.innerHTML       = '';
        editorEl.classList.add('preview-editor');

        // タイトルを「作曲ツール」に
        document.getElementById('topbarTitle').textContent = '作曲ツール';

        renderPreview(editorEl);

        // シークバーを下部に追加
        const seekRow = buildSeekBar();
        editorEl.appendChild(seekRow);
        return;
    }

    const track = appState.tracks.find(t => t.id === appState.activeTrackId);
    if (!track) return;

    emptyState.style.display = 'none';
    editorEl.style.display   = '';
    editorEl.innerHTML       = '';

    const header = document.createElement('div');
    header.className = 'editor-header';
    header.style.justifyContent = 'flex-end';
    editorEl.appendChild(header);

    if (INST_TYPE[track.instrument] === 'rhythm') {
        editorEl.classList.add('drum-track-editor');
        renderDrumEditor(track, editorEl);
    } else if (INST_TYPE[track.instrument] === 'chord') {
        editorEl.classList.add('chord-track-editor');
        renderChordEditor(track, editorEl);
    } else {
        editorEl.classList.add('melodic-track-editor');
        renderMelodicEditor(track, editorEl);
    }

    editorEl.appendChild(buildSeekBar());
}

export function syncMeasureSeekUI() {
    const seekSlider = document.querySelector('.measure-slider');
    const seekLabel = document.querySelector('.measure-seek-label');
    if (!seekSlider || !seekLabel) return;
    seekSlider.value = String(appState.currentMeasure);
    updateSeekSliderVisual(seekSlider, appState.currentMeasure);
    updateSeekLabel(seekLabel);
}

// --- 小節シークバー生成 ---
function buildSeekBar() {
    const seekRow = document.createElement('div');
    seekRow.className = 'measure-seek';
    const playRange = getNormalizedPlayRangeMeasures();

    const seekRemove = document.createElement('button');
    seekRemove.className = 'mb-btn mb-remove';
    seekRemove.textContent = '－';
    seekRemove.disabled = appState.numMeasures <= 1;
    seekRemove.addEventListener('click', removeMeasure);

    const seekPrev = document.createElement('button');
    seekPrev.className = 'mb-btn';
    seekPrev.textContent = '◀';
    seekPrev.disabled = appState.currentMeasure <= 0;
    seekPrev.addEventListener('click', () => { appState.currentMeasure--; renderEditor(); });

    const seekStart = document.createElement('button');
    seekStart.className = 'mb-btn mb-range-btn' + (appState.playRangeStartMeasure === appState.currentMeasure ? ' selected' : '');
    seekStart.textContent = '始';
    seekStart.title = '再生開始小節';
    seekStart.addEventListener('click', () => {
        appState.playRangeStartMeasure = appState.playRangeStartMeasure === appState.currentMeasure
            ? null
            : appState.currentMeasure;
        renderEditor();
    });

    const seekEnd = document.createElement('button');
    seekEnd.className = 'mb-btn mb-range-btn' + (appState.playRangeEndMeasure === appState.currentMeasure ? ' selected' : '');
    seekEnd.textContent = '終';
    seekEnd.title = '再生停止小節';
    seekEnd.addEventListener('click', () => {
        appState.playRangeEndMeasure = appState.playRangeEndMeasure === appState.currentMeasure
            ? null
            : appState.currentMeasure;
        renderEditor();
    });

    const seekSlider = document.createElement('input');
    seekSlider.type = 'range';
    seekSlider.className = 'measure-slider';
    seekSlider.min = 0;
    seekSlider.max = Math.max(1, appState.numMeasures - 1);
    seekSlider.value = appState.currentMeasure;
    const seekLabel = document.createElement('span');
    seekLabel.className = 'measure-seek-label';
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
    if (appState.playRangeStartMeasure !== null) {
        seekWrap.appendChild(buildRangeMarker('start', appState.playRangeStartMeasure));
    }
    if (appState.playRangeEndMeasure !== null) {
        seekWrap.appendChild(buildRangeMarker('end', appState.playRangeEndMeasure));
    }
    seekWrap.appendChild(seekSlider);

    const seekNext = document.createElement('button');
    seekNext.className = 'mb-btn';
    seekNext.textContent = '▶';
    seekNext.disabled = appState.currentMeasure >= appState.numMeasures - 1;
    seekNext.addEventListener('click', () => { appState.currentMeasure++; renderEditor(); });

    const seekAdd = document.createElement('button');
    seekAdd.className = 'mb-btn mb-add';
    seekAdd.textContent = '＋';
    seekAdd.addEventListener('click', addMeasure);

    seekRow.appendChild(seekRemove);
    seekRow.appendChild(seekPrev);
    seekRow.appendChild(seekStart);
    seekRow.appendChild(seekEnd);
    seekRow.appendChild(seekWrap);
    seekRow.appendChild(seekNext);
    seekRow.appendChild(seekAdd);
    seekRow.appendChild(seekLabel);

    return seekRow;
}

function updateSeekSliderVisual(seekSlider, measure) {
    const pct = appState.numMeasures <= 1 ? 0
        : (measure / (appState.numMeasures - 1)) * 100;
    seekSlider.style.backgroundSize = `${pct}% 100%`;
}

function updateSeekLabel(seekLabel) {
    const parts = [`${appState.currentMeasure + 1} / ${appState.numMeasures}`];
    if (appState.playRangeStartMeasure !== null) parts.push(`開始:${appState.playRangeStartMeasure + 1}`);
    if (appState.playRangeEndMeasure !== null) parts.push(`終了:${appState.playRangeEndMeasure + 1}`);
    seekLabel.textContent = parts.join('  ');
}

function buildRangeMarker(type, measure) {
    const marker = document.createElement('div');
    marker.className = `measure-point-marker ${type}`;
    const boundary = type === 'start'
        ? (measure / appState.numMeasures)
        : ((measure + 1) / appState.numMeasures);
    marker.style.left = `${boundary * 100}%`;
    marker.textContent = type === 'start' ? '始' : '終';
    marker.title = type === 'start'
        ? `再生開始: ${measure + 1}小節目`
        : `再生停止: ${measure + 1}小節目`;
    return marker;
}
