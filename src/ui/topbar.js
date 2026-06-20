import { appState, callbacks } from '../core/state.js';
import { INST_LABEL, INST_TYPE } from '../features/tracks/instrument-map.js';

const TAB_REORDER_HOLD_MS = 420;

let tabDragState = null;

function getTopbarTrackLabel(track) {
    if (!track) return 'トラック';
    if (INST_TYPE[track.instrument] === 'chord') return 'コード';
    const baseLabel = INST_LABEL[track.instrument] ?? track.instrument;
    return baseLabel.replace(/^[^\p{Letter}\p{Number}]+/u, '').trim() || baseLabel;
}

function moveTrackBeforeOrAfter(sourceId, targetId, placeAfter) {
    if (sourceId === targetId) return false;
    const fromIndex = appState.tracks.findIndex((track) => track.id === sourceId);
    const targetIndex = appState.tracks.findIndex((track) => track.id === targetId);
    if (fromIndex < 0 || targetIndex < 0) return false;

    const [track] = appState.tracks.splice(fromIndex, 1);
    let insertIndex = appState.tracks.findIndex((item) => item.id === targetId);
    if (insertIndex < 0) {
        appState.tracks.push(track);
        return true;
    }
    if (placeAfter) insertIndex += 1;
    appState.tracks.splice(insertIndex, 0, track);
    return true;
}

function getTrackTabAtPoint(x, y) {
    const tabsEl = document.getElementById('topbarTabs');
    if (!tabsEl) return null;
    const rowRect = tabsEl.getBoundingClientRect();
    const verticalPadding = 24;
    if (y < rowRect.top - verticalPadding || y > rowRect.bottom + verticalPadding) return null;

    const tabs = Array.from(tabsEl.querySelectorAll('.topbar-tab-btn[data-track-id]'))
        .filter((tab) => tab instanceof HTMLElement && tab !== tabDragState?.button);
    let closestTab = null;
    let closestDistance = Infinity;
    tabs.forEach((tab) => {
        const rect = tab.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right) {
            closestTab = tab;
            closestDistance = 0;
            return;
        }
        const distance = Math.min(Math.abs(x - rect.left), Math.abs(x - rect.right));
        if (distance < closestDistance) {
            closestTab = tab;
            closestDistance = distance;
        }
    });
    return closestTab;
}

function startTabDrag(button, event) {
    const trackId = Number(button.dataset.trackId);
    if (!Number.isFinite(trackId)) return;
    const tabsEl = document.getElementById('topbarTabs');
    if (!tabsEl) return;

    tabDragState = {
        button,
        pointerId: event.pointerId,
        trackId,
        moved: false,
        scrollLeft: tabsEl.scrollLeft,
    };
    button.dataset.dragSuppress = 'true';
    tabsEl.classList.add('is-reordering');
    button.classList.add('is-dragging');
    tabsEl.scrollLeft = tabDragState.scrollLeft;
}

function updateTabDrag(event) {
    if (!tabDragState || event.pointerId !== tabDragState.pointerId) return;
    const tabsEl = document.getElementById('topbarTabs');
    if (tabsEl) tabsEl.scrollLeft = tabDragState.scrollLeft;
    const targetTab = getTrackTabAtPoint(event.clientX, event.clientY);
    if (!targetTab) return;
    const targetId = Number(targetTab.dataset.trackId);
    if (!Number.isFinite(targetId) || targetId === tabDragState.trackId) return;

    const rect = targetTab.getBoundingClientRect();
    const placeAfter = event.clientX > rect.left + rect.width / 2;
    if (!moveTrackBeforeOrAfter(tabDragState.trackId, targetId, placeAfter)) return;

    const referenceNode = placeAfter ? targetTab.nextSibling : targetTab;
    targetTab.parentElement?.insertBefore(tabDragState.button, referenceNode);
    tabDragState.moved = true;
}

function finishTabDrag(event) {
    if (!tabDragState || event.pointerId !== tabDragState.pointerId) return;
    const { button, moved } = tabDragState;
    tabDragState = null;
    button.classList.remove('is-dragging');
    document.getElementById('topbarTabs')?.classList.remove('is-reordering');
    if (moved) {
        callbacks.renderEditor?.();
    }
    window.setTimeout(() => {
        delete button.dataset.dragSuppress;
    }, 0);
}

function bindTrackTabReorder(button) {
    let holdTimer = null;
    let pointerState = null;
    const clearHold = () => {
        if (holdTimer) window.clearTimeout(holdTimer);
        holdTimer = null;
    };
    const clearPointerListeners = () => {
        if (!pointerState) return;
        window.removeEventListener('pointermove', pointerState.onMove);
        window.removeEventListener('pointerup', pointerState.onUp);
        window.removeEventListener('pointercancel', pointerState.onCancel);
        pointerState = null;
    };

    button.addEventListener('click', (event) => {
        if (button.dataset.dragSuppress === 'true') {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    });

    button.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        clearHold();
        clearPointerListeners();
        const pointerId = event.pointerId;
        const onMove = (moveEvent) => {
            if (moveEvent.pointerId !== pointerId) return;
            if (tabDragState?.button === button) {
                moveEvent.preventDefault();
                updateTabDrag(moveEvent);
            }
        };
        const onUp = (upEvent) => {
            if (upEvent.pointerId !== pointerId) return;
            clearHold();
            finishTabDrag(upEvent);
            clearPointerListeners();
        };
        const onCancel = (cancelEvent) => {
            if (cancelEvent.pointerId !== pointerId) return;
            clearHold();
            finishTabDrag(cancelEvent);
            clearPointerListeners();
        };
        pointerState = { onMove, onUp, onCancel };
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
        holdTimer = window.setTimeout(() => {
            startTabDrag(button, event);
        }, TAB_REORDER_HOLD_MS);
    });
    button.addEventListener('contextmenu', (event) => {
        if (holdTimer || tabDragState?.button === button) event.preventDefault();
    });
}

export function setTopbarTitle() {
    renderTopbarTabs();
}

export function renderTopbarTabs() {
    const previewSlotEl = document.getElementById('topbarPreviewSlot');
    const tabsEl = document.getElementById('topbarTabs');
    if (!previewSlotEl || !tabsEl) return;

    const previewSelected = appState.previewMode || appState.activeTrackId === null;
    previewSlotEl.innerHTML = '';
    tabsEl.innerHTML = '';

    const previewButton = document.createElement('button');
    previewButton.className = 'btn topbar-tab-btn' + (previewSelected ? ' is-active' : '');
    previewButton.id = 'viewToggleBtn';
    previewButton.type = 'button';
    previewButton.dataset.topbarView = 'preview';
    previewButton.setAttribute('aria-pressed', String(previewSelected));
    previewButton.setAttribute('aria-label', previewSelected ? '全体表示中' : '全体表示へ切替');
    previewButton.textContent = '全体';
    previewSlotEl.appendChild(previewButton);

    appState.tracks.forEach((track) => {
        const selected = !previewSelected && appState.activeTrackId === track.id;
        const button = document.createElement('button');
        button.className = 'btn topbar-tab-btn' + (selected ? ' is-active' : '');
        button.type = 'button';
        button.dataset.trackId = String(track.id);
        button.setAttribute('aria-pressed', String(selected));
        button.setAttribute('aria-label', selected ? `${getTopbarTrackLabel(track)}を表示中` : `${getTopbarTrackLabel(track)}へ切替`);
        button.textContent = getTopbarTrackLabel(track);
        bindTrackTabReorder(button);
        tabsEl.appendChild(button);
    });
}

export function syncViewToggleButton() {
    renderTopbarTabs();
}
