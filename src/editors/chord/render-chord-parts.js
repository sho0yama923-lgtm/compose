import { callbacks } from '../../core/state.js';
import { CHORD_OCTAVE_MIN, CHORD_OCTAVE_MAX, buildLabel } from './chord-shared.js';
import { buildProgressSection } from './chord-progress-section.js';

export { buildProgressSection };

export function buildPaletteOctaveControls(track) {
    const octRow = document.createElement('div');
    octRow.className = 'chord-selector-row horizontal chord-oct-row';
    octRow.appendChild(buildLabel('オクターブ'));
    const octCtrl = document.createElement('div');
    octCtrl.className = 'chord-oct-ctrl';

    const octDown = document.createElement('button');
    octDown.className = 'oct-range-btn';
    octDown.innerHTML = '◀<span class="btn-guide">低</span>';
    octDown.disabled = track.selectedChordOctave <= CHORD_OCTAVE_MIN;
    octDown.addEventListener('click', () => {
        track.selectedChordOctave--;
        callbacks.renderEditor();
    });

    const octVal = document.createElement('span');
    octVal.className = 'oct-range-label';
    octVal.textContent = track.selectedChordOctave;

    const octUp = document.createElement('button');
    octUp.className = 'oct-range-btn';
    octUp.innerHTML = '▶<span class="btn-guide">高</span>';
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
