// player.js
// Tone.js はグローバル変数として使用（HTMLでCDN読み込み済み）
import instruments from '../tracks/instrument-map.js';
import { STEPS_PER_BEAT, STEPS_PER_MEASURE } from '../../core/state.js';

// ==========================================================
// スコアのデータ形式
// ==========================================================
//
// score: 長さ N の配列（インデックスが各ステップに対応）
//
// 各ステップ:
//   null            → 無音
//   [ イベント, ... ] → 同時に鳴らす音のリスト
//
// イベントの形式:
//   { instrument: '楽器名', notes: '音階', duration: '4n' }
//
// ==========================================================

let _part = null;

/**
 * 音楽を再生する
 * @param {Array} score  - ステップのスコア配列
 * @param {Object} options
 *   @param {number}  options.bpm  - テンポ（デフォルト: 120）
 *   @param {boolean} options.loop - ループ再生（デフォルト: true）
 *   @param {Function} options.onStep - 再生位置コールバック
 *   @param {number}  options.numMeasures - 小節数
 *   @param {number}  options.startStep - 再生開始ステップ
 *   @param {number}  options.endStepExclusive - 再生終了ステップ（exclusive）
 */
export async function play(score, {
    bpm = 120,
    loop = true,
    onStep,
    numMeasures = 1,
    startStep = 0,
    endStepExclusive = score.length,
} = {}) {
    if (!globalThis.Tone) {
        alert('Tone.js の読み込みに失敗したため、再生できません。ネットワーク接続を確認して再読み込みしてください。');
        return false;
    }

    await Tone.start();

    // 前の再生を停止
    stop();

    Tone.Transport.bpm.value = bpm;

    const beatDur = Tone.Time('4n').toSeconds();
    const events = [];
    const normalizedStart = Math.max(0, Math.min(startStep, score.length));
    const normalizedEnd = Math.max(normalizedStart + 1, Math.min(endStepExclusive, score.length));

    for (let idx = normalizedStart; idx < normalizedEnd; idx++) {
        const relativeStep = idx - normalizedStart;
        const beat = Math.floor(relativeStep / STEPS_PER_BEAT);
        const micro = relativeStep % STEPS_PER_BEAT;
        const time = beat * beatDur + (micro / STEPS_PER_BEAT) * beatDur;
        events.push([time, idx]);
    }

    _part = new Tone.Part((time, idx) => {
        if (onStep) Tone.Draw.schedule(() => onStep(idx), time);

        const step = score[idx];
        if (!step) return;

        step.forEach(({ instrument, notes, duration, volume }) => {
            const inst = instruments[instrument];
            if (!inst || !inst.loaded) return;

            const noteArray = Array.isArray(notes) ? notes : [notes];
            inst.triggerAttackRelease(noteArray, duration || '16n', time, volume ?? 1);
        });
    }, events);

    _part.loop = loop;
    _part.loopEnd = ((normalizedEnd - normalizedStart) / STEPS_PER_BEAT) * beatDur;
    _part.start(0);

    Tone.Transport.position = 0;
    Tone.Transport.start();
    return true;
}

/**
 * 再生を停止する
 */
export function stop() {
    Tone.Transport.stop();
    if (_part) {
        _part.stop();
        _part.dispose();
        _part = null;
    }
}
