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
            "F#1": "hihat.mp3",
            "G1": "tom1.mp3"
        }
    },
    // ■ ベース (フォルダを作ったらここを有効にするだけ！)

    {
        id: "bass",
        type: "chromatic",
        folder: "sounds/bass/",
        range: [1, 4]
    },

    // ■ エレキギター

    {
        id: "ele_guitar",
        type: "chromatic",
        folder: "sounds/ele_guitar/",
        range: [2, 5]
    },
    // ■ アコースティックギター (同様に追加可能)

    {
        id: "aco_guitar",
        type: "chromatic",
        folder: "sounds/aco_guitar/",
        range: [2, 4]
    },

        // ■ ヴァイオリン

    {
        id: "violin",
        type: "chromatic",
        folder: "sounds/violin/",
        range: [3, 6]
    },

        // ■ トランペット

    {
        id: "trumpet",
        type: "chromatic",
        folder: "sounds/trumpet/",
        range: [3, 6]
    },
    
];

// ドラムの変数定義（作曲時に使いやすくするため）
export const DRUM_MAP = {
    KICK: "C1",
    SNARE: "D1",
    HIHAT: "F#1",
    TOM: "G1"
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