import { appState, callbacks, clearPreviewCopyState, clearRepeatState } from '../../core/state.js';
import { copyTrackMeasureRange, pasteTrackMeasureRange, repeatTrackMeasureRange } from '../../features/tracks/tracks-controller.js';

export function buildRepeatSelectionRail(track, side) {
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

export function shouldShowRepeatEndRail(trackId) {
    const repeatState = getRepeatState(trackId);
    if (!repeatState || repeatState.sourceStartMeasure === null) return false;
    if (repeatState.sourceEndMeasure !== null && appState.currentMeasure !== repeatState.sourceEndMeasure) return false;
    const endMeasure = repeatState.sourceEndMeasure === null
        ? Math.max(repeatState.sourceStartMeasure, appState.currentMeasure)
        : repeatState.sourceEndMeasure;
    return appState.currentMeasure === endMeasure;
}

export function shouldShowRepeatStartRail(trackId) {
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

export function shouldShowRepeatButton(trackId) {
    return isRepeatAppendReady(trackId) || isRepeatClearReady(trackId);
}

export function handleRepeatButton(track) {
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

export function getRepeatCardStateClass(trackId) {
    const tone = getRepeatCardTone(trackId);
    return tone ? ` ${tone}` : '';
}

export function getRepeatGridStateClass(trackId) {
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
