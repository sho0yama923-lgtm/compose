export function setTopbarTitle(text) {
    const el = document.getElementById('trackModeBtn');
    if (el) el.textContent = text;
}

export function syncViewToggleButton(previewMode) {
    const trackBtn = document.getElementById('trackModeBtn');
    const viewBtn = document.getElementById('viewToggleBtn');
    if (!trackBtn || !viewBtn) return;
    trackBtn.classList.toggle('is-active', !previewMode);
    viewBtn.classList.toggle('is-active', previewMode);
    trackBtn.setAttribute('aria-pressed', String(!previewMode));
    viewBtn.setAttribute('aria-pressed', String(previewMode));
    trackBtn.setAttribute('aria-label', previewMode ? 'トラック編集へ戻る' : '現在のトラックを表示中');
    viewBtn.setAttribute('aria-label', previewMode ? '全体トラックビューを表示中' : '全体トラックビューへ切替');
}
