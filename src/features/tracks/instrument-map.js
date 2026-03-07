// instruments.js

// ==========================================================
// 1. ヘルパー関数
// ==========================================================

function buildUrlsFromFiles(files) {
    return Object.fromEntries(
        files.map(fileName => {
            const toneNote = fileName.replace('.mp3', '').replace(/s/g, '#');
            return [toneNote, fileName];
        })
    );
}

// ==========================================================
// 2. 設定データ
// ==========================================================
//
// sampleType の種類:
//   "range"     : files に列挙したファイルを読み込む
//   "manual"    : ドラム等、音名→ファイル名を手動マッピング
//   null        : 音源なし（chord はピアノを流用）
//
// ==========================================================

export const INSTRUMENT_LIST = [
    {
        id: "drums",
        label: "🥁 Drums",    instType: "rhythm",  octaveBase: null,
        sampleType: "manual",  folder: "sounds/drums/",
        mapping: { "C1": "kick.mp3", "D1": "snare.mp3", "F#1": "hihat.mp3", "G1": "tom1.mp3" },
        drumRows: [
            { label: 'Kick',  note: 'C1'  },
            { label: 'Snare', note: 'D1'  },
            { label: 'HiHat', note: 'F#1' },
            { label: 'Tom',   note: 'G1'  },
        ]
    },
    {
        id: "chord",
        label: "🎼 コード",   instType: "chord",   octaveBase: null,
        sampleType: null  // piano の sampler を流用
    },
    {
        id: "piano",
        label: "🎹 Piano",    instType: "melody",  octaveBase: 3,
        sampleType: "range",  folder: "sounds/piano/",
        files: [
            "A1.mp3", "A2.mp3", "A3.mp3", "A4.mp3", "A5.mp3", "A6.mp3", "A7.mp3",
            "As1.mp3", "As2.mp3", "As3.mp3", "As4.mp3", "As5.mp3", "As6.mp3", "As7.mp3",
            "B1.mp3", "B2.mp3", "B3.mp3", "B4.mp3", "B5.mp3", "B6.mp3", "B7.mp3",
            "C1.mp3", "C2.mp3", "C3.mp3", "C4.mp3", "C5.mp3", "C6.mp3", "C7.mp3", "C8.mp3",
            "Cs1.mp3", "Cs2.mp3", "Cs3.mp3", "Cs4.mp3", "Cs5.mp3", "Cs6.mp3", "Cs7.mp3",
            "D1.mp3", "D2.mp3", "D3.mp3", "D4.mp3", "D5.mp3", "D6.mp3", "D7.mp3",
            "Ds1.mp3", "Ds2.mp3", "Ds3.mp3", "Ds4.mp3", "Ds5.mp3", "Ds6.mp3", "Ds7.mp3",
            "E1.mp3", "E2.mp3", "E3.mp3", "E4.mp3", "E5.mp3", "E6.mp3", "E7.mp3",
            "F1.mp3", "F2.mp3", "F3.mp3", "F4.mp3", "F5.mp3", "F6.mp3", "F7.mp3",
            "Fs1.mp3", "Fs2.mp3", "Fs3.mp3", "Fs4.mp3", "Fs5.mp3", "Fs6.mp3", "Fs7.mp3",
            "G1.mp3", "G2.mp3", "G3.mp3", "G4.mp3", "G5.mp3", "G6.mp3", "G7.mp3",
            "Gs1.mp3", "Gs2.mp3", "Gs3.mp3", "Gs4.mp3", "Gs5.mp3", "Gs6.mp3", "Gs7.mp3"
        ]
    },
    {
        id: "bass",
        label: "🎸 Bass",     instType: "melody",  octaveBase: 1,
        sampleType: "range",  folder: "sounds/bass/",
        files: [
            "As1.mp3", "As2.mp3", "As3.mp3", "As4.mp3",
            "Cs1.mp3", "Cs2.mp3", "Cs3.mp3", "Cs4.mp3", "Cs5.mp3",
            "E1.mp3", "E2.mp3", "E3.mp3", "E4.mp3",
            "G1.mp3", "G2.mp3", "G3.mp3", "G4.mp3"
        ]
    },
    {
        id: "aco_guitar",
        label: "🎵 Acoustic Guitar", instType: "melody", octaveBase: 2,
        sampleType: "range",  folder: "sounds/aco_guitar/",
        files: [
            "A2.mp3", "A3.mp3", "A4.mp3", "As2.mp3", "As3.mp3", "As4.mp3",
            "B2.mp3", "B3.mp3", "B4.mp3",
            "C3.mp3", "C4.mp3", "C5.mp3", "Cs3.mp3", "Cs4.mp3", "Cs5.mp3",
            "D2.mp3", "D3.mp3", "D4.mp3", "D5.mp3", "Ds2.mp3", "Ds3.mp3", "Ds4.mp3",
            "E2.mp3", "E3.mp3", "E4.mp3",
            "F2.mp3", "F3.mp3", "F4.mp3", "Fs2.mp3", "Fs3.mp3", "Fs4.mp3",
            "G2.mp3", "G3.mp3", "G4.mp3", "Gs2.mp3", "Gs3.mp3", "Gs4.mp3"
        ]
    },
    {
        id: "ele_guitar",
        label: "⚡️ Electric Guitar", instType: "melody", octaveBase: 2,
        sampleType: "range",  folder: "sounds/ele_guitar/",
        files: [
            "A2.mp3", "A3.mp3", "A4.mp3", "A5.mp3",
            "C3.mp3", "C4.mp3", "C5.mp3", "C6.mp3", "Cs2.mp3",
            "Ds3.mp3", "Ds4.mp3", "Ds5.mp3",
            "E2.mp3",
            "Fs2.mp3", "Fs3.mp3", "Fs4.mp3", "Fs5.mp3"
        ]
    },
    {
        id: "violin",
        label: "🎻 Violin",   instType: "melody",  octaveBase: 3,
        sampleType: "range",  folder: "sounds/violin/",
        files: [
            "A3.mp3", "A4.mp3", "A5.mp3", "A6.mp3",
            "C4.mp3", "C5.mp3", "C6.mp3", "C7.mp3",
            "E4.mp3", "E5.mp3", "E6.mp3",
            "G3.mp3", "G4.mp3", "G5.mp3", "G6.mp3"
        ]
    },
    {
        id: "trumpet",
        label: "🎺 Trumpet",  instType: "melody",  octaveBase: 3,
        sampleType: "range",  folder: "sounds/trumpet/",
        files: [
            "A3.mp3", "A5.mp3", "As4.mp3", "C4.mp3", "C6.mp3",
            "D5.mp3", "Ds4.mp3",
            "F3.mp3", "F4.mp3", "F5.mp3",
            "G4.mp3"
        ]
    }
];

// ==========================================================
// 3. Sampler 生成
// ==========================================================

const instruments = {};
const ToneLib = globalThis.Tone;

INSTRUMENT_LIST.forEach(config => {
    if (!config.sampleType) return; // "chord" などはスキップ

    let urls = {};
    if (config.sampleType === "range") {
        urls = buildUrlsFromFiles(config.files || []);
    } else if (config.sampleType === "manual") {
        urls = config.mapping;
    }

    // 存在するファイルが1つもない場合はエラー落ちを防ぐためにスキップ
    if (Object.keys(urls).length === 0) {
        console.warn(`[Warning] ${config.id} の音源ファイルが見つかりませんでした。スキップします。`);
        return; 
    }

    if (!ToneLib) {
        console.warn('[Warning] Tone.js の読み込み前のため、音源初期化をスキップします。');
        return;
    }

    instruments[config.id] = new ToneLib.Sampler({
        urls,
        baseUrl: config.folder,
    }).toDestination();
});

export default instruments;

// ==========================================================
// 4. computed export
// ==========================================================

export const INST_LABEL = Object.fromEntries(INSTRUMENT_LIST.map(c => [c.id, c.label]));
export const INST_TYPE  = Object.fromEntries(INSTRUMENT_LIST.map(c => [c.id, c.instType]));
export const OCTAVE_DEFAULT_BASE = Object.fromEntries(
    INSTRUMENT_LIST.filter(c => c.octaveBase !== null).map(c => [c.id, c.octaveBase])
);

const drumsConfig = INSTRUMENT_LIST.find(c => c.id === 'drums');
export const DRUM_ROWS = drumsConfig ? drumsConfig.drumRows : [];
