// state.js — 共有状態管理

export const STEPS_PER_MEASURE = 16;

export const appState = {
    tracks: [],
    nextId: 0,
    activeTrackId: null,
    numMeasures: 4,
    currentMeasure: 0,
};

export function totalSteps() {
    return STEPS_PER_MEASURE * appState.numMeasures;
}

// 循環依存を回避するためのコールバック登録
// app.js の初期化時に実際の関数が代入される
export const callbacks = {
    renderEditor: null,
    renderSidebar: null,
    closeSidebar: null,
};
