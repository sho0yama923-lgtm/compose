// constants.js — アプリ全体で使う定数

export const DRUM_ROWS = [
    { label: 'Kick',  note: 'C1'  },
    { label: 'Snare', note: 'D1'  },
    { label: 'HiHat', note: 'F#1' },
];

// クロマチック音名（C〜B）
export const CHROMATIC  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const BLACK_KEYS = new Set(['C#','D#','F#','G#','A#']);

// 楽器ごとの使用オクターブ範囲
export const OCTAVE_RANGE = {
    piano:     [2, 3, 4, 5, 6],
    bass:      [1, 2, 3, 4],
    aco_guitar:[2, 3, 4, 5],
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
    piano:     '🎹 Piano',
    bass:      '🎸 Bass',
    aco_guitar:'🎵 Acoustic Guitar',
};
