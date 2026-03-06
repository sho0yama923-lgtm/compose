// state.js — 共有状態管理

export const STEPS_PER_BEAT = 12;
export const STEPS_PER_MEASURE = STEPS_PER_BEAT * 4;

export const appState = {
    tracks: [],
    nextId: 0,
    activeTrackId: null,
    numMeasures: 4,
    currentMeasure: 0,
    previewMode: false,
    editorGridMode: 'normal',
    // デュレーション
    selectedDuration: '16n',   // ツールバーで選択中の音価
    dottedMode: false,         // 付点トグル
    tripletMode: false,        // 3連符配置モード
    // 3連符: beatConfig[measure] = [4,4,4,4] (拍ごとのサブディビジョン数)
    beatConfig: [],
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
