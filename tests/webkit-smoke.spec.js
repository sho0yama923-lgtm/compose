const { test, expect } = require('@playwright/test');

async function getSelectOptionValues(page, selector) {
  return page.locator(selector).evaluate((element) =>
    Array.from(element.options).map((option) => option.value)
  );
}

async function getSelectedOptionText(page, selector) {
  return page.locator(selector).evaluate((element) =>
    element.selectedOptions[0]?.textContent?.trim() ?? ''
  );
}

test('webkit mobile smoke check', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();

  await expect(page.locator('#trackList li')).toHaveCount(3);
  await expect(page.locator('#trackModeBtn')).toContainText('Piano');
  await expect(page.locator('#viewToggleBtn')).toContainText('全体');
  await expect(page.locator('#emptyStateText')).toContainText('メニューを開いて');
  await page.getByRole('button', { name: 'はじめる' }).click();

  await expect(page.locator('.preview-song-root-select')).toHaveValue('C');
  await expect(page.locator('.preview-song-family-select')).toHaveValue('diatonic');
  await expect(await getSelectOptionValues(page, '.preview-song-family-select')).toEqual([
    'diatonic',
    'pentatonic',
    'blues',
    'mixolydian',
  ]);
  await expect(await getSelectedOptionText(page, '.preview-song-family-select')).toBe('メジャー');
  await page.locator('.preview-harmony-btn[data-harmony="major"]').click();
  await page.selectOption('.preview-song-family-select', 'pentatonic');
  await page.locator('#trackModeBtn').click();
  await expect(page.locator('.melody-grid-row[data-note-name="E"]').first()).toHaveClass(/is-scale-tone/);
  await expect(page.locator('.melody-grid-row[data-note-name="F"]').first()).toHaveClass(/is-non-scale-tone/);
  await page.locator('#viewToggleBtn').click();

  await page.locator('.preview-harmony-btn[data-harmony="minor"]').click();
  await expect(await getSelectOptionValues(page, '.preview-song-family-select')).toEqual([
    'diatonic',
    'harmonic',
    'melodic',
    'pentatonic',
    'blues',
    'dorian',
  ]);
  await page.locator('#trackModeBtn').click();
  await expect(page.locator('.melody-grid-row[data-note-name="D#"]').first()).toHaveClass(/is-scale-tone/);
  await expect(page.locator('.melody-grid-row[data-note-name="E"]').first()).toHaveClass(/is-non-scale-tone/);
  await page.locator('#viewToggleBtn').click();

  await page.selectOption('.preview-song-family-select', 'harmonic');
  await expect(await getSelectedOptionText(page, '.preview-song-family-select')).toBe('ハーモニック');
  await page.locator('.preview-harmony-btn[data-harmony="major"]').click();
  await expect(page.locator('.preview-song-family-select')).toHaveValue('diatonic');
  await expect(await getSelectedOptionText(page, '.preview-song-family-select')).toBe('メジャー');
  await page.selectOption('.preview-song-family-select', 'mixolydian');
  await expect(page.locator('.preview-harmony-btn.selected')).toContainText('M');
  await page.locator('#trackModeBtn').click();
  await expect(page.locator('.melody-grid-row[data-note-name="A#"]').first()).toHaveClass(/is-scale-tone/);
  await expect(page.locator('.melody-grid-row[data-note-name="B"]').first()).toHaveClass(/is-non-scale-tone/);
  await page.locator('#viewToggleBtn').click();

  await page.selectOption('.preview-song-family-select', 'pentatonic');
  await page.locator('.preview-harmony-btn[data-harmony="minor"]').click();
  await expect(page.locator('.preview-harmony-btn.selected')).toContainText('m');

  await page.evaluate(() => {
    document.querySelectorAll('#trackList li')[1]?.click();
  });
  await page.locator('#trackModeBtn').click();
  await expect(page.locator('.chord-progress-cell')).toHaveCount(4);

  await page.locator('.chord-progress-cell').nth(0).click();
  await page.locator('.chord-select-input').nth(0).selectOption('G');
  await page.locator('.chord-select-input').nth(1).selectOption('7');
  await page.locator('.chord-progress-cell').nth(1).click();
  await page.locator('.chord-select-input').nth(0).selectOption('A');
  await page.locator('.chord-select-input').nth(1).selectOption('m');
  await page.locator('.chord-progress-cell').nth(2).click();

  await page.locator('#viewToggleBtn').click();
  await page.evaluate(() => {
    document.querySelectorAll('#trackList li')[2]?.click();
  });
  await page.locator('#trackModeBtn').click();
  await expect(page.locator('.melody-chord-header-cell[data-beat="1"] .melody-chord-header-name').first()).toHaveText('CM');
  await expect(page.locator('.melody-chord-header-cell[data-beat="2"] .melody-chord-header-name').first()).toHaveText('G7');
  await expect(page.locator('.melody-chord-header-cell[data-beat="3"] .melody-chord-header-name').first()).toHaveText('Am');
  const chordGuideColors = await page.locator('.melody-grid-row[data-note-name="G"]').first().evaluate((row) => {
    const beat1 = row.querySelector('.melody-chord-tone-segment[data-beat="1"]');
    const beat2 = row.querySelector('.melody-chord-tone-segment[data-beat="2"]');
    return {
      beat1: beat1 ? getComputedStyle(beat1).backgroundColor : '',
      beat2: beat2 ? getComputedStyle(beat2).backgroundColor : '',
    };
  });
  await expect(chordGuideColors.beat1).not.toBe('');
  await expect(chordGuideColors.beat2).not.toBe('');
  await expect(chordGuideColors.beat1).not.toBe(chordGuideColors.beat2);
  await page.locator('#viewToggleBtn').click();

  const pianoCard = page.locator('.preview-card[data-instrument="piano"]');
  await expect(pianoCard).toBeVisible();
  await expect(pianoCard.getByRole('button', { name: '音作り' })).toBeVisible();
  await expect(pianoCard.locator('.preview-track-eq-summary')).toHaveCount(0);
  await expect(pianoCard.locator('.preview-track-eq-slider')).toHaveCount(0);

  await pianoCard.getByRole('button', { name: '音作り' }).click();
  await expect(page.locator('.preview-tone-sheet-title')).toContainText('Piano の音作り');
  await expect(page.locator('.preview-tone-graph-svg')).toBeVisible();

  const initialLowSummary = (await page.locator('.preview-tone-band-chip.low .preview-tone-band-chip-value').textContent())?.trim() || '';
  const initialMidSummary = (await page.locator('.preview-tone-band-chip.mid .preview-tone-band-chip-value').textContent())?.trim() || '';
  const initialHighSummary = (await page.locator('.preview-tone-band-chip.high .preview-tone-band-chip-value').textContent())?.trim() || '';

  await page.evaluate(() => {
    const hit = document.querySelector('.preview-tone-handle-hit[data-eq-band="low"]');
    const rect = hit.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const pointerId = 11;
    hit.dispatchEvent(new PointerEvent('pointerdown', { pointerId, bubbles: true, clientX: startX, clientY: startY, pointerType: 'touch', isPrimary: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId, bubbles: true, clientX: startX + 54, clientY: startY, pointerType: 'touch', isPrimary: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId, bubbles: true, clientX: startX + 54, clientY: startY, pointerType: 'touch', isPrimary: true }));
  });

  await page.evaluate(() => {
    const hit = document.querySelector('.preview-tone-handle-hit[data-eq-band="mid"]');
    const rect = hit.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const pointerId = 12;
    hit.dispatchEvent(new PointerEvent('pointerdown', { pointerId, bubbles: true, clientX: startX, clientY: startY, pointerType: 'touch', isPrimary: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId, bubbles: true, clientX: startX, clientY: startY - 34, pointerType: 'touch', isPrimary: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId, bubbles: true, clientX: startX, clientY: startY - 34, pointerType: 'touch', isPrimary: true }));
  });

  await expect(page.locator('.preview-tone-band-chip.low .preview-tone-band-chip-value')).not.toHaveText(initialLowSummary);
  await expect(page.locator('.preview-tone-band-chip.mid .preview-tone-band-chip-value')).not.toHaveText(initialMidSummary);

  const gainSlider = page.locator('.preview-tone-control-slider[data-tone-key="gainDb"]');
  await gainSlider.evaluate((element, value) => {
    element.value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, 6);

  await expect(page.locator('.preview-tone-control-value[data-tone-key="gainDb"]')).toContainText('+6 dB');
  const compSlider = page.locator('.preview-tone-control-slider[data-tone-key="compAmount"]');
  await compSlider.evaluate((element, value) => {
    element.value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, 72);

  await expect(page.locator('.preview-tone-control-value[data-tone-key="compAmount"]')).toContainText('72 %');
  const midQSlider = page.locator('.preview-tone-control-slider[data-tone-key="midQ"]');
  await midQSlider.evaluate((element, value) => {
    element.value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, 1.4);

  await expect(page.locator('.preview-tone-control-value[data-tone-key="midQ"]')).toContainText('1.40');
  await page.getByRole('button', { name: '閉じる' }).click();

  await page.locator('#playToggleBtn').click();
  await expect(page.locator('#playToggleBtn')).toContainText('||');
  await page.locator('#playToggleBtn').click();
  await expect(page.locator('#playToggleBtn')).toContainText('▶');

  await page.reload();

  const restartBtn = page.getByRole('button', { name: 'はじめる' });
  if (await restartBtn.isVisible().catch(() => false)) {
    await restartBtn.click();
  }

  const reloadedPianoCard = page.locator('.preview-card[data-instrument="piano"]');
  await expect(reloadedPianoCard.locator('.preview-track-eq-summary')).toHaveCount(0);
  await expect(page.locator('.preview-song-root-select')).toHaveValue('C');
  await expect(page.locator('.preview-song-family-select')).toHaveValue('pentatonic');
  await expect(page.locator('.preview-harmony-btn.selected')).toContainText('m');
  await reloadedPianoCard.getByRole('button', { name: '音作り' }).click();
  await expect(page.locator('.preview-tone-control-value[data-tone-key="gainDb"]')).toContainText('+6 dB');
  await expect(page.locator('.preview-tone-control-value[data-tone-key="compAmount"]')).toContainText('72 %');
  await expect(page.locator('.preview-tone-control-value[data-tone-key="midQ"]')).toContainText('1.40');
  await expect(page.locator('.preview-tone-band-chip.low .preview-tone-band-chip-value')).not.toContainText('180 / +0 dB');
  await expect(page.locator('.preview-tone-band-chip.mid .preview-tone-band-chip-value')).not.toContainText('1.4k / +0 dB');

  await page.getByRole('button', { name: '初期化' }).click();
  await expect(page.locator('.preview-tone-control-value[data-tone-key="gainDb"]')).toContainText('0 dB');
  await expect(page.locator('.preview-tone-control-value[data-tone-key="compAmount"]')).toContainText('40 %');
  await expect(page.locator('.preview-tone-control-value[data-tone-key="midQ"]')).toContainText('0.85');
  await expect(page.locator('.preview-tone-band-chip.low .preview-tone-band-chip-value')).toHaveText(initialLowSummary);
  await expect(page.locator('.preview-tone-band-chip.mid .preview-tone-band-chip-value')).toHaveText(initialMidSummary);
  await expect(page.locator('.preview-tone-band-chip.high .preview-tone-band-chip-value')).toHaveText(initialHighSummary);
});

test('legacy songScaleType migrates on load', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const current = JSON.parse(localStorage.getItem('compose_save'));
    current.songKeyRoot = 'C';
    current.songScaleType = 'minor_pentatonic';
    delete current.songRoot;
    delete current.songHarmony;
    delete current.songScaleFamily;
    localStorage.setItem('compose_save', JSON.stringify(current));
  });
  await page.reload();

  const restartBtn = page.getByRole('button', { name: 'はじめる' });
  if (await restartBtn.isVisible().catch(() => false)) {
    await restartBtn.click();
  }

  await expect(page.locator('.preview-song-root-select')).toHaveValue('C');
  await expect(page.locator('.preview-song-family-select')).toHaveValue('pentatonic');
  await expect(page.locator('.preview-harmony-btn.selected')).toContainText('m');
});
