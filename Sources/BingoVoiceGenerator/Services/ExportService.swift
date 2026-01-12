import Foundation

actor ExportService {
    static let shared = ExportService()

    private let fileManager = FileManager.default

    enum ExportError: LocalizedError {
        case noAudioFiles
        case zipCreationFailed
        case directoryCreationFailed

        var errorDescription: String? {
            switch self {
            case .noAudioFiles:
                return "No audio files to export"
            case .zipCreationFailed:
                return "Failed to create ZIP file"
            case .directoryCreationFailed:
                return "Failed to create temporary directory"
            }
        }
    }

    private init() {}

    /// Exports a voice to a ZIP file containing voice.yml and all audio files
    /// - Parameters:
    ///   - voice: The voice to export
    ///   - language: The language of the voice
    /// - Returns: URL to the temporary ZIP file (caller should move or copy to final destination)
    func exportVoice(voice: Voice, language: Language) async throws -> URL {
        let sanitizedName = voice.fileSystemName
        let langCode = language.rawValue

        // Create temporary directory
        let tempDir = fileManager.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let exportDir = tempDir.appendingPathComponent(sanitizedName, isDirectory: true)

        do {
            try fileManager.createDirectory(at: exportDir, withIntermediateDirectories: true)
        } catch {
            throw ExportError.directoryCreationFailed
        }

        // Generate voice.yml
        let voiceYml = generateVoiceYml(voice: voice, language: language)
        let ymlPath = exportDir.appendingPathComponent("voice.yml")
        try voiceYml.write(to: ymlPath, atomically: true, encoding: .utf8)

        // Load and copy audio files for both modes
        var hasFiles = false

        for mode in BingoMode.allCases {
            let audioPairs = await AudioStorageService.shared.loadAudioFiles(
                language: language,
                voice: voice,
                mode: mode
            )

            for (number, pair) in audioPairs {
                // Export each part (word and digit)
                for audioFile in pair.allAudioFiles {
                    hasFiles = true

                    // Generate export filename including part
                    let baseFilename: String
                    switch mode {
                    case .bingo90:
                        baseFilename = "\(langCode)_\(sanitizedName)_\(number)"
                    case .bingo75:
                        let letter = Bingo75Letter.letter(for: number).lowercased()
                        baseFilename = "\(langCode)_\(sanitizedName)_\(letter)\(number)"
                    }
                    let exportFilename = "\(baseFilename)_\(audioFile.part.fileSuffix).mp3"

                    let destURL = exportDir.appendingPathComponent(exportFilename)
                    try fileManager.copyItem(at: audioFile.fileURL, to: destURL)
                }
            }
        }

        if !hasFiles {
            // Clean up
            try? fileManager.removeItem(at: tempDir)
            throw ExportError.noAudioFiles
        }

        // Create ZIP file
        let zipPath = tempDir.appendingPathComponent("\(sanitizedName).zip")

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/zip")
        process.arguments = ["-r", zipPath.path, sanitizedName]
        process.currentDirectoryURL = tempDir

        try process.run()
        process.waitUntilExit()

        if process.terminationStatus != 0 {
            try? fileManager.removeItem(at: tempDir)
            throw ExportError.zipCreationFailed
        }

        // Clean up export directory (keep ZIP)
        try? fileManager.removeItem(at: exportDir)

        return zipPath
    }

    /// Generates the voice.yml content
    private func generateVoiceYml(voice: Voice, language: Language) -> String {
        """
        elevenLabsName: \(voice.elevenLabsName)
        customName: \(voice.customName)
        elevenLabsId: \(voice.elevenLabsId)
        language: \(language.rawValue)
        """
    }

    /// Cleans up temporary export files
    func cleanupTempFile(at url: URL) {
        // Remove the parent temp directory
        let parentDir = url.deletingLastPathComponent()
        try? fileManager.removeItem(at: parentDir)
    }
}
