// swipe.js — スワイプで小節移動

import { appState, callbacks } from './state.js';

export function initSwipe() {
    const mainEl = document.getElementById('main');
    let swipeStartX = 0, swipeStartY = 0;

    mainEl.addEventListener('touchstart', e => {
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
    }, { passive: true });

    mainEl.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - swipeStartX;
        const dy = e.changedTouches[0].clientY - swipeStartY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0 && appState.currentMeasure < appState.numMeasures - 1) {
                appState.currentMeasure++;
                callbacks.renderEditor();
            } else if (dx > 0 && appState.currentMeasure > 0) {
                appState.currentMeasure--;
                callbacks.renderEditor();
            }
        }
    });
}
