import * as Tone from 'tone';

function kickRawAudioOutput(rawContext) {
    if (!rawContext || typeof rawContext.createBufferSource !== 'function') return;
    if (rawContext.state !== 'running') return;

    try {
        const buffer = rawContext.createBuffer(1, 1, Math.max(1, rawContext.sampleRate || 44100));
        const source = rawContext.createBufferSource();
        source.buffer = buffer;
        source.connect(rawContext.destination);
        source.onended = () => {
            try {
                source.disconnect();
            } catch {
                // すでに切断済みなら何もしない。
            }
        };
        source.start(0);
    } catch (error) {
        console.warn('[Audio] Web Audio output kick skipped.', error);
    }
}

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
    kickRawAudioOutput(context.rawContext);
    console.info(`[Audio] Web Audio context: ${state}`);
    return context;
}

export async function ensureToneAudioReadyWithTimeout(timeoutMs = 1500) {
    const timeout = Math.max(0, timeoutMs);
    if (timeout <= 0) {
        await ensureToneAudioReady();
        return true;
    }

    return Promise.race([
        ensureToneAudioReady().then(() => true),
        new Promise((resolve) => {
            globalThis.setTimeout(() => resolve(false), timeout);
        }),
    ]);
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
