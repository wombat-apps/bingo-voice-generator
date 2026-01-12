import AVFoundation
import Foundation

actor WaveformService {
    static let shared = WaveformService()

    private var cache: [URL: WaveformData] = [:]
    private let targetSampleCount = 70
    private let cacheDirectory: URL

    private init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        cacheDirectory = caches.appendingPathComponent("BingoVoiceGenerator/Waveforms", isDirectory: true)
    }

    /// Converts an audio file URL to its corresponding waveform cache URL
    /// Audio: ~/Library/Application Support/BingoVoiceGenerator/{lang}/{voice}/{file}.mp3
    /// Cache: ~/Library/Caches/BingoVoiceGenerator/Waveforms/{lang}/{voice}/{file}.json
    private func getCacheURL(for audioURL: URL) -> URL {
        let components = audioURL.pathComponents
        // Extract last 3 components: lang, voice, filename
        guard components.count >= 3 else {
            return cacheDirectory.appendingPathComponent(audioURL.deletingPathExtension().lastPathComponent + ".json")
        }
        let lang = components[components.count - 3]
        let voice = components[components.count - 2]
        let filename = audioURL.deletingPathExtension().lastPathComponent + ".json"
        return cacheDirectory
            .appendingPathComponent(lang, isDirectory: true)
            .appendingPathComponent(voice, isDirectory: true)
            .appendingPathComponent(filename)
    }

    func getWaveform(for audioFile: AudioFile) async -> WaveformData? {
        let fileURL = audioFile.fileURL

        // Check in-memory cache
        if let cached = cache[fileURL] {
            return cached
        }

        // Check disk cache
        let cacheURL = getCacheURL(for: fileURL)
        if FileManager.default.fileExists(atPath: cacheURL.path),
           let data = try? Data(contentsOf: cacheURL),
           let waveform = try? JSONDecoder().decode(WaveformData.self, from: data) {
            cache[fileURL] = waveform
            return waveform
        }

        // Extract waveform
        guard let waveform = extractWaveform(from: fileURL) else {
            return nil
        }

        cache[fileURL] = waveform

        // Persist to disk (fire and forget)
        if let data = try? JSONEncoder().encode(waveform) {
            let directory = cacheURL.deletingLastPathComponent()
            try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try? data.write(to: cacheURL)
        }

        return waveform
    }

    private nonisolated func extractWaveform(from url: URL) -> WaveformData? {
        guard let file = try? AVAudioFile(forReading: url) else {
            return nil
        }

        let format = file.processingFormat
        let frameCount = AVAudioFrameCount(file.length)

        guard frameCount > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else {
            return nil
        }

        do {
            try file.read(into: buffer)
        } catch {
            return nil
        }

        guard let floatData = buffer.floatChannelData?[0] else {
            return nil
        }

        let totalFrames = Int(frameCount)
        let samplesPerBucket = max(1, totalFrames / targetSampleCount)
        var samples: [Float] = []

        for i in 0..<targetSampleCount {
            let start = i * samplesPerBucket
            let end = min(start + samplesPerBucket, totalFrames)
            var maxAmplitude: Float = 0

            for j in start..<end {
                maxAmplitude = max(maxAmplitude, abs(floatData[j]))
            }
            samples.append(maxAmplitude)
        }

        // Normalize
        let maxSample = samples.max() ?? 1.0
        guard maxSample > 0 else {
            return WaveformData(samples: Array(repeating: 0.1, count: targetSampleCount))
        }

        let normalizedSamples = samples.map { $0 / maxSample }

        return WaveformData(samples: normalizedSamples)
    }

    func clearCache() {
        cache.removeAll()
    }

    /// Invalidates the cache for a specific audio file URL
    /// Call this after trimming or modifying an audio file
    func invalidateCache(for url: URL) {
        cache.removeValue(forKey: url)

        // Also delete disk cache
        let cacheURL = getCacheURL(for: url)
        try? FileManager.default.removeItem(at: cacheURL)
    }
}
