import { appState, callbacks, STEPS_PER_BEAT, STEPS_PER_MEASURE } from '../core/state.js';
import { TUTORIAL_ACTION_EVENT } from '../core/tutorial-events.js';
import { INST_TYPE } from '../features/tracks/instrument-map.js';
import { setMeasureSeekExpanded } from './bottom-bar.js';
import repeatLoopIconUrl from '../assets/repeat_loop_icon.svg';

const ONBOARDING_KEY = 'compose_mobile_onboarding_v4';
const GUIDE_SECTION_COUNT = 6;
const TARGET_PADDING = 6;
const MELODY_GUIDE_ROW_SELECTOR = '.melody-grid-row.has-chord-tone';
const PLAYBACK_LISTEN_DELAY_MS = 2000;

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
            <div class="onboarding-kicker">はじめての方へ</div>
            <h2 class="onboarding-title">操作説明を受けますか？</h2>
            <p class="onboarding-description">再生、繰り返し、コード、メロディの基本を体験します。</p>
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
        targetSyncTimer: null,
        anchoredCardTop: null,
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
            title: '画面の説明',
            body: 'まず、画面の説明をします。',
            target: '#trackEditor',
            prepare: () => {
                showPreviewMeasure(0);
                setMeasureSeekExpanded(false);
            },
        }),
        guideStep({
            section: 1,
            title: '上部エリア',
            body: '上部では、表示するトラックの切り替え、BPM、曲のルートやスケールを確認できます。',
            target: ['.topbar', '.preview-song-settings'],
            highlight: true,
        }),
        guideStep({
            section: 1,
            title: 'トラックエリア',
            body: '中央のトラックエリアには、ドラムやコードなどのトラックが並びます。ここで、それぞれのトラックに何が入っているか確認できます。',
            target: () => getElementsRect('.preview-card'),
            highlight: true,
            cardPosition: 'top',
        }),
        guideStep({
            section: 1,
            title: '再生エリア',
            body: '最後に、下部では曲の再生、停止、小節移動、再生範囲の変更ができます。',
            target: '.measure-seek-card',
            highlight: true,
        }),
        guideStep({
            section: 1,
            title: 'トラックの詳細を見る',
            body: 'トラックをタップすると、そのトラックの編集画面を開けます。まず、Drumsを開いてみましょう！',
            target: '.preview-card[data-instrument="drums"] .preview-card-header',
            allowed: ['.preview-card[data-instrument="drums"] .preview-card-header'],
            action: 'track-selected',
            matches: (detail) => detail.trackType === 'rhythm',
            cardPosition: 'drums-anchor',
        }),
        guideStep({
            section: 1,
            title: 'エディタ画面',
            body: 'ここでは、どこで音を鳴らすかを決めます。',
            target: '.drum-editor',
            cardPosition: 'editor-lower',
        }),
        guideStep({
            section: 1,
            title: '1小節の見方',
            body: '1画面には1小節分が表示されます。通常のリズムでは、1小節が16分割されています。',
            target: '.timeline-header',
            highlight: true,
            cardPosition: 'editor-lower',
        }),
        guideStep({
            section: 1,
            title: '音の長さ',
            body: '音符のボタンでは、これから置く音の長さを選びます。',
            target: '.duration-toolbar',
            highlight: true,
            cardPosition: 'editor-lower',
        }),
        guideStep({
            section: 1,
            title: '音を置く場所',
            body: 'グリッドでは、どの音をどのタイミングで鳴らすかを決めます。',
            target: '.drum-roll-scroll',
            highlight: true,
            cardPosition: 'editor-lower',
        }),
        guideStep({
            section: 1,
            title: '全体画面へ戻る',
            body: 'エディタ画面の説明は以上です。トラック全体の画面に戻りましょう！',
            target: '#viewToggleBtn',
            allowed: ['#viewToggleBtn'],
            action: 'preview-view-opened',
            cardPosition: 'drums-anchor',
        }),
        guideStep({
            section: 2,
            title: 'ミュート操作',
            body: '次は、トラックの音をオン・オフする操作を試してみましょう。',
            target: '.preview-card[data-instrument="drums"]',
            cardPosition: 'drums-anchor',
        }),
        guideStep({
            section: 2,
            title: 'ミュート操作',
            body: 'トラック左上のチェックで、そのトラックの音をオン・オフできます。まず、Drumsのチェックを外してみましょう！',
            target: '.preview-card[data-instrument="drums"] .preview-track-toggle',
            allowed: ['.preview-card[data-instrument="drums"] .preview-track-toggle'],
            action: 'track-muted-changed',
            matches: (detail) => detail.trackType === 'rhythm' && detail.muted,
            cardPosition: 'drums-anchor',
        }),
        guideStep({
            section: 2,
            title: 'ミュート操作',
            body: '次に、もう一度チェックを入れてドラムの音を戻しましょう！',
            target: '.preview-card[data-instrument="drums"] .preview-track-toggle',
            allowed: ['.preview-card[data-instrument="drums"] .preview-track-toggle'],
            action: 'track-muted-changed',
            matches: (detail) => detail.trackType === 'rhythm' && !detail.muted,
            cardPosition: 'drums-anchor',
        }),
        guideStep({
            section: 3,
            title: '再生操作',
            body: '次は、曲の再生と停止を試してみましょう。',
            target: '[data-play-toggle="true"]',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 3,
            title: '再生操作',
            body: '再生ボタンを押して、曲を聴いてみましょう！',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-requested',
            advanceDelayMs: PLAYBACK_LISTEN_DELAY_MS,
        }),
        guideStep({
            section: 3,
            title: '再生操作',
            body: '少し聴いたら、同じボタンを押して停止しましょう。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-stopped',
        }),
        guideStep({
            section: 3,
            title: '再生操作',
            body: '次は、再生する範囲を変えてみましょう。',
            target: '.measure-seek-card',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 3,
            title: '再生操作',
            body: '下部の再生エリアにある小さなつまみをタップして、再生範囲の操作を表示します。',
            target: '.measure-seek-handle',
            allowed: ['.measure-seek-handle'],
            action: 'seek-bar-expanded',
        }),
        guideStep({
            section: 3,
            title: '再生操作',
            body: '青いバーが再生範囲です。右端の青いつまみが、再生を終える位置です。黄色い「ここまで」の線まで動かしてみましょう！',
            target: '.measure-range-rail',
            allowed: ['.measure-point-marker.end'],
            action: 'play-range-changed',
            matches: (detail) => detail.type === 'end' && detail.measure === 1,
            cardPosition: 'player-top',
            rangeDestinationMeasure: 2,
        }),
        guideStep({
            section: 3,
            title: '再生操作',
            body: '再生範囲が1〜2小節目になりました。再生ボタンを押して、狭めた範囲を聴いてみましょう！',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-requested',
            cardPosition: 'player-top',
            advanceDelayMs: PLAYBACK_LISTEN_DELAY_MS,
        }),
        guideStep({
            section: 3,
            title: '再生操作',
            body: '少し聴いたら、同じボタンを押して停止しましょう。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-stopped',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 3,
            title: '再生操作',
            body: '最後に、右端の青いつまみを黄色い「ここまで」の線まで動かし、再生範囲を1〜4小節目へ戻しましょう。',
            target: '.measure-range-rail',
            allowed: ['.measure-point-marker.end'],
            action: 'play-range-changed',
            matches: (detail) => detail.type === 'end' && detail.measure === 3,
            cardPosition: 'player-top',
            rangeDestinationMeasure: 4,
        }),
        guideStep({
            section: 3,
            title: '繰り返し設定',
            body: 'ここからは、残りの3〜4小節を実際に作っていきます。',
            target: '.preview-card[data-instrument="drums"]',
            nextLabel: '次のステップへ',
            prepare: () => setMeasureSeekExpanded(false),
        }),
        guideStep({
            section: 4,
            title: '繰り返し設定',
            body: '1〜2小節目のドラムを、3〜4小節目まで繰り返してみましょう！',
            target: '.preview-card[data-instrument="drums"]',
            prepare: () => {
                setMeasureSeekExpanded(false);
                showPreviewMeasure(0);
            },
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 4,
            title: '開始位置を決める',
            body: 'まず、繰り返す元になる範囲の開始位置を決めます。1小節目の左端のバーをタップしてみましょう！',
            target: '.preview-card[data-instrument="drums"] .preview-repeat-rail.start',
            allowed: ['.preview-card[data-instrument="drums"] .preview-repeat-rail.start'],
            action: 'repeat-source-started',
            matches: (detail) => detail.sourceStartMeasure === 0 && isTrackType(detail.trackId, 'rhythm'),
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 4,
            title: null,
            body: '次に、繰り返す元になる範囲の終了位置を決めます。2小節目に移動しましょう。',
            target: '.mb-nav-btn[data-direction="1"]',
            allowed: ['.mb-nav-btn[data-direction="1"]'],
            action: 'measure-changed',
            matches: (detail) => detail.currentMeasure === 1,
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 4,
            title: '終了位置を決める',
            body: '2小節目の右端のバーをタップしてみましょう！',
            target: '.preview-card[data-instrument="drums"] .preview-repeat-rail.end',
            allowed: ['.preview-card[data-instrument="drums"] .preview-repeat-rail.end'],
            action: 'repeat-source-completed',
            matches: (detail) => detail.sourceStartMeasure === 0
                && detail.sourceEndMeasure === 1
                && isTrackType(detail.trackId, 'rhythm'),
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 4,
            title: '繰り返す範囲',
            body: '繰り返す元の範囲が黄色で表示されました。この1〜2小節目を、後ろの小節へ繰り返します。',
            target: '.preview-card[data-instrument="drums"]',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 4,
            title: null,
            body: '次は、どこまで繰り返すかを決めます。3小節目に移動しましょう。',
            target: '.mb-nav-btn[data-direction="1"]',
            allowed: ['.mb-nav-btn[data-direction="1"]'],
            action: 'measure-changed',
            matches: (detail) => detail.currentMeasure === 2,
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 4,
            title: 'トラックを繰り返す',
            body: 'トラック右上の繰り返しボタンを押すと、黄色の範囲が今の小節まで繰り返されます。押してみましょう！',
            target: '.preview-card[data-instrument="drums"] .preview-track-repeat-btn',
            allowed: ['.preview-card[data-instrument="drums"] .preview-track-repeat-btn'],
            action: 'repeat-applied',
            matches: (detail) => detail.targetEndMeasure === 2 && isTrackType(detail.trackId, 'rhythm'),
            icon: repeatLoopIconUrl,
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 4,
            title: null,
            body: '次に、4小節目へ移動しましょう。',
            target: '.mb-nav-btn[data-direction="1"]',
            allowed: ['.mb-nav-btn[data-direction="1"]'],
            action: 'measure-changed',
            matches: (detail) => detail.currentMeasure === 3,
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 4,
            title: 'トラックを繰り返す',
            body: 'もう一度、繰り返しボタンを押してみましょう！',
            target: '.preview-card[data-instrument="drums"] .preview-track-repeat-btn',
            allowed: ['.preview-card[data-instrument="drums"] .preview-track-repeat-btn'],
            action: 'repeat-applied',
            matches: (detail) => detail.targetEndMeasure === 3 && isTrackType(detail.trackId, 'rhythm'),
            icon: repeatLoopIconUrl,
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 4,
            title: '繰り返し設定',
            body: '繰り返しが入った小節は緑色で表示されます。これで、1〜2小節目のドラムを3〜4小節目まで使えるようになりました！',
            target: '.preview-card[data-instrument="drums"]',
            nextLabel: '次のステップへ',
            cardPosition: 'player-top',
        }),
    ];

    steps.push(guideStep({
        section: 5,
        title: 'コード設定',
        body: '次は、コードを置いて曲の流れを作ってみましょう。',
        target: '.preview-card[data-instrument="chord"]',
        nextLabel: '次へ',
        prepare: () => {
            setMeasureSeekExpanded(false);
            showPreviewMeasure(2);
        },
    }));
    steps.push(guideStep({
        section: 5,
        title: 'コード設定',
        body: '前半にはC → G → Am → Emのコードが入っています。ここでは後半をF → C → F → Gにして、カノン進行を完成させます。',
        target: '.preview-card[data-instrument="chord"]',
    }));
    steps.push(guideStep({
        section: 5,
        title: 'コードエディタを開く',
        body: 'まず、「コード / Piano」を開きましょう！',
        target: '.preview-card[data-instrument="chord"] .preview-card-header',
        allowed: ['.preview-card[data-instrument="chord"] .preview-card-header'],
        action: 'track-selected',
        matches: (detail) => detail.trackType === 'chord',
    }));
    steps.push(guideStep({
        section: 5,
        title: 'コード設定',
        body: '3小節目をF → Cにします。',
        target: '.chord-sequencer-progress',
    }));

    CHORD_EXERCISE.forEach((expected, index) => {
        if (index === 4) {
            steps.push(guideStep({
                section: 5,
                title: 'コード設定',
                body: '3小節目がF → Cになりました。次は、4小節目をF → Gにします。',
                target: '.chord-sequencer-progress',
            }));
            steps.push(guideStep({
                section: 5,
                title: null,
                body: 'まず、4小節目へ移動しましょう。',
                target: '.mb-nav-btn[data-direction="1"]',
                allowed: ['.mb-nav-btn[data-direction="1"]'],
                action: 'measure-changed',
                matches: (detail) => detail.currentMeasure === 3,
            }));
        }

        if (expected.select) {
            const orderWord = index === 0 ? 'まず' : index === 2 ? '次に' : index === 6 ? '最後に' : '';
            const prefix = orderWord ? `${orderWord}、` : '';
            steps.push(guideStep({
                section: 5,
                title: 'コードを選ぶ',
                body: `${prefix}上のコード選択で${expected.label}を選びます。`,
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
            section: 5,
            title: 'コードを置く',
            body: pairStartBeat
                ? `${expected.label}を${expected.beat + 1}〜${pairEndBeat}拍目に置きます。${expected.beat + 1}拍目をタップしましょう！`
                : `続けて、${expected.beat + 1}拍目をタップしましょう！`,
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
        section: 5,
        title: 'コード設定',
        body: '後半がF → C → F → Gになりました。これでコード進行がつながりました！次は、コードを鳴らすタイミングを決めてみましょう。',
        target: '.chord-sequencer-progress',
        nextLabel: '次へ',
        cardPosition: 'player-top',
    }));

    steps.push(
        guideStep({
            section: 5,
            title: 'キックとコードを合わせる',
            body: 'キックとコードを同じタイミングで鳴らすと、リズムにまとまりが生まれます。まず、3小節目のコードをキックに合わせてみましょう！',
            target: '.chord-rhythm-summary',
            prepare: () => showTrackMeasure('chord', 2),
        }),
        guideStep({
            section: 5,
            title: 'ドラムを参照する',
            body: 'まず、ドラムのリズムを見るために「ドラムを参照」をタップしましょう！',
            target: '.chord-rhythm-summary',
            allowed: ['.chord-rhythm-summary'],
            action: 'chord-drum-reference-opened',
        }),
        guideStep({
            section: 5,
            title: 'キックを選ぶ',
            body: '次に、Kick（キック）にチェックを入れましょう！',
            target: '.chord-rhythm-row[data-drum-row="Kick"]',
            allowed: ['.chord-rhythm-row[data-drum-row="Kick"]'],
            action: 'chord-drum-row-changed',
            matches: (detail) => detail.rowLabel === 'Kick' && detail.checked,
            cardPosition: 'sheet-top',
        }),
        guideStep({
            section: 5,
            title: 'キックに同期する',
            body: '最後に「同期」を押すと、キックと同じ位置でコードが鳴るようになります！',
            target: '.chord-drum-sheet .chord-sync-all-btn',
            allowed: ['.chord-drum-sheet .chord-sync-all-btn'],
            action: 'chord-drum-synced',
            matches: (detail) => detail.selectedRows?.includes('Kick'),
            cardPosition: 'sheet-top',
        }),
        guideStep({
            section: 5,
            title: '同期できました',
            body: '3小節目のコードが、キックと同じタイミングで鳴るようになりました。再生して確認してみましょう。',
            target: '[data-play-toggle="true"]',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 5,
            title: '再生する',
            body: '再生ボタンを押して、キックとコードが重なるところを聴いてみましょう！',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-requested',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 5,
            title: '停止する',
            body: '確認できたら停止しましょう。',
            target: '[data-play-toggle="true"]',
            allowed: ['[data-play-toggle="true"]'],
            action: 'playback-stopped',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 5,
            title: '重なりを確認できました',
            body: '3小節目では、キックに合わせてコードを鳴らせました。次は4小節目で、自分で鳴らす場所を選んでみましょう。',
            target: '[data-play-toggle="true"]',
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 5,
            title: null,
            body: 'まず、4小節目へ移動しましょう。',
            target: '.mb-nav-btn[data-direction="1"]',
            allowed: ['.mb-nav-btn[data-direction="1"]'],
            action: 'measure-changed',
            matches: (detail) => detail.currentMeasure === 3,
            cardPosition: 'player-top',
        }),
        guideStep({
            section: 5,
            title: '鳴らす場所を選ぶ',
            body: '4小節目でコードを鳴らしたい場所を一つタップしてみましょう！',
            target: '.chord-timing-grid',
            allowed: ['.chord-timing-grid'],
            action: 'chord-sound-added',
            matches: (detail) => Math.floor(detail.step / STEPS_PER_MEASURE) === 3,
        }),
        guideStep({
            section: 5,
            title: 'コード設定',
            body: 'コード進行と、コードを鳴らすタイミングを設定できました！次は、コードに合わせてメロディを作ってみましょう。',
            target: '.chord-timing-grid',
            nextLabel: '次のステップへ',
        }),
        guideStep({
            section: 6,
            title: 'メロディ作成',
            body: '最後に、コードに合わせてメロディを作ります。色が付いたコードトーンを使うと、曲になじみやすくなります。',
            target: MELODY_GUIDE_ROW_SELECTOR,
            prepare: () => {
                setMeasureSeekExpanded(false);
                showTrackMeasure('melody', 2);
            },
        }),
        guideStep({
            section: 6,
            title: '音を置く',
            body: 'まず、色が付いたコードトーンから一つ選んで置いてみましょう！',
            target: MELODY_GUIDE_ROW_SELECTOR,
            allowed: [MELODY_GUIDE_ROW_SELECTOR],
            action: 'melody-note-added',
            onMatch: (detail) => {
                session.lastMelodyNote = { note: detail.note, step: detail.step };
            },
        }),
        guideStep({
            section: 6,
            title: '音を置けました',
            body: '音を置けました。次は、置いた音を移動してみましょう。',
            target: () => melodyNoteSelector(session.lastMelodyNote),
        }),
        guideStep({
            section: 6,
            title: '音を移動する',
            body: '音の高さやタイミングを変えたいときは、長押しして移動できます。置いた音を長押しして、上下または左右へ動かしてみましょう！',
            target: () => melodyNoteSelector(session.lastMelodyNote),
            allowed: () => [melodyNoteSelector(session.lastMelodyNote), '.melody-roll-content'],
            action: 'melody-note-moved',
            matches: (detail) => detail.sourceNote === session.lastMelodyNote?.note
                && detail.sourceStep === session.lastMelodyNote?.step,
            onMatch: (detail) => {
                session.lastMelodyNote = { note: detail.targetNote, step: detail.targetStep };
            },
        }),
        guideStep({
            section: 6,
            title: '音を移動できました',
            body: '音を移動できました。最後に、いらない音を削除してみましょう。',
            target: () => melodyNoteSelector(session.lastMelodyNote),
        }),
        guideStep({
            section: 6,
            title: '音を削除する',
            body: '音を置き直したいときは削除できます。移動した音をタップして削除してみましょう！',
            target: () => melodyNoteSelector(session.lastMelodyNote),
            allowed: () => [melodyNoteSelector(session.lastMelodyNote)],
            action: 'melody-note-removed',
            matches: (detail) => isSameMelodyNote(detail, session.lastMelodyNote),
        }),
        guideStep({
            section: 6,
            title: 'メロディ作成',
            body: '音の配置、移動、削除ができました。これで基本的な作曲の流れは完了です！',
            target: MELODY_GUIDE_ROW_SELECTOR,
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
    const hasVisualHighlight = Boolean(step.highlight || step.action);
    card.classList.toggle('is-guide-top', step.cardPosition === 'top');
    card.classList.toggle('is-guide-player-top', step.cardPosition === 'player-top');
    card.classList.toggle('is-guide-drums-anchor', step.cardPosition === 'drums-anchor');
    card.classList.toggle('is-guide-sheet-top', step.cardPosition === 'sheet-top');
    card.classList.toggle('is-guide-editor-lower', step.cardPosition === 'editor-lower');
    session.overlay.classList.toggle('is-guide-waiting-next', waitsForNext);
    session.overlay.classList.toggle('is-guide-has-highlight', hasVisualHighlight);
    nextBar.hidden = !waitsForNext;
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
        <div class="onboarding-kicker">${step.section} / ${GUIDE_SECTION_COUNT}${step.substep ? ` ・ ${step.substep}` : ''}</div>
        ${step.title ? `<h2 class="onboarding-title">${step.title}</h2>` : ''}
        ${step.icon ? `<div class="onboarding-guide-icon"><img src="${step.icon}" alt="繰り返し"></div>` : ''}
        <p class="onboarding-description">${step.body}</p>
    `;
    nextButton.onclick = () => {
        showGuideStep(session, session.stepIndex + 1);
    };
}

function showGuideComplete(session) {
    clearGuideTarget(session);
    const nextBar = session.overlay.querySelector('.onboarding-next-bar');
    nextBar.hidden = true;
    session.overlay.classList.add('is-guide-waiting-next');
    const card = session.overlay.querySelector('.onboarding-card');
    card.innerHTML = `
        <div class="onboarding-progress" style="--onboarding-progress: ${GUIDE_SECTION_COUNT}"></div>
        <div class="onboarding-kicker">完了</div>
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

function isSameMelodyNote(detail, note) {
    return detail.note === note?.note && detail.step === note?.step;
}
