const NOTICE_ID = 'saveErrorNotice';
const NOTICE_WIDTH_PX = 420;
const NOTICE_SIDE_GAP_PX = 16;
const NOTICE_BOTTOM_GAP_PX = 16;
const NOTICE_ACTION_HEIGHT_PX = 44;

function getNotice() {
    return document.getElementById(NOTICE_ID);
}

export function hideSaveErrorNotice() {
    getNotice()?.remove();
}

export function showSaveErrorNotice({ onExport } = {}) {
    const existing = getNotice();
    if (existing) return;

    const notice = document.createElement('section');
    notice.id = NOTICE_ID;
    notice.className = 'save-error-notice';
    notice.setAttribute('role', 'alert');
    notice.style.setProperty('--save-error-max-width', `${NOTICE_WIDTH_PX}px`);
    notice.style.setProperty('--save-error-side-gap', `${NOTICE_SIDE_GAP_PX}px`);
    notice.style.setProperty('--save-error-bottom-gap', `${NOTICE_BOTTOM_GAP_PX}px`);
    notice.style.setProperty('--save-error-action-height', `${NOTICE_ACTION_HEIGHT_PX}px`);

    const heading = document.createElement('div');
    heading.className = 'save-error-notice-heading';

    const title = document.createElement('strong');
    title.textContent = '保存できませんでした';

    const closeButton = document.createElement('button');
    closeButton.className = 'save-error-notice-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', '保存エラーを閉じる');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', hideSaveErrorNotice);

    heading.append(title, closeButton);

    const message = document.createElement('p');
    message.textContent = '空き容量やブラウザの保存設定を確認してください。';

    const exportButton = document.createElement('button');
    exportButton.className = 'save-error-notice-export';
    exportButton.type = 'button';
    exportButton.textContent = 'JSONを書き出す';
    exportButton.addEventListener('click', () => {
        void onExport?.();
    });

    notice.append(heading, message, exportButton);
    document.body.appendChild(notice);
}
