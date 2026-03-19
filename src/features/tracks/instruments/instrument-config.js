function buildUrlsFromFiles(files) {
    return Object.fromEntries(
        files.map((fileName) => {
            const toneNote = fileName.replace('.mp3', '').replace(/s/g, '#');
            return [toneNote, fileName];
        })
    );
}

const DRUM_SAMPLE_DEFINITIONS = [
    { sampleId: 'kick', label: 'Kick', note: 'C1' },
    { sampleId: 'snare', label: 'Snare', note: 'D1' },
    { sampleId: 'hihat', label: 'HiHat', note: 'F#1' },
    { sampleId: 'tom1', label: 'Tom1', note: 'G1' },
    { sampleId: 'tom2', label: 'Tom2', note: 'A1' },
    { sampleId: 'tom3', label: 'Tom3', note: 'B1' },
];

const DRUM_SAMPLE_ID_MAP = Object.fromEntries(
    DRUM_SAMPLE_DEFINITIONS.map((sample) => [sample.sampleId, sample])
);
const DRUM_NOTE_TO_SAMPLE_ID = Object.fromEntries(
    DRUM_SAMPLE_DEFINITIONS.map((sample) => [sample.note, sample.sampleId])
);
const DEFAULT_DRUM_SAMPLE_IDS = ['kick', 'snare', 'hihat', 'tom1'];

function createDrumManualMapping() {
    return Object.fromEntries(
        DRUM_SAMPLE_DEFINITIONS.map((sample) => [sample.note, `${sample.sampleId}.mp3`])
    );
}

function createDrumSampleInstrument(id, folder, kitLabel) {
    return {
        id,
        label: kitLabel,
        instType: 'rhythm',
        octaveBase: null,
        sampleType: 'manual',
        folder,
        mapping: createDrumManualMapping(),
    };
}

export const DRUM_SAMPLE_INSTRUMENTS = [
    createDrumSampleInstrument('drums_default', 'sounds/drums/', 'DEFAULT'),
    createDrumSampleInstrument('drums_hiphop1', 'sounds/beat1/', 'HIPHOP1'),
    createDrumSampleInstrument('drums_hiphop2', 'sounds/beat2/', 'HIPHOP2'),
    createDrumSampleInstrument('drums_hiphop3', 'sounds/beat3/', 'HIPHOP3'),
];

const DRUM_SAMPLE_INSTRUMENT_LABELS = Object.fromEntries(
    DRUM_SAMPLE_INSTRUMENTS.map((kit) => [kit.id, kit.label])
);

function buildDrumRowCandidate(sampleInstrumentId, sampleId) {
    const sample = DRUM_SAMPLE_ID_MAP[sampleId];
    const kitLabel = DRUM_SAMPLE_INSTRUMENT_LABELS[sampleInstrumentId] || 'DEFAULT';
    const isDefaultKit = sampleInstrumentId === 'drums_default';
    return {
        id: `${sampleInstrumentId}:${sampleId}`,
        sampleInstrumentId,
        sampleId,
        note: sample.note,
        label: isDefaultKit ? sample.label : `${sample.label} (${kitLabel})`,
        groupLabel: kitLabel,
    };
}

export const DRUM_ROWS = DEFAULT_DRUM_SAMPLE_IDS.map((sampleId) =>
    buildDrumRowCandidate('drums_default', sampleId)
);

export const DRUM_ROW_CANDIDATES = [
    buildDrumRowCandidate('drums_default', 'tom2'),
    buildDrumRowCandidate('drums_default', 'tom3'),
    ...['drums_hiphop1', 'drums_hiphop2', 'drums_hiphop3'].flatMap((sampleInstrumentId) =>
        DRUM_SAMPLE_DEFINITIONS.map((sample) => buildDrumRowCandidate(sampleInstrumentId, sample.sampleId))
    ),
];

export const INSTRUMENT_LIST = [
    {
        id: 'drums',
        label: '🥁 Drums',
        instType: 'rhythm',
        octaveBase: null,
    },
    {
        id: 'chord',
        label: '🎼 コード',
        instType: 'chord',
        octaveBase: null,
        sampleType: null,
    },
    {
        id: 'piano',
        label: '🎹 Piano',
        instType: 'melody',
        octaveBase: 3,
        sampleType: 'range',
        folder: 'sounds/piano/',
        files: [
            'A1.mp3', 'A2.mp3', 'A3.mp3', 'A4.mp3', 'A5.mp3', 'A6.mp3', 'A7.mp3',
            'As1.mp3', 'As2.mp3', 'As3.mp3', 'As4.mp3', 'As5.mp3', 'As6.mp3', 'As7.mp3',
            'B1.mp3', 'B2.mp3', 'B3.mp3', 'B4.mp3', 'B5.mp3', 'B6.mp3', 'B7.mp3',
            'C1.mp3', 'C2.mp3', 'C3.mp3', 'C4.mp3', 'C5.mp3', 'C6.mp3', 'C7.mp3', 'C8.mp3',
            'Cs1.mp3', 'Cs2.mp3', 'Cs3.mp3', 'Cs4.mp3', 'Cs5.mp3', 'Cs6.mp3', 'Cs7.mp3',
            'D1.mp3', 'D2.mp3', 'D3.mp3', 'D4.mp3', 'D5.mp3', 'D6.mp3', 'D7.mp3',
            'Ds1.mp3', 'Ds2.mp3', 'Ds3.mp3', 'Ds4.mp3', 'Ds5.mp3', 'Ds6.mp3', 'Ds7.mp3',
            'E1.mp3', 'E2.mp3', 'E3.mp3', 'E4.mp3', 'E5.mp3', 'E6.mp3', 'E7.mp3',
            'F1.mp3', 'F2.mp3', 'F3.mp3', 'F4.mp3', 'F5.mp3', 'F6.mp3', 'F7.mp3',
            'Fs1.mp3', 'Fs2.mp3', 'Fs3.mp3', 'Fs4.mp3', 'Fs5.mp3', 'Fs6.mp3', 'Fs7.mp3',
            'G1.mp3', 'G2.mp3', 'G3.mp3', 'G4.mp3', 'G5.mp3', 'G6.mp3', 'G7.mp3',
            'Gs1.mp3', 'Gs2.mp3', 'Gs3.mp3', 'Gs4.mp3', 'Gs5.mp3', 'Gs6.mp3', 'Gs7.mp3',
        ],
    },
    {
        id: 'bass',
        label: '🎸 Bass',
        instType: 'melody',
        octaveBase: 1,
        sampleType: 'range',
        folder: 'sounds/bass/',
        files: [
            'As1.mp3', 'As2.mp3', 'As3.mp3', 'As4.mp3',
            'Cs1.mp3', 'Cs2.mp3', 'Cs3.mp3', 'Cs4.mp3', 'Cs5.mp3',
            'E1.mp3', 'E2.mp3', 'E3.mp3', 'E4.mp3',
            'G1.mp3', 'G2.mp3', 'G3.mp3', 'G4.mp3',
        ],
    },
    {
        id: 'aco_guitar',
        label: '🎵 Acoustic Guitar',
        instType: 'melody',
        octaveBase: 2,
        sampleType: 'range',
        folder: 'sounds/aco_guitar/',
        files: [
            'A2.mp3', 'A3.mp3', 'A4.mp3', 'As2.mp3', 'As3.mp3', 'As4.mp3',
            'B2.mp3', 'B3.mp3', 'B4.mp3',
            'C3.mp3', 'C4.mp3', 'C5.mp3', 'Cs3.mp3', 'Cs4.mp3', 'Cs5.mp3',
            'D2.mp3', 'D3.mp3', 'D4.mp3', 'D5.mp3', 'Ds2.mp3', 'Ds3.mp3', 'Ds4.mp3',
            'E2.mp3', 'E3.mp3', 'E4.mp3',
            'F2.mp3', 'F3.mp3', 'F4.mp3', 'Fs2.mp3', 'Fs3.mp3', 'Fs4.mp3',
            'G2.mp3', 'G3.mp3', 'G4.mp3', 'Gs2.mp3', 'Gs3.mp3', 'Gs4.mp3',
        ],
    },
    {
        id: 'ele_guitar',
        label: '⚡️ Electric Guitar',
        instType: 'melody',
        octaveBase: 2,
        sampleType: 'range',
        folder: 'sounds/ele_guitar/',
        files: [
            'A2.mp3', 'A3.mp3', 'A4.mp3', 'A5.mp3',
            'C3.mp3', 'C4.mp3', 'C5.mp3', 'C6.mp3', 'Cs2.mp3',
            'Ds3.mp3', 'Ds4.mp3', 'Ds5.mp3',
            'E2.mp3',
            'Fs2.mp3', 'Fs3.mp3', 'Fs4.mp3', 'Fs5.mp3',
        ],
    },
    {
        id: 'violin',
        label: '🎻 Violin',
        instType: 'melody',
        octaveBase: 3,
        sampleType: 'range',
        folder: 'sounds/violin/',
        files: [
            'A3.mp3', 'A4.mp3', 'A5.mp3', 'A6.mp3',
            'C4.mp3', 'C5.mp3', 'C6.mp3', 'C7.mp3',
            'E4.mp3', 'E5.mp3', 'E6.mp3',
            'G3.mp3', 'G4.mp3', 'G5.mp3', 'G6.mp3',
        ],
    },
    {
        id: 'trumpet',
        label: '🎺 Trumpet',
        instType: 'melody',
        octaveBase: 3,
        sampleType: 'range',
        folder: 'sounds/trumpet/',
        files: [
            'A3.mp3', 'A5.mp3', 'As4.mp3', 'C4.mp3', 'C6.mp3',
            'D5.mp3', 'Ds4.mp3',
            'F3.mp3', 'F4.mp3', 'F5.mp3',
            'G4.mp3',
        ],
    },
];

export const INST_LABEL = Object.fromEntries(INSTRUMENT_LIST.map((config) => [config.id, config.label]));
export const INST_TYPE = Object.fromEntries(INSTRUMENT_LIST.map((config) => [config.id, config.instType]));
export const MELODY_INSTRUMENT_LIST = INSTRUMENT_LIST.filter((config) => config.instType === 'melody');
export const OCTAVE_DEFAULT_BASE = Object.fromEntries(
    INSTRUMENT_LIST.filter((config) => config.octaveBase !== null).map((config) => [config.id, config.octaveBase])
);
export const INSTRUMENT_CONFIG_MAP = Object.fromEntries(
    [...INSTRUMENT_LIST, ...DRUM_SAMPLE_INSTRUMENTS].map((config) => [config.id, config])
);

export function getInstrumentBaseUrl(config) {
    const folder = config?.folder || '';
    if (!folder) return '';
    return folder.startsWith('/') ? folder : `/${folder}`;
}

export function getInstrumentBufferBaseUrl(config) {
    const folder = config?.folder || '';
    if (!folder) return '';
    return `/audio-buffers/${folder}`;
}

export function getInstrumentUrls(config) {
    if (config?.sampleType === 'range') {
        return buildUrlsFromFiles(config.files || []);
    }
    if (config?.sampleType === 'manual') {
        return config.mapping || {};
    }
    return {};
}

export function getInstrumentBufferUrls(config) {
    return Object.fromEntries(
        Object.entries(getInstrumentUrls(config)).map(([note, fileName]) => [note, `${fileName}.bin`])
    );
}

export function getDrumSampleIdFromNote(note) {
    return DRUM_NOTE_TO_SAMPLE_ID[note] || null;
}

export function getDrumSampleDefinition(sampleId) {
    return DRUM_SAMPLE_ID_MAP[sampleId] || null;
}

export function createDrumRow(sampleInstrumentId, sampleId, { steps = [], label = null } = {}) {
    const candidate = buildDrumRowCandidate(sampleInstrumentId, sampleId);
    return {
        label: label || candidate.label,
        note: candidate.note,
        steps: Array.isArray(steps) ? [...steps] : [],
        sampleInstrumentId: candidate.sampleInstrumentId,
        sampleId: candidate.sampleId,
    };
}
