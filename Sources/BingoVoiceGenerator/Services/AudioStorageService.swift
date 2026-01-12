import Foundation

actor AudioStorageService {
    static let shared = AudioStorageService()

    private let fileManager = FileManager.default

    private var baseDirectory: URL {
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return appSupport.appendingPathComponent("BingoVoiceGenerator", isDirectory: true)
    }

    private init() {
        // Directory will be created when saving files
    }

    /// Builds path: ~/Library/Application Support/BingoVoiceGenerator/{language}/{uuid}/{number}.mp3
    /// - Bingo 90: es-ES/{uuid}/45.mp3
    /// - Bingo 75: es-ES/{uuid}/b15.mp3
    private func audioFileURL(
        number: Int,
        language: Language,
        voice: Voice,
        mode: BingoMode
    ) -> URL {
        let filename: String
        switch mode {
        case .bingo90:
            filename = "\(number).mp3"
        case .bingo75:
            let letter = Bingo75Letter.letter(for: number).lowercased()
            filename = "\(letter)\(number).mp3"
        }

        return baseDirectory
            .appendingPathComponent(language.rawValue, isDirectory: true)
            .appendingPathComponent(voice.uuid.uuidString, isDirectory: true)
            .appendingPathComponent(filename)
    }

    /// Returns the directory for a voice's audio files
    func voiceDirectory(language: Language, voice: Voice) -> URL {
        baseDirectory
            .appendingPathComponent(language.rawValue, isDirectory: true)
            .appendingPathComponent(voice.uuid.uuidString, isDirectory: true)
    }

    func saveAudioFile(
        data: Data,
        number: Int,
        language: Language,
        voice: Voice,
        mode: BingoMode
    ) throws -> AudioFile {
        let url = audioFileURL(number: number, language: language, voice: voice, mode: mode)

        // Create parent directories
        try fileManager.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )

        // Write data
        try data.write(to: url)

        return AudioFile(
            number: number,
            language: language,
            voice: voice,
            mode: mode,
            fileURL: url,
            createdAt: Date()
        )
    }

    /// Save audio data directly to a specific URL (used by import)
    func saveAudioData(_ data: Data, to url: URL) throws {
        try fileManager.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try data.write(to: url)
    }

    func loadAudioFiles(
        language: Language,
        voice: Voice,
        mode: BingoMode
    ) -> [Int: AudioFile] {
        var result: [Int: AudioFile] = [:]

        let directory = voiceDirectory(language: language, voice: voice)

        guard let enumerator = fileManager.enumerator(
            at: directory,
            includingPropertiesForKeys: [.creationDateKey],
            options: [.skipsHiddenFiles, .skipsSubdirectoryDescendants]
        ) else {
            return result
        }

        for case let fileURL as URL in enumerator {
            guard fileURL.pathExtension == "mp3" else { continue }

            let filename = fileURL.deletingPathExtension().lastPathComponent

            let number: Int?
            switch mode {
            case .bingo90:
                // Simple number: 45.mp3
                number = Int(filename)
            case .bingo75:
                // Letter + number: b15.mp3
                if filename.count >= 2, filename.first?.isLetter == true {
                    number = Int(filename.dropFirst())
                } else {
                    number = nil
                }
            }

            guard let validNumber = number else { continue }

            // Validate number is in correct range for mode
            let isValidForMode: Bool
            switch mode {
            case .bingo90:
                isValidForMode = (1...90).contains(validNumber)
            case .bingo75:
                isValidForMode = (1...75).contains(validNumber)
            }
            guard isValidForMode else { continue }

            let creationDate =
                (try? fileURL.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? Date()

            result[validNumber] = AudioFile(
                number: validNumber,
                language: language,
                voice: voice,
                mode: mode,
                fileURL: fileURL,
                createdAt: creationDate
            )
        }

        return result
    }

    func deleteAudioFile(
        number: Int,
        language: Language,
        voice: Voice,
        mode: BingoMode
    ) throws {
        let url = audioFileURL(number: number, language: language, voice: voice, mode: mode)
        try fileManager.removeItem(at: url)
    }

    func getStorageDirectory() -> URL {
        baseDirectory
    }
}
