import { appState, callbacks, STEPS_PER_BEAT, STEPS_PER_MEASURE } from '../core/state.js';
import { TUTORIAL_ACTION_EVENT } from '../core/tutorial-events.js';
import { INST_TYPE } from '../features/tracks/instrument-map.js';

const ONBOARDING_KEY = 'compose_mobile_onboarding_v4';
const GUIDE_SECTION_COUNT = 4;
const TARGET_PADDING = 6;

const CHORD_EXERCISE = [
    { measure: 2, beat: 0, root: 'F', type: 'M', label: 'F' },
    { measure: 2, beat: 2, root: 'C', type: 'M', label: 'C' },
    { measure: 3, beat: 0, root: 'F', type: 'M', label: 'F' },
    { measure: 3, beat: 2, root: 'G', type: 'M', label: 'G' },
];

export function initOnboarding({
    force = false,
    startImmediately = false,
} = {}) {
    if (document.querySelector('.onboarding-overlay')) return;
    if (!force && localStorage.getItem(ONBOARDING_KEY) === 'seen') return;

    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.innerHTML = `
        <div class="onboarding-shade onboarding-shade-top" hidden></div>
        <div class="onboarding-shade onboarding-shade-right" hidden></div>
        <div class="onboarding-shade onboarding-shade-bottom" hidden></div>
        <div class="onboarding-shade onboarding-shade-left" hidden></div>
        <div class="onboarding-spotlight" hidden></div>
        <div class="onboarding-card">
            <div class="onboarding-kicker">はじめての方へ</div>
            <h2 class="onboarding-title">操作説明を受けますか？</h2>
            <p class="onboarding-description">カノン進行の前半を使い、再生、繰り返し、コード、メロディを実際に操作しながら体験します。</p>
            <div class="onboarding-actions">
                <button type="button" class="onboarding-btn secondary" data-onboarding-skip="true">今はしない</button>
                <button type="button" class="onboarding-btn primary" data-onboarding-start="true">説明を見る</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const session = createGuideSession(overlay);
    overlay.querySelector('[data-onboarding-skip="true"]').addEventListener('click', session.dismiss);
    overlay.querySelector('[data-onboarding-start="true"]').addEventListener('click', session.start);
    if (startImmediately) session.start();
}

function createGuideSession(overlay) {
    const session = {
        overlay,
        stepIndex: -1,
        active: false,
        lastMelodyNote: null,
        resizeHandler: null,
        actionHandler: null,
        interactionBlocker: null,
        steps: [],
        dismiss: null,
        start: null,
    };

    session.steps = buildGuideSteps(session);
    session.resizeHandler = () => syncGuideTarget(session);
    session.actionHandler = (event) => handleTutorialAction(session, event.detail || {});
    session.interactionBlocker = (event) => blockOutsideInteraction(session, event);
    session.dismiss = () => dismissGuide(session);
    session.start = () => {
        session.active = true;
        session.overlay.classList.add('is-guide');
        document.addEventListener(TUTORIAL_ACTION_EVENT, session.actionHandler);
        document.addEventListener('pointerdown', session.interactionBlocker, true);
        document.addEventListener('click', session.interactionBlocker, true);
        window.addEventListener('resize', session.resizeHandler, { passive: true });
        showGuideStep(session, 0);
    };
    return session;
}

function buildGuideSteps(session) {
    const steps = [
        guideStep({
            section: 1,
            title: '再生して曲を聴く',
            body: '下の再生ボタンを押してください。前半の C → G → Am → Em とドラムが流れます。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            prepare: () => showPreviewMeasure(0),
            action: 'playback-requested',
        }),
        guideStep({
            section: 1,
            title: '停止する',
            body: '同じボタンが停止に変わりました。押して再生を止めてください。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-stopped',
        }),
        guideStep({
            section: 2,
            title: '繰り返す範囲を決める',
            body: 'Drums の左端にある黄色い範囲ボタンを押し、1小節目を開始位置にします。',
            target: '.preview-card[data-instrument="drums"] .preview-repeat-rail.start',
            allowed: ['.preview-card[data-instrument="drums"] .preview-repeat-rail.start'],
            prepare: () => showPreviewMeasure(0),
            action: 'repeat-source-started',
            matches: (detail) => detail.sourceStartMeasure === 0 && isTrackType(detail.trackId, 'rhythm'),
        }),
        guideStep({
            section: 2,
            title: '2小節目へ進む',
            body: '右の小節移動ボタンで2小節目へ進んでください。',
            target: '.mb-nav-btn[data-direction="1"]',
            allowed: ['.mb-nav-btn[data-direction="1"]'],
            action: 'measure-changed',
            matches: (detail) => detail.currentMeasure === 1,
        }),
        guideStep({
            section: 2,
            title: '範囲の終点を決める',
            body: 'Drums の右端に出た黄色い範囲ボタンを押し、1〜2小節目を繰り返し元にします。',
            target: '.preview-card[data-instrument="drums"] .preview-repeat-rail.end',
            allowed: ['.preview-card[data-instrument="drums"] .preview-repeat-rail.end'],
            action: 'repeat-source-completed',
            matches: (detail) => detail.sourceStartMeasure === 0
                && detail.sourceEndMeasure === 1
                && isTrackType(detail.trackId, 'rhythm'),
        }),
        guideStep({
            section: 2,
            title: '3小節目へ進む',
            body: '右の小節移動ボタンで、空いている3小節目へ進んでください。',
            target: '.mb-nav-btn[data-direction="1"]',
            allowed: ['.mb-nav-btn[data-direction="1"]'],
            action: 'measure-changed',
            matches: (detail) => detail.currentMeasure === 2,
        }),
        guideStep({
            section: 2,
            title: 'ドラムを繰り返す',
            body: 'Drums の繰り返しボタンを押すと、1〜2小節目の内容が3小節目へ続きます。',
            target: '.preview-card[data-instrument="drums"] .preview-track-repeat-btn',
            allowed: ['.preview-card[data-instrument="drums"] .preview-track-repeat-btn'],
            action: 'repeat-applied',
            matches: (detail) => detail.targetEndMeasure === 2 && isTrackType(detail.trackId, 'rhythm'),
        }),
        guideStep({
            section: 2,
            title: '4小節目へ進む',
            body: '右の小節移動ボタンで4小節目へ進んでください。',
            target: '.mb-nav-btn[data-direction="1"]',
            allowed: ['.mb-nav-btn[data-direction="1"]'],
            action: 'measure-changed',
            matches: (detail) => detail.currentMeasure === 3,
        }),
        guideStep({
            section: 2,
            title: '4小節目にも繰り返す',
            body: 'もう一度 Drums の繰り返しボタンを押し、後半のドラムを完成させます。',
            target: '.preview-card[data-instrument="drums"] .preview-track-repeat-btn',
            allowed: ['.preview-card[data-instrument="drums"] .preview-track-repeat-btn'],
            action: 'repeat-applied',
            matches: (detail) => detail.targetEndMeasure === 3 && isTrackType(detail.trackId, 'rhythm'),
        }),
    ];

    CHORD_EXERCISE.forEach((expected, index) => {
        steps.push(guideStep({
            section: 3,
            title: `${expected.measure + 1}小節目に ${expected.label} を置く`,
            body: `コード選択を ${expected.label} にして、${expected.beat + 1}拍目を押してください。後半は F → C → F → G にします。`,
            target: '.chord-sequencer-section',
            allowed: ['.chord-sequencer-section'],
            prepare: () => showTrackMeasure('chord', expected.measure),
            action: 'chord-changed',
            matches: (detail) => {
                const expectedStep = expected.measure * STEPS_PER_MEASURE + expected.beat * STEPS_PER_BEAT;
                return detail.step === expectedStep
                    && detail.chord?.root === expected.root
                    && detail.chord?.type === expected.type;
            },
            substep: `${index + 1} / ${CHORD_EXERCISE.length}`,
        }));
    });

    steps.push(
        guideStep({
            section: 3,
            title: 'キックとコードの同期を聴く',
            body: '前半では、コードを鳴らす位置をキックと同じ1拍目・3拍目にしています。再生して重なりを聴いてください。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            prepare: () => showTrackMeasure('chord', 0),
            action: 'playback-requested',
        }),
        guideStep({
            section: 3,
            title: '同期を確認して停止する',
            body: 'キックとコードが同時に鳴る感覚を確認したら、停止ボタンを押してください。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-stopped',
        }),
        guideStep({
            section: 3,
            title: '自分で鳴らす場所を選ぶ',
            body: '3小節目の下段を好きな位置で押し、コードを鳴らすタイミングを1つ作ってください。',
            target: '.chord-timing-grid',
            allowed: ['.chord-timing-grid'],
            prepare: () => showTrackMeasure('chord', 2),
            action: 'chord-sound-added',
            matches: (detail) => Math.floor(detail.step / STEPS_PER_MEASURE) === 2,
        }),
        guideStep({
            section: 3,
            title: '4小節目も自分で決める',
            body: '4小節目でも、コードを鳴らしたい位置を1つ選んでください。',
            target: '.chord-timing-grid',
            allowed: ['.chord-timing-grid'],
            prepare: () => showTrackMeasure('chord', 3),
            action: 'chord-sound-added',
            matches: (detail) => Math.floor(detail.step / STEPS_PER_MEASURE) === 3,
        }),
        guideStep({
            section: 4,
            title: 'コードトーンから音を選ぶ',
            body: '背景に色が付いた横列は、その拍のコードに含まれる音です。迷ったら色の付いた音から1つ選んで置いてみましょう。',
            target: '.melody-roll-content',
            allowed: ['.melody-roll-content'],
            prepare: () => showTrackMeasure('melody', 2),
            action: 'melody-note-added',
            onMatch: (detail) => {
                session.lastMelodyNote = { note: detail.note, step: detail.step };
            },
        }),
        guideStep({
            section: 4,
            title: '置いた音を削除する',
            body: '置いた音を1回押すと削除待ちになり、もう1回押すと削除できます。',
            target: () => melodyNoteSelector(session.lastMelodyNote),
            allowed: () => [melodyNoteSelector(session.lastMelodyNote)],
            action: 'melody-note-removed',
            matches: (detail) => isSameMelodyNote(detail, session.lastMelodyNote),
        }),
        guideStep({
            section: 4,
            title: '移動する音を置く',
            body: 'もう一度、コードトーンの色を参考に音を1つ置いてください。',
            target: '.melody-roll-content',
            allowed: ['.melody-roll-content'],
            action: 'melody-note-added',
            onMatch: (detail) => {
                session.lastMelodyNote = { note: detail.note, step: detail.step };
            },
        }),
        guideStep({
            section: 4,
            title: '長押しして音を移動する',
            body: '置いた音を長押しし、そのまま上下または左右へ動かして離してください。',
            target: () => melodyNoteSelector(session.lastMelodyNote),
            allowed: () => [melodyNoteSelector(session.lastMelodyNote), '.melody-roll-content'],
            action: 'melody-note-moved',
            matches: (detail) => detail.sourceNote === session.lastMelodyNote?.note
                && detail.sourceStep === session.lastMelodyNote?.step,
        })
    );

    return steps;
}

function guideStep(config) {
    return {
        section: config.section,
        title: config.title,
        body: config.body,
        target: config.target,
        allowed: config.allowed,
        prepare: config.prepare || null,
        action: config.action,
        matches: config.matches || (() => true),
        onMatch: config.onMatch || null,
        substep: config.substep || null,
    };
}

function showGuideStep(session, stepIndex) {
    session.stepIndex = stepIndex;
    const step = session.steps[stepIndex];
    if (!step) {
        showGuideComplete(session);
        return;
    }

    step.prepare?.();
    const card = session.overlay.querySelector('.onboarding-card');
    card.innerHTML = `
        <div class="onboarding-progress" style="--onboarding-progress: ${step.section}"></div>
        <div class="onboarding-kicker">${step.section} / ${GUIDE_SECTION_COUNT}${step.substep ? ` ・ ${step.substep}` : ''}</div>
        <h2 class="onboarding-title">${step.title}</h2>
        <p class="onboarding-description">${step.body}</p>
        <div class="onboarding-actions">
            <button type="button" class="onboarding-btn secondary" data-onboarding-close="true">終了</button>
        </div>
    `;
    card.querySelector('[data-onboarding-close="true"]').addEventListener('click', session.dismiss);
    requestAnimationFrame(() => requestAnimationFrame(() => syncGuideTarget(session)));
}

function showGuideComplete(session) {
    clearGuideTarget(session);
    const card = session.overlay.querySelector('.onboarding-card');
    card.classList.remove('is-top');
    card.classList.add('is-bottom');
    card.innerHTML = `
        <div class="onboarding-progress" style="--onboarding-progress: ${GUIDE_SECTION_COUNT}"></div>
        <div class="onboarding-kicker">完了</div>
        <h2 class="onboarding-title">基本操作を体験できました</h2>
        <p class="onboarding-description">後半のコードとリズム、メロディまで自分で作った状態です。このまま音を足したり動かしたりして曲を育てられます。</p>
        <div class="onboarding-actions">
            <button type="button" class="onboarding-btn primary" data-onboarding-finish="true">作曲を続ける</button>
        </div>
    `;
    card.querySelector('[data-onboarding-finish="true"]').addEventListener('click', session.dismiss);
}

function handleTutorialAction(session, detail) {
    if (!session.active) return;
    const step = session.steps[session.stepIndex];
    if (!step || detail.action !== step.action || !step.matches(detail)) return;
    step.onMatch?.(detail);
    showGuideStep(session, session.stepIndex + 1);
}

function blockOutsideInteraction(session, event) {
    if (!session.active) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.onboarding-card')) return;

    const step = session.steps[session.stepIndex];
    const selectors = resolveSelectors(step?.allowed);
    if (selectors.some((selector) => selector && target.closest(selector))) return;

    event.preventDefault();
    event.stopImmediatePropagation();
}

function syncGuideTarget(session) {
    if (!session.active) return;
    const step = session.steps[session.stepIndex];
    if (!step) return;
    const selector = resolveTargetSelector(step.target);
    const target = selector ? document.querySelector(selector) : null;
    if (!(target instanceof HTMLElement)) {
        clearGuideTarget(session);
        return;
    }

    const rect = target.getBoundingClientRect();
    const left = Math.max(0, rect.left - TARGET_PADDING);
    const top = Math.max(0, rect.top - TARGET_PADDING);
    const right = Math.min(window.innerWidth, rect.right + TARGET_PADDING);
    const bottom = Math.min(window.innerHeight, rect.bottom + TARGET_PADDING);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);

    const spotlight = session.overlay.querySelector('.onboarding-spotlight');
    spotlight.hidden = false;
    Object.assign(spotlight.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
    });

    setShadeRect(session.overlay, '.onboarding-shade-top', 0, 0, window.innerWidth, top);
    setShadeRect(session.overlay, '.onboarding-shade-right', right, top, window.innerWidth - right, height);
    setShadeRect(session.overlay, '.onboarding-shade-bottom', 0, bottom, window.innerWidth, window.innerHeight - bottom);
    setShadeRect(session.overlay, '.onboarding-shade-left', 0, top, left, height);

    const card = session.overlay.querySelector('.onboarding-card');
    const placeAtTop = rect.top + rect.height / 2 > window.innerHeight * 0.55;
    card.classList.toggle('is-top', placeAtTop);
    card.classList.toggle('is-bottom', !placeAtTop);
}

function clearGuideTarget(session) {
    session.overlay.querySelector('.onboarding-spotlight').hidden = true;
    session.overlay.querySelectorAll('.onboarding-shade').forEach((shade) => {
        shade.hidden = true;
    });
}

function setShadeRect(overlay, selector, left, top, width, height) {
    const shade = overlay.querySelector(selector);
    shade.hidden = false;
    Object.assign(shade.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${Math.max(0, width)}px`,
        height: `${Math.max(0, height)}px`,
    });
}

function dismissGuide(session) {
    clearGuideTarget(session);
    localStorage.setItem(ONBOARDING_KEY, 'seen');
    document.removeEventListener(TUTORIAL_ACTION_EVENT, session.actionHandler);
    document.removeEventListener('pointerdown', session.interactionBlocker, true);
    document.removeEventListener('click', session.interactionBlocker, true);
    window.removeEventListener('resize', session.resizeHandler);
    session.overlay.remove();
    session.active = false;
}

function showPreviewMeasure(measure) {
    appState.currentMeasure = measure;
    appState.playheadStep = measure * STEPS_PER_MEASURE;
    appState.previewMode = true;
    callbacks.renderEditor?.();
}

function showTrackMeasure(trackType, measure) {
    const track = appState.tracks.find((item) => INST_TYPE[item.instrument] === trackType);
    if (!track) return;
    appState.activeTrackId = track.id;
    appState.lastTouchedTrackId = track.id;
    appState.currentMeasure = measure;
    appState.playheadStep = measure * STEPS_PER_MEASURE;
    appState.previewMode = false;
    callbacks.renderEditor?.();
}

function isTrackType(trackId, type) {
    const track = appState.tracks.find((item) => item.id === trackId);
    return track ? INST_TYPE[track.instrument] === type : false;
}

function resolveTargetSelector(target) {
    return typeof target === 'function' ? target() : target;
}

function resolveSelectors(selectors) {
    const resolved = typeof selectors === 'function' ? selectors() : selectors;
    return (Array.isArray(resolved) ? resolved : [resolved]).filter(Boolean);
}

function melodyNoteSelector(note) {
    if (!note) return '.melody-grid-note';
    return `.melody-grid-note[data-note="${note.note}"][data-step="${note.step}"]`;
}

function isSameMelodyNote(detail, note) {
    return detail.note === note?.note && detail.step === note?.step;
}
