import Foundation

// MARK: - API Response Models

struct ElevenLabsVoice: Codable, Sendable {
    let voiceId: String
    let name: String
    let category: String
    let createdAtUnix: Int?

    enum CodingKeys: String, CodingKey {
        case voiceId = "voice_id"
        case name
        case category
        case createdAtUnix = "created_at_unix"
    }

    var isCustomVoice: Bool {
        // Custom voices are anything that's not premade (default ElevenLabs voices)
        category != "premade"
    }
}

struct VoicesResponse: Codable, Sendable {
    let voices: [ElevenLabsVoice]
}

struct ElevenLabsErrorDetail: Codable, Sendable {
    let status: String?
    let message: String?
}

struct ElevenLabsErrorResponse: Codable, Sendable {
    let detail: ElevenLabsErrorDetail?
}

struct SubscriptionInfo: Codable, Sendable {
    let tier: String
    let characterCount: Int
    let characterLimit: Int
    let status: String
    let nextCharacterCountResetUnix: Int?

    enum CodingKeys: String, CodingKey {
        case tier
        case characterCount = "character_count"
        case characterLimit = "character_limit"
        case status
        case nextCharacterCountResetUnix = "next_character_count_reset_unix"
    }

    var remainingCharacters: Int {
        max(0, characterLimit - characterCount)
    }

    var usagePercentage: Double {
        guard characterLimit > 0 else { return 0 }
        return Double(characterCount) / Double(characterLimit)
    }

    var nextResetDate: Date? {
        guard let unix = nextCharacterCountResetUnix else { return nil }
        return Date(timeIntervalSince1970: TimeInterval(unix))
    }
}

// MARK: - Service

actor ElevenLabsService {
    static let shared = ElevenLabsService()

    private let baseURL = "https://api.elevenlabs.io/v1"

    private init() {}

    func generateSpeech(
        text: String,
        voiceId: String,
        languageCode: String,
        apiKey: String,
        modelId: String = ElevenLabsModel.elevenV3.rawValue,
        outputFormat: String = OutputFormat.mp3_44100_128.rawValue,
        voiceSettings: [String: Any]? = nil
    ) async throws -> Data {
        guard !apiKey.isEmpty else {
            throw ElevenLabsError.noAPIKey
        }

        guard let url = URL(string: "\(baseURL)/text-to-speech/\(voiceId)?output_format=\(outputFormat)") else {
            throw ElevenLabsError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let settings = voiceSettings ?? VoiceSettings.default.asDictionary

        let body: [String: Any] = [
            "text": text,
            "model_id": modelId,
            "voice_settings": settings,
            "language_code": languageCode,
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ElevenLabsError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            let errorText = String(data: data, encoding: .utf8) ?? "Unknown error"

            // Check for voice_limit_reached error
            if let errorResponse = try? JSONDecoder().decode(ElevenLabsErrorResponse.self, from: data),
               errorResponse.detail?.status == "voice_limit_reached" {
                throw ElevenLabsError.voiceLimitReached
            }

            throw ElevenLabsError.apiError(statusCode: httpResponse.statusCode, message: errorText)
        }

        return data
    }

    // MARK: - Voice Management

    func listVoices(apiKey: String) async throws -> [ElevenLabsVoice] {
        guard !apiKey.isEmpty else {
            throw ElevenLabsError.noAPIKey
        }

        guard let url = URL(string: "\(baseURL)/voices") else {
            throw ElevenLabsError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ElevenLabsError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            let errorText = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw ElevenLabsError.apiError(statusCode: httpResponse.statusCode, message: errorText)
        }

        let voicesResponse = try JSONDecoder().decode(VoicesResponse.self, from: data)
        return voicesResponse.voices
    }

    func deleteVoice(voiceId: String, apiKey: String) async throws {
        guard !apiKey.isEmpty else {
            throw ElevenLabsError.noAPIKey
        }

        guard let url = URL(string: "\(baseURL)/voices/\(voiceId)") else {
            throw ElevenLabsError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ElevenLabsError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            let errorText = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw ElevenLabsError.apiError(statusCode: httpResponse.statusCode, message: errorText)
        }
    }

    // MARK: - Subscription

    func getSubscription(apiKey: String) async throws -> SubscriptionInfo {
        guard !apiKey.isEmpty else {
            throw ElevenLabsError.noAPIKey
        }

        guard let url = URL(string: "\(baseURL)/user/subscription") else {
            throw ElevenLabsError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ElevenLabsError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            let errorText = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw ElevenLabsError.apiError(statusCode: httpResponse.statusCode, message: errorText)
        }

        return try JSONDecoder().decode(SubscriptionInfo.self, from: data)
    }
}

enum ElevenLabsError: LocalizedError {
    case noAPIKey
    case invalidURL
    case invalidResponse
    case apiError(statusCode: Int, message: String)
    case voiceLimitReached
    case noCustomVoicesToDelete

    var errorDescription: String? {
        switch self {
        case .noAPIKey:
            "No API key configured. Please set your ElevenLabs API key in Settings."
        case .invalidURL:
            "Invalid API URL"
        case .invalidResponse:
            "Invalid response from server"
        case .apiError(let code, let message):
            "API Error (\(code)): \(message)"
        case .voiceLimitReached:
            "Voice limit reached. Unable to add more custom voices."
        case .noCustomVoicesToDelete:
            "No custom voices available to delete. Please delete a voice manually in ElevenLabs."
        }
    }
}
