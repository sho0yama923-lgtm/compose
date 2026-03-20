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
    let trackId: Int

    init(trackId: Int) {
        self.trackId = trackId
    }
}

private final class NativePlaybackEngine {
    private let leadTimeSeconds = 0.18
    private let schedulerTickSeconds = 0.12
    private let schedulerHorizonMinimumSeconds = 0.45
    private let schedulerHorizonMaximumSeconds = 0.9
    private let schedulerHorizonCycles = 1
    private let schedulerLateGraceSeconds = 0.04
    private let voiceCleanupTailSeconds = 0.08

    private let audioEngine = AVAudioEngine()
    private let engineQueue = DispatchQueue(label: "NativePlaybackEngine.queue")
    private var trackMixers: [Int: AVAudioMixerNode] = [:]
    private var sampleCache: [String: [CachedSample]] = [:]
    private var activeVoices: [UUID: PlaybackVoice] = [:]
    private var schedulerTimer: DispatchSourceTimer?
    private var scheduledPayload: NativePlaybackPayload?
    private var scheduledCycleCount = 0
    private var playbackSessionId = 0
    private var currentPlaybackState: NativePlaybackState?

    init() {
        audioEngine.mainMixerNode.outputVolume = 1
    }

    func preload(manifests: [NativePlaybackInstrumentManifest]) throws {
        try engineQueue.sync {
            var nextCache: [String: [CachedSample]] = [:]

            for manifest in manifests {
                nextCache[manifest.instrumentId] = try loadSamples(for: manifest)
            }

            sampleCache = nextCache
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
        let playStartUptime = ProcessInfo.processInfo.systemUptime
        let playStartWallClock = Date().timeIntervalSince1970
        let cycleSteps = max(1, payload.endStepExclusive - payload.startStep)
        let cycleDurationSeconds = durationForStepCount(
            cycleSteps,
            bpm: payload.bpm,
            stepsPerBeat: payload.stepsPerBeat
        )
        let renderBaseHostTime = mach_absolute_time() + AVAudioTime.hostTime(forSeconds: leadTimeSeconds)
        let outputLatencySeconds = estimatedOutputLatencySeconds()
        let audibleBaseHostTime = renderBaseHostTime + AVAudioTime.hostTime(forSeconds: outputLatencySeconds)
        audioEngine.mainMixerNode.outputVolume = 1

        payload.tracks.forEach { track in
            let mixer = ensureTrackMixer(trackId: track.trackId)
            mixer.outputVolume = track.muted ? 0 : Float(max(0, min(1, track.volume)))
        }

        try ensureEngineStarted()

        let schedulingElapsed = max(0, ProcessInfo.processInfo.systemUptime - playStartUptime)
        let remainingLeadTime = max(0, leadTimeSeconds - schedulingElapsed)
        let startedAtMs = Int((playStartWallClock + remainingLeadTime + outputLatencySeconds) * 1000)

        scheduledPayload = payload
        scheduledCycleCount = 0
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
        return (Int(remainingLeadTime * 1000), startedAtMs)
    }

    private func stopLocked() {
        playbackSessionId += 1
        cancelSchedulerTimerLocked()
        scheduledPayload = nil
        scheduledCycleCount = 0
        currentPlaybackState = nil
        audioEngine.mainMixerNode.outputVolume = 0

        let voices = activeVoices
        activeVoices.removeAll()
        voices.values.forEach { cleanupVoice($0) }
        if audioEngine.isRunning {
            audioEngine.pause()
        }
    }

    private func ensureEngineStarted() throws {
        if audioEngine.isRunning { return }
        audioEngine.prepare()
        try audioEngine.start()
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

    private func ensureTrackMixer(trackId: Int) -> AVAudioMixerNode {
        if let mixer = trackMixers[trackId] {
            return mixer
        }

        let mixer = AVAudioMixerNode()
        audioEngine.attach(mixer)
        audioEngine.connect(mixer, to: audioEngine.mainMixerNode, format: nil)
        trackMixers[trackId] = mixer
        return mixer
    }

    private func scheduleCycle(
        payload: NativePlaybackPayload,
        sessionId: Int,
        cycleStartHostTime: UInt64
    ) throws {
        guard playbackSessionId == sessionId else { return }

        for event in payload.events {
            let relativeStep = event.step - payload.startStep
            if relativeStep < 0 { continue }
            let eventOffsetSeconds = durationForStepCount(relativeStep, bpm: payload.bpm, stepsPerBeat: payload.stepsPerBeat)
            try scheduleEvent(
                event,
                payload: payload,
                sessionId: sessionId,
                hostTime: cycleStartHostTime + AVAudioTime.hostTime(forSeconds: eventOffsetSeconds),
                secondsPerStep: secondsPerStep(bpm: payload.bpm, stepsPerBeat: payload.stepsPerBeat)
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
        let trackMixer = ensureTrackMixer(trackId: event.trackId)
        let instrumentId = event.playbackInstrument
            ?? payload.tracks.first(where: { $0.trackId == event.trackId })?.playbackInstrument
            ?? event.instrument

        for note in event.notes {
            guard let sample = nearestSample(instrumentId: instrumentId, note: note) else { continue }
            guard let targetMidi = noteToMidi(note) else { continue }

            let voiceId = UUID()
            let voice = PlaybackVoice(trackId: event.trackId)
            activeVoices[voiceId] = voice

            audioEngine.attach(voice.player)
            audioEngine.attach(voice.rate)
            audioEngine.connect(voice.player, to: voice.rate, format: sample.buffer.format)
            audioEngine.connect(voice.rate, to: trackMixer, format: sample.buffer.format)

            voice.player.volume = Float(max(0, min(1, event.volume)))
            voice.rate.rate = powf(2, Float(targetMidi - sample.rootMidi) / 12)
            voice.player.prepare(withFrameCount: sample.buffer.frameLength)
            voice.player.scheduleBuffer(sample.buffer, at: nil, options: [], completionHandler: nil)
            voice.player.play(at: AVAudioTime(hostTime: hostTime))

            let durationSeconds = max(secondsPerStep, secondsPerStep * Double(max(1, event.durationSteps)))
            scheduleWorkItem(
                sessionId: sessionId,
                hostTime: hostTime + AVAudioTime.hostTime(forSeconds: durationSeconds + voiceCleanupTailSeconds)
            ) { [weak self] in
                self?.finishVoice(voiceId)
            }
        }
    }

    private func finishVoice(_ voiceId: UUID) {
        guard let voice = activeVoices.removeValue(forKey: voiceId) else { return }
        cleanupVoice(voice)
    }

    private func cleanupVoice(_ voice: PlaybackVoice) {
        voice.player.stop()
        voice.player.reset()
        audioEngine.disconnectNodeOutput(voice.player)
        audioEngine.disconnectNodeInput(voice.rate)
        audioEngine.disconnectNodeOutput(voice.rate)
        if audioEngine.attachedNodes.contains(voice.player) {
            audioEngine.detach(voice.player)
        }
        if audioEngine.attachedNodes.contains(voice.rate) {
            audioEngine.detach(voice.rate)
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
        let lateThresholdHostTime = nowHostTime + AVAudioTime.hostTime(forSeconds: schedulerLateGraceSeconds)
        let scheduleCutoffHostTime = nowHostTime + AVAudioTime.hostTime(forSeconds: scheduleHorizonSeconds)

        while true {
            let cycleStartHostTime = state.renderBaseHostTime + AVAudioTime.hostTime(
                forSeconds: state.cycleDurationSeconds * Double(scheduledCycleCount)
            )
            if cycleStartHostTime > scheduleCutoffHostTime { break }
            if cycleStartHostTime < lateThresholdHostTime {
                scheduledCycleCount += 1
                if !state.loop { break }
                continue
            }

            try scheduleCycle(
                payload: payload,
                sessionId: state.sessionId,
                cycleStartHostTime: cycleStartHostTime
            )
            scheduledCycleCount += 1
            if !state.loop { break }
        }
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
        engineQueue.asyncAfter(deadline: .now() + max(0, secondsUntilHostTime(hostTime))) { [weak self] in
            guard let self, self.playbackSessionId == sessionId else { return }
            work()
        }
    }

    private func playbackStatusLocked() -> [String: Any] {
        guard let state = currentPlaybackState, audioEngine.isRunning else {
            return [
                "playing": false
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
            "loop": state.loop,
            "startStep": state.startStep,
            "endStepExclusive": state.endStepExclusive,
            "positionStep": positionStep,
            "currentStep": currentStep,
            "startedAtMs": state.startedAtMs
        ]
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
