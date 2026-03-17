import { totalSteps, callbacks, STEPS_PER_MEASURE } from '../../core/state.js';
import { DURATION_CELLS, ROOT_COLORS } from '../../core/constants.js';
import { toggleStep, isStepHead, isStepTie } from '../../core/duration.js';
import { getCurrentDuration } from '../duration-toolbar.js';
import { createPlayheadBar } from './chord-shared.js';

export function buildTimingSection(track, offset, mEnd, cells, majorGroup) {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'chord-section chord-timing-section';

    const titleEl = document.createElement('div');
    titleEl.className = 'chord-section-title';
    titleEl.textContent = '鳴らすタイミング';
    sectionEl.appendChild(titleEl);

    const descEl = document.createElement('div');
    descEl.className = 'chord-section-desc';
    descEl.textContent = 'タイミング: そのコードをどこで鳴らすか';
    sectionEl.appendChild(descEl);

    const soundCells = document.createElement('div');
    soundCells.className = 'chord-steps-cells chord-timing-grid';
    soundCells.dataset.measureStart = String(offset);
    soundCells.style.setProperty('--timeline-columns', String(cells.length));
    soundCells.style.setProperty('--timeline-major', String(majorGroup));
    soundCells.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('timeline-note')) return;
        const rect = soundCells.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width - 1, event.clientX - rect.left));
        const column = Math.floor((x / rect.width) * cells.length);
        const cellInfo = cells[Math.max(0, Math.min(cells.length - 1, column))];
        toggleStep(track.soundSteps, offset + cellInfo.localStep, getCurrentDuration(), mEnd);
        callbacks.renderEditor();
    });

    const inheritedChords = Array(totalSteps()).fill(null);
    let inherited = null;
    for (let i = 0; i < inheritedChords.length; i++) {
        if (track.chordMap[i]) inherited = track.chordMap[i];
        inheritedChords[i] = inherited;
    }

    for (let localStep = 0; localStep < STEPS_PER_MEASURE; localStep++) {
        const si = offset + localStep;
        const val = track.soundSteps[si];
        if (isStepTie(val) || !isStepHead(val)) continue;
        const btn = document.createElement('div');
        btn.className = 'timeline-note chord-note';
        btn.style.left = `${(localStep / STEPS_PER_MEASURE) * 100}%`;
        btn.style.width = `${((DURATION_CELLS[val] || 1) / STEPS_PER_MEASURE) * 100}%`;
        if (inheritedChords[si]) {
            const color = ROOT_COLORS[inheritedChords[si].root] ?? '#111';
            btn.style.background = color;
            btn.style.borderColor = color;
        }
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleStep(track.soundSteps, si, getCurrentDuration(), mEnd);
            callbacks.renderEditor();
        });
        soundCells.appendChild(btn);
    }

    soundCells.appendChild(createPlayheadBar(offset));
    sectionEl.appendChild(soundCells);
    return sectionEl;
}
