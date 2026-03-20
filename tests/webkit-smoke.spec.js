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

async function longPressSelector(page, selector, duration = 520) {
  await page.locator(selector).evaluate(async (element, holdMs) => {
    const rect = element.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const pointerId = 91;
    element.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId,
      bubbles: true,
      clientX,
      clientY,
      pointerType: 'touch',
      isPrimary: true,
    }));
    await new Promise((resolve) => window.setTimeout(resolve, holdMs));
    element.dispatchEvent(new PointerEvent('pointerup', {
      pointerId,
      bubbles: true,
      clientX,
      clientY,
      pointerType: 'touch',
      isPrimary: true,
    }));
  }, duration);
}

async function dragTimelineNote(page, selector, deltaX = 70, holdMs = 430) {
  await page.locator(selector).evaluate(async (element, options) => {
    const rect = element.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const pointerId = 73;
    element.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId,
      bubbles: true,
      clientX: startX,
      clientY: startY,
      pointerType: 'touch',
      isPrimary: true,
    }));
    await new Promise((resolve) => window.setTimeout(resolve, options.holdMs));
    window.dispatchEvent(new PointerEvent('pointermove', {
      pointerId,
      bubbles: true,
      clientX: startX + options.deltaX,
      clientY: startY,
      pointerType: 'touch',
      isPrimary: true,
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      pointerId,
      bubbles: true,
      clientX: startX + options.deltaX,
      clientY: startY,
      pointerType: 'touch',
      isPrimary: true,
    }));
  }, { deltaX, holdMs });
}

async function swipeChordDetailKeyboard(page, deltaX = 140) {
  await page.locator('[data-chord-detail-keyboard="true"]').evaluate((element, dragDistance) => {
    element.scrollLeft += dragDistance;
  }, deltaX);
}

async function clickChordDetailKey(page, note) {
  await page.locator(`.chord-detail-key[data-note="${note}"]`).evaluate((element) => {
    element.click();
  });
}

async function storeChordDetailSheetReference(page) {
  await page.evaluate(() => {
    window.__chordDetailSheetRef = document.querySelector('.chord-detail-sheet');
  });
}

async function chordDetailSheetWasReplaced(page) {
  return page.evaluate(() => document.querySelector('.chord-detail-sheet') !== window.__chordDetailSheetRef);
}

async function getChordDetailKeyboardMetrics(page) {
  return page.locator('.chord-detail-piano-stage').evaluate((stage) => {
    const stageRect = stage.getBoundingClientRect();
    const getRelativeBox = (selector) => {
      const element = stage.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left - stageRect.left,
        right: rect.right - stageRect.left,
        top: rect.top - stageRect.top,
        bottom: rect.bottom - stageRect.top,
        width: rect.width,
        height: rect.height,
      };
    };
    const getKeyAndLabelBox = (selector) => {
      const key = stage.querySelector(selector);
      if (!key) return null;
      const keyRect = key.getBoundingClientRect();
      const label = key.querySelector('.chord-detail-key-label');
      const labelRect = label?.getBoundingClientRect();
      return {
        key: {
          top: keyRect.top - stageRect.top,
          bottom: keyRect.bottom - stageRect.top,
          height: keyRect.height,
        },
        label: labelRect ? {
          top: labelRect.top - stageRect.top,
          bottom: labelRect.bottom - stageRect.top,
          height: labelRect.height,
        } : null,
      };
    };
    return {
      blackCount: stage.querySelectorAll('.chord-detail-key.black-key').length,
      whiteCount: stage.querySelectorAll('.chord-detail-key.white-key').length,
      white: {
        C4: getRelativeBox('.chord-detail-key.white-key[data-note="C4"]'),
        D4: getRelativeBox('.chord-detail-key.white-key[data-note="D4"]'),
        E4: getRelativeBox('.chord-detail-key.white-key[data-note="E4"]'),
        F4: getRelativeBox('.chord-detail-key.white-key[data-note="F4"]'),
        G4: getRelativeBox('.chord-detail-key.white-key[data-note="G4"]'),
        A4: getRelativeBox('.chord-detail-key.white-key[data-note="A4"]'),
        B4: getRelativeBox('.chord-detail-key.white-key[data-note="B4"]'),
      },
      black: {
        'C#4': getRelativeBox('.chord-detail-key.black-key[data-note="C#4"]'),
        'D#4': getRelativeBox('.chord-detail-key.black-key[data-note="D#4"]'),
        'F#4': getRelativeBox('.chord-detail-key.black-key[data-note="F#4"]'),
        'G#4': getRelativeBox('.chord-detail-key.black-key[data-note="G#4"]'),
        'A#4': getRelativeBox('.chord-detail-key.black-key[data-note="A#4"]'),
      },
      labels: {
        whiteC4: getKeyAndLabelBox('.chord-detail-key.white-key[data-note="C4"]'),
        blackCs4: getKeyAndLabelBox('.chord-detail-key.black-key[data-note="C#4"]'),
      },
    };
  });
}

test('webkit mobile smoke check', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/
  );
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
  await longPressSelector(page, '.preview-card[data-instrument="drums"]');
  await expect(page.locator('.preview-card[data-instrument="drums"] .preview-card-actions')).toBeVisible();
  await page.locator('.preview-card[data-instrument="drums"] .preview-card-action-btn', { hasText: 'コピー' }).click();
  await expect(page.locator('.preview-range-title')).toHaveText('コピー範囲');
  await page.locator('.preview-card[data-instrument="drums"] .preview-card-action-btn.compact', { hasText: '中止' }).click();

  await page.evaluate(() => {
    document.querySelectorAll('#trackList li')[0]?.click();
  });
  await page.locator('#trackModeBtn').click();
  await expect(page.locator('.drum-add-panel')).toBeVisible();
  await expect(page.locator('.drum-add-panel-trigger')).toHaveText('音源を追加');
  await expect(page.locator('.drum-key')).toHaveCount(4);
  await page.locator('.drum-add-panel-trigger').click();
  await expect(page.locator('.drum-add-sheet')).toBeVisible();
  const drumPanelSummary = await page.evaluate(() => {
    const sheetRect = document.querySelector('.drum-add-sheet')?.getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      sheetTop: sheetRect?.top ?? null,
      sheetBottom: sheetRect?.bottom ?? null,
      sheetRight: sheetRect?.right ?? null,
      groups: Array.from(document.querySelectorAll('.drum-add-sheet .drum-add-group')).map((group) => ({
        title: group.querySelector('.drum-add-group-summary')?.textContent?.trim() ?? '',
        open: group.open,
        itemCount: group.querySelectorAll('.drum-add-row').length,
      })),
      firstGroupActions: Array.from(
        document.querySelectorAll('.drum-add-sheet .drum-add-group:first-of-type .drum-add-row:first-of-type button')
      ).map((button) => button.textContent?.trim() ?? ''),
    };
  });
  expect(drumPanelSummary.sheetTop).toBeGreaterThanOrEqual(0);
  expect(drumPanelSummary.sheetBottom).toBeLessThanOrEqual(drumPanelSummary.viewportHeight + 1);
  expect(drumPanelSummary.sheetRight).toBeLessThanOrEqual(drumPanelSummary.viewportWidth);
  expect(drumPanelSummary.groups).toEqual([
    { title: 'DEFAULT', open: false, itemCount: 2 },
    { title: 'HIPHOP1', open: false, itemCount: 6 },
    { title: 'HIPHOP2', open: false, itemCount: 6 },
    { title: 'HIPHOP3', open: false, itemCount: 6 },
  ]);
  expect(drumPanelSummary.firstGroupActions).toEqual(['▶︎', '→']);
  const drumPanelScrollMetrics = await page.evaluate(() => {
    document.querySelectorAll('.drum-add-sheet .drum-add-group').forEach((group) => {
      group.open = true;
    });
    const body = document.querySelector('.drum-add-sheet-body');
    if (!body) return null;
    const before = {
      clientHeight: body.clientHeight,
      scrollHeight: body.scrollHeight,
      scrollTop: body.scrollTop,
    };
    body.scrollTop = 180;
    const after = {
      scrollTop: body.scrollTop,
    };
    return { before, after };
  });
  expect(drumPanelScrollMetrics).not.toBeNull();
  expect(drumPanelScrollMetrics.before.scrollHeight).toBeGreaterThan(drumPanelScrollMetrics.before.clientHeight);
  expect(drumPanelScrollMetrics.after.scrollTop).toBeGreaterThan(0);
  await page.evaluate(() => {
    const body = document.querySelector('.drum-add-sheet-body');
    if (body) body.scrollTop = 0;
    document.querySelector('.drum-add-sheet .drum-add-group')?.removeAttribute('open');
  });
  await page.locator('.drum-add-sheet .drum-add-group').first().click();
  await expect(page.locator('.drum-add-sheet .drum-add-group').first().locator('.drum-add-row-label')).toHaveText(['Tom2', 'Tom3']);
  await page.locator('.drum-add-sheet .drum-add-group').first().locator('.drum-add-row').first().getByRole('button', { name: '追加' }).click();
  await expect(page.locator('.drum-key')).toHaveCount(5);
  await expect(page.locator('.drum-key').nth(4)).toHaveText('Tom2');
  const closeSheetBtn = page.locator('.drum-add-sheet-close');
  if (await closeSheetBtn.count()) {
    await closeSheetBtn.click();
  }

  await page.locator('.timeline-row[data-row-label="Kick"]').click({ position: { x: 14, y: 10 } });
  await expect(page.locator('.timeline-row[data-row-label="Kick"] .timeline-note')).toHaveCount(1);
  const kickNote = page.locator('.timeline-row[data-row-label="Kick"] .timeline-note').first();
  await kickNote.click();
  await expect(kickNote).toHaveClass(/is-delete-pending/);
  await kickNote.click();
  await expect(page.locator('.timeline-row[data-row-label="Kick"] .timeline-note')).toHaveCount(0);

  await page.locator('.timeline-row[data-row-label="Snare"]').click({ position: { x: 14, y: 10 } });
  const snareNote = page.locator('.timeline-row[data-row-label="Snare"] .timeline-note').first();
  const beforeDragLeft = await snareNote.evaluate((element) => element.style.left);
  await dragTimelineNote(page, '.timeline-row[data-row-label="Snare"] .timeline-note', 70, 430);
  await expect
    .poll(async () =>
      page.locator('.timeline-row[data-row-label="Snare"] .timeline-note').first().evaluate((element) => element.style.left)
    )
    .not.toBe(beforeDragLeft);

  await page.evaluate(() => {
    document.querySelectorAll('#trackList li')[1]?.click();
  });
  await page.locator('#trackModeBtn').click();
  await expect(page.locator('.chord-sequencer-section')).toBeVisible();
  await expect(page.locator('.chord-progress-grid-embedded')).toBeVisible();
  await expect(page.locator('.chord-sequencer-timing .chord-timing-grid')).toBeVisible();
  await expect(page.locator('.chord-progress-cell')).toHaveCount(4);

  await page.locator('.chord-progress-cell').nth(0).click();
  await page.locator('.chord-select-input[aria-label="コードトラックのルート"]').selectOption('G');
  await page.locator('.chord-select-input[aria-label="コードトラックのタイプ"]').selectOption('7');
  await page.locator('.chord-progress-cell').nth(1).click();
  await page.locator('.chord-select-input[aria-label="コードトラックのルート"]').selectOption('A');
  await page.locator('.chord-select-input[aria-label="コードトラックのタイプ"]').selectOption('m');
  await page.locator('.chord-progress-cell').nth(2).click();
  await page.locator('.chord-instrument-select .chord-select-input').selectOption('violin');
  await expect(page.locator('#trackModeBtn')).toContainText('Violin');

  await longPressSelector(page, '.chord-progress-cell[data-beat="1"]');
  await expect(page.locator('.chord-detail-select[aria-label="コードのルート"]')).toHaveValue('C');
  await expect(page.locator('.chord-detail-select[aria-label="コードのタイプ"]')).toHaveValue('M');
  await expect(page.locator('[data-chord-detail-octave="true"]')).toHaveText('oct4');
  await expect(page.locator('[data-chord-detail-keyboard="true"]')).toBeVisible();
  await page.selectOption('.chord-detail-select[aria-label="コードのルート"]', 'D');
  await expect(page.locator('.chord-detail-select[aria-label="コードのルート"]')).toHaveValue('D');
  await page.selectOption('.chord-detail-select[aria-label="コードのタイプ"]', 'm7');
  await expect(page.locator('.chord-detail-select[aria-label="コードのタイプ"]')).toHaveValue('m7');
  await expect(page.locator('.chord-progress-cell[data-beat="1"] .chord-progress-name')).toHaveText('Dm7');
  await storeChordDetailSheetReference(page);
  await clickChordDetailKey(page, 'E4');
  expect(await chordDetailSheetWasReplaced(page)).toBe(false);
  await expect(page.locator('.chord-detail-key[data-note="E4"]')).toHaveClass(/is-active/);
  await expect(page.locator('.chord-detail-note-summary-value')).toContainText('E4');
  await expect(page.locator('.chord-progress-cell[data-beat="1"] .chord-progress-badge')).toContainText('編集');
  const keyboardMetrics = await getChordDetailKeyboardMetrics(page);
  expect(keyboardMetrics.blackCount).toBe(35);
  expect(keyboardMetrics.whiteCount).toBe(49);
  expect(keyboardMetrics.white.C4.height).toBeCloseTo(168, 0);
  expect(keyboardMetrics.black['C#4'].top).toBeCloseTo(keyboardMetrics.white.C4.top, 0);
  expect(keyboardMetrics.black['C#4'].height / keyboardMetrics.white.C4.height).toBeGreaterThan(0.62);
  expect(keyboardMetrics.black['C#4'].height / keyboardMetrics.white.C4.height).toBeLessThan(0.66);
  expect(keyboardMetrics.black['C#4'].left).toBeGreaterThan(keyboardMetrics.white.C4.left);
  expect(keyboardMetrics.black['C#4'].right).toBeLessThan(keyboardMetrics.white.D4.right);
  expect(keyboardMetrics.black['D#4'].left).toBeGreaterThan(keyboardMetrics.white.D4.left);
  expect(keyboardMetrics.black['D#4'].right).toBeLessThan(keyboardMetrics.white.E4.right);
  expect(keyboardMetrics.black['F#4'].left).toBeGreaterThan(keyboardMetrics.white.F4.left);
  expect(keyboardMetrics.black['F#4'].right).toBeLessThan(keyboardMetrics.white.G4.right);
  expect(keyboardMetrics.black['G#4'].left).toBeGreaterThan(keyboardMetrics.white.G4.left);
  expect(keyboardMetrics.black['G#4'].right).toBeLessThan(keyboardMetrics.white.A4.right);
  expect(keyboardMetrics.black['A#4'].left).toBeGreaterThan(keyboardMetrics.white.A4.left);
  expect(keyboardMetrics.black['A#4'].right).toBeLessThan(keyboardMetrics.white.B4.right);
  expect(keyboardMetrics.labels.whiteC4.label.top).toBeGreaterThan(
    keyboardMetrics.labels.whiteC4.key.top + keyboardMetrics.labels.whiteC4.key.height * 0.55
  );
  expect(keyboardMetrics.labels.blackCs4.label.top).toBeGreaterThan(
    keyboardMetrics.labels.blackCs4.key.top + keyboardMetrics.labels.blackCs4.key.height * 0.45
  );
  const initialScrollLeft = await page.locator('[data-chord-detail-keyboard="true"]').evaluate((element) => element.scrollLeft);
  await swipeChordDetailKeyboard(page);
  const movedScrollLeft = await page.locator('[data-chord-detail-keyboard="true"]').evaluate((element) => element.scrollLeft);
  expect(movedScrollLeft).toBeGreaterThan(initialScrollLeft);
  await page.getByRole('button', { name: 'コードのオクターブを上げる' }).click();
  await expect(page.locator('[data-chord-detail-octave="true"]')).toHaveText('oct5');
  await expect(page.locator('.chord-detail-key[data-note="D5"]')).toHaveClass(/is-active/);
  await expect(page.locator('.chord-progress-cell[data-beat="1"] .chord-progress-badge')).toContainText('編集');
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(page.locator('.chord-detail-select[aria-label="コードのルート"]')).toHaveCount(0);

  await page.locator('#viewToggleBtn').click();
  const chordCard = page.locator('.preview-card[data-instrument="chord"]');
  await expect(chordCard.locator('.preview-card-title')).toContainText('Violin');
  await page.evaluate(() => {
    document.querySelectorAll('#trackList li')[2]?.click();
  });
  await page.locator('#trackModeBtn').click();
  await expect(page.locator('.melody-chord-header-cell[data-beat="1"] .melody-chord-header-name').first()).toHaveText('Dm7');
  await expect(page.locator('.melody-chord-header-cell[data-beat="2"] .melody-chord-header-name').first()).toHaveText('G7');
  await expect(page.locator('.melody-chord-header-cell[data-beat="3"] .melody-chord-header-name').first()).toHaveText('Am');
  const chordGuideColors = await page.locator('.melody-grid-row[data-note-name="D"]').first().evaluate((row) => {
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
  await page.getByRole('button', { name: '閉じる', exact: true }).click();

  const playToggleBtn = page.locator('[data-play-toggle="true"]').first();
  await playToggleBtn.click();
  await expect(playToggleBtn).toContainText('||');
  await playToggleBtn.click({ force: true });
  await expect(playToggleBtn).toContainText('▶');

  await page.reload();

  const restartBtn = page.getByRole('button', { name: 'はじめる' });
  if (await restartBtn.isVisible().catch(() => false)) {
    await restartBtn.click();
  }

  const reloadedPianoCard = page.locator('.preview-card[data-instrument="piano"]');
  const reloadedChordCard = page.locator('.preview-card[data-instrument="chord"]');
  await expect(reloadedPianoCard.locator('.preview-track-eq-summary')).toHaveCount(0);
  await expect(reloadedChordCard.locator('.preview-card-title')).toContainText('Violin');
  await expect(page.locator('.preview-song-root-select')).toHaveValue('C');
  await expect(page.locator('.preview-song-family-select')).toHaveValue('pentatonic');
  await expect(page.locator('.preview-harmony-btn.selected')).toContainText('m');
  await reloadedPianoCard.getByRole('button', { name: '音作り' }).click();
  await expect(page.locator('.preview-tone-control-value[data-tone-key="gainDb"]')).toContainText('+6 dB');
  await expect(page.locator('.preview-tone-control-value[data-tone-key="compAmount"]')).toContainText('72 %');
  await expect(page.locator('.preview-tone-control-value[data-tone-key="midQ"]')).toContainText('1.40');
  await expect(page.locator('.preview-tone-band-chip.low .preview-tone-band-chip-value')).not.toContainText('180 / +0 dB');
  await expect(page.locator('.preview-tone-band-chip.mid .preview-tone-band-chip-value')).not.toContainText('1.4k / +0 dB');

  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.evaluate(() => {
    document.querySelectorAll('#trackList li')[1]?.click();
  });
  await expect(page.locator('#trackModeBtn')).toContainText('Violin');
  await longPressSelector(page, '.chord-progress-cell[data-beat="1"]');
  await expect(page.locator('.chord-detail-select[aria-label="コードのルート"]')).toHaveValue('D');
  await expect(page.locator('.chord-detail-select[aria-label="コードのタイプ"]')).toHaveValue('m7');
  await expect(page.locator('[data-chord-detail-octave="true"]')).toHaveText('oct5');
  await expect(page.locator('.chord-detail-key[data-note="E5"]')).toHaveClass(/is-active/);
  await expect(page.locator('.chord-detail-key[data-note="D5"]')).toHaveClass(/is-active/);
  await page.getByRole('button', { name: '閉じる', exact: true }).click();

  await page.locator('#viewToggleBtn').click();
  await reloadedPianoCard.getByRole('button', { name: '音作り' }).click();
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
