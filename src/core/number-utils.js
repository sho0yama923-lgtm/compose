export function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function normalizeUnitValue(value, fallback = 1) {
    return typeof value === 'number' && Number.isFinite(value)
        ? clampNumber(value, 0, 1)
        : fallback;
}

export function normalizeFiniteNumber(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
