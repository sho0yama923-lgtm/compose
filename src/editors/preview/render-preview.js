import {
    appState,
    STEPS_PER_BEAT,
    STEPS_PER_MEASURE,
} from '../../core/state.js';
import {
    INST_TYPE,
    getTrackDisplayLabel,
} from '../../features/tracks/instrument-map.js';
import {
    ROOT_COLORS,
} from '../../core/constants.js';
import { selectTrack } from '../../features/tracks/tracks-controller.js';
import { getMeasureStart } from '../../core/rhythm-grid.js';
import { bindPreviewScroll } from './preview-shared.js';
import { buildPreviewActionMenu, attachPreviewCardLongPress, closePreviewActions, buildTrackControls } from './preview-actions.js';
import { buildRepeatSelectionRail, getRepeatCardStateClass, getRepeatGridStateClass, shouldShowRepeatEndRail, shouldShowRepeatStartRail } from './preview-repeat.js';
import { buildTrackToneSheet } from './preview-tone-sheet.js';
import { buildSongSettingsCard } from './preview-song-settings.js';
import { buildMelodyPreviewSummaryRows, buildPreviewRow } from './preview-row.js';

export function renderPreview(containerEl) {
    const measureIndex = appState.currentMeasure;
    const offset = getMeasureStart(measureIndex);
    const mEnd = offset + STEPS_PER_MEASURE;
    const cells = Array.from({ length: STEPS_PER_MEASURE }, (_, localStep) => ({
        beat: Math.floor(localStep / STEPS_PER_BEAT),
        localStep,
    }));
    const wrapEl = document.createElement('div');
    wrapEl.className = 'preview-wrap';
    bindPreviewScroll(wrapEl);

    wrapEl.appendChild(buildSongSettingsCard());

    wrapEl.addEventListener('click', (event) => {
        if (!appState.previewActionMenuOpen) return;
        if (event.target.closest('.preview-card-actions')) return;
        closePreviewActions(true);
    });

    appState.tracks.forEach((track) => {
        const card = document.createElement('div');
        card.className = 'preview-card'
            + getRepeatCardStateClass(track.id)
            + (track.muted ? ' is-muted' : '');
        card.dataset.trackId = String(track.id);
        card.dataset.instrument = track.instrument;
        attachPreviewCardLongPress(card, track.id);
        if (shouldShowRepeatStartRail(track.id)) {
            card.appendChild(buildRepeatSelectionRail(track, 'start'));
        }

        const headerEl = document.createElement('div');
        headerEl.className = 'preview-card-header';
        headerEl.addEventListener('click', (event) => {
            if (event.target.closest('.preview-card-actions, .preview-track-controls')) return;
            if (appState.previewActionMenuOpen && appState.previewActionTrackId === track.id) {
                closePreviewActions(true);
                return;
            }
            selectTrack(track.id);
        });

        const titleEl = document.createElement('span');
        titleEl.className = 'preview-card-title';
        titleEl.textContent = getTrackDisplayLabel(track, { showChordPlaybackInstrument: true });
        headerEl.appendChild(titleEl);

        headerEl.appendChild(buildTrackControls(track));
        card.appendChild(headerEl);
        if (appState.previewActionMenuOpen && appState.previewActionTrackId === track.id) {
            card.appendChild(buildPreviewActionMenu(track));
        }
        if (shouldShowRepeatEndRail(track.id)) {
            card.appendChild(buildRepeatSelectionRail(track, 'end'));
        }

        const gridEl = document.createElement('div');
        gridEl.className = 'preview-grid' + getRepeatGridStateClass(track.id);

        const type = INST_TYPE[track.instrument];
        if (type === 'rhythm') {
            (track.rows ?? []).forEach((row) => {
                gridEl.appendChild(buildPreviewRow(cells, offset, row?.steps, 'rhythm'));
            });
        } else if (type === 'chord') {
            const zoneGrid = document.createElement('div');
            zoneGrid.className = 'preview-chord-zone-grid';
            zoneGrid.style.gridTemplateColumns = `repeat(${STEPS_PER_MEASURE}, minmax(0, 1fr))`;

            const chordMap = Array.isArray(track.chordMap) ? track.chordMap : [];
            let inheritedChord = null;
            for (let step = 0; step <= offset; step++) {
                if (chordMap[step]) inheritedChord = chordMap[step];
            }
            for (let beat = 0; beat < 4; beat++) {
                const start = offset + beat * STEPS_PER_BEAT;
                const end = Math.min(start + STEPS_PER_BEAT, mEnd);
                for (let step = Math.max(offset + 1, start - STEPS_PER_BEAT + 1); step <= start; step++) {
                    if (chordMap[step]) inheritedChord = chordMap[step];
                }

                const label = document.createElement('span');
                label.className = 'preview-chord-label';
                const span = Math.max(1, end - start);
                label.style.gridColumn = `span ${span || 1}`;
                if (beat > 0) label.style.borderLeft = '1px solid #999';

                if (inheritedChord) {
                    label.textContent = inheritedChord.root + inheritedChord.type;
                    label.style.background = ROOT_COLORS[inheritedChord.root] || '#666';
                } else {
                    label.textContent = '—';
                    label.style.background = '#999';
                }

                zoneGrid.appendChild(label);
            }
            gridEl.appendChild(zoneGrid);
            gridEl.appendChild(buildPreviewRow(cells, offset, track.soundSteps, 'chord'));
        } else {
            buildMelodyPreviewSummaryRows(cells, offset, track).forEach((rowEl) => {
                gridEl.appendChild(rowEl);
            });
        }

        card.appendChild(gridEl);
        wrapEl.appendChild(card);
    });

    containerEl.appendChild(wrapEl);

    const toneTrack = appState.tracks.find((track) => track.id === appState.previewToneTrackId);
    if (toneTrack) {
        containerEl.appendChild(buildTrackToneSheet(toneTrack));
    }
}
