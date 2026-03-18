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
    private let loopScheduleLookaheadSeconds = 0.35
    private let voiceCleanupTailSeconds = 0.08

    private let audioEngine = AVAudioEngine()
    private var trackMixers: [Int: AVAudioMixerNode] = [:]
    private var instrumentManifests: [String: NativePlaybackInstrumentManifest] = [:]
    private var sampleCache: [String: [CachedSample]] = [:]
    private var activeVoices: [UUID: PlaybackVoice] = [:]
    private var pendingWorkItems: [DispatchWorkItem] = []
    private var playbackSessionId = 0

    init() {
        audioEngine.mainMixerNode.outputVolume = 1
    }

    func preload(manifests: [NativePlaybackInstrumentManifest]) throws {
        var nextManifestMap: [String: NativePlaybackInstrumentManifest] = [:]
        var nextCache: [String: [CachedSample]] = [:]

        for manifest in manifests {
            nextManifestMap[manifest.instrumentId] = manifest
            nextCache[manifest.instrumentId] = try loadSamples(for: manifest)
        }

        instrumentManifests = nextManifestMap
        sampleCache = nextCache
    }

    var startDelayMilliseconds: Int {
        Int(leadTimeSeconds * 1000)
    }

    func play(payload: NativePlaybackPayload) throws {
        stop()
        playbackSessionId += 1
        let sessionId = playbackSessionId
        let cycleDurationSeconds = durationForStepCount(
            payload.endStepExclusive - payload.startStep,
            bpm: payload.bpm,
            stepsPerBeat: payload.stepsPerBeat
        )
        let baseHostTime = mach_absolute_time() + AVAudioTime.hostTime(forSeconds: leadTimeSeconds)

        payload.tracks.forEach { track in
            let mixer = ensureTrackMixer(trackId: track.trackId)
            mixer.outputVolume = track.muted ? 0 : Float(max(0, min(1, track.volume)))
        }

        try ensureEngineStarted()

        try scheduleCycle(
            payload: payload,
            sessionId: sessionId,
            cycleIndex: 0,
            cycleDurationSeconds: cycleDurationSeconds,
            baseHostTime: baseHostTime
        )
    }

    func stop() {
        playbackSessionId += 1
        pendingWorkItems.forEach { $0.cancel() }
        pendingWorkItems.removeAll()

        let voices = activeVoices
        activeVoices.removeAll()
        voices.values.forEach { cleanupVoice($0) }
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
        cycleIndex: Int,
        cycleDurationSeconds: Double,
        baseHostTime: UInt64
    ) throws {
        guard playbackSessionId == sessionId else { return }

        let cycleStartOffsetSeconds = cycleDurationSeconds * Double(cycleIndex)
        let cycleHostTime = baseHostTime + AVAudioTime.hostTime(forSeconds: cycleStartOffsetSeconds)

        for event in payload.events {
            let relativeStep = event.step - payload.startStep
            if relativeStep < 0 { continue }
            let eventOffsetSeconds = durationForStepCount(relativeStep, bpm: payload.bpm, stepsPerBeat: payload.stepsPerBeat)
            try scheduleEvent(
                event,
                payload: payload,
                sessionId: sessionId,
                hostTime: cycleHostTime + AVAudioTime.hostTime(forSeconds: eventOffsetSeconds),
                cleanupDelaySeconds: leadTimeSeconds + cycleStartOffsetSeconds + eventOffsetSeconds,
                secondsPerStep: secondsPerStep(bpm: payload.bpm, stepsPerBeat: payload.stepsPerBeat)
            )
        }

        if payload.loop {
            let scheduleDelaySeconds = leadTimeSeconds + cycleStartOffsetSeconds + max(0.05, cycleDurationSeconds - loopScheduleLookaheadSeconds)
            scheduleWorkItem(sessionId: sessionId, delaySeconds: scheduleDelaySeconds) { [weak self] in
                guard let self else { return }
                try? self.scheduleCycle(
                    payload: payload,
                    sessionId: sessionId,
                    cycleIndex: cycleIndex + 1,
                    cycleDurationSeconds: cycleDurationSeconds,
                    baseHostTime: baseHostTime
                )
            }
        }
    }

    private func scheduleEvent(
        _ event: NativePlaybackEvent,
        payload: NativePlaybackPayload,
        sessionId: Int,
        hostTime: UInt64,
        cleanupDelaySeconds: Double,
        secondsPerStep: Double
    ) throws {
        let trackMixer = ensureTrackMixer(trackId: event.trackId)
        let instrumentId = event.playbackInstrument ?? payload.tracks.first(where: { $0.trackId == event.trackId })?.playbackInstrument ?? event.instrument

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
            voice.player.scheduleBuffer(sample.buffer, at: AVAudioTime(hostTime: hostTime), options: [], completionHandler: nil)
            voice.player.play()

            let durationSeconds = max(secondsPerStep, secondsPerStep * Double(max(1, event.durationSteps)))
            scheduleWorkItem(
                sessionId: sessionId,
                delaySeconds: cleanupDelaySeconds + durationSeconds + voiceCleanupTailSeconds
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
        if audioEngine.attachedNodes.contains(voice.player) {
            audioEngine.detach(voice.player)
        }
        if audioEngine.attachedNodes.contains(voice.rate) {
            audioEngine.detach(voice.rate)
        }
    }

    private func scheduleWorkItem(sessionId: Int, delaySeconds: Double, work: @escaping () -> Void) {
        let item = DispatchWorkItem { [weak self] in
            guard let self, self.playbackSessionId == sessionId else { return }
            work()
        }
        pendingWorkItems.append(item)
        DispatchQueue.main.asyncAfter(deadline: .now() + delaySeconds, execute: item)
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
            let payload = try decode(NativePlaybackPayload.self, from: call.options["payload"])
            try playbackEngine.play(payload: payload)
            call.resolve([
                "started": true,
                "startDelayMs": playbackEngine.startDelayMilliseconds
            ])
        } catch {
            call.reject("Failed to start native playback.", nil, error)
        }
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
}
