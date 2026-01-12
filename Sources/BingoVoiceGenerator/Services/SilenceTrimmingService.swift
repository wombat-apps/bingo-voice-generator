import AVFoundation
import Foundation

actor SilenceTrimmingService {
    static let shared = SilenceTrimmingService()

    // Configuration
    private let silenceThresholdDB: Double = -40.0  // dB threshold for silence
    private let minSilenceDuration: Double = 0.3    // Minimum silence duration to detect (seconds)
    private let tailPadding: Double = 0.15          // Keep 150ms of tail after content
    private let fadeOutDuration: Double = 0.08      // 80ms fade-out at end
    private let silencePadding: Double = 0.08       // 80ms of absolute silence at end

    enum TrimmingError: LocalizedError {
        case ffmpegNotFound
        case silenceDetectionFailed(String)
        case trimmingFailed(String)
        case noSignificantSilence
        case fileNotFound

        var errorDescription: String? {
            switch self {
            case .ffmpegNotFound:
                return "ffmpeg not found in app bundle"
            case .silenceDetectionFailed(let detail):
                return "Failed to analyze audio: \(detail)"
            case .trimmingFailed(let detail):
                return "Failed to trim audio: \(detail)"
            case .noSignificantSilence:
                return "No significant trailing silence detected"
            case .fileNotFound:
                return "Audio file not found"
            }
        }
    }

    struct TrimmingResult: Sendable {
        let originalDuration: TimeInterval
        let trimmedDuration: TimeInterval
        var silenceTrimmed: TimeInterval {
            originalDuration - trimmedDuration
        }
    }

    private init() {}

    // MARK: - ffmpeg Path Resolution

    private var ffmpegURL: URL? {
        // Look for bundled ffmpeg in app resources
        Bundle.main.url(forResource: "ffmpeg", withExtension: nil)
    }

    // MARK: - Public API

    /// Trims trailing silence from an audio file
    /// - Parameter audioFile: The audio file to trim
    /// - Returns: TrimmingResult with original and new durations
    func trimSilence(from audioFile: AudioFile) async throws -> TrimmingResult {
        guard let ffmpeg = ffmpegURL else {
            throw TrimmingError.ffmpegNotFound
        }

        let inputURL = audioFile.fileURL

        guard FileManager.default.fileExists(atPath: inputURL.path) else {
            throw TrimmingError.fileNotFound
        }

        // 1. Detect trailing silence
        let trimPoint = try await detectTrailingSilence(in: inputURL, ffmpegURL: ffmpeg)

        // Check if trim point is close to the original duration (no significant silence)
        let originalDuration = audioFile.duration
        if trimPoint >= originalDuration - 0.1 {
            throw TrimmingError.noSignificantSilence
        }

        // 2. Create temp output file
        let tempURL = inputURL.deletingLastPathComponent()
            .appendingPathComponent(UUID().uuidString + ".mp3")

        defer {
            // Clean up temp file if still exists
            try? FileManager.default.removeItem(at: tempURL)
        }

        // 3. Trim audio to temp file
        try await trimAudio(from: inputURL, to: tempURL, duration: trimPoint, ffmpegURL: ffmpeg)

        // 4. Atomic replacement
        _ = try FileManager.default.replaceItemAt(inputURL, withItemAt: tempURL)

        // 5. Get new duration
        let newDuration = getAudioDuration(at: inputURL)

        return TrimmingResult(
            originalDuration: originalDuration,
            trimmedDuration: newDuration
        )
    }

    /// Analyzes an audio file and returns the amount of trailing silence
    /// - Parameter audioFile: The audio file to analyze
    /// - Returns: Duration of trailing silence in seconds
    func analyzeTrailingSilence(in audioFile: AudioFile) async throws -> TimeInterval {
        guard let ffmpeg = ffmpegURL else {
            throw TrimmingError.ffmpegNotFound
        }

        guard FileManager.default.fileExists(atPath: audioFile.fileURL.path) else {
            throw TrimmingError.fileNotFound
        }

        let trimPoint = try await detectTrailingSilence(in: audioFile.fileURL, ffmpegURL: ffmpeg)
        return audioFile.duration - trimPoint
    }

    // MARK: - Private Methods

    private func detectTrailingSilence(in inputURL: URL, ffmpegURL: URL) async throws -> TimeInterval {
        // Run ffmpeg silence detection
        // ffmpeg -i input.mp3 -af "silencedetect=noise=-40dB:d=0.3" -f null -
        let process = Process()
        process.executableURL = ffmpegURL
        process.arguments = [
            "-i", inputURL.path,
            "-af", "silencedetect=noise=\(Int(silenceThresholdDB))dB:d=\(minSilenceDuration)",
            "-f", "null",
            "-"
        ]

        let stderrPipe = Pipe()
        process.standardError = stderrPipe
        process.standardOutput = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            throw TrimmingError.silenceDetectionFailed(error.localizedDescription)
        }

        let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
        guard let output = String(data: stderrData, encoding: .utf8) else {
            throw TrimmingError.silenceDetectionFailed("Could not read ffmpeg output")
        }

        // Parse silence detection output
        // Lines look like:
        // [silencedetect @ 0x...] silence_start: 1.234
        // [silencedetect @ 0x...] silence_end: 2.567 | silence_duration: 1.333

        let silenceRegions = parseSilenceRegions(from: output)

        // Get the total duration from ffmpeg output
        let totalDuration = parseDuration(from: output) ?? getAudioDuration(at: inputURL)

        guard totalDuration > 0 else {
            throw TrimmingError.silenceDetectionFailed("Could not determine audio duration")
        }

        // Find trailing silence (silence that extends to the end of the file)
        // We look for silence_start that has no corresponding silence_end (silence extends to EOF)
        // or silence_end that is very close to the total duration

        var trimPoint = totalDuration

        for region in silenceRegions {
            // Check if this silence region extends to the end of the file
            // (within a small tolerance)
            if let end = region.end {
                if abs(end - totalDuration) < 0.1 {
                    // This silence ends at the file end
                    trimPoint = region.start + tailPadding
                    break
                }
            } else {
                // No end means silence extends to EOF
                trimPoint = region.start + tailPadding
                break
            }
        }

        // Ensure we don't trim too much
        trimPoint = max(0.1, trimPoint)

        return trimPoint
    }

    private struct SilenceRegion {
        let start: TimeInterval
        let end: TimeInterval?
    }

    private func parseSilenceRegions(from output: String) -> [SilenceRegion] {
        var regions: [SilenceRegion] = []
        var pendingStart: TimeInterval?

        let lines = output.components(separatedBy: .newlines)

        for line in lines {
            if line.contains("silence_start:") {
                // Extract the time value
                if let time = extractTime(from: line, key: "silence_start:") {
                    // If we have a pending start without end, save it
                    if let start = pendingStart {
                        regions.append(SilenceRegion(start: start, end: nil))
                    }
                    pendingStart = time
                }
            } else if line.contains("silence_end:") {
                if let time = extractTime(from: line, key: "silence_end:"),
                   let start = pendingStart {
                    regions.append(SilenceRegion(start: start, end: time))
                    pendingStart = nil
                }
            }
        }

        // If there's a pending start with no end, it means silence extends to EOF
        if let start = pendingStart {
            regions.append(SilenceRegion(start: start, end: nil))
        }

        return regions
    }

    private func extractTime(from line: String, key: String) -> TimeInterval? {
        guard let range = line.range(of: key) else { return nil }
        let afterKey = line[range.upperBound...]
        let trimmed = afterKey.trimmingCharacters(in: .whitespaces)

        // Handle "silence_end: 1.234 | silence_duration: ..."
        let valueString: String
        if let pipeIndex = trimmed.firstIndex(of: "|") {
            valueString = String(trimmed[..<pipeIndex]).trimmingCharacters(in: .whitespaces)
        } else {
            valueString = String(trimmed.prefix(while: { $0.isNumber || $0 == "." || $0 == "-" }))
        }

        return TimeInterval(valueString)
    }

    private func parseDuration(from output: String) -> TimeInterval? {
        // Look for "Duration: HH:MM:SS.ms" in ffmpeg output
        let pattern = #"Duration: (\d+):(\d+):(\d+\.?\d*)"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: output, range: NSRange(output.startIndex..., in: output)) else {
            return nil
        }

        guard let hoursRange = Range(match.range(at: 1), in: output),
              let minutesRange = Range(match.range(at: 2), in: output),
              let secondsRange = Range(match.range(at: 3), in: output) else {
            return nil
        }

        let hours = Double(output[hoursRange]) ?? 0
        let minutes = Double(output[minutesRange]) ?? 0
        let seconds = Double(output[secondsRange]) ?? 0

        return hours * 3600 + minutes * 60 + seconds
    }

    private func trimAudio(from inputURL: URL, to outputURL: URL, duration: TimeInterval, ffmpegURL: URL) async throws {
        // Apply fade-out and add silence padding at the end
        // ffmpeg -i input.mp3 -t {duration} -af "afade=...,apad=..." -c:a libmp3lame -q:a 2 output.mp3
        let fadeStart = max(0, duration - fadeOutDuration)
        let audioFilter = "afade=t=out:st=\(String(format: "%.3f", fadeStart)):d=\(fadeOutDuration),apad=pad_dur=\(silencePadding)"

        let process = Process()
        process.executableURL = ffmpegURL
        process.arguments = [
            "-y",  // Overwrite output
            "-i", inputURL.path,
            "-t", String(format: "%.3f", duration),
            "-af", audioFilter,
            "-c:a", "libmp3lame",
            "-q:a", "2",  // Quality setting (0-9, lower is better)
            outputURL.path
        ]

        let stderrPipe = Pipe()
        process.standardError = stderrPipe
        process.standardOutput = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            throw TrimmingError.trimmingFailed(error.localizedDescription)
        }

        guard process.terminationStatus == 0 else {
            let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
            let errorOutput = String(data: stderrData, encoding: .utf8) ?? "Unknown error"
            throw TrimmingError.trimmingFailed("ffmpeg exited with status \(process.terminationStatus): \(errorOutput)")
        }

        // Verify output file exists
        guard FileManager.default.fileExists(atPath: outputURL.path) else {
            throw TrimmingError.trimmingFailed("Output file was not created")
        }
    }

    private nonisolated func getAudioDuration(at url: URL) -> TimeInterval {
        guard let player = try? AVAudioPlayer(contentsOf: url) else {
            return 0
        }
        return player.duration
    }
}
