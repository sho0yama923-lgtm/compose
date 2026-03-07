import { openSidebar } from './track-drawer.js';

const ONBOARDING_KEY = 'compose_mobile_onboarding_v1';

export function initOnboarding() {
    if (localStorage.getItem(ONBOARDING_KEY) === 'seen') return;

    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.innerHTML = `
        <div class="onboarding-card">
            <div class="onboarding-kicker">はじめての操作</div>
            <h2 class="onboarding-title">スマホで迷わず作る</h2>
            <div class="onboarding-points">
                <div class="onboarding-point">
                    <strong>1. 左上メニュー</strong>
                    <span>トラックの切替、追加、保存、読込はここです。</span>
                </div>
                <div class="onboarding-point">
                    <strong>2. 中央のグリッド</strong>
                    <span>タップでノートを置きます。再生中は赤い線が動きます。</span>
                </div>
                <div class="onboarding-point">
                    <strong>3. 下のバー</strong>
                    <span>小節移動、範囲再生、追加削除をまとめています。</span>
                </div>
            </div>
            <div class="onboarding-actions">
                <button type="button" class="onboarding-btn secondary" id="onboardingMenuBtn">メニューを見る</button>
                <button type="button" class="onboarding-btn primary" id="onboardingCloseBtn">はじめる</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const dismiss = () => {
        localStorage.setItem(ONBOARDING_KEY, 'seen');
        overlay.remove();
    };

    overlay.querySelector('#onboardingCloseBtn').addEventListener('click', dismiss);
    overlay.querySelector('#onboardingMenuBtn').addEventListener('click', () => {
        dismiss();
        openSidebar();
    });
}
