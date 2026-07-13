const { test, expect } = require('@playwright/test');
const { version: APP_VERSION } = require('../package.json');

async function waitForProjectHomeReady(page) {
  // The project home is initially hidden, but becomes visible before the boot
  // overlay finishes its transition. Waiting for the overlay to leave layout
  // ensures the asynchronous storage initialization and home render completed.
  await expect(page.locator('#bootOverlay')).toHaveCSS('display', 'none');
  await expect(page.locator('#projectHome')).toBeVisible();
}

function getTrackTab(page, label) {
  return page.locator('#topbarTabs .topbar-tab-btn[data-track-id]', { hasText: label });
}

async function selectTrackTab(page, label) {
  const tab = getTrackTab(page, label);
  await tab.click();
  await expect(tab).toHaveAttribute('aria-pressed', 'true');
}

async function dismissOnboardingIfPresent(page) {
  const skipButton = page.locator('[data-onboarding-skip="true"]');
  if (await skipButton.isVisible().catch(() => false)) {
    await expect.poll(() => page.locator('html').evaluate((html) => (
      html.hasAttribute('data-action-busy')
    ))).toBe(false);
    await skipButton.click();
  }
}

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

async function createNewProject(page, name) {
  await page.locator('[data-project-new="true"]').last().click();
  await page.locator('[data-project-create-name="true"]').fill(name);
  await page.locator('[data-project-create-submit="true"]').click();
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
  const sampleResponse = await page.request.get('/audio-buffers/sounds/piano/A1.mp3.bin');
  expect(sampleResponse.ok()).toBe(true);
  expect(sampleResponse.headers()['content-type']).toContain('application/octet-stream');
  expect((await sampleResponse.body()).subarray(0, 3).toString()).toBe('ID3');

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-app-version', APP_VERSION);
  await expect(page.locator('html')).toHaveAttribute('data-app-runtime', 'web');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/
  );
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();

  await waitForProjectHomeReady(page);
  await createNewProject(page, 'Smoke Project');
  await expect(page.locator('[data-onboarding-skip="true"]')).toBeVisible({ timeout: 10_000 });
  await dismissOnboardingIfPresent(page);
  await expect(page.locator('#trackList li')).toHaveCount(3);
  await expect(getTrackTab(page, 'Piano')).toBeVisible();
  await expect(page.locator('#viewToggleBtn')).toContainText('全体');
  await expect(page.locator('#emptyStateText')).toContainText('メニューを開いて');
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
  await selectTrackTab(page, 'Piano');
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
  await selectTrackTab(page, 'Piano');
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
  await selectTrackTab(page, 'Piano');
  await expect(page.locator('.melody-grid-row[data-note-name="A#"]').first()).toHaveClass(/is-scale-tone/);
  await expect(page.locator('.melody-grid-row[data-note-name="B"]').first()).toHaveClass(/is-non-scale-tone/);
  await page.locator('#viewToggleBtn').click();

  await page.selectOption('.preview-song-family-select', 'pentatonic');
  await page.locator('.preview-harmony-btn[data-harmony="minor"]').click();
  await expect(page.locator('.preview-harmony-btn.selected')).toContainText('m');
  await page.locator('.preview-card[data-instrument="drums"] .preview-track-tone-btn').click();
  await expect(page.locator('.preview-card[data-instrument="drums"] .preview-card-actions')).toBeVisible();
  await page.locator('.preview-card[data-instrument="drums"] .preview-card-action-btn', { hasText: 'コピー' }).click();
  await expect(page.locator('.preview-range-current')).toHaveText('コピー範囲: 1小節');
  await page.locator('.preview-card[data-instrument="drums"] .preview-card-action-btn.compact', { hasText: '中止' }).click();

  await page.evaluate(() => {
    document.querySelectorAll('#trackList li')[0]?.click();
  });
  await expect(getTrackTab(page, 'Drums')).toHaveAttribute('aria-pressed', 'true');
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
  await expect(getTrackTab(page, 'コード')).toHaveAttribute('aria-pressed', 'true');
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
  await expect(getTrackTab(page, 'コード')).toHaveAttribute('aria-pressed', 'true');

  await longPressSelector(page, '.chord-progress-cell[data-beat="1"]');
  await expect(page.locator('.chord-detail-select[aria-label="コードのルート"]')).toHaveValue('C');
  await expect(page.locator('.chord-detail-select[aria-label="コードのタイプ"]')).toHaveValue('M');
  await expect(page.locator('[data-chord-detail-octave="true"]')).toHaveText('oct3');
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
  await expect(page.locator('[data-chord-detail-octave="true"]')).toHaveText('oct4');
  await expect(page.locator('.chord-detail-key[data-note="D4"]')).toHaveClass(/is-active/);
  await expect(page.locator('.chord-progress-cell[data-beat="1"] .chord-progress-badge')).toContainText('編集');
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(page.locator('.chord-detail-select[aria-label="コードのルート"]')).toHaveCount(0);

  await page.locator('#viewToggleBtn').click();
  const chordCard = page.locator('.preview-card[data-instrument="chord"]');
  await expect(chordCard.locator('.preview-card-title')).toContainText('Violin');
  await page.evaluate(() => {
    document.querySelectorAll('#trackList li')[2]?.click();
  });
  await expect(getTrackTab(page, 'Piano')).toHaveAttribute('aria-pressed', 'true');
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
  await pianoCard.locator('.preview-track-tone-btn').click();
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
  await expect(playToggleBtn).toHaveAttribute('aria-label', '停止');

  await page.reload();

  await waitForProjectHomeReady(page);
  await page.locator('.project-home-card').first().click();
  const reloadedPianoCard = page.locator('.preview-card[data-instrument="piano"]');
  const reloadedChordCard = page.locator('.preview-card[data-instrument="chord"]');
  await expect(reloadedPianoCard).toBeVisible();
  await expect(reloadedChordCard.locator('.preview-card-title')).toContainText('Violin');
  await expect(page.locator('.preview-song-root-select')).toHaveValue('C');
  await expect(page.locator('.preview-song-family-select')).toHaveValue('pentatonic');
  await expect(page.locator('.preview-harmony-btn.selected')).toContainText('m');
});

test('current song settings restore on load', async ({ page }) => {
  await page.goto('/');
  await createNewProject(page, 'Settings Project');
  await expect(page.locator('[data-onboarding-skip="true"]')).toBeVisible({ timeout: 10_000 });
  await dismissOnboardingIfPresent(page);
  await expect(page.locator('.preview-song-root-select')).toHaveValue('C');
  await page.selectOption('.preview-song-root-select', 'D');
  await page.locator('.preview-harmony-btn[data-harmony="minor"]').click();
  await page.selectOption('.preview-song-family-select', 'pentatonic');
  await expect.poll(() => page.evaluate(() => {
    const activeProjectId = localStorage.getItem('compose_active_project_id');
    const current = JSON.parse(localStorage.getItem(`compose_project:${activeProjectId}`));
    return [current.songRoot, current.songHarmony, current.songScaleFamily];
  })).toEqual(['D', 'minor', 'pentatonic']);
  await page.reload();
  await waitForProjectHomeReady(page);
  await page.locator('.project-home-card').first().click();

  const restartBtn = page.getByRole('button', { name: 'はじめる' });
  if (await restartBtn.isVisible().catch(() => false)) {
    await restartBtn.click();
  }

  await expect(page.locator('.preview-song-root-select')).toHaveValue('D');
  await expect(page.locator('.preview-song-family-select')).toHaveValue('pentatonic');
  await expect(page.locator('.preview-harmony-btn.selected')).toContainText('m');
});

test('rejects oversized or malformed project data before restore', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { restoreFromData } = await import('/src/features/project/storage/storage-helpers.js');
    const { appState } = await import('/src/core/state.js');
    const { MAX_PROJECT_MEASURES, MAX_PROJECT_TRACKS } = await import('/src/core/constants.js');
    const { addMeasure, addTrack } = await import('/src/features/tracks/tracks-controller.js');
    const steps = Array(48).fill(null);
    return {
      tooManyMeasures: restoreFromData({
        version: 11,
        numMeasures: 129,
        tracks: [],
      }),
      unknownInstrument: restoreFromData({
        version: 11,
        numMeasures: 1,
        tracks: [{
          id: 1,
          instrument: 'unknown',
        }],
      }),
      invalidDuration: restoreFromData({
        version: 11,
        numMeasures: 1,
        tracks: [{
          id: 1,
          instrument: 'piano',
          stepsMap: { C4: ['invalid-duration', ...steps.slice(1)] },
        }],
      }),
      invalidChord: restoreFromData({
        version: 11,
        numMeasures: 1,
        tracks: [{
          id: 1,
          instrument: 'chord',
          chordMap: [{ root: 'C', type: 'invalid-type', octave: 3 }, ...steps.slice(1)],
          soundSteps: steps,
        }],
      }),
      olderSchemaVersion: restoreFromData({
        version: 10,
        numMeasures: 1,
        tracks: [{
          id: 2,
          instrument: 'piano',
          stepsMap: { C4: Array(48).fill(null) },
        }],
      }),
      compatibleLocalShape: (() => {
        const restored = restoreFromData({
          version: 11,
          numMeasures: 1,
          tracks: [{
            id: 3,
            instrument: 'piano',
            stepsMap: { C4: [true, ...steps.slice(1)] },
          }],
        }, { allowCompatibleShape: true });
        return restored ? appState.tracks[0].stepsMap.C4[0] : null;
      })(),
      preservedChord: (() => {
        const restored = restoreFromData({
          version: 11,
          numMeasures: 1,
          tracks: [{
            id: 3,
            instrument: 'chord',
            chordMap: [{ root: 'D', type: 'm', octave: 3 }, ...steps.slice(1)],
            soundSteps: steps,
          }],
        });
        const chord = restored ? appState.tracks[0].chordMap[0] : null;
        return chord ? `${chord.root}${chord.type}${chord.octave}` : null;
      })(),
      legacy16StepShape: restoreFromData({
        version: 10,
        numMeasures: 1,
        tracks: [{
          id: 3,
          instrument: 'piano',
          stepsMap: { C4: Array(16).fill(null) },
        }],
      }, { allowCompatibleShape: true }),
      nextId: (() => {
        const restored = restoreFromData({
          version: 11,
          numMeasures: 1,
          nextId: 0,
          tracks: [{
            id: 4,
            instrument: 'piano',
            stepsMap: {},
          }],
        });
        return restored ? appState.nextId : null;
      })(),
      runtimeLimits: (() => {
        appState.numMeasures = MAX_PROJECT_MEASURES;
        const measureAdded = addMeasure();
        appState.tracks = Array.from({ length: MAX_PROJECT_TRACKS }, () => ({}));
        const trackAdded = addTrack('piano');
        return [measureAdded, trackAdded];
      })(),
    };
  });

  expect(result).toEqual({
    tooManyMeasures: false,
    unknownInstrument: false,
    invalidDuration: false,
    invalidChord: false,
    olderSchemaVersion: true,
    compatibleLocalShape: '16n',
    preservedChord: 'Dm3',
    legacy16StepShape: false,
    nextId: 5,
    runtimeLimits: [false, false],
  });
});

test('does not overwrite an active project before this tab restores it', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await createNewProject(page, 'Reload Save Guard');

  const before = await page.evaluate(() => {
    const index = JSON.parse(localStorage.getItem('compose_project_index') || '{"projects":[]}');
    const projectId = index.projects?.[0]?.id;
    const raw = projectId ? localStorage.getItem(`compose_project:${projectId}`) : null;
    return { projectId, raw, trackCount: raw ? JSON.parse(raw).tracks?.length : 0 };
  });
  expect(before.trackCount).toBeGreaterThan(0);

  await page.reload();
  await page.evaluate(async () => {
    const { callbacks } = await import('/src/core/state.js');
    callbacks.renderSidebar?.();
    callbacks.renderEditor?.();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  const after = await page.evaluate((projectId) => (
    localStorage.getItem(`compose_project:${projectId}`)
  ), before.projectId);
  expect(after).toBe(before.raw);
});

test('shows a backup action when browser storage save fails', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await createNewProject(page, 'Save Error Test');

  const saveFailed = await page.evaluate(async () => {
    const originalSetItem = Storage.prototype.setItem;
    window.__originalStorageSetItem = originalSetItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
    const { saveState } = await import('/src/features/project/storage/storage-core.js');
    return saveState();
  });

  expect(saveFailed).toBe(false);
  await expect(page.getByRole('alert')).toContainText('保存できませんでした');
  await expect(page.getByRole('button', { name: 'JSONを書き出す' })).toBeVisible();

  const noticeMetrics = await page.locator('#saveErrorNotice').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const exportButton = element.querySelector('.save-error-notice-export');
    const exportRect = exportButton?.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      left: Math.round(rect.left),
      rightGap: Math.round(window.innerWidth - rect.right),
      actionHeight: Math.round(exportRect?.height || 0),
    };
  });
  expect(noticeMetrics.width).toBeLessThanOrEqual(420);
  expect(noticeMetrics.left).toBeGreaterThanOrEqual(16);
  expect(noticeMetrics.rightGap).toBeGreaterThanOrEqual(16);
  expect(noticeMetrics.actionHeight).toBeGreaterThanOrEqual(44);

  const saveRecovered = await page.evaluate(async () => {
    Storage.prototype.setItem = window.__originalStorageSetItem;
    delete window.__originalStorageSetItem;
    const { saveState } = await import('/src/features/project/storage/storage-core.js');
    return saveState();
  });

  expect(saveRecovered).toBe(true);
  await expect(page.locator('#saveErrorNotice')).toHaveCount(0);
});
