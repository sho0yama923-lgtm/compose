import { appState } from '../../core/state.js';
import { INST_TYPE } from '../../features/tracks/instrument-map.js';
import { buildDrumReferenceSheet } from './chord-drum-reference-sheet.js';
import { buildChordDetailSheet } from './chord-detail-sheet.js';
export function buildDetailAndSheets(track, editorEl, offset, mEnd, cells) {
    const drumTracks = appState.tracks.filter((item) => INST_TYPE[item.instrument] === 'rhythm');
    if (appState.chordDrumSheetOpen && drumTracks.length > 0) {
        editorEl.appendChild(buildDrumReferenceSheet(track, drumTracks, offset, mEnd, cells));
    }
    const detailSheet = buildChordDetailSheet(track);
    if (detailSheet) editorEl.appendChild(detailSheet);
}
