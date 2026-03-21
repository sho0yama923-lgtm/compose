import Foundation
import Capacitor
import AVFAudio
import Darwin

private struct NativePlaybackInstrumentManifest: Decodable {
    let instrumentId: String
    let samples: [String: String]
}

private struct NativePlaybackTrack: Decodable {
    let trackId: Int
    let instrument: String
    let playbackInstrument: String?
    let volume: Double
    let muted: Bool
}

private struct NativePlaybackEvent: Decodable {
    let step: Int
    let trackId: Int
    let instrument: String
    let playbackInstrument: String?
    let notes: [String]
    let durationSteps: Int
    let volume: Double
}

private struct NativePlaybackPayload: Decodable {
    let bpm: Double
    let stepsPerBeat: Int
    let stepsPerMeasure: Int
    let startStep: Int
    let endStepExclusive: Int
    let loop: Bool
    let tracks: [NativePlaybackTrack]
    let events: [NativePlaybackEvent]
}

private struct CachedSample {
    let rootNote: String
    let rootMidi: Int
    let buffer: AVAudioPCMBuffer
}

private struct NativePlaybackState {
    let sessionId: Int
    let startedAtMs: Int
    let renderBaseHostTime: UInt64
    let audibleBaseHostTime: UInt64
    let secondsPerStep: Double
    let cycleDurationSeconds: Double
    let cycleSteps: Int
    let startStep: Int
    let endStepExclusive: Int
    let loop: Bool
}

private final class PlaybackVoice {
    let player = AVAudioPlayerNode()
    let rate = AVAudioUnitVarispeed()
    let gainMixer = AVAudioMixerNode()
    let trackId: Int
    let poolKey: String
    let mainMixerInputBus: AVAudioNodeBus
    var isFadingOut = false
    var fadeSequence = 0

    init(trackId: Int, poolKey: String, mainMixerInputBus: AVAudioNodeBus) {
        self.trackId = trackId
        self.poolKey = poolKey
        self.mainMixerInputBus = mainMixerInputBus
    }
}

private final class NativePlaybackEngine {
    private let leadTimeSeconds = 0.18
    private let warmupPrimeSeconds = 0.12
    private let warmupReadyLeadSeconds = 1.0
    private let pooledVoiceCountPerDrumNote = 12
    private let pooledVoiceCountPerPitchedRoute = 36
    private let schedulerTickSeconds = 0.12
    private let schedulerHorizonMinimumSeconds = 0.45
    private let schedulerHorizonMaximumSeconds = 0.9
    private let schedulerHorizonCycles = 1
    private let schedulerLateGraceSeconds = 0.04
    private let voiceCleanupTailSeconds = 0.05
    private let voiceFadeStepDurationSeconds = 0.004
    private let drumSampleTailCapSeconds = 0.16
    private let pitchedSampleTailCapSeconds = 0.07

    private let audioEngine = AVAudioEngine()
    private let engineQueue = DispatchQueue(label: "NativePlaybackEngine.queue")
    private let warmupPlayer = AVAudioPlayerNode()
    private var sampleCache: [String: [CachedSample]] = [:]
    private var voicePools: [String: [PlaybackVoice]] = [:]
    private var availableVoicesByKey: [String: [PlaybackVoice]] = [:]
    private var activeVoices: [UUID: PlaybackVoice] = [:]
    private var nextMainMixerInputBus: AVAudioNodeBus = 1
    private var hasBeenPrimed = false
    private var schedulerTimer: DispatchSourceTimer?
    private var scheduledPayload: NativePlaybackPayload?
    private var scheduledUpToHostTime: UInt64 = 0
    private var playbackSessionId = 0
    private var currentPlaybackState: NativePlaybackState?
    private var playbackReadyAtMs = 0

    init() {
        audioEngine.attach(warmupPlayer)
        audioEngine.connect(warmupPlayer, to: audioEngine.mainMixerNode, fromBus: 0, toBus: 0, format: nil)
        audioEngine.mainMixerNode.outputVolume = 1
    }

    func preload(manifests: [NativePlaybackInstrumentManifest]) throws {
        try engineQueue.sync {
            if manifests.isEmpty {
                print("[NativePlayback] preload: skip empty manifest request (cache keys: \(sampleCache.keys.sorted()))")
                return
            }

            var nextCache = sampleCache
            var loadedInstrumentIds: [String] = []
            var reusedInstrumentIds: [String] = []

            for manifest in manifests {
                if let cachedSamples = nextCache[manifest.instrumentId], !cachedSamples.isEmpty {
                    reusedInstrumentIds.append(manifest.instrumentId)
                    continue
                }
                nextCache[manifest.instrumentId] = try loadSamples(for: manifest)
                loadedInstrumentIds.append(manifest.instrumentId)
            }

            sampleCache = nextCache
            print(
                "[NativePlayback] preload: loaded=\(loadedInstrumentIds.sorted()) reused=\(reusedInstrumentIds.sorted()) cache=\(sampleCache.keys.sorted())"
            )
        }
    }

    func warmup() throws {
        try engineQueue.sync {
            try ensureEngineStarted()
            if !hasBeenPrimed {
                audioEngine.mainMixerNode.outputVolume = 0
                try primeOutputPathLocked()
                hasBeenPrimed = true
            }
        }
    }

    func play(payload: NativePlaybackPayload) throws -> (startDelayMs: Int, startedAtMs: Int) {
        try engineQueue.sync {
            try playLocked(payload: payload)
        }
    }

    func stop() {
        audioEngine.mainMixerNode.outputVolume = 0
        engineQueue.async { [self] in
            self.stopLocked()
        }
    }

    func playbackStatus() -> [String: Any] {
        engineQueue.sync {
            playbackStatusLocked()
        }
    }

    private func playLocked(payload: NativePlaybackPayload) throws -> (startDelayMs: Int, startedAtMs: Int) {
        stopLocked()
        playbackSessionId += 1
        let sessionId = playbackSessionId
        let cycleSteps = max(1, payload.endStepExclusive - payload.startStep)
        let cycleDurationSeconds = durationForStepCount(
            cycleSteps,
            bpm: payload.bpm,
            stepsPerBeat: payload.stepsPerBeat
        )

        // volume=0 の状態でグラフ変更（stopLockedで0設定済み）
        clearVoicePoolsLocked()
        try prepareVoicePoolsLocked(payload: payload)
        if !audioEngine.isRunning {
            try restartEngine()
        }

        let renderBaseHostTime = mach_absolute_time() + AVAudioTime.hostTime(forSeconds: leadTimeSeconds)
        let outputLatencySeconds = estimatedOutputLatencySeconds()
        let audibleBaseHostTime = renderBaseHostTime + AVAudioTime.hostTime(forSeconds: outputLatencySeconds)
        let startedAtMs = Int((Date().timeIntervalSince1970 + leadTimeSeconds + outputLatencySeconds) * 1000)

        scheduledPayload = payload
        scheduledUpToHostTime = 0
        currentPlaybackState = NativePlaybackState(
            sessionId: sessionId,
            startedAtMs: startedAtMs,
            renderBaseHostTime: renderBaseHostTime,
            audibleBaseHostTime: audibleBaseHostTime,
            secondsPerStep: secondsPerStep(bpm: payload.bpm, stepsPerBeat: payload.stepsPerBeat),
            cycleDurationSeconds: cycleDurationSeconds,
            cycleSteps: cycleSteps,
            startStep: payload.startStep,
            endStepExclusive: payload.endStepExclusive,
            loop: payload.loop
        )

        try refillScheduleHorizonLocked()
        startSchedulerTimerLocked()
        audioEngine.mainMixerNode.outputVolume = 1
        return (Int(leadTimeSeconds * 1000), startedAtMs)
    }

    private func stopLocked() {
        playbackSessionId += 1
        cancelSchedulerTimerLocked()
        scheduledPayload = nil
        scheduledUpToHostTime = 0
        currentPlaybackState = nil
        audioEngine.mainMixerNode.outputVolume = 0

        let voices = activeVoices
        activeVoices.removeAll()
        voices.values.forEach { returnVoiceToPool($0, immediate: true) }
        for key in availableVoicesByKey.keys {
            availableVoicesByKey[key]?.forEach { stopVoice($0, immediate: true) }
        }
        warmupPlayer.stop()
        warmupPlayer.reset()
    }

    private func ensureEngineStarted() throws {
        if audioEngine.isRunning { return }
        audioEngine.prepare()
        try audioEngine.start()
        playbackReadyAtMs = currentTimeMs() + Int(warmupReadyLeadSeconds * 1000)
    }

    private func restartEngine() throws {
        if audioEngine.isRunning { return }
        audioEngine.prepare()
        try audioEngine.start()
    }

    private func primeOutputPathLocked() throws {
        let format = audioEngine.mainMixerNode.outputFormat(forBus: 0)
        let sampleRate = max(1, format.sampleRate)
        let frameCount = AVAudioFrameCount(max(256, Int(sampleRate * warmupPrimeSeconds)))
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else {
            throw NSError(
                domain: "NativePlayback",
                code: 6,
                userInfo: [NSLocalizedDescriptionKey: "Unable to allocate warmup buffer."]
            )
        }
        buffer.frameLength = frameCount

        let semaphore = DispatchSemaphore(value: 0)
        warmupPlayer.stop()
        warmupPlayer.reset()
        warmupPlayer.volume = 0
        warmupPlayer.prepare(withFrameCount: buffer.frameLength)
        warmupPlayer.scheduleBuffer(buffer, at: nil, options: [], completionHandler: {
            semaphore.signal()
        })
        warmupPlayer.play()

        let waitSeconds = warmupPrimeSeconds + estimatedOutputLatencySeconds() + 0.08
        _ = semaphore.wait(timeout: .now() + waitSeconds)

        warmupPlayer.stop()
        warmupPlayer.reset()
    }

    private func loadSamples(for manifest: NativePlaybackInstrumentManifest) throws -> [CachedSample] {
        var cachedSamples: [CachedSample] = []

        for (rootNote, relativePath) in manifest.samples.sorted(by: { $0.key < $1.key }) {
            guard let rootMidi = noteToMidi(rootNote) else { continue }
            guard let url = resolveBundleURL(relativePath: relativePath) else {
                throw NSError(
                    domain: "NativePlayback",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Missing bundled sample: \(relativePath)"]
                )
            }

            let audioFile = try AVAudioFile(forReading: url)
            guard let buffer = AVAudioPCMBuffer(
                pcmFormat: audioFile.processingFormat,
                frameCapacity: AVAudioFrameCount(audioFile.length)
            ) else {
                throw NSError(
                    domain: "NativePlayback",
                    code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "Unable to allocate sample buffer for \(relativePath)"]
                )
            }
            try audioFile.read(into: buffer)
            cachedSamples.append(CachedSample(rootNote: rootNote, rootMidi: rootMidi, buffer: buffer))
        }

        return cachedSamples
    }

    private func resolveBundleURL(relativePath: String) -> URL? {
        guard let resourceURL = Bundle.main.resourceURL else { return nil }
        return resourceURL
            .appendingPathComponent("public", isDirectory: true)
            .appendingPathComponent(relativePath)
    }

    private func resolveInstrumentId(
        for event: NativePlaybackEvent,
        payload: NativePlaybackPayload
    ) -> String {
        event.playbackInstrument
            ?? payload.tracks.first(where: { $0.trackId == event.trackId })?.playbackInstrument
            ?? event.instrument
    }

    private func trackType(for trackId: Int, payload: NativePlaybackPayload) -> String? {
        payload.tracks.first(where: { $0.trackId == trackId })?.instrument
    }

    private func voicePoolKey(
        trackId: Int,
        instrumentId: String,
        payload: NativePlaybackPayload,
        note: String? = nil
    ) -> String {
        if trackType(for: trackId, payload: payload) == "drums", let note, !note.isEmpty {
            return "\(trackId)|\(instrumentId)|\(note)"
        }
        return "\(trackId)|\(instrumentId)"
    }

    private func pooledVoiceCount(
        trackId: Int,
        payload: NativePlaybackPayload
    ) -> Int {
        trackType(for: trackId, payload: payload) == "drums"
            ? pooledVoiceCountPerDrumNote
            : pooledVoiceCountPerPitchedRoute
    }

    private func sampleTailCapSeconds(
        trackId: Int,
        payload: NativePlaybackPayload
    ) -> Double {
        trackType(for: trackId, payload: payload) == "drums"
            ? drumSampleTailCapSeconds
            : pitchedSampleTailCapSeconds
    }

    private func prepareVoicePoolsLocked(payload: NativePlaybackPayload) throws {
        var nextPools: [String: [PlaybackVoice]] = [:]
        var nextAvailable: [String: [PlaybackVoice]] = [:]

        for event in payload.events {
            let instrumentId = resolveInstrumentId(for: event, payload: payload)
            guard let sampleFormat = sampleCache[instrumentId]?.first?.buffer.format else {
                let poolKey = voicePoolKey(trackId: event.trackId, instrumentId: instrumentId, payload: payload)
                print("[NativePlayback] prepareVoicePools: SKIP \(poolKey) — no samples for '\(instrumentId)' (cache keys: \(sampleCache.keys.sorted()))")
                continue
            }

            let poolKeys = event.notes.map { note in
                voicePoolKey(trackId: event.trackId, instrumentId: instrumentId, payload: payload, note: note)
            }
            let voiceCount = pooledVoiceCount(trackId: event.trackId, payload: payload)
            for poolKey in Set(poolKeys) {
                if nextPools[poolKey] != nil { continue }
                var pool: [PlaybackVoice] = []
                pool.reserveCapacity(voiceCount)
                for _ in 0..<voiceCount {
                    pool.append(createVoice(poolKey: poolKey, trackId: event.trackId, format: sampleFormat))
                }
                nextPools[poolKey] = pool
                nextAvailable[poolKey] = pool
            }
        }

        voicePools = nextPools
        availableVoicesByKey = nextAvailable
    }

    private func clearVoicePoolsLocked() {
        voicePools.values.flatMap { $0 }.forEach { destroyVoice($0) }
        voicePools.removeAll()
        availableVoicesByKey.removeAll()
        nextMainMixerInputBus = 1
    }

    private func createVoice(
        poolKey: String,
        trackId: Int,
        format: AVAudioFormat
    ) -> PlaybackVoice {
        let voice = PlaybackVoice(
            trackId: trackId,
            poolKey: poolKey,
            mainMixerInputBus: nextMainMixerInputBus
        )
        nextMainMixerInputBus += 1
        audioEngine.attach(voice.player)
        audioEngine.attach(voice.rate)
        audioEngine.attach(voice.gainMixer)
        audioEngine.connect(voice.player, to: voice.rate, fromBus: 0, toBus: 0, format: format)
        audioEngine.connect(voice.rate, to: voice.gainMixer, fromBus: 0, toBus: 0, format: format)
        audioEngine.connect(
            voice.gainMixer,
            to: audioEngine.mainMixerNode,
            fromBus: 0,
            toBus: voice.mainMixerInputBus,
            format: format
        )
        voice.rate.rate = 1
        voice.player.volume = 1
        voice.gainMixer.outputVolume = 1
        return voice
    }

    private func checkoutVoice(poolKey: String) -> PlaybackVoice? {
        guard var available = availableVoicesByKey[poolKey], !available.isEmpty else { return nil }
        let voice = available.removeLast()
        availableVoicesByKey[poolKey] = available
        return voice
    }

    private func returnVoiceToPool(_ voice: PlaybackVoice, immediate: Bool = false) {
        stopVoice(voice, immediate: immediate) { [self] in
            self.availableVoicesByKey[voice.poolKey, default: []].append(voice)
        }
    }

    private func scheduleEventsInRange(
        payload: NativePlaybackPayload,
        state: NativePlaybackState,
        cycleStartHostTime: UInt64,
        rangeStart: UInt64,
        rangeEnd: UInt64
    ) throws {
        guard playbackSessionId == state.sessionId else { return }

        for event in payload.events {
            let relativeStep = event.step - payload.startStep
            if relativeStep < 0 { continue }
            let eventOffsetSeconds = durationForStepCount(
                relativeStep, bpm: payload.bpm, stepsPerBeat: payload.stepsPerBeat
            )
            let eventHostTime = cycleStartHostTime + AVAudioTime.hostTime(forSeconds: eventOffsetSeconds)
            if eventHostTime <= rangeStart { continue }
            if eventHostTime > rangeEnd { continue }
            try scheduleEvent(
                event,
                payload: payload,
                sessionId: state.sessionId,
                hostTime: eventHostTime,
                secondsPerStep: state.secondsPerStep
            )
        }
    }

    private func scheduleEvent(
        _ event: NativePlaybackEvent,
        payload: NativePlaybackPayload,
        sessionId: Int,
        hostTime: UInt64,
        secondsPerStep: Double
    ) throws {
        let instrumentId = resolveInstrumentId(for: event, payload: payload)
        let durationSeconds = max(secondsPerStep, secondsPerStep * Double(max(1, event.durationSteps)))
        let volume = Float(max(0, min(1, event.volume)))

        for note in event.notes {
            let poolKey = voicePoolKey(
                trackId: event.trackId,
                instrumentId: instrumentId,
                payload: payload,
                note: note
            )
            guard let sample = nearestSample(instrumentId: instrumentId, note: note) else {
                print("[NativePlayback] scheduleEvent: no sample for \(instrumentId) note=\(note)")
                continue
            }
            guard let targetMidi = noteToMidi(note) else { continue }
            guard let voice = checkoutVoice(poolKey: poolKey) else {
                print("[NativePlayback] scheduleEvent: voice pool exhausted for \(poolKey)")
                continue
            }

            let voiceId = UUID()
            activeVoices[voiceId] = voice

            voice.player.volume = volume
            let playbackRate = max(0.01, Double(powf(2, Float(targetMidi - sample.rootMidi) / 12)))
            voice.rate.rate = Float(playbackRate)
            voice.player.prepare(withFrameCount: sample.buffer.frameLength)
            voice.player.scheduleBuffer(
                sample.buffer,
                at: AVAudioTime(hostTime: hostTime),
                options: [],
                completionHandler: nil
            )
            voice.player.play()

            let sampleDurationSeconds = (
                Double(sample.buffer.frameLength)
                / max(1, sample.buffer.format.sampleRate)
            ) / playbackRate
            let cappedSampleDurationSeconds = min(
                sampleDurationSeconds,
                durationSeconds + sampleTailCapSeconds(trackId: event.trackId, payload: payload)
            )
            let cleanupDelaySeconds = max(
                durationSeconds + voiceCleanupTailSeconds,
                cappedSampleDurationSeconds
            )

            scheduleWorkItem(
                sessionId: sessionId,
                hostTime: hostTime + AVAudioTime.hostTime(forSeconds: cleanupDelaySeconds)
            ) { [self] in
                self.finishVoice(voiceId)
            }
        }
    }

    private func finishVoice(_ voiceId: UUID) {
        guard let voice = activeVoices[voiceId] else { return }
        stopVoice(voice) { [self] in
            guard let stoppedVoice = self.activeVoices.removeValue(forKey: voiceId) else { return }
            self.availableVoicesByKey[stoppedVoice.poolKey, default: []].append(stoppedVoice)
        }
    }

    private func stopVoice(
        _ voice: PlaybackVoice,
        immediate: Bool = false,
        completion: (() -> Void)? = nil
    ) {
        voice.fadeSequence += 1
        let fadeSequence = voice.fadeSequence
        let finalize = {
            guard voice.fadeSequence == fadeSequence else { return }
            voice.player.stop()
            voice.player.reset()
            voice.rate.reset()
            voice.player.volume = 1
            voice.rate.rate = 1
            voice.gainMixer.outputVolume = 1
            voice.isFadingOut = false
            completion?()
        }

        if immediate || !voice.player.isPlaying {
            finalize()
            return
        }
        if voice.isFadingOut { return }

        voice.isFadingOut = true
        let fadeLevels: [Float] = [0.7, 0.35, 0]
        for (index, level) in fadeLevels.enumerated() {
            let delaySeconds = voiceFadeStepDurationSeconds * Double(index)
            engineQueue.asyncAfter(deadline: .now() + delaySeconds) {
                guard voice.isFadingOut, voice.fadeSequence == fadeSequence else { return }
                voice.gainMixer.outputVolume = level
                if index == fadeLevels.count - 1 {
                    self.engineQueue.asyncAfter(deadline: .now() + self.voiceFadeStepDurationSeconds) {
                        guard voice.isFadingOut, voice.fadeSequence == fadeSequence else { return }
                        finalize()
                    }
                }
            }
        }
    }

    private func destroyVoice(_ voice: PlaybackVoice) {
        stopVoice(voice, immediate: true)
        audioEngine.disconnectNodeOutput(voice.player)
        audioEngine.disconnectNodeInput(voice.rate)
        audioEngine.disconnectNodeOutput(voice.rate)
        audioEngine.disconnectNodeInput(voice.gainMixer)
        audioEngine.disconnectNodeOutput(voice.gainMixer)
        if audioEngine.attachedNodes.contains(voice.player) {
            audioEngine.detach(voice.player)
        }
        if audioEngine.attachedNodes.contains(voice.rate) {
            audioEngine.detach(voice.rate)
        }
        if audioEngine.attachedNodes.contains(voice.gainMixer) {
            audioEngine.detach(voice.gainMixer)
        }
    }

    private func refillScheduleHorizonLocked() throws {
        guard let state = currentPlaybackState, let payload = scheduledPayload else { return }

        let nowHostTime = mach_absolute_time()
        let scheduleHorizonSeconds = min(
            schedulerHorizonMaximumSeconds,
            max(
                schedulerHorizonMinimumSeconds,
                state.cycleDurationSeconds * Double(schedulerHorizonCycles)
            )
        )
        let scheduleCutoffHostTime = nowHostTime + AVAudioTime.hostTime(forSeconds: scheduleHorizonSeconds)
        let rangeStart = scheduledUpToHostTime

        // rangeStart 時刻が属するサイクルを起点にする
        var cycleIndex = 0
        if rangeStart > state.renderBaseHostTime {
            let elapsed = secondsForHostTimeDelta(rangeStart - state.renderBaseHostTime)
            cycleIndex = max(0, Int(elapsed / state.cycleDurationSeconds))
        }

        while true {
            let cycleStartHostTime = state.renderBaseHostTime + AVAudioTime.hostTime(
                forSeconds: state.cycleDurationSeconds * Double(cycleIndex)
            )
            if cycleStartHostTime > scheduleCutoffHostTime { break }

            try scheduleEventsInRange(
                payload: payload,
                state: state,
                cycleStartHostTime: cycleStartHostTime,
                rangeStart: rangeStart,
                rangeEnd: scheduleCutoffHostTime
            )

            cycleIndex += 1
            if !state.loop { break }
        }

        scheduledUpToHostTime = scheduleCutoffHostTime
    }

    private func startSchedulerTimerLocked() {
        cancelSchedulerTimerLocked()
        guard currentPlaybackState?.loop == true else { return }

        let timer = DispatchSource.makeTimerSource(queue: engineQueue)
        timer.schedule(deadline: .now() + schedulerTickSeconds, repeating: schedulerTickSeconds)
        timer.setEventHandler { [weak self] in
            guard let self else { return }
            try? self.refillScheduleHorizonLocked()
        }
        schedulerTimer = timer
        timer.resume()
    }

    private func cancelSchedulerTimerLocked() {
        schedulerTimer?.cancel()
        schedulerTimer = nil
    }

    private func scheduleWorkItem(sessionId: Int, hostTime: UInt64, work: @escaping () -> Void) {
        engineQueue.asyncAfter(deadline: .now() + max(0, secondsUntilHostTime(hostTime))) { [self] in
            guard self.playbackSessionId == sessionId else { return }
            work()
        }
    }

    private func playbackStatusLocked() -> [String: Any] {
        let ready = isPlaybackReadyLocked()
        guard let state = currentPlaybackState, audioEngine.isRunning else {
            return [
                "playing": false,
                "ready": ready,
                "readyAtMs": playbackReadyAtMs,
            ]
        }

        let nowHostTime = mach_absolute_time()
        let elapsedSeconds: Double
        if nowHostTime <= state.audibleBaseHostTime {
            elapsedSeconds = 0
        } else {
            elapsedSeconds = secondsForHostTimeDelta(nowHostTime - state.audibleBaseHostTime)
        }

        let cycleSteps = Double(max(1, state.cycleSteps))
        let elapsedSteps = elapsedSeconds / max(0.000_001, state.secondsPerStep)
        if !state.loop && elapsedSteps >= cycleSteps {
            return [
                "playing": false,
                "ready": ready,
                "readyAtMs": playbackReadyAtMs,
                "startStep": state.startStep,
                "endStepExclusive": state.endStepExclusive,
                "startedAtMs": state.startedAtMs
            ]
        }

        let positionOffsetSteps = state.loop
            ? elapsedSteps.truncatingRemainder(dividingBy: cycleSteps)
            : min(elapsedSteps, max(0, cycleSteps - 0.001))
        let positionStep = min(
            Double(state.endStepExclusive) - 0.001,
            Double(state.startStep) + positionOffsetSteps
        )
        let currentStep = min(
            state.endStepExclusive - 1,
            max(state.startStep, Int(floor(positionStep)))
        )

        return [
            "playing": true,
            "ready": ready,
            "readyAtMs": playbackReadyAtMs,
            "loop": state.loop,
            "startStep": state.startStep,
            "endStepExclusive": state.endStepExclusive,
            "positionStep": positionStep,
            "currentStep": currentStep,
            "startedAtMs": state.startedAtMs
        ]
    }

    private func isPlaybackReadyLocked() -> Bool {
        if !audioEngine.isRunning { return false }
        return currentTimeMs() >= playbackReadyAtMs
    }

    private func currentTimeMs() -> Int {
        Int(Date().timeIntervalSince1970 * 1000)
    }

    private func nearestSample(instrumentId: String, note: String) -> CachedSample? {
        guard let targetMidi = noteToMidi(note) else { return nil }
        let candidates = sampleCache[instrumentId] ?? []
        return candidates.min(by: { abs($0.rootMidi - targetMidi) < abs($1.rootMidi - targetMidi) })
    }

    private func secondsPerStep(bpm: Double, stepsPerBeat: Int) -> Double {
        let safeBpm = max(1, bpm)
        let safeStepsPerBeat = max(1, stepsPerBeat)
        return (60.0 / safeBpm) / Double(safeStepsPerBeat)
    }

    private func durationForStepCount(_ stepCount: Int, bpm: Double, stepsPerBeat: Int) -> Double {
        secondsPerStep(bpm: bpm, stepsPerBeat: stepsPerBeat) * Double(max(0, stepCount))
    }

    private func secondsForHostTimeDelta(_ hostTimeDelta: UInt64) -> Double {
        var timebase = mach_timebase_info_data_t()
        mach_timebase_info(&timebase)
        let nanos = Double(hostTimeDelta) * Double(timebase.numer) / Double(timebase.denom)
        return nanos / 1_000_000_000.0
    }

    private func secondsUntilHostTime(_ hostTime: UInt64) -> Double {
        let now = mach_absolute_time()
        guard hostTime > now else { return 0 }
        return secondsForHostTimeDelta(hostTime - now)
    }

    private func estimatedOutputLatencySeconds() -> Double {
        let session = AVAudioSession.sharedInstance()
        let outputNodeLatency = audioEngine.outputNode.presentationLatency
        return max(0, session.outputLatency + session.ioBufferDuration + outputNodeLatency)
    }

    private func noteToMidi(_ note: String) -> Int? {
        let pattern = #"^([A-G])(#?)(-?\d+)$"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(location: 0, length: note.utf16.count)
        guard let match = regex.firstMatch(in: note, options: [], range: range) else { return nil }

        func capture(_ index: Int) -> String? {
            guard let captureRange = Range(match.range(at: index), in: note) else { return nil }
            return String(note[captureRange])
        }

        guard let letter = capture(1), let sharp = capture(2), let octaveString = capture(3), let octave = Int(octaveString) else {
            return nil
        }

        let noteName = "\(letter)\(sharp)"
        let chromatic = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        guard let noteIndex = chromatic.firstIndex(of: noteName) else { return nil }
        return (octave + 1) * 12 + noteIndex
    }
}

@objc(NativePlaybackPlugin)
public class NativePlaybackPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativePlaybackPlugin"
    public let jsName = "NativePlayback"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "preload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "warmup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "preview", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let playbackEngine = NativePlaybackEngine()

    @objc func preload(_ call: CAPPluginCall) {
        do {
            let manifests = try decode([NativePlaybackInstrumentManifest].self, from: call.options["instruments"])
            try playbackEngine.preload(manifests: manifests)
            call.resolve([
                "loadedInstrumentIds": manifests.map(\.instrumentId)
            ])
        } catch {
            call.reject("Failed to preload native playback samples.", nil, error)
        }
    }

    @objc func warmup(_ call: CAPPluginCall) {
        do {
            try playbackEngine.warmup()
            call.resolve(["warmed": true])
        } catch {
            call.reject("Failed to warm up native playback.", nil, error)
        }
    }

    @objc func play(_ call: CAPPluginCall) {
        do {
            let payload = try decodePlaybackPayload(from: call)
            let timing = try playbackEngine.play(payload: payload)
            call.resolve([
                "started": true,
                "startDelayMs": timing.startDelayMs,
                "startedAtMs": timing.startedAtMs
            ])
        } catch {
            call.reject("Failed to start native playback.", nil, error)
        }
    }

    @objc func preview(_ call: CAPPluginCall) {
        do {
            guard let instrumentId = call.getString("instrumentId"),
                  let note = call.getString("note") else {
                throw NSError(
                    domain: "NativePlayback",
                    code: 5,
                    userInfo: [NSLocalizedDescriptionKey: "Missing preview instrumentId or note."]
                )
            }
            let durationSeconds = max(0.08, call.getDouble("durationSeconds") ?? 0.35)
            let volume = max(0, min(1, call.getDouble("volume") ?? 1))
            let secondsPerStep = 60.0 / 120.0 / 12.0
            let durationSteps = max(1, Int((durationSeconds / secondsPerStep).rounded()))
            let previewPayload = NativePlaybackPayload(
                bpm: 120,
                stepsPerBeat: 12,
                stepsPerMeasure: 48,
                startStep: 0,
                endStepExclusive: 1,
                loop: false,
                tracks: [
                    NativePlaybackTrack(
                        trackId: -1,
                        instrument: instrumentId,
                        playbackInstrument: instrumentId,
                        volume: volume,
                        muted: false
                    )
                ],
                events: [
                    NativePlaybackEvent(
                        step: 0,
                        trackId: -1,
                        instrument: instrumentId,
                        playbackInstrument: instrumentId,
                        notes: [note],
                        durationSteps: durationSteps,
                        volume: volume
                    )
                ]
            )
            _ = try playbackEngine.play(payload: previewPayload)
            call.resolve(["started": true])
        } catch {
            call.reject("Failed to preview native playback.", nil, error)
        }
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        call.resolve(playbackEngine.playbackStatus())
    }

    @objc func stop(_ call: CAPPluginCall) {
        playbackEngine.stop()
        call.resolve(["stopped": true])
    }

    private func decode<T: Decodable>(_ type: T.Type, from value: Any?) throws -> T {
        guard let value else {
            throw NSError(
                domain: "NativePlayback",
                code: 3,
                userInfo: [NSLocalizedDescriptionKey: "Missing plugin payload."]
            )
        }
        let data = try JSONSerialization.data(withJSONObject: value, options: [])
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func decodePlaybackPayload(from call: CAPPluginCall) throws -> NativePlaybackPayload {
        if let payloadJson = call.getString("payloadJson") {
            guard let data = payloadJson.data(using: .utf8) else {
                throw NSError(
                    domain: "NativePlayback",
                    code: 4,
                    userInfo: [NSLocalizedDescriptionKey: "Invalid payloadJson encoding."]
                )
            }
            return try JSONDecoder().decode(NativePlaybackPayload.self, from: data)
        }
        return try decode(NativePlaybackPayload.self, from: call.options["payload"])
    }
}
