import Foundation

enum BingoMode: String, CaseIterable, Identifiable, Codable, Sendable {
    case bingo90
    case bingo75

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .bingo90: "Bingo 90"
        case .bingo75: "Bingo 75"
        }
    }

    var maxNumber: Int {
        switch self {
        case .bingo90: 90
        case .bingo75: 75
        }
    }

    var gridColumns: Int {
        switch self {
        case .bingo90: 10
        case .bingo75: 5
        }
    }

    var numbers: [Int] {
        Array(1...maxNumber)
    }
}
