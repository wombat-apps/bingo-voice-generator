import Foundation

struct AudioFile: Sendable {
    let number: Int
    let language: Language
    let voice: Voice
    let mode: BingoMode
    let fileURL: URL
    let createdAt: Date

    var exists: Bool {
        FileManager.default.fileExists(atPath: fileURL.path)
    }
}
