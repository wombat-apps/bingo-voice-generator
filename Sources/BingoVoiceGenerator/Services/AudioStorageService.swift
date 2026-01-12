import AVFoundation
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

    private nonisolated func getAudioDuration(at url: URL) -> TimeInterval {
        guard let player = try? AVAudioPlayer(contentsOf: url) else {
            return 0
        }
        return player.duration
    }

    /// Builds path: ~/Library/Application Support/BingoVoiceGenerator/{language}/{uuid}/{number}_{part}.mp3
    /// - Bingo 90: es-ES/{uuid}/45_word.mp3, es-ES/{uuid}/45_digit.mp3
    /// - Bingo 75: es-ES/{uuid}/b15_word.mp3, es-ES/{uuid}/b15_digit.mp3
    private func audioFileURL(
        number: Int,
        language: Language,
        voice: Voice,
        mode: BingoMode,
        part: AudioPart
    ) -> URL {
        let baseFilename: String
        switch mode {
        case .bingo90:
            baseFilename = "\(number)"
        case .bingo75:
            let letter = Bingo75Letter.letter(for: number).lowercased()
            baseFilename = "\(letter)\(number)"
        }

        let filename = "\(baseFilename)_\(part.fileSuffix).mp3"

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
        mode: BingoMode,
        part: AudioPart
    ) throws -> AudioFile {
        let url = audioFileURL(number: number, language: language, voice: voice, mode: mode, part: part)

        // Create parent directories
        try fileManager.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )

        // Write data
        try data.write(to: url)

        let duration = getAudioDuration(at: url)

        return AudioFile(
            number: number,
            part: part,
            language: language,
            voice: voice,
            mode: mode,
            fileURL: url,
            createdAt: Date(),
            duration: duration
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
    ) -> [Int: NumberAudioPair] {
        var result: [Int: NumberAudioPair] = [:]

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

            // Parse filename: "45_word" or "b15_digit"
            guard let (number, part) = parseFilename(filename, mode: mode) else { continue }

            // Validate number is in correct range for mode
            let isValidForMode: Bool
            switch mode {
            case .bingo90:
                isValidForMode = (1...90).contains(number)
            case .bingo75:
                isValidForMode = (1...75).contains(number)
            }
            guard isValidForMode else { continue }

            let creationDate =
                (try? fileURL.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? Date()

            let duration = getAudioDuration(at: fileURL)

            let audioFile = AudioFile(
                number: number,
                part: part,
                language: language,
                voice: voice,
                mode: mode,
                fileURL: fileURL,
                createdAt: creationDate,
                duration: duration
            )

            // Initialize pair if needed
            if result[number] == nil {
                result[number] = NumberAudioPair(number: number)
            }

            // Add to appropriate slot
            switch part {
            case .word:
                result[number]?.wordAudio = audioFile
            case .digit:
                result[number]?.digitAudio = audioFile
            }
        }

        return result
    }

    /// Parse filename like "45_word" or "b15_digit" into (number, part)
    private func parseFilename(_ filename: String, mode: BingoMode) -> (Int, AudioPart)? {
        // Split by underscore: "45_word" -> ["45", "word"]
        let components = filename.split(separator: "_")
        guard components.count == 2,
              let part = AudioPart(rawValue: String(components[1])) else {
            return nil
        }

        let numberPart = String(components[0])

        switch mode {
        case .bingo90:
            guard let number = Int(numberPart) else { return nil }
            return (number, part)
        case .bingo75:
            // "b15" -> drop letter, get number
            guard numberPart.count >= 2,
                  numberPart.first?.isLetter == true,
                  let number = Int(numberPart.dropFirst()) else {
                return nil
            }
            return (number, part)
        }
    }

    func deleteAudioFile(
        number: Int,
        language: Language,
        voice: Voice,
        mode: BingoMode,
        part: AudioPart
    ) throws {
        let url = audioFileURL(number: number, language: language, voice: voice, mode: mode, part: part)
        try fileManager.removeItem(at: url)
    }

    /// Delete all audio files for a number (both word and digit)
    func deleteAllAudioFiles(
        number: Int,
        language: Language,
        voice: Voice,
        mode: BingoMode
    ) throws {
        for part in AudioPart.allCases {
            let url = audioFileURL(number: number, language: language, voice: voice, mode: mode, part: part)
            if fileManager.fileExists(atPath: url.path) {
                try fileManager.removeItem(at: url)
            }
        }
    }

    func getStorageDirectory() -> URL {
        baseDirectory
    }
}
