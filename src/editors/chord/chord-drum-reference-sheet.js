import { appState, callbacks } from '../../core/state.js';
import { isStepHead } from '../../core/duration.js';

export function buildDrumReferenceSheet(track, drumTracks, offset, mEnd, cells) {
    const overlayEl = document.createElement('div');
    overlayEl.className = 'chord-drum-sheet-overlay';
    overlayEl.addEventListener('click', (event) => {
        if (event.target !== overlayEl) return;
        appState.chordDrumSheetOpen = false;
        callbacks.renderEditor();
    });

    const sheetEl = document.createElement('section');
    sheetEl.className = 'chord-drum-sheet';

    const handleEl = document.createElement('div');
    handleEl.className = 'chord-drum-sheet-handle';
    sheetEl.appendChild(handleEl);

    const titleEl = document.createElement('div');
    titleEl.className = 'chord-drum-sheet-title';
    titleEl.textContent = 'ドラムを参照';
    sheetEl.appendChild(titleEl);

    const descEl = document.createElement('div');
    descEl.className = 'chord-drum-sheet-desc';
    descEl.textContent = '参照したいドラム行にチェックを入れて、同期を押します。';
    sheetEl.appendChild(descEl);

    const listEl = document.createElement('div');
    listEl.className = 'chord-drum-sheet-list';
    drumTracks.forEach((dt) => {
        dt.rows.forEach((row) => {
            const rowEl = document.createElement('label');
            rowEl.className = 'chord-rhythm-row';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'chord-drum-check';
            chk.checked = track.selectedDrumRows.has(row.label);
            chk.addEventListener('change', () => {
                if (chk.checked) track.selectedDrumRows.add(row.label);
                else track.selectedDrumRows.delete(row.label);
            });
            rowEl.appendChild(chk);

            const lbl = document.createElement('span');
            lbl.className = 'chord-rhythm-row-label';
            lbl.textContent = row.label;
            rowEl.appendChild(lbl);

            const cellsEl = document.createElement('div');
            cellsEl.className = 'chord-rhythm-cells';
            cellsEl.style.gridTemplateColumns = `repeat(${cells.length}, minmax(0, 1fr))`;
            cells.forEach((cellInfo) => {
                const cell = document.createElement('span');
                const on = isStepHead(row.steps[offset + cellInfo.localStep]);
                cell.className = 'chord-rhythm-cell' + (on ? ' on' : '');
                cell.textContent = on ? '●' : '·';
                cellsEl.appendChild(cell);
            });
            rowEl.appendChild(cellsEl);
            listEl.appendChild(rowEl);
        });
    });
    sheetEl.appendChild(listEl);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'chord-drum-sheet-actions';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'chord-quick-btn';
    closeBtn.type = 'button';
    closeBtn.textContent = '閉じる';
    closeBtn.addEventListener('click', () => {
        appState.chordDrumSheetOpen = false;
        callbacks.renderEditor();
    });

    const syncBtn = document.createElement('button');
    syncBtn.className = 'chord-sync-all-btn';
    syncBtn.type = 'button';
    syncBtn.textContent = '同期';
    syncBtn.addEventListener('click', () => {
        syncSelectedDrumRows(track, drumTracks, offset, mEnd);
        appState.chordDrumSheetOpen = false;
        callbacks.renderEditor();
    });

    actionsEl.append(closeBtn, syncBtn);
    sheetEl.appendChild(actionsEl);
    overlayEl.appendChild(sheetEl);
    return overlayEl;
}

function syncSelectedDrumRows(track, drumTracks, offset, mEnd) {
    track.soundSteps.fill(null, offset, mEnd);
    drumTracks.forEach((dt) => {
        dt.rows.forEach((row) => {
            if (!track.selectedDrumRows.has(row.label)) return;
            row.steps.forEach((val, i) => {
                if (i >= offset && i < mEnd && isStepHead(val)) {
                    track.soundSteps[i] = '16n';
                }
            });
        });
    });
}
