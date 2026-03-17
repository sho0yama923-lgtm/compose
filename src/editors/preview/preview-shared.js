import { appState } from '../../core/state.js';
import {
    TRACK_TONE_LIMITS,
    normalizeTrackEq,
    normalizeTrackTone,
} from '../../features/tracks/instrument-map.js';

export const LONG_PRESS_MS = 420;
export const SVG_NS = 'http://www.w3.org/2000/svg';
export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;
export const EQ_GRAPH_MIN_FREQ = 80;
export const EQ_GRAPH_MAX_FREQ = 9000;
export const EQ_GRAPH_BANDS = [
    { key: 'low', label: 'Low', freqKey: 'lowFreq', color: '#2f6fed' },
    { key: 'mid', label: 'Mid', freqKey: 'midFreq', color: '#059669' },
    { key: 'high', label: 'High', freqKey: 'highFreq', color: '#ef6c00' },
];
export const EQ_GRAPH_DB_TICKS = [-12, -6, 0, 6, 12];
export const EQ_GRAPH_FREQ_TICKS = [100, 200, 500, 1000, 2000, 5000];
export const TONE_CONTROL_CONFIG = [
    { key: 'gainDb', label: 'Gain', unit: 'dB', format: formatSignedValue },
    { key: 'compAmount', label: 'Comp', unit: '%', format: formatIntegerValue },
    { key: 'midQ', label: 'Mid Q', unit: '', format: formatFixedValue },
];

export function bindPreviewScroll(wrapEl) {
    wrapEl.addEventListener('scroll', () => {
        appState.previewScrollTop = wrapEl.scrollTop;
    });
}

function clampPreviewScrollTop(wrapEl) {
    const maxScroll = Math.max(0, wrapEl.scrollHeight - wrapEl.clientHeight);
    return Math.max(0, Math.min(appState.previewScrollTop || 0, maxScroll));
}

export function restorePreviewScroll(wrapEl) {
    if (!wrapEl) return;
    wrapEl.scrollTop = clampPreviewScrollTop(wrapEl);
}

export function normalizeEqValue(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, Math.round(value)));
}

export function ensureTrackEq(track) {
    const normalizedEq = normalizeTrackEq(track.eq, track.instrument);
    track.eq = normalizedEq;
    return normalizedEq;
}

export function ensureTrackTone(track) {
    const normalizedTone = normalizeTrackTone(track.tone);
    track.tone = normalizedTone;
    return normalizedTone;
}

export function formatFrequency(freq) {
    const rounded = Math.round(freq);
    if (rounded >= 1000) {
        const kilo = rounded / 1000;
        return Number.isInteger(kilo) ? `${kilo}k` : `${kilo.toFixed(1)}k`;
    }
    return `${rounded}`;
}

export function formatDbTick(db) {
    if (db > 0) return `+${db}`;
    return `${db}`;
}

export function freqToGraphX(freq, left, graphWidth) {
    const clamped = Math.max(EQ_GRAPH_MIN_FREQ, Math.min(EQ_GRAPH_MAX_FREQ, freq));
    const min = Math.log10(EQ_GRAPH_MIN_FREQ);
    const max = Math.log10(EQ_GRAPH_MAX_FREQ);
    const value = Math.log10(clamped);
    return left + ((value - min) / (max - min)) * graphWidth;
}

export function xToFrequency(x, left, graphWidth) {
    const clampedX = Math.max(left, Math.min(left + graphWidth, x));
    const ratio = (clampedX - left) / graphWidth;
    const min = Math.log10(EQ_GRAPH_MIN_FREQ);
    const max = Math.log10(EQ_GRAPH_MAX_FREQ);
    return Math.pow(10, min + ratio * (max - min));
}

export function dbToGraphY(db, top, graphHeight) {
    const clamped = Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, db));
    const ratio = (EQ_MAX_DB - clamped) / (EQ_MAX_DB - EQ_MIN_DB);
    return top + ratio * graphHeight;
}

export function yToDb(y, top, graphHeight) {
    const clampedY = Math.max(top, Math.min(top + graphHeight, y));
    const ratio = (clampedY - top) / graphHeight;
    return EQ_MAX_DB - ratio * (EQ_MAX_DB - EQ_MIN_DB);
}

export function clampToneFrequencyForBand(freqKey, value) {
    const limits = TRACK_TONE_LIMITS[freqKey];
    if (!limits) return value;
    return Math.max(limits.min, Math.min(limits.max, Math.round(value)));
}

export function formatToneControlValue(control, value) {
    return control.format(value, control.unit);
}

export function formatSignedValue(value, unit) {
    const normalized = typeof value === 'number' ? value : 0;
    const sign = normalized > 0 ? `+${normalized}` : `${normalized}`;
    return unit ? `${sign} ${unit}` : sign;
}

export function formatIntegerValue(value, unit) {
    const normalized = typeof value === 'number' ? Math.round(value) : 0;
    return unit ? `${normalized} ${unit}` : `${normalized}`;
}

export function formatFixedValue(value, unit) {
    const normalized = typeof value === 'number' ? value.toFixed(2) : '0.00';
    return unit ? `${normalized} ${unit}` : normalized;
}
