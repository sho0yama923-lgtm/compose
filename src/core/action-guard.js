let currentAction = null;
let actionSequence = 0;

const DEFAULT_MIN_LOCK_MS = 350;
const TRANSIENT_LOCK_MS = 250;

function getActionControl(target) {
    if (!(target instanceof Element)) return null;
    return target.closest('button, [role="button"], input[type="button"], input[type="submit"]');
}

function shouldIgnoreControl(control) {
    return Boolean(control?.closest('[data-action-guard-ignore="true"]'));
}

function canUseControlWhileBusy(control) {
    return Boolean(control?.closest('[data-action-guard-allow-while-busy="true"]'));
}

export function isActionGuardBusy() {
    return currentAction !== null;
}

function setDocumentBusyState(busy) {
    document.documentElement.toggleAttribute('data-action-busy', busy);
    document.documentElement.setAttribute('aria-busy', String(busy));
}

function releaseAction(sequence) {
    if (!currentAction || currentAction.sequence !== sequence) return;
    currentAction = null;
    setDocumentBusyState(false);
}

function beginActionLock() {
    const sequence = ++actionSequence;
    currentAction = { sequence };
    setDocumentBusyState(true);
    return sequence;
}

function scheduleTransientActionLock() {
    queueMicrotask(() => {
        if (isActionGuardBusy()) return;
        const sequence = beginActionLock();
        window.setTimeout(() => releaseAction(sequence), TRANSIENT_LOCK_MS);
    });
}

export async function runExclusiveAction(action, {
    minLockMs = DEFAULT_MIN_LOCK_MS,
} = {}) {
    if (isActionGuardBusy()) return undefined;

    const sequence = beginActionLock();
    const startedAt = performance.now();

    try {
        return await action();
    } finally {
        const elapsed = performance.now() - startedAt;
        const waitMs = Math.max(0, minLockMs - elapsed);
        if (waitMs > 0) {
            window.setTimeout(() => releaseAction(sequence), waitMs);
        } else {
            releaseAction(sequence);
        }
    }
}

export function initActionGuard() {
    document.addEventListener('click', (event) => {
        const control = getActionControl(event.target);
        if (!control || shouldIgnoreControl(control) || canUseControlWhileBusy(control)) return;
        if (!isActionGuardBusy()) {
            scheduleTransientActionLock();
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);
}
