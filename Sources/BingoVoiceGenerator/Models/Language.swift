import Foundation

enum Language: String, CaseIterable, Identifiable, Codable, Sendable {
    case spanish = "es-ES"
    case english = "en-US"
    case englishGB = "en-GB"
    case french = "fr-FR"
    case portuguese = "pt-BR"
    case italian = "it-IT"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .spanish: "Español"
        case .english: "English (US)"
        case .englishGB: "English (UK)"
        case .french: "Français"
        case .portuguese: "Português"
        case .italian: "Italiano"
        }
    }

    var flag: String {
        switch self {
        case .spanish: "🇪🇸"
        case .english: "🇺🇸"
        case .englishGB: "🇬🇧"
        case .french: "🇫🇷"
        case .portuguese: "🇧🇷"
        case .italian: "🇮🇹"
        }
    }

    /// Language code for ElevenLabs API (e.g., "es", "en", "fr")
    var elevenLabsCode: String {
        switch self {
        case .spanish: "es"
        case .english: "en"
        case .englishGB: "en"
        case .french: "fr"
        case .portuguese: "pt"
        case .italian: "it"
        }
    }

    /// Accent for ElevenLabs shared voices API filter
    var elevenLabsAccent: String {
        switch self {
        case .spanish: "peninsular"
        case .english: "american"
        case .englishGB: "british"
        case .french: "standard"
        case .portuguese: "brazilian"
        case .italian: "standard"
        }
    }
}
