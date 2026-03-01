// instruments.js

// ==========================================================
// 1. ヘルパー関数
// ==========================================================

// "As4.mp3" → "A#4" に変換（ファイル名 → Tone.js の音名キー）
function fileNameToNote(filename) {
    const m = filename.match(/^([A-G])(s?)(\d)\.mp3$/);
    if (!m) return null;
    return m[1] + (m[2] ? '#' : '') + m[3];
}

// Python http.server のディレクトリ一覧 HTML から .mp3 ファイルの音名リストを取得
async function fetchFolderNotes(folder) {
    try {
        const html = await (await fetch(folder)).text();
        return [...html.matchAll(/href="([A-Za-z0-9]+\.mp3)"/g)]
            .map(m => fileNameToNote(m[1])).filter(Boolean);
    } catch {
        return [];
    }
}

// 音階ファイル名を自動生成するヘルパー（フルクロマチック楽器用）
function generateChromaticFiles(startOctave, endOctave) {
    const notes = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
    const fileMap = {};
    for (let oct = startOctave; oct <= endOctave; oct++) {
        notes.forEach(note => {
            const fileName = `${note}${oct}.mp3`;
            const toneNote = `${note.replace("s", "#")}${oct}`;
            fileMap[toneNote] = fileName;
        });
    }
    return fileMap;
}


// ==========================================================
// 2. 設定データ（ここを編集するだけで楽器が増減します）
// ==========================================================
//
// sampleType の種類:
//   "chromatic" : 全クロマチック音源あり。range:[開始oct, 終了oct] を指定
//   "auto"      : フォルダ内の .mp3 を自動検出（Python http.server 専用）
//   "manual"    : ドラム等、音名→ファイル名を手動マッピング
//   null        : 音源なし（chord はピアノを流用）
//
// ==========================================================

const INSTRUMENT_LIST = [
    {
        id: "drums",
        label: "🥁 Drums",    instType: "rhythm",  octaveBase: null,
        sampleType: "manual",  folder: "sounds/drums/",
        mapping: { "C1": "kick.mp3", "D1": "snare.mp3", "F#1": "hihat.mp3", "G1": "tom1.mp3" }
    },
    {
        id: "chord",
        label: "🎼 コード",   instType: "chord",   octaveBase: null,
        sampleType: null  // piano の sampler を流用。sampler は作らない
    },
    {
        id: "piano",
        label: "🎹 Piano",    instType: "melody",  octaveBase: 3,
        sampleType: "chromatic", folder: "sounds/piano/", range: [1, 7]
    },
    {
        id: "bass",
        label: "🎸 Bass",     instType: "melody",  octaveBase: 1,
        sampleType: "auto",   folder: "sounds/bass/"
    },
    {
        id: "aco_guitar",
        label: "🎵 Acoustic Guitar", instType: "melody", octaveBase: 2,
        sampleType: "auto",   folder: "sounds/aco_guitar/"
    },
    {
        id: "ele_guitar",
        label: "⚡️ Electric Guitar", instType: "melody", octaveBase: 2,
        sampleType: "auto",   folder: "sounds/ele_guitar/"
    },
    {
        id: "violin",
        label: "🎻 Violin",   instType: "melody",  octaveBase: 3,
        sampleType: "auto",   folder: "sounds/violin/"
    },
    {
        id: "trumpet",
        label: "🎺 Trumpet",  instType: "melody",  octaveBase: 3,
        sampleType: "auto",   folder: "sounds/trumpet/"
    },
];

// ==========================================================
// 3. 初期化（"auto" 楽器のファイル一覧を事前取得）
// ==========================================================

// top-level await: モジュール読み込み時に自動実行
for (const config of INSTRUMENT_LIST) {
    if (config.sampleType === 'auto') {
        config._notes = await fetchFolderNotes(config.folder);
    }
}


// ==========================================================
// 4. Sampler 生成（自動生成ロジック）
// ==========================================================

const instruments = {};

INSTRUMENT_LIST.forEach(config => {
    if (!config.sampleType) return; // "chord" などは sampler 不要

    let urls = {};
    if (config.sampleType === "chromatic") {
        urls = generateChromaticFiles(config.range[0], config.range[1]);
    } else if (config.sampleType === "manual") {
        urls = config.mapping;
    } else if (config.sampleType === "auto") {
        // _notes: ["A3","A#4",...] → { "A3": "A3.mp3", "A#4": "As4.mp3" }
        (config._notes || []).forEach(note => {
            urls[note] = note.replace('#', 's') + '.mp3';
        });
    }

    instruments[config.id] = new Tone.Sampler({
        urls,
        baseUrl: config.folder,
    }).toDestination();
});

export default instruments;


// ==========================================================
// 5. computed export（constants.js の代わりにここから参照）
// ==========================================================

export const INST_LABEL = Object.fromEntries(INSTRUMENT_LIST.map(c => [c.id, c.label]));
export const INST_TYPE  = Object.fromEntries(INSTRUMENT_LIST.map(c => [c.id, c.instType]));
export const OCTAVE_DEFAULT_BASE = Object.fromEntries(
    INSTRUMENT_LIST.filter(c => c.octaveBase !== null).map(c => [c.id, c.octaveBase])
);

// ドラムの変数定義（後方互換性のため残す）
export const DRUM_MAP = {
    KICK: "C1",
    SNARE: "D1",
    HIHAT: "F#1",
    TOM: "G1"
};
