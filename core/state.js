// state.js — 共有状態管理

export const STEPS_PER_BEAT = 12;
export const STEPS_PER_MEASURE = STEPS_PER_BEAT * 4;

export const appState = {
    tracks: [],
    nextId: 0,
    activeTrackId: null,
    numMeasures: 4,
    currentMeasure: 0,
    playheadStep: null,
    isPlaying: false,
    playRangeStartMeasure: null,
    playRangeEndMeasure: null,
    previewMode: false,
    editorGridMode: 'normal',
    // デュレーション
    selectedDuration: '16n',   // ツールバーで選択中の音価
    lastNormalDuration: '16n',
    lastTripletDuration: '8t',
    dottedMode: false,         // 付点トグル
    tripletMode: false,        // 3連符配置モード
    // 3連符: beatConfig[measure] = [4,4,4,4] (拍ごとのサブディビジョン数)
    beatConfig: [],
};

export function totalSteps() {
    return STEPS_PER_MEASURE * appState.numMeasures;
}

export function getNormalizedPlayRangeMeasures() {
    if (appState.playRangeStartMeasure === null || appState.playRangeEndMeasure === null) {
        return null;
    }
    const maxMeasure = Math.max(0, appState.numMeasures - 1);
    const clampedStart = Math.max(0, Math.min(appState.playRangeStartMeasure, maxMeasure));
    const clampedEnd = Math.max(0, Math.min(appState.playRangeEndMeasure, maxMeasure));
    const startMeasure = Math.min(clampedStart, clampedEnd);
    const endMeasure = Math.max(clampedStart, clampedEnd);
    return { startMeasure, endMeasure };
}

export function clampPlayRangeMeasures() {
    const maxMeasure = Math.max(0, appState.numMeasures - 1);
    if (appState.playRangeStartMeasure !== null) {
        appState.playRangeStartMeasure = Math.max(0, Math.min(appState.playRangeStartMeasure, maxMeasure));
    }
    if (appState.playRangeEndMeasure !== null) {
        appState.playRangeEndMeasure = Math.max(0, Math.min(appState.playRangeEndMeasure, maxMeasure));
    }
}

// 循環依存を回避するためのコールバック登録
// app.js の初期化時に実際の関数が代入される
export const callbacks = {
    renderEditor: null,
    renderSidebar: null,
    closeSidebar: null,
};
