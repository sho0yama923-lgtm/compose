import { Capacitor } from '@capacitor/core';

export function isNativeApp() {
    return Capacitor.isNativePlatform();
}

export function getPlatformName() {
    return Capacitor.getPlatform();
}

export function isIosApp() {
    return getPlatformName() === 'ios';
}

export function isAndroidApp() {
    return getPlatformName() === 'android';
}
