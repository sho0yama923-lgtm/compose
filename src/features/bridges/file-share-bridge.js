import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativeApp } from './device-bridge.js';

const EXPORT_DIR = 'compose/exports';

async function ensureExportDir() {
    await Filesystem.mkdir({
        path: EXPORT_DIR,
        directory: Directory.Cache,
        recursive: true,
    }).catch(() => {});
}

export async function exportProjectData(serialized, fileName) {
    if (!isNativeApp()) {
        const blob = new Blob([serialized], { type: 'application/json' });
        const linkEl = document.createElement('a');
        linkEl.href = URL.createObjectURL(blob);
        linkEl.download = fileName;
        linkEl.click();
        URL.revokeObjectURL(linkEl.href);
        return true;
    }

    try {
        await ensureExportDir();
        const exportPath = `${EXPORT_DIR}/${fileName}`;
        const { uri } = await Filesystem.writeFile({
            path: exportPath,
            data: serialized,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
            recursive: true,
        });
        const canShare = await Share.canShare().catch(() => ({ value: false }));
        if (!canShare.value) return false;
        await Share.share({
            title: 'Compose project',
            text: 'Compose project',
            files: uri ? [uri] : undefined,
            url: uri,
            dialogTitle: 'プロジェクトを書き出す',
        });
        return true;
    } catch (error) {
        console.warn('exportProjectData failed:', error);
        return false;
    }
}

export function requestProjectImport(inputEl) {
    inputEl?.click();
}
