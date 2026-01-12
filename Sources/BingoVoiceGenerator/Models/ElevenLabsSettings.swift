import Foundation

// MARK: - Voice Settings

struct VoiceSettings: Codable, Sendable, Equatable {
    var stability: Double
    var similarityBoost: Double
    var style: Double
    var useSpeakerBoost: Bool

    static let `default` = VoiceSettings(
        stability: 0.5,  // Natural (v3 accepts: 0.0=Creative, 0.5=Natural, 1.0=Robust)
        similarityBoost: 0.85,
        style: 0.75,
        useSpeakerBoost: true
    )

    var asDictionary: [String: Any] {
        [
            "stability": stability,
            "similarity_boost": similarityBoost,
            "style": style,
            "use_speaker_boost": useSpeakerBoost,
        ]
    }
}

// MARK: - Model Selection

enum ElevenLabsModel: String, CaseIterable, Identifiable, Codable, Sendable {
    case elevenV3 = "eleven_v3"
    case elevenTurboV2 = "eleven_turbo_v2"
    case elevenMultilingualV2 = "eleven_multilingual_v2"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .elevenV3: "Eleven v3 (Latest)"
        case .elevenTurboV2: "Turbo v2 (Fast)"
        case .elevenMultilingualV2: "Multilingual v2"
        }
    }

    var description: String {
        switch self {
        case .elevenV3: "Highest quality, best for production"
        case .elevenTurboV2: "Faster generation, good quality"
        case .elevenMultilingualV2: "Best for non-English languages"
        }
    }
}

// MARK: - Output Format

enum OutputFormat: String, CaseIterable, Identifiable, Codable, Sendable {
    case mp3_44100_128 = "mp3_44100_128"
    case mp3_44100_192 = "mp3_44100_192"
    case mp3_22050_32 = "mp3_22050_32"
    case pcm_16000 = "pcm_16000"
    case pcm_22050 = "pcm_22050"
    case pcm_44100 = "pcm_44100"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .mp3_44100_128: "MP3 44.1kHz 128kbps"
        case .mp3_44100_192: "MP3 44.1kHz 192kbps (HQ)"
        case .mp3_22050_32: "MP3 22kHz 32kbps (Small)"
        case .pcm_16000: "PCM 16kHz"
        case .pcm_22050: "PCM 22kHz"
        case .pcm_44100: "PCM 44.1kHz (HQ)"
        }
    }

    var fileExtension: String {
        rawValue.hasPrefix("mp3") ? "mp3" : "wav"
    }
}
