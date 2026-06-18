import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { canUseNativeShare } from './device-bridge.js';

const EXPORT_DIR = 'compose/exports';

async function ensureExportDir() {
    await Filesystem.mkdir({
        path: EXPORT_DIR,
        directory: Directory.Cache,
        recursive: true,
    }).catch(() => {});
}

export async function exportProjectData(serialized, fileName) {
    if (!canUseNativeShare()) {
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
            dialogTitle: 'プロジェクトをエクスポート',
        });
        return true;
    } catch (error) {
        console.warn('exportProjectData failed:', error);
        return false;
    }
}

export async function exportProjectFiles(files) {
    if (!Array.isArray(files) || files.length === 0) return false;
    if (!canUseNativeShare()) {
        files.forEach(({ serialized, fileName }) => {
            const blob = new Blob([serialized], { type: 'application/json' });
            const linkEl = document.createElement('a');
            linkEl.href = URL.createObjectURL(blob);
            linkEl.download = fileName;
            linkEl.click();
            URL.revokeObjectURL(linkEl.href);
        });
        return true;
    }

    try {
        await ensureExportDir();
        const fileUris = [];
        for (const { serialized, fileName } of files) {
            const exportPath = `${EXPORT_DIR}/${fileName}`;
            const { uri } = await Filesystem.writeFile({
                path: exportPath,
                data: serialized,
                directory: Directory.Cache,
                encoding: Encoding.UTF8,
                recursive: true,
            });
            if (uri) fileUris.push(uri);
        }
        const canShare = await Share.canShare().catch(() => ({ value: false }));
        if (!canShare.value || fileUris.length === 0) return false;
        await Share.share({
            title: 'Compose projects',
            text: 'Compose projects',
            files: fileUris,
            dialogTitle: 'プロジェクトをエクスポート',
        });
        return true;
    } catch (error) {
        console.warn('exportProjectFiles failed:', error);
        return false;
    }
}

export function requestProjectImport(inputEl) {
    inputEl?.click();
}
