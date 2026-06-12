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

export { Tone };
