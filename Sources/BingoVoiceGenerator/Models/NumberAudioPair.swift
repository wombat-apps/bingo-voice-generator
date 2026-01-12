import Foundation

struct NumberAudioPair: Sendable, Equatable {
    let number: Int
    var wordAudio: AudioFile?
    var digitAudio: AudioFile?

    /// Whether this number needs a digit audio (numbers 10+ need both parts)
    var needsDigit: Bool { number >= 10 }

    /// Whether all required parts are present
    var isComplete: Bool {
        wordAudio != nil && (digitAudio != nil || !needsDigit)
    }

    /// Whether any part is present
    var hasAny: Bool { wordAudio != nil || digitAudio != nil }

    /// Total duration of all parts
    var totalDuration: TimeInterval {
        (wordAudio?.duration ?? 0) + (digitAudio?.duration ?? 0)
    }

    /// Formatted total duration
    var formattedDuration: String {
        let duration = totalDuration
        let totalSeconds = Int(duration)
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        let tenths = Int((duration - Double(totalSeconds)) * 10)
        return String(format: "%d:%02d.%d", minutes, seconds, tenths)
    }

    /// Get the audio file for a specific part
    func audio(for part: AudioPart) -> AudioFile? {
        switch part {
        case .word: wordAudio
        case .digit: digitAudio
        }
    }

    /// Check if a specific part exists
    func has(_ part: AudioPart) -> Bool {
        audio(for: part) != nil
    }

    /// Get all existing audio files as an array (for playback)
    var allAudioFiles: [AudioFile] {
        var files: [AudioFile] = []
        if let word = wordAudio { files.append(word) }
        if let digit = digitAudio { files.append(digit) }
        return files
    }

    /// Get the parts that are missing
    var missingParts: [AudioPart] {
        var parts: [AudioPart] = []
        if wordAudio == nil { parts.append(.word) }
        if needsDigit && digitAudio == nil { parts.append(.digit) }
        return parts
    }

    /// Get the parts that should exist for this number
    var requiredParts: [AudioPart] {
        needsDigit ? [.word, .digit] : [.word]
    }
}
