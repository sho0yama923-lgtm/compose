// instruments.js

// ==========================================================
// 1. ヘルパー関数
// ==========================================================

const NOTES = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];

// 指定されたオクターブ範囲のファイルに対し存在確認を行い、存在するファイルだけを抽出
async function getAvailableNotesInRange(folder, startOctave, endOctave) {
    const availableUrls = {};
    const promises = [];

    for (let oct = startOctave; oct <= endOctave; oct++) {
        for (const note of NOTES) {
            const fileName = `${note}${oct}.mp3`;
            const fileUrl = `${folder}${fileName}`;
            const toneNote = `${note.replace("s", "#")}${oct}`;

            // GETではなくHEADメソッドを使うことで、音声データをダウンロードせずに存在確認だけを高速に行う
            const p = fetch(fileUrl, { method: 'HEAD', cache: 'no-store' })
                .then(res => {
                    // ステータスが200番台（ファイルが存在する）場合のみ登録
                    if (res.ok) { 
                        availableUrls[toneNote] = fileName;
                    }
                })
                .catch(() => {
                    // エラー（ファイルがない等）は無視して読み飛ばす
                });
            
            promises.push(p);
        }
    }

    // すべてのファイルの存在確認が完了するのを待つ
    await Promise.all(promises);
    return availableUrls;
}

// ==========================================================
// 2. 設定データ
// ==========================================================
//
// sampleType の種類:
//   "range"     : 指定されたオクターブ範囲(range)のファイルを自動チェックし、存在するものだけ読み込む
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
        sampleType: null  // piano の sampler を流用
    },
    {
        id: "piano",
        label: "🎹 Piano",    instType: "melody",  octaveBase: 3,
        sampleType: "range",  folder: "sounds/piano/", range: [1, 7]
    },
    {
        id: "bass",
        label: "🎸 Bass",     instType: "melody",  octaveBase: 1,
        sampleType: "range",  folder: "sounds/bass/",  range: [1, 4] // 範囲を指定
    },
    {
        id: "aco_guitar",
        label: "🎵 Acoustic Guitar", instType: "melody", octaveBase: 2,
        sampleType: "range",  folder: "sounds/aco_guitar/", range: [2, 5]
    },
    {
        id: "ele_guitar",
        label: "⚡️ Electric Guitar", instType: "melody", octaveBase: 2,
        sampleType: "range",  folder: "sounds/ele_guitar/", range: [2, 5]
    },
    {
        id: "violin",
        label: "🎻 Violin",   instType: "melody",  octaveBase: 3,
        sampleType: "range",  folder: "sounds/violin/", range: [3, 6]
    },
    {
        id: "trumpet",
        label: "🎺 Trumpet",  instType: "melody",  octaveBase: 3,
        sampleType: "range",  folder: "sounds/trumpet/", range: [3, 6]
    }
];

// ==========================================================
// 3. 初期化（"range" 楽器のファイル存在チェックを事前実行）
// ==========================================================

// top-level await: モジュール読み込み時に自動実行
for (const config of INSTRUMENT_LIST) {
    if (config.sampleType === 'range') {
        // 例: range: [1, 4] なら 1〜4オクターブのファイルをチェック
        config._urls = await getAvailableNotesInRange(config.folder, config.range[0], config.range[1]);
    }
}

// ==========================================================
// 4. Sampler 生成
// ==========================================================

const instruments = {};

INSTRUMENT_LIST.forEach(config => {
    if (!config.sampleType) return; // "chord" などはスキップ

    let urls = {};
    if (config.sampleType === "range") {
        urls = config._urls || {};
    } else if (config.sampleType === "manual") {
        urls = config.mapping;
    }

    // 存在するファイルが1つもない場合はエラー落ちを防ぐためにスキップ
    if (Object.keys(urls).length === 0) {
        console.warn(`[Warning] ${config.id} の音源ファイルが見つかりませんでした。スキップします。`);
        return; 
    }

    instruments[config.id] = new Tone.Sampler({
        urls,
        baseUrl: config.folder,
    }).toDestination();
});

export default instruments;

// ==========================================================
// 5. computed export
// ==========================================================

export const INST_LABEL = Object.fromEntries(INSTRUMENT_LIST.map(c => [c.id, c.label]));
export const INST_TYPE  = Object.fromEntries(INSTRUMENT_LIST.map(c => [c.id, c.instType]));
export const OCTAVE_DEFAULT_BASE = Object.fromEntries(
    INSTRUMENT_LIST.filter(c => c.octaveBase !== null).map(c => [c.id, c.octaveBase])
);

export const DRUM_MAP = {
    KICK: "C1",
    SNARE: "D1",
    HIHAT: "F#1",
    TOM: "G1"
};