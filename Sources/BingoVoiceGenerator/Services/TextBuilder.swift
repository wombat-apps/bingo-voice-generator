import Foundation

enum TextBuilder {
    static func buildText(number: Int, language: Language, mode: BingoMode) -> String {
        switch mode {
        case .bingo90:
            buildText90(number: number, language: language)
        case .bingo75:
            buildText75(number: number, language: language)
        }
    }

    private static func buildText90(number: Int, language: Language) -> String {
        let config = NumberWords.config(for: language)
        let numWord = config.numbers[number] ?? "\(number)"

        if number < 10 {
            return config.patterns.singleDigit90
                .replacingOccurrences(of: "{num_word}", with: numWord)
        }

        let d1 = number / 10
        let d2 = number % 10
        let d1Word = config.numbers[d1] ?? "\(d1)"
        let d2Word = config.numbers[d2] ?? "\(d2)"

        return config.patterns.twoDigit90
            .replacingOccurrences(of: "{num_word}", with: numWord)
            .replacingOccurrences(of: "{d1}", with: d1Word)
            .replacingOccurrences(of: "{d2}", with: d2Word)
    }

    private static func buildText75(number: Int, language: Language) -> String {
        let config = NumberWords.config(for: language)
        let letter = Bingo75Letter.letter(for: number)
        let numWord = config.numbers[number] ?? "\(number)"

        if number < 10 {
            return config.patterns.singleDigit75
                .replacingOccurrences(of: "{letter}", with: letter)
                .replacingOccurrences(of: "{num_word}", with: numWord)
        }

        let d1 = number / 10
        let d2 = number % 10
        let d1Word = config.numbers[d1] ?? "\(d1)"
        let d2Word = config.numbers[d2] ?? "\(d2)"

        return config.patterns.twoDigit75
            .replacingOccurrences(of: "{letter}", with: letter)
            .replacingOccurrences(of: "{num_word}", with: numWord)
            .replacingOccurrences(of: "{d1}", with: d1Word)
            .replacingOccurrences(of: "{d2}", with: d2Word)
    }
}
