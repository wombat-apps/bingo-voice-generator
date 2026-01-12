import Foundation

enum Bingo75Letter {
    /// Returns B/I/N/G/O letter for a Bingo 75 number
    /// B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
    static func letter(for number: Int) -> String {
        switch number {
        case 1...15: "B"
        case 16...30: "I"
        case 31...45: "N"
        case 46...60: "G"
        case 61...75: "O"
        default: "?"
        }
    }
}
