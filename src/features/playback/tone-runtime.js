import * as Tone from 'tone';

let toneAudioContextResetNeeded = false;
let toneAudioContextGeneration = 0;

export function markToneAudioContextResetNeeded() {
    toneAudioContextResetNeeded = true;
}

export function resetToneAudioContextIfNeeded() {
    if (!toneAudioContextResetNeeded) return false;
    const previousContext = Tone.getContext?.() || null;
    const previousRawContext = previousContext?.rawContext || null;

    try {
        const transport = Tone.getTransport?.() || Tone.Transport;
        transport.stop();
        transport.cancel?.();
    } catch {
        // Transport がまだ初期化前でも、context の差し替えは続ける。
    }

    try {
        const nextContext = new Tone.Context();
        Tone.setContext(nextContext);
        toneAudioContextResetNeeded = false;
        toneAudioContextGeneration += 1;

        // Safari では timeout 済みの Tone.start()/resume() が遅れて戻ることがある。
        // ここで旧 context を閉じると、その遅延処理が InvalidStateError: Context is closed
        // を投げて復旧後の再生まで壊すため、旧 context は参照から外すだけにする。
        void previousRawContext;
        console.info('[Audio] Web Audio context was recreated for recovery.');
        return true;
    } catch (error) {
        console.warn('[Audio] Web Audio context recreation skipped.', error);
        return false;
    }
}

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
    resetToneAudioContextIfNeeded();
    const generation = toneAudioContextGeneration;
    const context = Tone.getContext();
    await Tone.start();

    if (generation !== toneAudioContextGeneration || context !== Tone.getContext()) {
        throw new Error('Web Audio context was replaced while starting.');
    }
    if (context.state !== 'running') {
        await context.resume();
    }
    if (context.rawContext?.state !== 'running' && typeof context.rawContext?.resume === 'function') {
        await context.rawContext.resume();
    }
    if (generation !== toneAudioContextGeneration || context !== Tone.getContext()) {
        throw new Error('Web Audio context was replaced while resuming.');
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

    const readyPromise = ensureToneAudioReady()
        .then(() => true)
        .catch((error) => {
            console.warn('[Audio] Web Audio context warmup skipped.', error);
            return false;
        });

    return Promise.race([
        readyPromise,
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
