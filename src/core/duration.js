// ステップグリッド上のノート配置、タイ、削除を扱う。

import { DURATION_CELLS } from './constants.js';

/**
 * 付点モードを反映した実効音価を返す。
 * @param {string} base - 基本音価 ('16n','8n','4n','2n','1n')
 * @param {boolean} dotted - 付点モード
 * @returns {string} 実効音価
 */
export function getEffectiveDuration(base, dotted) {
    if (!dotted) return base;
    // 付点に対応している音価だけ置き換える。
    const map = { '8n': '8d', '4n': '4d', '2n': '2d' };
    return map[base] || base;
}

/**
 * 指定位置にノートを置き、占有範囲を `_tie` で埋める。
 * @param {Array} steps - ステップ配列
 * @param {number} index - 配置開始インデックス
 * @param {string} duration - 音価 ('16n','8n','4d' 等)
 * @param {number} maxIndex - 配列の有効範囲上限（排他）
 * @returns {boolean} 配置成功
 */
export function placeNote(steps, index, duration, maxIndex) {
    const span = DURATION_CELLS[duration] || 1;

    // 編集できる範囲を超えるノートは置かない。
    if (index + span > maxIndex) return false;

    // 新しいノートと重なる既存ノートを先に消す。
    for (let i = index; i < index + span; i++) {
        const val = steps[i];
        if (val && val !== '_tie') {
            // ノート開始セルなら、そのノート全体を消す。
            clearNote(steps, i);
        } else if (val === '_tie') {
            // 継続セルなら、開始セルまで戻ってノート全体を消す。
            clearFromTie(steps, i);
        }
    }

    // 開始セルには音価を置く。
    steps[index] = duration;

    // 継続セルは `_tie` で表す。
    for (let i = 1; i < span; i++) {
        steps[index + i] = '_tie';
    }

    return true;
}

/**
 * ヘッドセルのノートをクリアする
 * @param {Array} steps - ステップ配列
 * @param {number} index - ヘッドセルのインデックス
 */
export function clearNote(steps, index) {
    const val = steps[index];
    if (!val || val === '_tie') return;

    const span = DURATION_CELLS[val] || 1;
    for (let i = 0; i < span && (index + i) < steps.length; i++) {
        steps[index + i] = null;
    }
}

/**
 * タイセルから親ヘッドを探してクリアする
 * @param {Array} steps - ステップ配列
 * @param {number} index - タイセルのインデックス
 */
export function clearFromTie(steps, index) {
    // 継続セルから左へ戻り、開始セルを探す。
    let head = index;
    while (head > 0 && steps[head] === '_tie') {
        head--;
    }
    if (steps[head] && steps[head] !== '_tie') {
        clearNote(steps, head);
    }
}

/**
 * タップ位置の状態に応じて、ノートの追加または削除を行う。
 * @param {Array} steps - ステップ配列
 * @param {number} index - タップ位置
 * @param {string} duration - 配置する音価
 * @param {number} maxIndex - 配列の有効範囲上限（排他）
 * @returns {boolean} トグル後の状態（true=ON, false=OFF）
 */
export function toggleStep(steps, index, duration, maxIndex) {
    const val = steps[index];

    if (val === '_tie') {
        // 継続セルを押した時は、元のノート全体を削除する。
        clearFromTie(steps, index);
        return false;
    } else if (val && val !== '_tie') {
        // 開始セルを押した時は、そのノート全体を削除する。
        clearNote(steps, index);
        return false;
    } else {
        // 空セルなら、現在選択中の音価で配置する。
        return placeNote(steps, index, duration, maxIndex);
    }
}

/**
 * ステップ値が「ON」（ヘッドまたはタイ）かどうか
 */
export function isStepOn(val) {
    return !!val;
}

/**
 * ステップ値が「ヘッド」（ノート開始）かどうか
 */
export function isStepHead(val) {
    return !!val && val !== '_tie';
}

/**
 * ステップ値が「タイ」（継続セル）かどうか
 */
export function isStepTie(val) {
    return val === '_tie';
}

export function noteReachesIndex(steps, headIndex, targetIndex) {
    const val = steps[headIndex];
    if (!isStepHead(val)) return false;
    const span = DURATION_CELLS[val] || 1;
    return targetIndex < headIndex + span;
}
