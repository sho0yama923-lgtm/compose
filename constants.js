// constants.js — アプリ全体で使う定数

export const DRUM_ROWS = [
    { label: 'Kick',  note: 'C1'  },
    { label: 'Snare', note: 'D1'  },
    { label: 'HiHat', note: 'F#1' },
    { label: 'Tom', note: 'G1' },
];

// クロマチック音名（C〜B）
export const CHROMATIC  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const BLACK_KEYS = new Set(['C#','D#','F#','G#','A#']);

// 楽器ごとのデフォルト表示オクターブ開始値（3オクターブ分を表示: base, base+1, base+2）
// ユーザーが◀▶で変更可能。全音符は oct 1〜7 で保存される
export const OCTAVE_DEFAULT_BASE = {
    piano:      3,   // デフォルト: 3〜5
    bass:       1,   // デフォルト: 1〜3
    aco_guitar: 2,   // デフォルト: 2〜4
    ele_guitar: 2,
    violin: 3,
    trumpet: 3
};

// オクターブごとの色（低=青系、中=緑、高=黄〜橙）
export const OCT_COLOR = {
    1: { on: '#5c6bc0', border: '#9fa8da', label: 'Oct 1' },
    2: { on: '#1976d2', border: '#64b5f6', label: 'Oct 2' },
    3: { on: '#0288d1', border: '#4fc3f7', label: 'Oct 3' },
    4: { on: '#2e7d32', border: '#81c784', label: 'Oct 4' },
    5: { on: '#c8a600', border: '#ffe082', label: 'Oct 5' },
    6: { on: '#ef6c00', border: '#ffb74d', label: 'Oct 6' },
    7: { on: '#c62828', border: '#ef9a9a', label: 'Oct 7' },
};

export const INST_LABEL = {
    drums:     '🥁 Drums',
    chord:     '🎼 コード',
    piano:     '🎹 Piano',
    bass:      '🎸 Bass',
    aco_guitar:'🎵 Acoustic Guitar',
    ele_guitar:'⚡️ Electric Guitar',
    violin:'🎻 Violin',
    trumpet:'🎺 Trumpet' 
};

// 楽器の型: 'rhythm'（行×ステップ）か 'melody'（クロマチック×オクターブ）か 'chord'（コード進行）
// 新楽器を追加する際はここに1行追加するだけでUIが自動決定される
export const INST_TYPE = {
    drums:     'rhythm',
    chord:     'chord',
    piano:     'melody',
    bass:      'melody',
    aco_guitar:'melody',
    ele_guitar:'melody',
    violin:'melody',
    trumpet:'melody'
};

// コード機能: ルート音とコードタイプ
export const CHORD_ROOTS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// ルート音ごとの固有色（コード範囲ステップボタンのON時背景色）
export const ROOT_COLORS = {
    'C':  '#c62828',  // 赤
    'C#': '#ad1457',  // ピンク
    'D':  '#6a1b9a',  // 紫
    'D#': '#4527a0',  // 深紫
    'E':  '#283593',  // インディゴ
    'F':  '#1565c0',  // 青
    'F#': '#006064',  // シアン
    'G':  '#00695c',  // ティール
    'G#': '#2e7d32',  // 緑
    'A':  '#558b2f',  // オリーブ
    'A#': '#e65100',  // オレンジ
    'B':  '#bf360c',  // 深オレンジ
};

// コードタイプ: 半音インターバル配列
export const CHORD_TYPES = {
    'maj':  [0, 4, 7],
    'min':  [0, 3, 7],
    '7':    [0, 4, 7, 10],
    'maj7': [0, 4, 7, 11],
    'min7': [0, 3, 7, 10],
    'sus4': [0, 5, 7],
    'sus2': [0, 2, 7],
    'dim':  [0, 3, 6],
    'aug':  [0, 4, 8],
};
