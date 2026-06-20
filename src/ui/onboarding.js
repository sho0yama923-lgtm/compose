import { appState, callbacks, STEPS_PER_BEAT, STEPS_PER_MEASURE } from '../core/state.js';
import { TUTORIAL_ACTION_EVENT } from '../core/tutorial-events.js';
import { isStepHead, placeNote } from '../core/duration.js';
import { INST_TYPE } from '../features/tracks/instrument-map.js';
import { copyTrackMeasureRange, repeatTrackMeasureRange } from '../features/tracks/tracks-controller.js';
import { setMeasureSeekExpanded } from './bottom-bar.js';
import repeatLoopIconUrl from '../assets/repeat_loop_icon.svg';

const ONBOARDING_KEY = 'compose_mobile_onboarding_v4';
const GUIDE_SECTION_COUNT = 5;
const GUIDE_MODE_QUICK = 'quick';
const GUIDE_MODE_DETAIL = 'detail';
const TARGET_PADDING = 6;
const PLAYER_HIGHLIGHT_GAP = 12;
const MELODY_GUIDE_ROW_SELECTOR = '.melody-grid-row.has-chord-tone';
const PLAYBACK_LISTEN_DELAY_MS = 2000;

const GUIDE_SECTIONS = [
    { section: 1, label: '画面の見方', description: '画面の基本を見ます。' },
    { section: 2, label: '再生', description: '再生、停止、範囲変更も試します。' },
    { section: 3, label: '繰り返し', description: '1〜2小節目を後ろへコピーします。' },
    { section: 4, label: 'コード', description: '後半コードと鳴らす位置を作ります。' },
    { section: 5, label: 'メロディ', description: 'コードトーンで音を置きます。' },
];

const CHORD_EXERCISE = [
    { measure: 2, beat: 0, root: 'F', type: 'M', label: 'F', select: true },
    { measure: 2, beat: 1, root: 'F', type: 'M', label: 'F' },
    { measure: 2, beat: 2, root: 'C', type: 'M', label: 'C', select: true },
    { measure: 2, beat: 3, root: 'C', type: 'M', label: 'C' },
    { measure: 3, beat: 0, root: 'F', type: 'M', label: 'F', select: true },
    { measure: 3, beat: 1, root: 'F', type: 'M', label: 'F' },
    { measure: 3, beat: 2, root: 'G', type: 'M', label: 'G', select: true },
    { measure: 3, beat: 3, root: 'G', type: 'M', label: 'G' },
];

export function initOnboarding({
    force = false,
    startImmediately = false,
    chooseStartSection = false,
    onStart = null,
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
        <div class="onboarding-range-destination" hidden>
            <span class="onboarding-range-destination-label">ここまで</span>
        </div>
        <div class="onboarding-range-arrow" hidden>
            <span class="onboarding-range-arrow-line"></span>
            <span class="onboarding-range-arrow-head"></span>
        </div>
        <div class="onboarding-next-bar" hidden>
            <button type="button" class="onboarding-btn primary" data-onboarding-next="true">次へ</button>
        </div>
        <div class="onboarding-card">
            <h2 class="onboarding-title">操作説明を受けますか？</h2>
            <p class="onboarding-description">基本操作をひと通り試します。</p>
            <div class="onboarding-actions">
                <button type="button" class="onboarding-btn secondary" data-onboarding-skip="true">今はしない</button>
                <button type="button" class="onboarding-btn primary" data-onboarding-start="true">説明を見る</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const session = createGuideSession(overlay, { onStart });
    overlay.querySelector('[data-onboarding-skip="true"]').addEventListener('click', session.dismiss);
    overlay.querySelector('[data-onboarding-start="true"]').addEventListener('click', () => {
        if (chooseStartSection) {
            showTutorialStartPicker(session);
            return;
        }
        session.startQuick();
    });
    if (startImmediately) {
        if (chooseStartSection) showTutorialStartPicker(session);
        else session.startQuick();
    }
}

function createGuideSession(overlay, { onStart = null } = {}) {
    const session = {
        overlay,
        stepIndex: -1,
        active: false,
        startedHookCalled: false,
        lastMelodyNote: null,
        resizeHandler: null,
        actionHandler: null,
        interactionBlocker: null,
        targetSyncTimer: null,
        anchoredCardTop: null,
        sectionCount: GUIDE_SECTION_COUNT,
        steps: [],
        dismiss: null,
        start: null,
        startQuick: null,
    };

    session.resizeHandler = () => syncGuideTarget(session);
    session.actionHandler = (event) => handleTutorialAction(session, event.detail || {});
    session.interactionBlocker = (event) => blockOutsideInteraction(session, event);
    session.dismiss = () => dismissGuide(session);
    session.start = (startSection = 1, mode = GUIDE_MODE_DETAIL) => {
        if (!session.startedHookCalled) {
            session.startedHookCalled = true;
            onStart?.();
        }
        session.steps = mode === GUIDE_MODE_QUICK
            ? buildQuickGuideSteps(session)
            : buildDetailGuideSteps(session);
        session.sectionCount = mode === GUIDE_MODE_QUICK ? 4 : GUIDE_SECTION_COUNT;
        session.overlay.style.setProperty('--onboarding-progress-steps', String(session.sectionCount));
        prepareGuideStartState(startSection, mode);
        session.active = true;
        session.overlay.classList.add('is-guide');
        document.addEventListener(TUTORIAL_ACTION_EVENT, session.actionHandler);
        document.addEventListener('pointerdown', session.interactionBlocker, true);
        document.addEventListener('click', session.interactionBlocker, true);
        window.addEventListener('resize', session.resizeHandler, { passive: true });
        showGuideStep(session, getSectionStartIndex(session, startSection));
    };
    session.startQuick = () => session.start(1, GUIDE_MODE_QUICK);
    return session;
}

function showTutorialStartPicker(session) {
    const card = session.overlay.querySelector('.onboarding-card');
    card.innerHTML = `
        <h2 class="onboarding-title">チュートリアル</h2>
        <p class="onboarding-description">まずは短い流れで1曲の基本を触ります。</p>
        <div class="onboarding-start-actions">
            <button type="button" class="onboarding-btn primary onboarding-start-primary" data-onboarding-quick="true">おすすめチュートリアル</button>
            <button type="button" class="onboarding-btn secondary onboarding-start-detail" data-onboarding-detail="true">章を選んで見る</button>
        </div>
        <div class="onboarding-actions">
            <button type="button" class="onboarding-btn secondary" data-onboarding-skip="true">閉じる</button>
        </div>
    `;
    card.querySelector('[data-onboarding-quick="true"]').addEventListener('click', session.startQuick);
    card.querySelector('[data-onboarding-detail="true"]').addEventListener('click', () => showSectionPicker(session));
    card.querySelector('[data-onboarding-skip="true"]').addEventListener('click', session.dismiss);
}

function showSectionPicker(session) {
    const card = session.overlay.querySelector('.onboarding-card');
    card.innerHTML = `
        <h2 class="onboarding-title">章を選んで見る</h2>
        <div class="onboarding-section-list">
            ${GUIDE_SECTIONS.map((section) => `
                <button type="button" class="onboarding-section-option" data-onboarding-section="${section.section}">
                    <span class="onboarding-section-label">${section.label}</span>
                    <span class="onboarding-section-desc">${section.description}</span>
                </button>
            `).join('')}
        </div>
        <div class="onboarding-actions">
            <button type="button" class="onboarding-btn secondary" data-onboarding-skip="true">閉じる</button>
        </div>
    `;
    card.querySelector('[data-onboarding-skip="true"]').addEventListener('click', session.dismiss);
    card.querySelectorAll('[data-onboarding-section]').forEach((button) => {
        button.addEventListener('click', () => {
            session.start(Number(button.dataset.onboardingSection) || 1, GUIDE_MODE_DETAIL);
        });
    });
}

function getSectionStartIndex(session, startSection) {
    const normalizedSection = Math.max(1, Math.min(GUIDE_SECTION_COUNT, startSection));
    const index = session.steps.findIndex((step) => step.section === normalizedSection);
    return index >= 0 ? index : 0;
}

function prepareGuideStartState(startSection, mode = GUIDE_MODE_DETAIL) {
    const section = Math.max(1, Math.min(GUIDE_SECTION_COUNT, startSection));
    setMeasureSeekExpanded(false);
    appState.playRangeStartMeasure = 0;
    appState.playRangeEndMeasure = 3;
    appState.isPlaying = false;
    appState.playheadStep = null;

    if (mode === GUIDE_MODE_QUICK) prepareQuickGuideStartState(section);
    else prepareDetailGuideStartState(section);
}

function prepareDetailGuideStartState(section) {
    if (section >= 4) completeRepeatTutorialState();
    if (section >= 5) completeChordProgressState(true);
    if (section >= 5) {
        showTrackMeasure('melody', 2);
    } else if (section >= 4) {
        showPreviewMeasure(2);
    } else {
        showPreviewMeasure(0);
    }
    callbacks.renderEditor?.();
    callbacks.saveState?.();
}

function prepareQuickGuideStartState(section) {
    if (section >= 4) completeChordProgressState(true);
    if (section >= 4) {
        showTrackMeasure('melody', 2);
    } else if (section >= 3) {
        prepareQuickCodeStartState();
    } else {
        showPreviewMeasure(0);
    }
    callbacks.renderEditor?.();
    callbacks.saveState?.();
}

function prepareQuickCodeStartState() {
    completeRepeatTutorialState();
    const chordTrack = appState.tracks.find((track) => track.instrument === 'chord');
    if (chordTrack) {
        const start = 2 * STEPS_PER_MEASURE;
        const end = 4 * STEPS_PER_MEASURE;
        chordTrack.chordMap.fill(null, start, end);
        chordTrack.soundSteps.fill(null, start, end);
        chordTrack.selectedChordRoot = 'C';
        chordTrack.selectedChordType = 'M';
    }
    showPreviewMeasure(2);
}

function selectTutorialChord(root, type = 'M') {
    const chordTrack = appState.tracks.find((track) => track.instrument === 'chord');
    if (!chordTrack) return;
    chordTrack.selectedChordRoot = root;
    chordTrack.selectedChordType = type;
    callbacks.renderEditor?.();
}

function completeRepeatTutorialState() {
    const drumTrack = appState.tracks.find((track) => track.instrument === 'drums');
    if (!drumTrack) return;
    repeatTrackMeasureRange(drumTrack, 0, 1, 3);
    appState.repeatStates[drumTrack.id] = {
        sourceStartMeasure: 0,
        sourceEndMeasure: 1,
        targetEndMeasure: 3,
        modeStep: 'ready',
        restoreMeasures: {},
        sourceSnapshot: copyTrackMeasureRange(drumTrack, 0, 1),
    };
}

function completeChordProgressState(includeFinalSound = false) {
    const chordTrack = appState.tracks.find((track) => track.instrument === 'chord');
    if (!chordTrack) return;
    CHORD_EXERCISE.forEach((expected) => {
        const start = expected.measure * STEPS_PER_MEASURE + expected.beat * STEPS_PER_BEAT;
        const end = start + STEPS_PER_BEAT;
        for (let step = start; step < end; step += 1) {
            chordTrack.chordMap[step] = {
                root: expected.root,
                type: expected.type,
                octave: 4,
                customNotes: null,
            };
        }
    });
    syncChordToDrums(chordTrack, 2);
    if (includeFinalSound) {
        placeNote(chordTrack.soundSteps, 3 * STEPS_PER_MEASURE, '8n', chordTrack.soundSteps.length);
    }
    chordTrack.selectedDrumRows = new Set(['Kick', 'Snare']);
    chordTrack.selectedChordRoot = 'G';
    chordTrack.selectedChordType = 'M';
}

function syncChordToDrums(chordTrack, measure) {
    const start = measure * STEPS_PER_MEASURE;
    const end = start + STEPS_PER_MEASURE;
    const drumTrack = appState.tracks.find((track) => track.instrument === 'drums');
    chordTrack.soundSteps.fill(null, start, end);
    if (!drumTrack) return;
    drumTrack.rows
        .filter((row) => row.label === 'Kick' || row.label === 'Snare')
        .forEach((row) => {
            for (let step = start; step < end; step += 1) {
                const value = row.steps[step];
                if (isStepHead(value)) {
                    placeNote(chordTrack.soundSteps, step, value, chordTrack.soundSteps.length);
                }
            }
        });
}

function buildQuickGuideSteps(session) {
    return [
        guideStep({
            section: 1,
            title: '画面の見方',
            body: '上部で曲の設定とトラック切り替えをします。',
            target: ['.topbar', '.preview-song-settings'],
            highlight: true,
            prepare: () => {
                showPreviewMeasure(0);
                setMeasureSeekExpanded(false);
            },
        }),
        guideStep({
            section: 1,
            title: '画面の見方',
            body: '中央にドラム、コード、メロディのトラックが並びます。',
            target: getPreviewCardsRectAbovePlayer,
            highlight: true,
            cardPosition: 'top',
        }),
        guideStep({
            section: 1,
            title: '画面の見方',
            body: '下部で再生と小節移動をします。',
            target: '.measure-seek-card',
            highlight: true,
            nextLabel: '次のステップへ',
            chapterEnd: true,
        }),
        guideStep({
            section: 2,
            title: '再生',
            body: 'まず曲を再生してみましょう。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-requested',
            cardPosition: 'player-top',
            advanceDelayMs: PLAYBACK_LISTEN_DELAY_MS,
        }),
        guideStep({
            section: 2,
            title: '再生',
            body: '同じボタンで停止します。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-stopped',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 2,
            title: '再生',
            body: '再生できました。次はコードです。',
            target: '[data-play-toggle="true"]',
            nextLabel: '次のステップへ',
            chapterEnd: true,
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 3,
            title: 'コード',
            body: '後半にコードを足して、曲の流れを作ります。',
            target: '.preview-card[data-instrument="chord"]',
            prepare: () => prepareQuickCodeStartState(),
        }),
        guideStep({
            section: 3,
            title: 'コード',
            body: '「コード / Piano」を開きます。',
            target: '.preview-card[data-instrument="chord"] .preview-card-header',
            allowed: ['.preview-card[data-instrument="chord"] .preview-card-header'],
            action: 'track-selected',
            matches: (detail) => detail.trackType === 'chord',
        }),
        guideStep({
            section: 3,
            title: 'コード',
            body: 'コード選択でFを選びます。',
            target: '.chord-select-input[aria-label="コードトラックのルート"]',
            allowed: ['.chord-select-input[aria-label="コードトラックのルート"]'],
            action: 'chord-selection-changed',
            matches: (detail) => detail.root === 'F'
                && detail.type === 'M'
                && isTrackType(detail.trackId, 'chord'),
        }),
        guideStep({
            section: 3,
            title: 'コード',
            body: '色のついたマスをタップしてFを置きます。',
            target: `.chord-progress-cell[data-step="${2 * STEPS_PER_MEASURE}"]`,
            allowed: [`.chord-progress-cell[data-step="${2 * STEPS_PER_MEASURE}"]`],
            action: 'chord-changed',
            matches: (detail) => detail.step === 2 * STEPS_PER_MEASURE
                && detail.chord?.root === 'F'
                && detail.chord?.type === 'M',
            prepare: () => selectTutorialChord('F'),
        }),
        guideStep({
            section: 3,
            title: 'コード',
            body: '鳴らしたい場所を1つタップします。',
            target: getChordTimingFirstBeatRect,
            allowed: ['.chord-timing-grid'],
            action: 'chord-sound-added',
            matches: (detail) => detail.step >= 2 * STEPS_PER_MEASURE
                && detail.step < 2 * STEPS_PER_MEASURE + STEPS_PER_BEAT,
        }),
        guideStep({
            section: 3,
            title: 'コード',
            body: 'コードが鳴るようになりました。残りは整えておきます。',
            target: '.chord-timing-grid',
            nextLabel: '次のステップへ',
            chapterEnd: true,
            prepare: () => completeChordProgressState(true),
        }),
        guideStep({
            section: 4,
            title: 'メロディ',
            body: '次にメロディを編集します。',
            target: '#trackEditor',
            prepare: () => {
                setMeasureSeekExpanded(false);
                completeChordProgressState(true);
                showTrackMeasure('melody', 2);
            },
        }),
        guideStep({
            section: 4,
            title: 'メロディ',
            body: 'コードトーンには色でガイドがついています。',
            target: MELODY_GUIDE_ROW_SELECTOR,
        }),
        guideStep({
            section: 4,
            title: 'メロディ',
            body: '試しにコードトーンに音を置いてみましょう。',
            target: MELODY_GUIDE_ROW_SELECTOR,
            allowed: [MELODY_GUIDE_ROW_SELECTOR],
            action: 'melody-note-added',
            onMatch: (detail) => {
                session.lastMelodyNote = { note: detail.note, step: detail.step };
            },
        }),
        guideStep({
            section: 4,
            title: 'メロディ',
            body: '音を置けました。これで基本操作は完了です。',
            target: () => melodyNoteSelector(session.lastMelodyNote),
            nextLabel: '完了',
        }),
    ];
}

function buildDetailGuideSteps(session) {
    const steps = [
        guideStep({
            section: 1,
            title: '画面の説明',
            body: '画面の全体を見ます。',
            target: '#trackEditor',
            prepare: () => {
                showPreviewMeasure(0);
                setMeasureSeekExpanded(false);
            },
        }),
        guideStep({
            section: 1,
            title: '上部エリア',
            body: '上部でトラック切り替え、BPM、キーを確認します。',
            target: ['.topbar', '.preview-song-settings'],
            highlight: true,
        }),
        guideStep({
            section: 1,
            title: 'トラックエリア',
            body: '中央にドラムやコードのトラックが並びます。',
            target: getPreviewCardsRectAbovePlayer,
            highlight: true,
            cardPosition: 'top',
        }),
        guideStep({
            section: 1,
            title: '再生エリア',
            body: '下部で再生、停止、小節移動、範囲変更をします。',
            target: '.measure-seek-card',
            highlight: true,
        }),
        guideStep({
            section: 1,
            title: 'トラックの詳細を見る',
            body: 'トラックをタップすると編集画面を開けます。Drumsを開きます。',
            target: '.preview-card[data-instrument="drums"] .preview-card-header',
            allowed: ['.preview-card[data-instrument="drums"] .preview-card-header'],
            action: 'track-selected',
            matches: (detail) => detail.trackType === 'rhythm',
            cardPosition: 'drums-anchor',
        }),
        guideStep({
            section: 1,
            title: 'エディタ画面',
            body: 'ここで音を鳴らす位置を決めます。',
            target: '.drum-editor',
            cardPosition: 'editor-lower',
        }),
        guideStep({
            section: 1,
            title: '1小節の見方',
            body: '1画面に1小節を表示します。通常は16分割です。',
            target: '.timeline-header',
            highlight: true,
            cardPosition: 'editor-lower',
        }),
        guideStep({
            section: 1,
            title: '音の長さ',
            body: '音符ボタンで音の長さを選びます。',
            target: '.duration-toolbar',
            highlight: true,
            cardPosition: 'editor-lower',
        }),
        guideStep({
            section: 1,
            title: '音を置く場所',
            body: 'グリッドで音とタイミングを決めます。',
            target: '.drum-roll-scroll',
            highlight: true,
            cardPosition: 'editor-lower',
        }),
        guideStep({
            section: 1,
            title: '全体画面へ戻る',
            body: '全体画面に戻ります。',
            target: '#viewToggleBtn',
            allowed: ['#viewToggleBtn'],
            action: 'preview-view-opened',
            cardPosition: 'drums-anchor',
        }),
        guideStep({
            section: 1,
            title: '画面の見方',
            body: '次は再生を試します。',
            target: '#trackEditor',
            nextLabel: '次のステップへ',
            chapterEnd: true,
            prepare: () => {
                showPreviewMeasure(0);
                setMeasureSeekExpanded(false);
            },
        }),
        guideStep({
            section: 2,
            title: '再生操作',
            body: '曲の再生と停止を試します。',
            target: '[data-play-toggle="true"]',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 2,
            title: '再生操作',
            body: '再生ボタンで曲を聴きます。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-requested',
            advanceDelayMs: PLAYBACK_LISTEN_DELAY_MS,
        }),
        guideStep({
            section: 2,
            title: '再生操作',
            body: '同じボタンで停止します。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-stopped',
        }),
        guideStep({
            section: 2,
            title: '再生操作',
            body: '再生範囲を変えます。',
            target: '.measure-seek-card',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 2,
            title: '再生操作',
            body: '下部のつまみで範囲操作を開きます。',
            target: '.measure-seek-handle',
            allowed: ['.measure-seek-handle'],
            action: 'seek-bar-expanded',
        }),
        guideStep({
            section: 2,
            title: '再生操作',
            body: '右端の青いつまみを黄色い線まで動かします。',
            target: '.measure-range-rail',
            allowed: ['.measure-point-marker.end'],
            action: 'play-range-changed',
            matches: (detail) => detail.type === 'end' && detail.measure === 1,
            cardPosition: 'player-top',
            rangeDestinationMeasure: 2,
        }),
        guideStep({
            section: 2,
            title: '再生操作',
            body: '1〜2小節目だけ再生します。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-requested',
            cardPosition: 'player-top',
            advanceDelayMs: PLAYBACK_LISTEN_DELAY_MS,
        }),
        guideStep({
            section: 2,
            title: '再生操作',
            body: '同じボタンで停止します。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-stopped',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 2,
            title: '再生操作',
            body: '右端のつまみを黄色い線へ戻します。',
            target: '.measure-range-rail',
            allowed: ['.measure-point-marker.end'],
            action: 'play-range-changed',
            matches: (detail) => detail.type === 'end' && detail.measure === 3,
            cardPosition: 'player-top',
            rangeDestinationMeasure: 4,
        }),
        guideStep({
            section: 2,
            title: '繰り返し設定',
            body: '3〜4小節目を作ります。',
            target: '.preview-card[data-instrument="drums"]',
            nextLabel: '次のステップへ',
            chapterEnd: true,
            prepare: () => setMeasureSeekExpanded(false),
        }),
        guideStep({
            section: 3,
            title: '繰り返し設定',
            body: '1〜2小節目のドラムを3〜4小節目へ繰り返します。',
            target: '.preview-card[data-instrument="drums"]',
            prepare: () => {
                setMeasureSeekExpanded(false);
                showPreviewMeasure(0);
            },
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 3,
            title: '開始位置を決める',
            body: '1小節目の左端バーをタップします。',
            target: '.preview-card[data-instrument="drums"] .preview-repeat-rail.start',
            allowed: ['.preview-card[data-instrument="drums"] .preview-repeat-rail.start'],
            action: 'repeat-source-started',
            matches: (detail) => detail.sourceStartMeasure === 0 && isTrackType(detail.trackId, 'rhythm'),
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 3,
            title: null,
            body: '2小節目へ移動します。',
            target: '.mb-nav-btn[data-direction="1"]',
            allowed: ['.mb-nav-btn[data-direction="1"]'],
            action: 'measure-changed',
            matches: (detail) => detail.currentMeasure === 1,
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 3,
            title: '終了位置を決める',
            body: '2小節目の右端バーをタップします。',
            target: '.preview-card[data-instrument="drums"] .preview-repeat-rail.end',
            allowed: ['.preview-card[data-instrument="drums"] .preview-repeat-rail.end'],
            action: 'repeat-source-completed',
            matches: (detail) => detail.sourceStartMeasure === 0
                && detail.sourceEndMeasure === 1
                && isTrackType(detail.trackId, 'rhythm'),
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 3,
            title: '繰り返す範囲',
            body: '黄色が繰り返し元の範囲です。',
            target: '.preview-card[data-instrument="drums"]',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 3,
            title: null,
            body: '3小節目へ移動します。',
            target: '.mb-nav-btn[data-direction="1"]',
            allowed: ['.mb-nav-btn[data-direction="1"]'],
            action: 'measure-changed',
            matches: (detail) => detail.currentMeasure === 2,
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 3,
            title: 'トラックを繰り返す',
            body: '右上の繰り返しボタンを押します。',
            target: '.preview-card[data-instrument="drums"] .preview-track-repeat-btn',
            allowed: ['.preview-card[data-instrument="drums"] .preview-track-repeat-btn'],
            action: 'repeat-applied',
            matches: (detail) => detail.targetEndMeasure === 2 && isTrackType(detail.trackId, 'rhythm'),
            icon: repeatLoopIconUrl,
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 3,
            title: null,
            body: '4小節目へ移動します。',
            target: '.mb-nav-btn[data-direction="1"]',
            allowed: ['.mb-nav-btn[data-direction="1"]'],
            action: 'measure-changed',
            matches: (detail) => detail.currentMeasure === 3,
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 3,
            title: 'トラックを繰り返す',
            body: 'もう一度、繰り返しボタンを押します。',
            target: '.preview-card[data-instrument="drums"] .preview-track-repeat-btn',
            allowed: ['.preview-card[data-instrument="drums"] .preview-track-repeat-btn'],
            action: 'repeat-applied',
            matches: (detail) => detail.targetEndMeasure === 3 && isTrackType(detail.trackId, 'rhythm'),
            icon: repeatLoopIconUrl,
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 3,
            title: '繰り返し設定',
            body: '緑が反映済みの範囲です。',
            target: '.preview-card[data-instrument="drums"]',
            nextLabel: '次のステップへ',
            chapterEnd: true,
            cardPosition: 'player-top',
        }),
    ];

    steps.push(guideStep({
        section: 4,
        title: 'コード設定',
        body: 'コードを置いて曲の流れを作ります。',
        target: '.preview-card[data-instrument="chord"]',
        nextLabel: '次へ',
        prepare: () => {
            setMeasureSeekExpanded(false);
            showPreviewMeasure(2);
        },
    }));
    steps.push(guideStep({
        section: 4,
        title: 'コード設定',
        body: '後半をF → C → F → Gにします。',
        target: '.preview-card[data-instrument="chord"]',
    }));
    steps.push(guideStep({
        section: 4,
        title: 'コードエディタを開く',
        body: '「コード / Piano」を開きます。',
        target: '.preview-card[data-instrument="chord"] .preview-card-header',
        allowed: ['.preview-card[data-instrument="chord"] .preview-card-header'],
        action: 'track-selected',
        matches: (detail) => detail.trackType === 'chord',
    }));
    steps.push(guideStep({
        section: 4,
        title: 'コード設定',
        body: '3小節目をF → Cにします。',
        target: '.chord-sequencer-progress',
    }));

    CHORD_EXERCISE.forEach((expected, index) => {
        if (index === 4) {
            steps.push(guideStep({
                section: 4,
                title: 'コード設定',
                body: '次は4小節目をF → Gにします。',
                target: '.chord-sequencer-progress',
            }));
            steps.push(guideStep({
                section: 4,
                title: null,
                body: '4小節目へ移動します。',
                target: '.mb-nav-btn[data-direction="1"]',
                allowed: ['.mb-nav-btn[data-direction="1"]'],
                action: 'measure-changed',
                matches: (detail) => detail.currentMeasure === 3,
            }));
        }

        if (expected.select) {
            steps.push(guideStep({
                section: 4,
                title: 'コードを選ぶ',
                body: `コード選択で${expected.label}を選びます。`,
                target: '.chord-select-input[aria-label="コードトラックのルート"]',
                allowed: ['.chord-select-input[aria-label="コードトラックのルート"]'],
                action: 'chord-selection-changed',
                matches: (detail) => detail.root === expected.root
                    && detail.type === expected.type
                    && isTrackType(detail.trackId, 'chord'),
            }));
        }

        const pairStartBeat = expected.beat % 2 === 0;
        const pairEndBeat = expected.beat + (pairStartBeat ? 2 : 1);
        steps.push(guideStep({
            section: 4,
            title: 'コードを置く',
            body: pairStartBeat
                ? `${expected.label}を${expected.beat + 1}〜${pairEndBeat}拍目に置きます。`
                : `${expected.beat + 1}拍目にも置きます。`,
            target: `.chord-progress-cell[data-step="${expected.measure * STEPS_PER_MEASURE + expected.beat * STEPS_PER_BEAT}"]`,
            allowed: [`.chord-progress-cell[data-step="${expected.measure * STEPS_PER_MEASURE + expected.beat * STEPS_PER_BEAT}"]`],
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
    steps.push(guideStep({
        section: 4,
        title: 'コード設定',
        body: 'コード進行ができました。次は鳴らすタイミングです。',
        target: '.chord-sequencer-progress',
        nextLabel: '次へ',
        cardPosition: 'player-top',
    }));

    steps.push(
        guideStep({
            section: 4,
            title: 'ドラムとコードを合わせる',
            body: '3小節目のコードをKickとSnareに合わせます。',
            target: '.chord-rhythm-summary',
            prepare: () => showTrackMeasure('chord', 2),
        }),
        guideStep({
            section: 4,
            title: 'ドラムを参照する',
            body: '「ドラムを参照」をタップします。',
            target: '.chord-rhythm-summary',
            allowed: ['.chord-rhythm-summary'],
            action: 'chord-drum-reference-opened',
        }),
        guideStep({
            section: 4,
            title: 'キックを選ぶ',
            body: 'Kickにチェックを入れます。',
            target: '.chord-rhythm-row[data-drum-row="Kick"]',
            allowed: ['.chord-rhythm-row[data-drum-row="Kick"]'],
            action: 'chord-drum-row-changed',
            matches: (detail) => detail.rowLabel === 'Kick' && detail.checked,
            cardPosition: 'sheet-top',
        }),
        guideStep({
            section: 4,
            title: 'スネアを選ぶ',
            body: 'Snareにもチェックを入れます。',
            target: '.chord-rhythm-row[data-drum-row="Snare"]',
            allowed: ['.chord-rhythm-row[data-drum-row="Snare"]'],
            action: 'chord-drum-row-changed',
            matches: (detail) => detail.rowLabel === 'Snare' && detail.checked,
            cardPosition: 'sheet-top',
        }),
        guideStep({
            section: 4,
            title: 'ドラムに同期する',
            body: '「同期」でコードをドラムに合わせます。',
            target: '.chord-drum-sheet .chord-sync-all-btn',
            allowed: ['.chord-drum-sheet .chord-sync-all-btn'],
            action: 'chord-drum-synced',
            matches: (detail) => detail.selectedRows?.includes('Kick')
                && detail.selectedRows?.includes('Snare'),
            cardPosition: 'sheet-top',
        }),
        guideStep({
            section: 4,
            title: '同期できました',
            body: '再生して重なりを確認します。',
            target: '[data-play-toggle="true"]',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 4,
            title: '再生する',
            body: '再生ボタンを押します。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-requested',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 4,
            title: '停止する',
            body: '確認したら停止します。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-stopped',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 4,
            title: '重なりを確認できました',
            body: '次は4小節目で鳴らす場所を選びます。',
            target: '[data-play-toggle="true"]',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 4,
            title: null,
            body: '4小節目へ移動します。',
            target: '.mb-nav-btn[data-direction="1"]',
            allowed: ['.mb-nav-btn[data-direction="1"]'],
            action: 'measure-changed',
            matches: (detail) => detail.currentMeasure === 3,
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 4,
            title: '鳴らす場所を選ぶ',
            body: '鳴らしたい場所を1つタップします。',
            target: getChordTimingFirstBeatRect,
            allowed: ['.chord-timing-grid'],
            action: 'chord-sound-added',
            matches: (detail) => detail.step >= 3 * STEPS_PER_MEASURE
                && detail.step < 3 * STEPS_PER_MEASURE + STEPS_PER_BEAT,
        }),
        guideStep({
            section: 4,
            title: 'コード設定',
            body: '次はコードに合わせてメロディを作ります。',
            target: '.chord-timing-grid',
            nextLabel: '次のステップへ',
            chapterEnd: true,
        }),
        guideStep({
            section: 5,
            title: 'メロディ作成',
            body: '次にメロディを編集します。',
            target: '#trackEditor',
            prepare: () => {
                setMeasureSeekExpanded(false);
                showTrackMeasure('melody', 2);
            },
        }),
        guideStep({
            section: 5,
            title: 'メロディ作成',
            body: 'コードトーンには色でガイドがついています。',
            target: MELODY_GUIDE_ROW_SELECTOR,
        }),
        guideStep({
            section: 5,
            title: '音を置く',
            body: '試しにコードトーンに音を置いてみましょう。',
            target: MELODY_GUIDE_ROW_SELECTOR,
            allowed: [MELODY_GUIDE_ROW_SELECTOR],
            action: 'melody-note-added',
            onMatch: (detail) => {
                session.lastMelodyNote = { note: detail.note, step: detail.step };
            },
        }),
        guideStep({
            section: 5,
            title: '音を置けました',
            body: '音を置けました。基本操作は完了です。',
            target: () => melodyNoteSelector(session.lastMelodyNote),
            nextLabel: '完了',
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
        action: config.action || null,
        matches: config.matches || (() => true),
        onMatch: config.onMatch || null,
        substep: config.substep || null,
        icon: config.icon || null,
        nextLabel: config.nextLabel || '次へ',
        chapterEnd: Boolean(config.chapterEnd),
        cardPosition: config.cardPosition || 'bottom',
        rangeDestinationMeasure: config.rangeDestinationMeasure || null,
        highlight: Boolean(config.highlight),
        advanceDelayMs: config.advanceDelayMs || 0,
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
    renderGuideCard(session);
    requestAnimationFrame(() => requestAnimationFrame(() => syncGuideTarget(session)));
    window.clearTimeout(session.targetSyncTimer);
    session.targetSyncTimer = window.setTimeout(() => syncGuideTarget(session), 260);
}

function renderGuideCard(session) {
    const step = session.steps[session.stepIndex];
    if (!step) return;
    const card = session.overlay.querySelector('.onboarding-card');
    const nextBar = session.overlay.querySelector('.onboarding-next-bar');
    const nextButton = nextBar.querySelector('[data-onboarding-next="true"]');
    const waitsForNext = !step.action;
    const waitsForChapterChoice = waitsForNext && step.chapterEnd;
    const hasVisualHighlight = Boolean(step.highlight || step.action);
    card.classList.toggle('is-guide-top', step.cardPosition === 'top');
    card.classList.toggle('is-guide-player-top', step.cardPosition === 'player-top');
    card.classList.toggle('is-guide-drums-anchor', step.cardPosition === 'drums-anchor');
    card.classList.toggle('is-guide-sheet-top', step.cardPosition === 'sheet-top');
    card.classList.toggle('is-guide-editor-lower', step.cardPosition === 'editor-lower');
    session.overlay.classList.toggle('is-guide-waiting-next', waitsForNext);
    session.overlay.classList.toggle('is-guide-chapter-choice', waitsForChapterChoice);
    session.overlay.classList.toggle('is-guide-has-highlight', hasVisualHighlight);
    nextBar.hidden = !waitsForNext || waitsForChapterChoice;
    nextButton.textContent = step.nextLabel;
    card.classList.remove('is-guide-avoid-target');
    card.style.removeProperty('--onboarding-avoid-target-top');
    if (step.cardPosition !== 'player-top') card.style.removeProperty('--onboarding-player-card-bottom');
    if (step.cardPosition !== 'drums-anchor') {
        card.style.removeProperty('--onboarding-drums-card-top');
        session.anchoredCardTop = null;
    }
    if (step.cardPosition !== 'sheet-top') card.style.removeProperty('--onboarding-sheet-card-bottom');
    if (step.cardPosition !== 'editor-lower') card.style.removeProperty('--onboarding-editor-lower-top');
    card.innerHTML = `
        <div class="onboarding-progress" style="--onboarding-progress: ${step.section}"></div>
        ${step.icon ? `<div class="onboarding-guide-icon"><img src="${step.icon}" alt="繰り返し"></div>` : ''}
        <p class="onboarding-description">${step.body}</p>
        ${waitsForChapterChoice ? `
            <div class="onboarding-actions onboarding-actions-split">
                <button type="button" class="onboarding-btn secondary" data-onboarding-finish-section="true">終わる</button>
                <button type="button" class="onboarding-btn primary" data-onboarding-next-section="true">${step.nextLabel}</button>
            </div>
        ` : ''}
    `;
    const next = () => showGuideStep(session, session.stepIndex + 1);
    nextButton.onclick = next;
    card.querySelector('[data-onboarding-finish-section="true"]')?.addEventListener('click', session.dismiss);
    card.querySelector('[data-onboarding-next-section="true"]')?.addEventListener('click', next);
}

function showGuideComplete(session) {
    clearGuideTarget(session);
    const nextBar = session.overlay.querySelector('.onboarding-next-bar');
    nextBar.hidden = true;
    session.overlay.classList.add('is-guide-waiting-next');
    const card = session.overlay.querySelector('.onboarding-card');
    card.innerHTML = `
        <div class="onboarding-progress" style="--onboarding-progress: ${session.sectionCount}"></div>
        <h2 class="onboarding-title">基本操作を体験できました</h2>
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
    if (step.advanceDelayMs > 0) {
        window.clearTimeout(session.targetSyncTimer);
        session.targetSyncTimer = window.setTimeout(() => {
            if (!session.active) return;
            showGuideStep(session, session.stepIndex + 1);
        }, step.advanceDelayMs);
        return;
    }
    showGuideStep(session, session.stepIndex + 1);
}

function blockOutsideInteraction(session, event) {
    if (!session.active) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.onboarding-card')) return;
    if (target.closest('.onboarding-next-bar')) return;

    const step = session.steps[session.stepIndex];
    const selectors = resolveSelectors(step?.allowed);
    if (selectors.some((selector) => selector && target.closest(selector))) {
        return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
}

function syncGuideTarget(session) {
    if (!session.active) return;
    const step = session.steps[session.stepIndex];
    if (!step) return;
    if (!step.action && !step.highlight) {
        clearGuideTarget(session);
        syncGuideCardPosition(session, step);
        avoidExpandedPlayerOverlap(session, step);
        return;
    }
    const rect = resolveTargetRect(step.target);
    if (!rect) {
        clearGuideTarget(session);
        return;
    }

    if (!step.action && !step.highlight) {
        clearGuideTarget(session);
        syncGuideCardPosition(session, step);
        avoidExpandedPlayerOverlap(session, step);
        avoidGuideTargetRectOverlap(session, rect);
        return;
    }

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
    syncGuideCardPosition(session, step);
    avoidExpandedPlayerOverlap(session, step);
    avoidGuideTargetOverlap(session);
    syncRangeDestination(session, step);
}

function clearGuideTarget(session) {
    session.overlay.querySelector('.onboarding-spotlight').hidden = true;
    session.overlay.querySelector('.onboarding-range-destination').hidden = true;
    session.overlay.querySelector('.onboarding-range-arrow').hidden = true;
    session.overlay.querySelectorAll('.onboarding-shade').forEach((shade) => {
        shade.hidden = true;
    });
}

function syncRangeDestination(session, step) {
    const destination = session.overlay.querySelector('.onboarding-range-destination');
    const arrow = session.overlay.querySelector('.onboarding-range-arrow');
    const measure = step.rangeDestinationMeasure;
    const player = document.querySelector('.measure-seek-card.is-expanded');
    const rail = measure && player ? document.querySelector('.measure-range-rail') : null;
    if (!(rail instanceof HTMLElement)) {
        destination.hidden = true;
        arrow.hidden = true;
        return;
    }

    const rect = rail.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, measure / appState.numMeasures));
    const currentEndMeasure = appState.playRangeEndMeasure ?? Math.max(0, appState.numMeasures - 1);
    const fromRatio = Math.max(0, Math.min(1, (currentEndMeasure + 1) / appState.numMeasures));
    const fromX = rect.left + rect.width * fromRatio;
    const toX = rect.left + rect.width * ratio;
    const arrowTop = rect.top + rect.height + 10;
    const arrowLeft = Math.min(fromX, toX);
    const arrowWidth = Math.abs(toX - fromX);
    destination.hidden = false;
    destination.classList.toggle('is-end', ratio >= 0.9);
    Object.assign(destination.style, {
        left: `${rect.left + rect.width * ratio}px`,
        top: `${rect.top - 8}px`,
        height: `${rect.height + 16}px`,
    });
    arrow.hidden = arrowWidth < 12;
    arrow.classList.toggle('is-left', toX < fromX);
    Object.assign(arrow.style, {
        left: `${arrowLeft}px`,
        top: `${arrowTop}px`,
        width: `${Math.max(12, arrowWidth)}px`,
    });
}

function syncGuideCardPosition(session, step) {
    const card = session.overlay.querySelector('.onboarding-card');
    if (step.cardPosition === 'player-top') {
        const player = document.querySelector('.measure-seek-card.is-expanded');
        if (!(player instanceof HTMLElement)) return;
        const playerRect = player.getBoundingClientRect();
        const bottom = Math.max(12, window.innerHeight - playerRect.top + 12);
        card.style.setProperty('--onboarding-player-card-bottom', `${bottom}px`);
        return;
    }

    if (step.cardPosition === 'sheet-top') {
        const sheet = document.querySelector('.chord-drum-sheet');
        if (!(sheet instanceof HTMLElement)) return;
        const sheetRect = sheet.getBoundingClientRect();
        const bottom = Math.max(12, window.innerHeight - sheetRect.top + 12);
        card.style.setProperty('--onboarding-sheet-card-bottom', `${bottom}px`);
        return;
    }

    if (step.cardPosition === 'editor-lower') {
        const top = Math.round(window.innerHeight * 0.48);
        card.style.setProperty('--onboarding-editor-lower-top', `${top}px`);
        return;
    }

    if (step.cardPosition !== 'drums-anchor') return;
    const drumsCard = document.querySelector('.preview-card[data-instrument="drums"]');
    if (drumsCard instanceof HTMLElement) {
        session.anchoredCardTop = drumsCard.getBoundingClientRect().bottom + 12;
    }
    if (session.anchoredCardTop !== null) {
        card.style.setProperty('--onboarding-drums-card-top', `${session.anchoredCardTop}px`);
    }

    return;
}

function avoidExpandedPlayerOverlap(session, step) {
    if (step.cardPosition !== 'bottom') return;
    const card = session.overlay.querySelector('.onboarding-card');
    const player = document.querySelector('.measure-seek-card.is-expanded');
    if (!(player instanceof HTMLElement)) return;
    const cardRect = card.getBoundingClientRect();
    const playerRect = player.getBoundingClientRect();
    if (cardRect.bottom <= playerRect.top) return;

    card.classList.add('is-guide-player-top');
    card.style.setProperty(
        '--onboarding-player-card-bottom',
        `${Math.max(12, window.innerHeight - playerRect.top + 12)}px`
    );
}

function avoidGuideTargetOverlap(session) {
    const card = session.overlay.querySelector('.onboarding-card');
    const spotlight = session.overlay.querySelector('.onboarding-spotlight:not([hidden])');
    if (!(spotlight instanceof HTMLElement)) return;
    const cardRect = card.getBoundingClientRect();
    const targetRect = spotlight.getBoundingClientRect();
    avoidGuideTargetRectOverlap(session, targetRect);
}

function avoidGuideTargetRectOverlap(session, targetRect) {
    const card = session.overlay.querySelector('.onboarding-card');
    const nextBar = session.overlay.querySelector('.onboarding-next-bar:not([hidden])');
    const cardRect = card.getBoundingClientRect();
    const overlaps = cardRect.left < targetRect.right
        && cardRect.right > targetRect.left
        && cardRect.top < targetRect.bottom
        && cardRect.bottom > targetRect.top;
    if (!overlaps) return;

    const player = document.querySelector('.measure-seek-card.is-expanded');
    const nextBarRect = nextBar instanceof HTMLElement ? nextBar.getBoundingClientRect() : null;
    const lowerLimit = nextBarRect
        ? nextBarRect.top - 12
        : player instanceof HTMLElement
        ? player.getBoundingClientRect().top - 12
        : window.innerHeight - 12;
    const aboveTop = targetRect.top - cardRect.height - 12;
    const belowTop = targetRect.bottom + 12;
    const maxTop = Math.max(12, lowerLimit - cardRect.height);
    const nextTop = aboveTop >= 12
        ? Math.min(aboveTop, maxTop)
        : (belowTop + cardRect.height <= lowerLimit ? belowTop : 12);

    card.classList.add('is-guide-avoid-target');
    card.style.setProperty('--onboarding-avoid-target-top', `${nextTop}px`);
}

function positionGuideCardNearRect(session, targetRect) {
    const card = session.overlay.querySelector('.onboarding-card');
    const nextBar = session.overlay.querySelector('.onboarding-next-bar:not([hidden])');
    const cardRect = card.getBoundingClientRect();
    const nextBarRect = nextBar instanceof HTMLElement ? nextBar.getBoundingClientRect() : null;
    const lowerLimit = nextBarRect ? nextBarRect.top - 12 : window.innerHeight - 12;
    const belowTop = targetRect.bottom + 12;
    const aboveTop = targetRect.top - cardRect.height - 12;
    const maxTop = Math.max(12, lowerLimit - cardRect.height);
    const nextTop = belowTop + cardRect.height <= lowerLimit
        ? belowTop
        : Math.max(12, Math.min(aboveTop, maxTop));

    card.classList.add('is-guide-avoid-target');
    card.style.setProperty('--onboarding-avoid-target-top', `${nextTop}px`);
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
    window.clearTimeout(session.targetSyncTimer);
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

function resolveTargetRect(target) {
    const resolved = typeof target === 'function' ? target() : target;
    if (isRectLike(resolved)) return resolved;

    const selectors = Array.isArray(resolved) ? resolved : [resolved];
    const rects = selectors
        .filter(Boolean)
        .map((selector) => document.querySelector(selector))
        .filter((element) => element instanceof HTMLElement)
        .map((element) => element.getBoundingClientRect());
    return combineRects(rects);
}

function getElementsRect(selector) {
    return combineRects([...document.querySelectorAll(selector)]
        .filter((element) => element instanceof HTMLElement)
        .map((element) => element.getBoundingClientRect()));
}

function getPreviewCardsRectAbovePlayer() {
    const rect = getElementsRect('.preview-card');
    if (!rect) return null;

    const player = document.querySelector('.measure-seek-card');
    if (!(player instanceof HTMLElement)) return rect;

    const playerRect = player.getBoundingClientRect();
    const maxBottom = playerRect.top - TARGET_PADDING - PLAYER_HIGHLIGHT_GAP;
    return {
        ...rect,
        bottom: Math.max(rect.top, Math.min(rect.bottom, maxBottom)),
    };
}

function getChordTimingFirstBeatRect() {
    const grid = document.querySelector('.chord-timing-grid');
    if (!(grid instanceof HTMLElement)) return null;
    const rect = grid.getBoundingClientRect();
    const beatWidth = rect.width * (STEPS_PER_BEAT / STEPS_PER_MEASURE);
    return {
        left: rect.left,
        top: rect.top,
        right: rect.left + beatWidth,
        bottom: rect.bottom,
        width: beatWidth,
        height: rect.height,
    };
}

function combineRects(rects) {
    if (!rects.length) return null;
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return {
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
    };
}

function isRectLike(value) {
    return value
        && Number.isFinite(value.left)
        && Number.isFinite(value.top)
        && Number.isFinite(value.right)
        && Number.isFinite(value.bottom);
}

function resolveSelectors(selectors) {
    const resolved = typeof selectors === 'function' ? selectors() : selectors;
    return (Array.isArray(resolved) ? resolved : [resolved]).filter(Boolean);
}

function melodyNoteSelector(note) {
    if (!note) return '.melody-grid-note';
    return `.melody-grid-note[data-note="${note.note}"][data-step="${note.step}"]`;
}
