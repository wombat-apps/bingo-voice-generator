import Foundation

actor ImportService {
    static let shared = ImportService()

    private let fileManager = FileManager.default

    enum ImportError: LocalizedError {
        case unzipFailed
        case voiceYmlNotFound
        case voiceYmlInvalid
        case noAudioFiles
        case invalidLanguage(String)

        var errorDescription: String? {
            switch self {
            case .unzipFailed:
                return "Failed to extract ZIP file"
            case .voiceYmlNotFound:
                return "voice.yml not found in ZIP"
            case .voiceYmlInvalid:
                return "voice.yml is invalid or missing required fields"
            case .noAudioFiles:
                return "No audio files found in ZIP"
            case .invalidLanguage(let code):
                return "Unknown language code: \(code)"
            }
        }
    }

    private init() {}

    /// Imports a voice from a ZIP file
    /// - Parameter zipURL: URL to the ZIP file
    /// - Returns: The imported Voice (caller should add to VoiceStore)
    func importVoice(from zipURL: URL) async throws -> Voice {
        // Create temporary directory for extraction
        let tempDir = fileManager.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)

        defer {
            // Clean up temp directory
            try? fileManager.removeItem(at: tempDir)
        }

        try fileManager.createDirectory(at: tempDir, withIntermediateDirectories: true)

        // Unzip
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
        process.arguments = ["-q", zipURL.path, "-d", tempDir.path]

        try process.run()
        process.waitUntilExit()

        if process.terminationStatus != 0 {
            throw ImportError.unzipFailed
        }

        // Find the extracted directory (should be named after customName)
        let contents = try fileManager.contentsOfDirectory(
            at: tempDir,
            includingPropertiesForKeys: [.isDirectoryKey]
        )

        guard let extractedDir = contents.first(where: { url in
            (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
        }) else {
            throw ImportError.voiceYmlNotFound
        }

        // Read voice.yml
        let ymlPath = extractedDir.appendingPathComponent("voice.yml")
        guard fileManager.fileExists(atPath: ymlPath.path) else {
            throw ImportError.voiceYmlNotFound
        }

        let ymlContent = try String(contentsOf: ymlPath, encoding: .utf8)
        let voiceData = parseVoiceYml(ymlContent)

        guard let elevenLabsName = voiceData["elevenLabsName"],
              let customName = voiceData["customName"],
              let elevenLabsId = voiceData["elevenLabsId"],
              let languageCode = voiceData["language"] else {
            throw ImportError.voiceYmlInvalid
        }

        guard let language = Language.allCases.first(where: { $0.rawValue == languageCode }) else {
            throw ImportError.invalidLanguage(languageCode)
        }

        // Create new voice with new UUID
        let newVoice = Voice(
            elevenLabsId: elevenLabsId,
            elevenLabsName: elevenLabsName,
            customName: customName,
            language: language
        )

        // Get all MP3 files
        let mp3Files = try fileManager.contentsOfDirectory(at: extractedDir, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "mp3" }

        if mp3Files.isEmpty {
            throw ImportError.noAudioFiles
        }

        // Copy audio files to new voice directory
        let voiceDir = await AudioStorageService.shared.voiceDirectory(language: language, voice: newVoice)
        try fileManager.createDirectory(at: voiceDir, withIntermediateDirectories: true)

        for mp3URL in mp3Files {
            let filename = mp3URL.lastPathComponent

            // Parse filename to determine mode and number
            // Format: {lang}_{name}_{number}.mp3 or {lang}_{name}_{letter}{number}.mp3
            let parsed = parseExportFilename(filename)

            guard let number = parsed.number else { continue }

            // Determine new filename based on mode
            let newFilename: String
            if let letter = parsed.letter {
                // Bingo 75 format
                newFilename = "\(letter)\(number).mp3"
            } else {
                // Bingo 90 format
                newFilename = "\(number).mp3"
            }

            let destURL = voiceDir.appendingPathComponent(newFilename)
            try fileManager.copyItem(at: mp3URL, to: destURL)
        }

        return newVoice
    }

    /// Parses simple YAML format (key: value per line)
    private func parseVoiceYml(_ content: String) -> [String: String] {
        var result: [String: String] = [:]

        for line in content.components(separatedBy: .newlines) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty else { continue }

            if let colonIndex = trimmed.firstIndex(of: ":") {
                let key = String(trimmed[..<colonIndex]).trimmingCharacters(in: .whitespaces)
                let value = String(trimmed[trimmed.index(after: colonIndex)...]).trimmingCharacters(in: .whitespaces)
                result[key] = value
            }
        }

        return result
    }

    /// Parses export filename to extract letter (if any) and number
    /// Input: "es-ES_manuel_45.mp3" or "es-ES_manuel_b15.mp3"
    /// Returns: (letter: nil, number: 45) or (letter: "b", number: 15)
    private func parseExportFilename(_ filename: String) -> (letter: String?, number: Int?) {
        // Remove .mp3 extension
        let name = filename.replacingOccurrences(of: ".mp3", with: "")

        // Split by underscore and get last component
        let components = name.components(separatedBy: "_")
        guard let lastComponent = components.last else {
            return (nil, nil)
        }

        // Check if starts with letter (Bingo 75) or is just number (Bingo 90)
        if let firstChar = lastComponent.first, firstChar.isLetter {
            let letter = String(firstChar).lowercased()
            let numberPart = String(lastComponent.dropFirst())
            return (letter, Int(numberPart))
        } else {
            return (nil, Int(lastComponent))
        }
    }
}
