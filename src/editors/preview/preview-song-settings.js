import { appState, callbacks } from '../../core/state.js';
import {
    CHORD_ROOTS,
    HARMONY_TYPES,
    getAvailableScaleFamilies,
    normalizeSongSettings,
} from '../../core/constants.js';

export function buildSongSettingsCard() {
    const scaleFamilyOptions = getAvailableScaleFamilies(appState.songHarmony);
    const cardEl = document.createElement('section');
    cardEl.className = 'preview-song-settings';

    const titleEl = document.createElement('strong');
    titleEl.textContent = 'ルート / スケール';
    cardEl.appendChild(titleEl);

    const keyRow = document.createElement('div');
    keyRow.className = 'preview-song-settings-row';
    keyRow.appendChild(buildSettingsLabel('Root'));

    const keyRootSelect = document.createElement('select');
    keyRootSelect.className = 'preview-song-select preview-song-root-select';
    CHORD_ROOTS.forEach((root) => {
        const option = document.createElement('option');
        option.value = root;
        option.textContent = root;
        option.selected = root === appState.songRoot;
        keyRootSelect.appendChild(option);
    });
    keyRootSelect.addEventListener('change', () => {
        const normalized = normalizeSongSettings(
            keyRootSelect.value,
            appState.songHarmony,
            appState.songScaleFamily
        );
        appState.songRoot = normalized.root;
        appState.songHarmony = normalized.harmony;
        appState.songScaleFamily = normalized.scaleFamily;
        callbacks.renderEditor?.();
    });
    keyRow.appendChild(keyRootSelect);
    cardEl.appendChild(keyRow);

    const scaleRow = document.createElement('div');
    scaleRow.className = 'preview-song-settings-row scale-row';
    scaleRow.appendChild(buildSettingsLabel('Scale'));

    const harmonyControls = document.createElement('div');
    harmonyControls.className = 'preview-harmony-segmented';
    HARMONY_TYPES.forEach(({ value, label }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'preview-harmony-btn' + (appState.songHarmony === value ? ' selected' : '');
        button.dataset.harmony = value;
        button.textContent = label;
        button.addEventListener('click', () => {
            const normalized = normalizeSongSettings(
                appState.songRoot,
                value,
                appState.songScaleFamily
            );
            appState.songRoot = normalized.root;
            appState.songHarmony = normalized.harmony;
            appState.songScaleFamily = normalized.scaleFamily;
            callbacks.renderEditor?.();
        });
        harmonyControls.appendChild(button);
    });

    const scaleSelect = document.createElement('select');
    scaleSelect.className = 'preview-song-select preview-song-family-select';
    scaleSelect.setAttribute('aria-label', 'Scale Family');
    scaleFamilyOptions.forEach(({ value, label }) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.selected = appState.songScaleFamily === value;
        scaleSelect.appendChild(option);
    });
    scaleSelect.addEventListener('change', () => {
        const normalized = normalizeSongSettings(
            appState.songRoot,
            appState.songHarmony,
            scaleSelect.value
        );
        appState.songRoot = normalized.root;
        appState.songHarmony = normalized.harmony;
        appState.songScaleFamily = normalized.scaleFamily;
        callbacks.renderEditor?.();
    });
    scaleRow.appendChild(harmonyControls);
    scaleRow.appendChild(scaleSelect);
    cardEl.appendChild(scaleRow);

    return cardEl;
}

function buildSettingsLabel(text) {
    const labelEl = document.createElement('span');
    labelEl.className = 'preview-song-settings-label';
    labelEl.textContent = text;
    return labelEl;
}
