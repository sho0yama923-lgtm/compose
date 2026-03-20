const DEFAULT_BPM = 120;
const MIN_BPM = 30;
const MAX_BPM = 300;

function normalizeNumericString(value) {
    return String(value ?? '')
        .trim()
        .replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xFEE0))
        .replace(/[．。]/g, '.');
}

export function normalizeBpmValue(value, fallback = DEFAULT_BPM) {
    const normalized = normalizeNumericString(value);
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(parsed)));
}

export function getCurrentBpm() {
    const inputEl = document.getElementById('bpmInput');
    if (!(inputEl instanceof HTMLInputElement)) return DEFAULT_BPM;
    const bpm = normalizeBpmValue(inputEl.value, DEFAULT_BPM);
    inputEl.value = String(bpm);
    return bpm;
}
