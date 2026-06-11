import { Capacitor } from '@capacitor/core';

export const APP_RUNTIME = Object.freeze({
    WEB: 'web',
    IOS: 'ios',
    ANDROID: 'android',
    NATIVE: 'native',
});

export function isNativeApp() {
    return Capacitor.isNativePlatform();
}

export function getPlatformName() {
    return Capacitor.getPlatform();
}

export function getAppRuntime() {
    if (!isNativeApp()) return APP_RUNTIME.WEB;
    const platform = getPlatformName();
    if (platform === APP_RUNTIME.IOS || platform === APP_RUNTIME.ANDROID) return platform;
    return APP_RUNTIME.NATIVE;
}

export function isWebApp() {
    return getAppRuntime() === APP_RUNTIME.WEB;
}

export function isIosApp() {
    return getAppRuntime() === APP_RUNTIME.IOS;
}

export function isAndroidApp() {
    return getAppRuntime() === APP_RUNTIME.ANDROID;
}

export function canUseNativeFilesystem() {
    return isNativeApp() && Capacitor.isPluginAvailable('Filesystem');
}

export function canUseNativeShare() {
    return isNativeApp()
        && Capacitor.isPluginAvailable('Filesystem')
        && Capacitor.isPluginAvailable('Share');
}

export function canUseIosNativePlayback() {
    return isIosApp() && Capacitor.isPluginAvailable('NativePlayback');
}
