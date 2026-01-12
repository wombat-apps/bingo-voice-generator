import Foundation

struct Voice: Identifiable, Hashable, Codable, Sendable {
    let uuid: UUID
    let elevenLabsId: String
    let elevenLabsName: String
    let customName: String
    let language: Language

    var id: UUID { uuid }

    /// Safe name for file system paths (sanitized customName)
    var fileSystemName: String { customName.sanitizedForFileSystem() }

    init(elevenLabsId: String, elevenLabsName: String, customName: String? = nil, language: Language) {
        self.uuid = UUID()
        self.elevenLabsId = elevenLabsId
        self.elevenLabsName = elevenLabsName
        self.customName = customName ?? elevenLabsName
        self.language = language
    }

    init(uuid: UUID, elevenLabsId: String, elevenLabsName: String, customName: String, language: Language) {
        self.uuid = uuid
        self.elevenLabsId = elevenLabsId
        self.elevenLabsName = elevenLabsName
        self.customName = customName
        self.language = language
    }

    // MARK: - Codable Migration

    private enum CodingKeys: String, CodingKey {
        case uuid
        case elevenLabsId
        case elevenLabsName
        case customName
        case language
        // Legacy key
        case name
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        uuid = try container.decode(UUID.self, forKey: .uuid)
        elevenLabsId = try container.decode(String.self, forKey: .elevenLabsId)
        language = try container.decode(Language.self, forKey: .language)

        // Migration: check for new keys first, fall back to legacy
        if let newElevenLabsName = try container.decodeIfPresent(String.self, forKey: .elevenLabsName) {
            elevenLabsName = newElevenLabsName
            customName = try container.decodeIfPresent(String.self, forKey: .customName) ?? newElevenLabsName
        } else if let legacyName = try container.decodeIfPresent(String.self, forKey: .name) {
            // Legacy migration: old "name" becomes both elevenLabsName and customName
            elevenLabsName = legacyName
            customName = legacyName
        } else {
            throw DecodingError.dataCorruptedError(
                forKey: .elevenLabsName,
                in: container,
                debugDescription: "Missing voice name"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(uuid, forKey: .uuid)
        try container.encode(elevenLabsId, forKey: .elevenLabsId)
        try container.encode(elevenLabsName, forKey: .elevenLabsName)
        try container.encode(customName, forKey: .customName)
        try container.encode(language, forKey: .language)
    }
}

// MARK: - String Sanitization

extension String {
    /// Sanitizes string for safe file system usage
    /// - Replaces spaces with underscores
    /// - Removes special characters except alphanumeric, underscore, hyphen
    /// - Lowercases the result
    /// - Falls back to "voice" if result is empty
    func sanitizedForFileSystem() -> String {
        let allowedCharacters = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "_-"))

        let sanitized = self
            .trimmingCharacters(in: .whitespaces)
            .lowercased()
            .replacingOccurrences(of: " ", with: "_")
            .unicodeScalars
            .filter { allowedCharacters.contains($0) }
            .map { Character($0) }
            .reduce(into: "") { $0.append($1) }

        return sanitized.isEmpty ? "voice" : sanitized
    }
}
