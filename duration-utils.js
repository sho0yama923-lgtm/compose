// duration-utils.js — ノート配置・削除のユーティリティ

import { DURATION_CELLS } from './constants.js';

/**
 * 付点を適用した実効デュレーションを返す
 * @param {string} base - 基本音価 ('16n','8n','4n','2n','1n')
 * @param {boolean} dotted - 付点モード
 * @returns {string} 実効音価
 */
export function getEffectiveDuration(base, dotted) {
    if (!dotted) return base;
    // 付点可能: 8n→8d, 4n→4d, 2n→2d
    const map = { '8n': '8d', '4n': '4d', '2n': '2d' };
    return map[base] || base;  // 16n, 1n は付点不可 → そのまま
}

/**
 * ノートを配置する
 * @param {Array} steps - ステップ配列
 * @param {number} index - 配置開始インデックス
 * @param {string} duration - 音価 ('16n','8n','4d' 等)
 * @param {number} maxIndex - 配列の有効範囲上限（排他）
 * @returns {boolean} 配置成功
 */
export function placeNote(steps, index, duration, maxIndex) {
    const span = DURATION_CELLS[duration] || 1;

    // 範囲チェック: ノートが maxIndex を超える場合は配置不可
    if (index + span > maxIndex) return false;

    // 範囲内の既存ノートをクリア
    for (let i = index; i < index + span; i++) {
        const val = steps[i];
        if (val && val !== '_tie') {
            // ヘッドセル → そのノート全体をクリア
            clearNote(steps, i);
        } else if (val === '_tie') {
            // タイセル → 親ヘッドを探してクリア
            clearFromTie(steps, i);
        }
    }

    // ヘッドセルを設定
    steps[index] = duration;

    // 後続セルにタイを設定
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
    // 逆方向にヘッドを探索
    let head = index;
    while (head > 0 && steps[head] === '_tie') {
        head--;
    }
    if (steps[head] && steps[head] !== '_tie') {
        clearNote(steps, head);
    }
}

/**
 * ステップをトグルする（タップ時の統合ロジック）
 * @param {Array} steps - ステップ配列
 * @param {number} index - タップ位置
 * @param {string} duration - 配置する音価
 * @param {number} maxIndex - 配列の有効範囲上限（排他）
 * @returns {boolean} トグル後の状態（true=ON, false=OFF）
 */
export function toggleStep(steps, index, duration, maxIndex) {
    const val = steps[index];

    if (val === '_tie') {
        // タイセル → 親ノートを削除
        clearFromTie(steps, index);
        return false;
    } else if (val && val !== '_tie') {
        // ヘッドセル → このノートを削除
        clearNote(steps, index);
        return false;
    } else {
        // 空セル → ノートを配置
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
