import Foundation

struct AudioFile: Sendable, Equatable {
    let number: Int
    let part: AudioPart
    let language: Language
    let voice: Voice
    let mode: BingoMode
    let fileURL: URL
    let createdAt: Date
    let duration: TimeInterval

    var formattedDuration: String {
        let totalSeconds = Int(duration)
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        let tenths = Int((duration - Double(totalSeconds)) * 10)
        return String(format: "%d:%02d.%d", minutes, seconds, tenths)
    }

    var exists: Bool {
        FileManager.default.fileExists(atPath: fileURL.path)
    }

    func withDuration(_ newDuration: TimeInterval) -> AudioFile {
        AudioFile(
            number: number,
            part: part,
            language: language,
            voice: voice,
            mode: mode,
            fileURL: fileURL,
            createdAt: createdAt,
            duration: newDuration
        )
    }
}
