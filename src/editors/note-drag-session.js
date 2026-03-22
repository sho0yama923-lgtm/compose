export function beginNoteDragInteraction({ sourceEl, pointerId }) {
    const releasePointerCapture = capturePointer(sourceEl, pointerId);
    const releaseViewportLock = lockNoteDragViewport();
    return () => {
        releasePointerCapture();
        releaseViewportLock();
    };
}

function capturePointer(sourceEl, pointerId) {
    if (!(sourceEl instanceof Element) || pointerId === null || pointerId === undefined) {
        return () => {};
    }
    if (typeof sourceEl.setPointerCapture === 'function') {
        try {
            sourceEl.setPointerCapture(pointerId);
        } catch {}
    }
    return () => {
        if (typeof sourceEl.releasePointerCapture === 'function') {
            try {
                if (sourceEl.hasPointerCapture?.(pointerId)) {
                    sourceEl.releasePointerCapture(pointerId);
                }
            } catch {}
        }
    };
}

function lockNoteDragViewport() {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const mainEl = document.getElementById('main');
    const trackEditorEl = document.getElementById('trackEditor');
    const scrollSnapshot = {
        windowScrollY: window.scrollY,
        mainScrollTop: mainEl?.scrollTop ?? 0,
        trackEditorScrollTop: trackEditorEl?.scrollTop ?? 0,
    };

    const htmlTouchAction = htmlEl?.style.touchAction ?? '';
    const htmlOverscroll = htmlEl?.style.overscrollBehavior ?? '';
    const bodyTouchAction = bodyEl?.style.touchAction ?? '';
    const bodyOverscroll = bodyEl?.style.overscrollBehavior ?? '';
    const bodyUserSelect = bodyEl?.style.userSelect ?? '';
    const bodyWebkitUserSelect = bodyEl?.style.webkitUserSelect ?? '';
    const bodyWebkitTouchCallout = bodyEl?.style.webkitTouchCallout ?? '';
    const mainOverflowY = mainEl?.style.overflowY ?? '';
    const mainTouchAction = mainEl?.style.touchAction ?? '';
    const trackEditorOverflowY = trackEditorEl?.style.overflowY ?? '';
    const trackEditorTouchAction = trackEditorEl?.style.touchAction ?? '';

    const keepViewport = () => {
        if (window.scrollY !== scrollSnapshot.windowScrollY) {
            window.scrollTo(window.scrollX, scrollSnapshot.windowScrollY);
        }
        if (mainEl) mainEl.scrollTop = scrollSnapshot.mainScrollTop;
        if (trackEditorEl) trackEditorEl.scrollTop = scrollSnapshot.trackEditorScrollTop;
    };

    htmlEl.style.touchAction = 'none';
    htmlEl.style.overscrollBehavior = 'none';
    bodyEl.style.touchAction = 'none';
    bodyEl.style.overscrollBehavior = 'none';
    bodyEl.style.userSelect = 'none';
    bodyEl.style.webkitUserSelect = 'none';
    bodyEl.style.webkitTouchCallout = 'none';
    if (mainEl) {
        mainEl.style.overflowY = 'hidden';
        mainEl.style.touchAction = 'none';
        mainEl.addEventListener('scroll', keepViewport, { passive: true });
    }
    if (trackEditorEl) {
        trackEditorEl.style.overflowY = 'hidden';
        trackEditorEl.style.touchAction = 'none';
        trackEditorEl.addEventListener('scroll', keepViewport, { passive: true });
    }

    keepViewport();

    return () => {
        if (mainEl) {
            mainEl.removeEventListener('scroll', keepViewport);
            mainEl.style.overflowY = mainOverflowY;
            mainEl.style.touchAction = mainTouchAction;
            mainEl.scrollTop = scrollSnapshot.mainScrollTop;
        }
        if (trackEditorEl) {
            trackEditorEl.removeEventListener('scroll', keepViewport);
            trackEditorEl.style.overflowY = trackEditorOverflowY;
            trackEditorEl.style.touchAction = trackEditorTouchAction;
            trackEditorEl.scrollTop = scrollSnapshot.trackEditorScrollTop;
        }
        htmlEl.style.touchAction = htmlTouchAction;
        htmlEl.style.overscrollBehavior = htmlOverscroll;
        bodyEl.style.touchAction = bodyTouchAction;
        bodyEl.style.overscrollBehavior = bodyOverscroll;
        bodyEl.style.userSelect = bodyUserSelect;
        bodyEl.style.webkitUserSelect = bodyWebkitUserSelect;
        bodyEl.style.webkitTouchCallout = bodyWebkitTouchCallout;
        if (window.scrollY !== scrollSnapshot.windowScrollY) {
            window.scrollTo(window.scrollX, scrollSnapshot.windowScrollY);
        }
    };
}
