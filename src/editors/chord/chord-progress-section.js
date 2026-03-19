import { appState, callbacks, STEPS_PER_BEAT } from '../../core/state.js';
import { ROOT_COLORS, normalizeChordCustomNotes } from '../../core/constants.js';
import { closeChordDetail } from './chord-detail-sheet.js';

export function buildProgressSection(track, offset, mEnd, options = {}) {
    const { embedded = false } = options;
    const sectionEl = document.createElement('section');
    sectionEl.className = embedded
        ? 'chord-sequencer-progress'
        : 'chord-section chord-progress-section';

    const headEl = document.createElement('div');
    headEl.className = embedded ? 'chord-sequencer-head' : 'chord-progress-head';

    if (!embedded) {
        const titleEl = document.createElement('div');
        titleEl.className = 'chord-section-title';
        titleEl.textContent = 'コード進行';
        sectionEl.appendChild(titleEl);

        const descEl = document.createElement('div');
        descEl.className = 'chord-section-desc';
        descEl.textContent = '進行: どの拍でコードを変えるか';
        headEl.appendChild(descEl);
    }

    if (!embedded) {
        const clearBtn = document.createElement('button');
        clearBtn.className = 'chord-quick-btn danger';
        clearBtn.textContent = '全クリア';
        clearBtn.addEventListener('click', () => {
            for (let i = offset; i < mEnd; i++) track.chordMap[i] = null;
            if (appState.chordDetailTrackId === track.id
                && appState.chordDetailStep !== null
                && appState.chordDetailStep >= offset
                && appState.chordDetailStep < mEnd) {
                closeChordDetail(false);
            }
            callbacks.renderEditor();
        });
        headEl.appendChild(clearBtn);
    }
    sectionEl.appendChild(headEl);

    const gridEl = document.createElement('div');
    gridEl.className = embedded
        ? 'chord-progress-grid chord-progress-grid-embedded'
        : 'chord-progress-grid';

    for (let beat = 0; beat < 4; beat++) {
        const beatStart = offset + beat * STEPS_PER_BEAT;
        const beatEnd = beatStart + STEPS_PER_BEAT;
        const beatChord = track.chordMap[beatStart];
        const customNotes = normalizeChordCustomNotes(beatChord?.customNotes);
        const beatCell = document.createElement('button');
        beatCell.className = 'chord-progress-cell'
            + (beatChord ? ' on' : '')
            + (customNotes ? ' is-customized' : '')
            + (appState.chordDetailTrackId === track.id && appState.chordDetailStep === beatStart ? ' detail-open' : '');
        beatCell.type = 'button';
        beatCell.dataset.beat = String(beat + 1);
        beatCell.dataset.step = String(beatStart);

        if (beatChord) {
            const color = ROOT_COLORS[beatChord.root] ?? '#111';
            beatCell.style.setProperty('--chord-accent', color);
        }

        const beatNo = document.createElement('span');
        beatNo.className = 'chord-progress-beat';
        beatNo.textContent = `${beat + 1}拍`;
        beatCell.appendChild(beatNo);

        const beatName = document.createElement('span');
        beatName.className = 'chord-progress-name';
        beatName.textContent = beatChord
            ? `${beatChord.root}${beatChord.type}`
            : 'タップで設定';
        beatCell.appendChild(beatName);

        if (customNotes) {
            const badgeEl = document.createElement('span');
            badgeEl.className = 'chord-progress-badge';
            badgeEl.textContent = '編集';
            beatCell.appendChild(badgeEl);
        }

        attachChordProgressLongPress(beatCell, track, beatStart, Boolean(beatChord));
        beatCell.addEventListener('click', () => {
            const selected = {
                root: track.selectedChordRoot,
                type: track.selectedChordType,
                octave: track.selectedChordOctave,
                customNotes: null,
            };
            const sameChord = beatChord
                && !customNotes
                && beatChord.root === selected.root
                && beatChord.type === selected.type
                && beatChord.octave === selected.octave;

            for (let i = beatStart; i < beatEnd; i++) {
                track.chordMap[i] = sameChord ? null : { ...selected };
            }
            if (sameChord && appState.chordDetailTrackId === track.id && appState.chordDetailStep === beatStart) {
                closeChordDetail(false);
            }
            callbacks.renderEditor();
        });

        gridEl.appendChild(beatCell);
    }

    sectionEl.appendChild(gridEl);
    return sectionEl;
}

function attachChordProgressLongPress(cellEl, track, beatStart, hasChord) {
    let timerId = null;
    let startX = 0;
    let startY = 0;
    let suppressClick = false;

    const clearTimer = () => {
        if (timerId !== null) {
            clearTimeout(timerId);
            timerId = null;
        }
    };

    cellEl.addEventListener('pointerdown', (event) => {
        if (!hasChord) return;
        startX = event.clientX;
        startY = event.clientY;
        suppressClick = false;
        clearTimer();
        timerId = window.setTimeout(() => {
            appState.chordDetailTrackId = track.id;
            appState.chordDetailStep = beatStart;
            suppressClick = true;
            callbacks.renderEditor();
        }, 420);
    });

    cellEl.addEventListener('pointermove', (event) => {
        if (timerId === null) return;
        if (Math.abs(event.clientX - startX) > 8 || Math.abs(event.clientY - startY) > 8) {
            clearTimer();
        }
    });

    cellEl.addEventListener('pointerup', clearTimer);
    cellEl.addEventListener('pointercancel', clearTimer);
    cellEl.addEventListener('pointerleave', clearTimer);
    cellEl.addEventListener('click', (event) => {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
    }, true);
}
