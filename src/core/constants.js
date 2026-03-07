// constants.js — アプリ全体で使う定数

// 音価 → 占有セル数のマッピング
export const DURATION_CELLS = {
    '16t': 2,  // 半拍三連
    '16n': 3,
    '8t':  4,  // 1拍三連
    '8n':  6,  '8d':  9,
    '4n':  12, '4d':  18,
    '2n':  24, '2d':  36,
    '1n':  48,
};

// ツールバー用ラベル（左から長い → 短い）
export const DURATION_LIST = [
    { value: '8t',  label: '1拍3連' },
    { value: '16t', label: '半拍3連' },
    { value: '1n',  label: '全' },
    { value: '2n',  label: '2分' },
    { value: '4n',  label: '4分' },
    { value: '8n',  label: '8分' },
    { value: '16n', label: '16分' },
];

// クロマチック音名（C〜B）
export const CHROMATIC  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const BLACK_KEYS = new Set(['C#','D#','F#','G#','A#']);

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

// コード機能: ルート音とコードタイプ
export const CHORD_ROOTS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const SCALE_TYPES = [
    { value: 'major', label: 'メジャー' },
    { value: 'harmonic_minor', label: 'ハーモニックマイナー' },
    { value: 'melodic_minor', label: 'メロディックマイナー' },
];

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
    'M':    [0, 4, 7],
    'm':    [0, 3, 7],
    'M7':   [0, 4, 7, 11],
    'm7':   [0, 3, 7, 10],
    '7':    [0, 4, 7, 10],
    'dim':  [0, 3, 6],
    'sus4': [0, 5, 7],
    'sus2': [0, 2, 7],
    'aug':  [0, 4, 8],
};

// コードの構成音を返す（例: getChordNotes('C', 'M', 4) → ['C4','E4','G4']）
export function getChordNotes(root, type, octave) {
    const rootIdx = CHROMATIC.indexOf(root);
    return CHORD_TYPES[type].map(interval => {
        const noteIdx = (rootIdx + interval) % 12;
        const oct = octave + Math.floor((rootIdx + interval) / 12);
        return CHROMATIC[noteIdx] + oct;
    });
}
