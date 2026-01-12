import Foundation

enum AudioPart: String, CaseIterable, Sendable, Equatable {
    case word
    case digit

    var fileSuffix: String { rawValue }

    var displayName: String {
        switch self {
        case .word: "Word"
        case .digit: "Digit"
        }
    }

    var shortName: String {
        switch self {
        case .word: "W"
        case .digit: "D"
        }
    }
}
