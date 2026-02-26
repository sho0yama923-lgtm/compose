// instruments.js

// ==========================================================
// 1. 設定データ（ここを編集するだけで楽器が増減します）
// ==========================================================

const INSTRUMENT_LIST = [
    // ■ ピアノ (自動でファイル名を生成)
    {
        id: "piano",            // 呼び出す時の名前
        type: "chromatic",      // 音階がある楽器
        folder: "sounds/piano/",// フォルダの場所
        range: [1, 7]           // オクターブの範囲 (1〜7)
    },
    // ■ ドラム (手動でファイルを指定)
    {
        id: "drums",
        type: "manual",         // 特殊な割り当てが必要な楽器
        folder: "sounds/drums/",
        mapping: {
            "C1": "kick.mp3",
            "D1": "snare.mp3",
            "F#1": "hihat.mp3"
        }
    },
    // ■ ベース (フォルダを作ったらここを有効にするだけ！)

    {
        id: "bass",
        type: "manual",
        folder: "sounds/bass/",
        mapping: {
            "A#1": "As1.mp3", "A#2": "As2.mp3", "A#3": "As3.mp3", "A#4": "As4.mp3",
            "C#1": "Cs1.mp3", "C#2": "Cs2.mp3", "C#3": "Cs3.mp3", "C#4": "Cs4.mp3", "C#5": "Cs5.mp3",
            "E1": "E1.mp3",   "E2": "E2.mp3",   "E3": "E3.mp3",   "E4": "E4.mp3",
            "G1": "G1.mp3",   "G2": "G2.mp3",   "G3": "G3.mp3",   "G4": "G4.mp3"
        }
    },

    // ■ アコースティックギター (同様に追加可能)

    {
        id: "aco_guitar",
        type: "manual",
        folder: "sounds/aco_guitar/",
        mapping: {
            "A2": "A2.mp3",   "A3": "A3.mp3",   "A4": "A4.mp3",
            "A#2": "As2.mp3", "A#3": "As3.mp3", "A#4": "As4.mp3",
            "B2": "B2.mp3",   "B3": "B3.mp3",   "B4": "B4.mp3",
            "C3": "C3.mp3",   "C4": "C4.mp3",   "C5": "C5.mp3",
            "C#3": "Cs3.mp3", "C#4": "Cs4.mp3", "C#5": "Cs5.mp3",
            "D2": "D2.mp3",   "D3": "D3.mp3",   "D4": "D4.mp3",   "D5": "D5.mp3",
            "D#2": "Ds2.mp3", "D#3": "Ds3.mp3", "D#4": "Ds4.mp3",
            "E2": "E2.mp3",   "E3": "E3.mp3",   "E4": "E4.mp3",
            "F2": "F2.mp3",   "F3": "F3.mp3",   "F4": "F4.mp3",
            "F#2": "Fs2.mp3", "F#3": "Fs3.mp3", "F#4": "Fs4.mp3",
            "G2": "G2.mp3",   "G3": "G3.mp3",   "G4": "G4.mp3",
            "G#2": "Gs2.mp3", "G#3": "Gs3.mp3", "G#4": "Gs4.mp3"
        }
    }
    
];

// ドラムの変数定義（作曲時に使いやすくするため）
export const DRUM_MAP = {
    KICK: "C1",
    SNARE: "D1",
    HIHAT: "F#1"
};


// ==========================================================
// 2. 自動生成ロジック（ここは触らなくてOK）
// ==========================================================

// 音階ファイル名を自動生成するヘルパー関数
function generateChromaticFiles(startOctave, endOctave) {
    const notes = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
    const fileMap = {};
    
    for (let oct = startOctave; oct <= endOctave; oct++) {
        notes.forEach(note => {
            // ファイル名: "Cs2.mp3"
            const fileName = `${note}${oct}.mp3`;
            // Tone.js用の音階名: "C#2"
            const toneNote = `${note.replace("s", "#")}${oct}`;
            
            fileMap[toneNote] = fileName;
        });
    }
    return fileMap;
}

// 全楽器を格納するオブジェクト
const instruments = {};

// リストをループして、サンプラーを自動作成
INSTRUMENT_LIST.forEach(config => {
    let urls = {};

    if (config.type === "chromatic") {
        // 音階楽器なら、全ファイル名を自動生成
        urls = generateChromaticFiles(config.range[0], config.range[1]);
    } else if (config.type === "manual") {
        // ドラムなら、指定されたマッピングをそのまま使う
        urls = config.mapping;
    }

    // Tone.jsのサンプラーを作成して、instrumentsオブジェクトに登録
    instruments[config.id] = new Tone.Sampler({
        urls: urls,
        baseUrl: config.folder
    }).toDestination();
});

// 完成した楽器セットをエクスポート
export default instruments;