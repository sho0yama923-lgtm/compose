import { appState, STEPS_PER_MEASURE, totalSteps, callbacks } from '../../../core/state.js';
import { CHROMATIC } from '../../../core/constants.js';
import {
    INST_TYPE,
    OCTAVE_DEFAULT_BASE,
    DRUM_ROWS,
    createDefaultTrackEq,
    createDefaultTrackTone,
    getTrackDisplayLabel,
} from '../instrument-map.js';
import { setTopbarTitle } from '../../../ui/topbar.js';

export function selectTrack(id) {
    appState.activeTrackId = id;
    appState.lastTouchedTrackId = id;
    appState.previewMode = false;
    callbacks.renderEditor();
    callbacks.renderSidebar();
    callbacks.closeSidebar();

    const track = appState.tracks.find((item) => item.id === id);
    if (track) setTopbarTitle(getTrackDisplayLabel(track, { showChordPlaybackInstrument: true }));
}

export function deleteTrack(id) {
    appState.tracks = appState.tracks.filter((track) => track.id !== id);
    if (appState.activeTrackId === id) {
        appState.activeTrackId = appState.tracks.length > 0
            ? appState.tracks[appState.tracks.length - 1].id
            : null;
        const title = appState.activeTrackId
            ? getTrackDisplayLabel(
                appState.tracks.find((track) => track.id === appState.activeTrackId),
                { showChordPlaybackInstrument: true }
            )
            : '作曲ツール';
        setTopbarTitle(title);
    }
    if (appState.lastTouchedTrackId === id) {
        appState.lastTouchedTrackId = appState.activeTrackId ?? appState.tracks[appState.tracks.length - 1]?.id ?? null;
    }
    callbacks.renderSidebar();
    callbacks.renderEditor();
}

export function addTrack(instrument) {
    const id = appState.nextId++;
    let track;

    const steps = totalSteps();
    if (INST_TYPE[instrument] === 'rhythm') {
        track = {
            id,
            instrument,
            muted: false,
            volume: 1,
            eq: createDefaultTrackEq(instrument),
            tone: createDefaultTrackTone(),
            rows: DRUM_ROWS.map((row) => ({ label: row.label, note: row.note, steps: Array(steps).fill(null) })),
        };
    } else if (INST_TYPE[instrument] === 'chord') {
        track = {
            id,
            instrument,
            muted: false,
            volume: 1,
            eq: createDefaultTrackEq(instrument),
            tone: createDefaultTrackTone(),
            playbackInstrument: 'piano',
            chordMap: Array(steps).fill(null),
            soundSteps: Array(steps).fill(null),
            selectedChordRoot: 'C',
            selectedChordType: 'M',
            selectedChordOctave: 4,
            dividers: [0, STEPS_PER_MEASURE / 2],
            selectedDivPos: null,
            selectedDrumRows: new Set(),
        };
    } else {
        const stepsMap = {};
        for (let oct = 1; oct <= 7; oct++) {
            CHROMATIC.forEach((note) => {
                stepsMap[`${note}${oct}`] = Array(steps).fill(null);
            });
        }
        const viewBase = OCTAVE_DEFAULT_BASE[instrument] ?? 3;
        track = {
            id,
            instrument,
            muted: false,
            volume: 1,
            eq: createDefaultTrackEq(instrument),
            tone: createDefaultTrackTone(),
            viewBase,
            activeOctave: viewBase + 1,
            stepsMap,
        };
    }

    appState.tracks.push(track);
    selectTrack(id);
}
