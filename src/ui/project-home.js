import { APP_VERSION } from '../core/app-info.js';
import { appState } from '../core/state.js';

function formatProjectUpdatedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hour}:${minute}`;
}

function createProjectCard(project, handlers) {
    const item = document.createElement('li');
    item.className = 'project-home-item';
    item.classList.toggle('is-selecting', appState.projectSelectionMode);

    const openButton = document.createElement('button');
    openButton.className = 'project-home-card';
    openButton.type = 'button';
    const selected = appState.selectedProjectIds.includes(project.id);
    if (appState.projectSelectionMode) {
        openButton.classList.toggle('is-selected', selected);
        openButton.setAttribute('aria-pressed', String(selected));
    }
    openButton.innerHTML = `
        ${appState.projectSelectionMode ? '<span class="project-home-check" aria-hidden="true"></span>' : ''}
        <span class="project-home-card-title"></span>
        <span class="project-home-card-meta"></span>
        ${appState.projectSelectionMode ? '' : '<span class="project-home-card-chevron" aria-hidden="true">›</span>'}
    `;
    openButton.querySelector('.project-home-card-title').textContent = project.name;
    openButton.querySelector('.project-home-card-meta').textContent = `最終更新 ${formatProjectUpdatedAt(project.updatedAt)}`;
    openButton.addEventListener('click', () => {
        if (appState.projectSelectionMode) {
            handlers.onToggleProjectSelection(project.id);
            return;
        }
        handlers.onOpenProject(project.id);
    });

    const tools = document.createElement('div');
    tools.className = 'project-home-card-tools';

    const menuTrigger = document.createElement('button');
    menuTrigger.className = 'project-home-icon-btn project-home-card-menu-trigger';
    menuTrigger.type = 'button';
    menuTrigger.setAttribute('aria-label', `${project.name} の操作`);
    menuTrigger.setAttribute('aria-expanded', 'false');
    menuTrigger.textContent = '…';

    const menu = document.createElement('div');
    menu.className = 'project-home-card-menu';
    menu.hidden = true;

    const closeMenu = () => {
        menu.hidden = true;
        menuTrigger.setAttribute('aria-expanded', 'false');
    };
    menuTrigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const nextOpen = menu.hidden;
        item.dispatchEvent(new CustomEvent('project-card-menu-open', {
            bubbles: true,
            detail: { currentMenu: menu },
        }));
        menu.hidden = !nextOpen;
        menuTrigger.setAttribute('aria-expanded', String(nextOpen));
    });

    const renameButton = document.createElement('button');
    renameButton.className = 'project-home-icon-btn';
    renameButton.type = 'button';
    renameButton.setAttribute('aria-label', `${project.name} の名前を変更`);
    renameButton.textContent = '名前を変更';
    renameButton.addEventListener('click', (event) => {
        event.stopPropagation();
        closeMenu();
        handlers.onRenameProject(project);
    });

    const deleteButton = document.createElement('button');
    deleteButton.className = 'project-home-icon-btn danger';
    deleteButton.type = 'button';
    deleteButton.setAttribute('aria-label', `${project.name} を削除`);
    deleteButton.textContent = '削除';
    deleteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        closeMenu();
        handlers.onDeleteProject(project);
    });

    menu.append(renameButton, deleteButton);
    tools.append(menuTrigger, menu);
    item.append(openButton);
    if (!appState.projectSelectionMode) {
        item.append(tools);
    }
    return item;
}

function buildDefaultProjectName() {
    return `新規プロジェクト ${(appState.projectList || []).length + 1}`;
}

function openCreateProjectDialog(home, handlers) {
    const dialog = home.querySelector('[data-project-create-dialog="true"]');
    const input = home.querySelector('[data-project-create-name="true"]');
    const error = home.querySelector('[data-project-create-error="true"]');
    if (!dialog || !input) return;

    input.value = buildDefaultProjectName();
    if (error) error.hidden = true;
    dialog.hidden = false;
    requestAnimationFrame(() => {
        input.focus();
        input.select();
    });

    const submit = () => {
        const name = input.value.trim();
        if (!name) {
            if (error) error.hidden = false;
            input.focus();
            return;
        }
        dialog.hidden = true;
        handlers.onCreateProject(name);
    };
    const updateSubmitAvailability = () => {
        const submitButton = dialog.querySelector('[data-project-create-submit="true"]');
        if (submitButton) submitButton.disabled = input.value.trim().length === 0;
    };

    dialog.querySelector('[data-project-create-submit="true"]').onclick = submit;
    dialog.querySelector('[data-project-create-cancel="true"]').onclick = () => {
        dialog.hidden = true;
    };
    input.onkeydown = (event) => {
        if (event.key === 'Enter') submit();
        if (event.key === 'Escape') dialog.hidden = true;
    };
    input.oninput = () => {
        if (error) error.hidden = true;
        updateSubmitAvailability();
    };
    updateSubmitAvailability();
}

export function setProjectHomeVisible(visible) {
    appState.projectHomeVisible = visible;
    document.body.classList.toggle('project-home-active', visible);
    const home = document.getElementById('projectHome');
    const emptyState = document.getElementById('emptyState');
    const editor = document.getElementById('trackEditor');
    if (home) home.hidden = !visible;
    if (emptyState) emptyState.style.display = visible ? 'none' : '';
    if (editor) editor.style.display = visible ? 'none' : editor.style.display;
}

export function renderProjectHome(handlers) {
    const home = document.getElementById('projectHome');
    if (!home) return;

    const projects = appState.projectList || [];
    const isSelecting = Boolean(appState.projectSelectionMode);
    const selectedCount = appState.selectedProjectIds.length;
    home.innerHTML = `
        <div class="project-home-shell">
            <div class="project-home-header">
                <div>
                    <p class="project-home-kicker">ezmelo</p>
                    <h1>プロジェクト一覧</h1>
                    <p class="project-home-lead">プロジェクトを開くか、新しく作成します。</p>
                </div>
                <div class="project-home-header-actions">
                    <button class="project-home-menu-trigger" type="button" data-project-menu-trigger="true" aria-label="プロジェクトメニュー" aria-expanded="false">…</button>
                    <div class="project-home-menu" data-project-menu="true" hidden>
                        <button type="button" data-project-tutorial="true">チュートリアル</button>
                        <button type="button" data-project-import="true">インポート</button>
                        <button type="button" data-project-select-mode="true">複数選択</button>
                    </div>
                </div>
            </div>
            <ul class="project-home-list" aria-label="プロジェクト一覧"></ul>
            <div class="project-home-empty" ${projects.length > 0 ? 'hidden' : ''}>
                <strong>まだプロジェクトがありません</strong>
                <span>新規作成してすぐ作曲を始められます。</span>
            </div>
            <div class="project-home-actions ${isSelecting ? 'is-selecting' : ''}">
                ${isSelecting ? `
                    <button class="project-home-action danger" type="button" data-project-bulk-delete="true" ${selectedCount === 0 ? 'disabled' : ''}>一括削除</button>
                    <button class="project-home-action primary" type="button" data-project-bulk-export="true" ${selectedCount === 0 ? 'disabled' : ''}>一括エクスポート</button>
                    <button class="project-home-action" type="button" data-project-select-cancel="true">キャンセル</button>
                ` : `
                    <button class="project-home-action wide primary" type="button" data-project-new="true">＋ 新規プロジェクト</button>
                `}
            </div>
            <div class="project-home-version">v${APP_VERSION}</div>
            <div class="project-create-dialog" data-project-create-dialog="true" hidden>
                <div class="project-create-panel" role="dialog" aria-modal="true" aria-labelledby="projectCreateTitle">
                    <h2 id="projectCreateTitle">プロジェクト名</h2>
                    <input class="project-create-input" data-project-create-name="true" type="text" maxlength="40" autocomplete="off">
                    <div class="project-create-error" data-project-create-error="true" hidden>名前を入力してください</div>
                    <div class="project-create-actions">
                        <button class="project-create-btn" type="button" data-project-create-cancel="true">キャンセル</button>
                        <button class="project-create-btn primary" type="button" data-project-create-submit="true">作成</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const list = home.querySelector('.project-home-list');
    projects.forEach((project) => {
        list.appendChild(createProjectCard(project, handlers));
    });

    home.addEventListener('project-card-menu-open', (event) => {
        const currentMenu = event.detail?.currentMenu;
        home.querySelectorAll('.project-home-card-menu').forEach((cardMenu) => {
            if (cardMenu !== currentMenu) cardMenu.hidden = true;
        });
        home.querySelectorAll('.project-home-card-menu-trigger').forEach((button) => {
            if (button.nextElementSibling !== currentMenu) button.setAttribute('aria-expanded', 'false');
        });
    });

    home.querySelectorAll('[data-project-new="true"]').forEach((button) => {
        button.addEventListener('click', () => openCreateProjectDialog(home, handlers));
    });

    const shell = home.querySelector('.project-home-shell');
    const menuTrigger = home.querySelector('[data-project-menu-trigger="true"]');
    const menu = home.querySelector('[data-project-menu="true"]');
    const closeMenu = () => {
        if (!menu || !menuTrigger) return;
        menu.hidden = true;
        menuTrigger.setAttribute('aria-expanded', 'false');
    };
    const runMenuAction = (handler) => {
        closeMenu();
        handler?.();
    };

    menuTrigger?.addEventListener('click', (event) => {
        event.stopPropagation();
        const nextOpen = menu?.hidden;
        if (!menu || !menuTrigger) return;
        menu.hidden = !nextOpen;
        menuTrigger.setAttribute('aria-expanded', String(nextOpen));
    });
    shell?.addEventListener('click', (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest('.project-home-header-actions, .project-home-card-tools')) return;
        closeMenu();
        home.querySelectorAll('.project-home-card-menu').forEach((cardMenu) => {
            cardMenu.hidden = true;
        });
        home.querySelectorAll('.project-home-card-menu-trigger').forEach((button) => {
            button.setAttribute('aria-expanded', 'false');
        });
    });
    home.querySelector('[data-project-tutorial="true"]')?.addEventListener('click', () => {
        runMenuAction(handlers.onStartTutorial);
    });
    home.querySelector('[data-project-import="true"]')?.addEventListener('click', () => {
        runMenuAction(handlers.onImportProject);
    });
    home.querySelector('[data-project-select-mode="true"]')?.addEventListener('click', () => {
        runMenuAction(handlers.onEnterProjectSelectionMode);
    });
    home.querySelector('[data-project-select-cancel="true"]')?.addEventListener('click', () => {
        handlers.onExitProjectSelectionMode();
    });
    home.querySelector('[data-project-bulk-delete="true"]')?.addEventListener('click', () => {
        handlers.onDeleteSelectedProjects();
    });
    home.querySelector('[data-project-bulk-export="true"]')?.addEventListener('click', () => {
        handlers.onExportSelectedProjects();
    });
}
