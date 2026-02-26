// player.js
// Tone.js はグローバル変数として使用（HTMLでCDN読み込み済み）
import instruments from './instruments.js';

// ==========================================================
// スコアのデータ形式
// ==========================================================
//
// score: 長さ16の配列（インデックス0〜15 が 1小節の16分音符に対応）
//
// 各ステップ:
//   null            → 無音
//   [ イベント, ... ] → 同時に鳴らす音のリスト（最大15個）
//
// イベントの形式:
//   { instrument: '楽器名', notes: '音階' }         // 単音
//   { instrument: '楽器名', notes: ['C4','E4','G4'] } // 和音
//
// 使用例:
//   const score = Array(16).fill(null);
//   score[0]  = [{ instrument: 'drums', notes: 'C1' }];          // キック
//   score[4]  = [{ instrument: 'piano', notes: ['C4','E4','G4'] }]; // コード
//
// ==========================================================

let _sequence = null;

/**
 * 音楽を再生する
 * @param {Array} score  - 16ステップのスコア配列
 * @param {Object} options
 *   @param {number}  options.bpm  - テンポ（デフォルト: 120）
 *   @param {boolean} options.loop - ループ再生（デフォルト: true）
 */
export async function play(score, { bpm = 120, loop = true } = {}) {
    await Tone.start();

    // 前の再生を停止
    stop();

    Tone.Transport.bpm.value = bpm;

    // インデックス(0〜15)を渡し、コールバック内でscoreを参照する
    // ※ Tone.Sequence に配列を直接渡すとサブ分割として解釈されるため
    const indices = score.map((_, i) => i);

    _sequence = new Tone.Sequence((time, i) => {
        const step = score[i];
        if (!step) return;

        step.forEach(({ instrument, notes, duration }) => {
            const inst = instruments[instrument];
            if (!inst || !inst.loaded) return;

            const noteArray = Array.isArray(notes) ? notes : [notes];
            inst.triggerAttackRelease(noteArray, duration || '16n', time);
        });
    }, indices, '16n');

    _sequence.loop = loop;
    _sequence.start(0);
    Tone.Transport.start();
}

/**
 * 再生を停止する
 */
export function stop() {
    Tone.Transport.stop();
    if (_sequence) {
        _sequence.stop();
        _sequence.dispose();
        _sequence = null;
    }
}
