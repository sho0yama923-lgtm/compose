import * as Tone from 'tone';

export async function ensureToneAudioReady() {
    const context = Tone.getContext();
    await Tone.start();

    if (context.state !== 'running') {
        await context.resume();
    }
    if (context.rawContext?.state !== 'running' && typeof context.rawContext?.resume === 'function') {
        await context.rawContext.resume();
    }

    const state = context.rawContext?.state || context.state;
    if (state !== 'running') {
        throw new Error(`Web Audio context is ${state || 'unavailable'}`);
    }
    console.info(`[Audio] Web Audio context: ${state}`);
    return context;
}

export async function waitForToneLoaded(timeoutMs = 2500) {
    if (typeof Tone.loaded !== 'function') return true;

    const timeout = Math.max(0, timeoutMs);
    if (timeout <= 0) {
        await Tone.loaded();
        return true;
    }

    return Promise.race([
        Tone.loaded().then(() => true),
        new Promise((resolve) => {
            window.setTimeout(() => resolve(false), timeout);
        }),
    ]);
}

export { Tone };
