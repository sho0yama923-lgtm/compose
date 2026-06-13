export const TUTORIAL_ACTION_EVENT = 'compose:tutorial-action';

export function emitTutorialAction(action, detail = {}) {
    document.dispatchEvent(new CustomEvent(TUTORIAL_ACTION_EVENT, {
        detail: {
            action,
            ...detail,
        },
    }));
}
