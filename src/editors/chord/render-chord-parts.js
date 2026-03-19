import { callbacks } from '../../core/state.js';
import { CHORD_OCTAVE_MIN, CHORD_OCTAVE_MAX } from './chord-shared.js';
import { buildProgressSection } from './chord-progress-section.js';

export { buildProgressSection };

export function buildPaletteOctaveControls(track) {
    const octRow = document.createElement('div');
    octRow.className = 'chord-selector-row horizontal chord-oct-row';
    const octCtrl = document.createElement('div');
    octCtrl.className = 'chord-oct-ctrl';

    const octDown = document.createElement('button');
    octDown.className = 'oct-range-btn';
    octDown.type = 'button';
    octDown.setAttribute('aria-label', '上段octを下げる');
    octDown.textContent = '◀';
    octDown.disabled = track.selectedChordOctave <= CHORD_OCTAVE_MIN;
    octDown.addEventListener('click', () => {
        track.selectedChordOctave--;
        callbacks.renderEditor();
    });

    const octVal = document.createElement('span');
    octVal.className = 'oct-range-label';
    octVal.textContent = `oct${track.selectedChordOctave}`;

    const octUp = document.createElement('button');
    octUp.className = 'oct-range-btn';
    octUp.type = 'button';
    octUp.setAttribute('aria-label', '上段octを上げる');
    octUp.textContent = '▶';
    octUp.disabled = track.selectedChordOctave >= CHORD_OCTAVE_MAX;
    octUp.addEventListener('click', () => {
        track.selectedChordOctave++;
        callbacks.renderEditor();
    });

    octCtrl.appendChild(octDown);
    octCtrl.appendChild(octVal);
    octCtrl.appendChild(octUp);
    octRow.appendChild(octCtrl);
    return octRow;
}
