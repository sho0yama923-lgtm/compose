import { appState, callbacks } from '../core/state.js';
import { INST_TYPE } from '../features/tracks/instrument-map.js';

const ONBOARDING_KEY = 'compose_mobile_onboarding_v2';
const GUIDE_STEPS = [
    {
        kicker: '1 / 3',
        title: 'まず曲全体を聴く',
        body: '下の再生ボタンで、カノン進行にドラムとメロディを重ねたサンプルを確認できます。',
        target: '[data-play-toggle="true"]',
        prepare() {
            appState.previewMode = true;
            callbacks.renderEditor?.();
        },
    },
    {
        kicker: '2 / 3',
        title: 'コードが曲の流れを作る',
        body: 'このサンプルは C → G → Am → Em → F → C → F → G の順です。色の付いたコードを変えると、曲全体の雰囲気が変わります。',
        target: '.chord-sequencer-grid',
        prepare() {
            const track = appState.tracks.find((item) => INST_TYPE[item.instrument] === 'chord');
            if (!track) return;
            appState.activeTrackId = track.id;
            appState.lastTouchedTrackId = track.id;
            appState.previewMode = false;
            callbacks.renderEditor?.();
        },
    },
    {
        kicker: '3 / 3',
        title: 'メロディを自分の形にする',
        body: 'コードに合う単純なメロディを入れています。音の長さや高さを変えて、自分の曲へ育ててみてください。',
        target: '.melody-roll-content',
        prepare() {
            const track = appState.tracks.find((item) => INST_TYPE[item.instrument] === 'melody');
            if (!track) return;
            appState.activeTrackId = track.id;
            appState.lastTouchedTrackId = track.id;
            appState.previewMode = false;
            callbacks.renderEditor?.();
        },
    },
];

export function initOnboarding() {
    if (localStorage.getItem(ONBOARDING_KEY) === 'seen') return;

    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.innerHTML = `
        <div class="onboarding-card">
            <div class="onboarding-kicker">はじめての方へ</div>
            <h2 class="onboarding-title">操作説明を受けますか？</h2>
            <p class="onboarding-description">最初から入っているカノン進行のサンプルを使って、曲の見方を3段階で案内します。</p>
            <div class="onboarding-actions">
                <button type="button" class="onboarding-btn secondary" data-onboarding-skip="true">今はしない</button>
                <button type="button" class="onboarding-btn primary" data-onboarding-start="true">説明を見る</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const dismiss = () => {
        clearGuideTarget();
        localStorage.setItem(ONBOARDING_KEY, 'seen');
        overlay.remove();
    };

    overlay.querySelector('[data-onboarding-skip="true"]').addEventListener('click', dismiss);
    overlay.querySelector('[data-onboarding-start="true"]').addEventListener('click', () => {
        showGuideStep(overlay, 0, dismiss);
    });
}

function clearGuideTarget() {
    document.querySelectorAll('.onboarding-guide-target').forEach((element) => {
        element.classList.remove('onboarding-guide-target');
    });
}

function showGuideStep(overlay, stepIndex, dismiss) {
    clearGuideTarget();
    const step = GUIDE_STEPS[stepIndex];
    step.prepare();

    requestAnimationFrame(() => {
        document.querySelector(step.target)?.classList.add('onboarding-guide-target');
    });

    const isLast = stepIndex === GUIDE_STEPS.length - 1;
    overlay.innerHTML = `
        <div class="onboarding-card onboarding-guide-card">
            <div class="onboarding-progress" style="--onboarding-progress: ${stepIndex + 1}"></div>
            <div class="onboarding-kicker">${step.kicker}</div>
            <h2 class="onboarding-title">${step.title}</h2>
            <p class="onboarding-description">${step.body}</p>
            <div class="onboarding-actions">
                <button type="button" class="onboarding-btn secondary" data-onboarding-close="true">終了</button>
                <button type="button" class="onboarding-btn primary" data-onboarding-next="true">${isLast ? '作曲を始める' : '次へ'}</button>
            </div>
        </div>
    `;
    overlay.querySelector('[data-onboarding-close="true"]').addEventListener('click', dismiss);
    overlay.querySelector('[data-onboarding-next="true"]').addEventListener('click', () => {
        if (isLast) {
            dismiss();
            return;
        }
        showGuideStep(overlay, stepIndex + 1, dismiss);
    });
}
