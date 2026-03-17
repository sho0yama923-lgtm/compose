import { appState, callbacks } from '../../core/state.js';
import {
    INST_LABEL,
    TRACK_TONE_LIMITS,
    createDefaultTrackEq,
    createDefaultTrackTone,
    normalizeTrackTone,
    updateTrackPlaybackChain,
} from '../../features/tracks/instrument-map.js';
import {
    SVG_NS,
    EQ_GRAPH_BANDS,
    EQ_GRAPH_DB_TICKS,
    EQ_GRAPH_FREQ_TICKS,
    TONE_CONTROL_CONFIG,
    ensureTrackEq,
    ensureTrackTone,
    normalizeEqValue,
    formatFrequency,
    formatDbTick,
    freqToGraphX,
    xToFrequency,
    dbToGraphY,
    yToDb,
    clampToneFrequencyForBand,
    formatToneControlValue,
    formatSignedValue,
} from './preview-shared.js';

function closeTrackToneSheet(shouldRender = true) {
    appState.previewToneTrackId = null;
    if (shouldRender) callbacks.renderEditor?.();
}

export function buildTrackToneSheet(track) {
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
