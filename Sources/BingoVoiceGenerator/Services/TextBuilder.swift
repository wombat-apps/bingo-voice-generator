import Foundation

enum TextBuilder {
    static func buildText(number: Int, language: Language, mode: BingoMode, part: AudioPart) -> String {
        switch (mode, part) {
        case (.bingo90, .word):
            buildWordText90(number: number, language: language)
        case (.bingo90, .digit):
            buildDigitText90(number: number, language: language)
        case (.bingo75, .word):
            buildWordText75(number: number, language: language)
        case (.bingo75, .digit):
            buildDigitText75(number: number, language: language)
        }
    }

    // MARK: - Bingo 90 Word

    private static func buildWordText90(number: Int, language: Language) -> String {
        let config = NumberWords.config(for: language)
        let numWord = (config.numbers[number] ?? "\(number)").uppercased()

        if number < 10 {
            return config.patterns.wordSingleDigit90
                .replacingOccurrences(of: "{num_word}", with: numWord)
        }

        return config.patterns.wordTwoDigit90
            .replacingOccurrences(of: "{num_word}", with: numWord)
    }

    // MARK: - Bingo 90 Digit

    private static func buildDigitText90(number: Int, language: Language) -> String {
        let config = NumberWords.config(for: language)

        // For single digits, same as word (should not be called for single digits)
        if number < 10 {
            let numWord = (config.numbers[number] ?? "\(number)").uppercased()
            return config.patterns.wordSingleDigit90
                .replacingOccurrences(of: "{num_word}", with: numWord)
        }

        let d1 = number / 10
        let d2 = number % 10
        let d1Word = (config.numbers[d1] ?? "\(d1)").uppercased()
        let d2Word = (config.numbers[d2] ?? "\(d2)").uppercased()

        return config.patterns.digitTwoDigit90
            .replacingOccurrences(of: "{d1}", with: d1Word)
            .replacingOccurrences(of: "{d2}", with: d2Word)
    }

    // MARK: - Bingo 75 Word

    private static func buildWordText75(number: Int, language: Language) -> String {
        let config = NumberWords.config(for: language)
        let letterKey = Bingo75Letter.letter(for: number)
        let letterName = (config.letters[letterKey] ?? letterKey).uppercased()
        let numWord = (config.numbers[number] ?? "\(number)").uppercased()

        if number < 10 {
            return config.patterns.wordSingleDigit75
                .replacingOccurrences(of: "{letter}", with: letterName)
                .replacingOccurrences(of: "{num_word}", with: numWord)
        }

        return config.patterns.wordTwoDigit75
            .replacingOccurrences(of: "{letter}", with: letterName)
            .replacingOccurrences(of: "{num_word}", with: numWord)
    }

    // MARK: - Bingo 75 Digit

    private static func buildDigitText75(number: Int, language: Language) -> String {
        let config = NumberWords.config(for: language)
        let letterKey = Bingo75Letter.letter(for: number)
        let letterName = (config.letters[letterKey] ?? letterKey).uppercased()

        // For single digits, same as word (should not be called for single digits)
        if number < 10 {
            let numWord = (config.numbers[number] ?? "\(number)").uppercased()
            return config.patterns.wordSingleDigit75
                .replacingOccurrences(of: "{letter}", with: letterName)
                .replacingOccurrences(of: "{num_word}", with: numWord)
        }

        let d1 = number / 10
        let d2 = number % 10
        let d1Word = (config.numbers[d1] ?? "\(d1)").uppercased()
        let d2Word = (config.numbers[d2] ?? "\(d2)").uppercased()

        return config.patterns.digitTwoDigit75
            .replacingOccurrences(of: "{letter}", with: letterName)
            .replacingOccurrences(of: "{d1}", with: d1Word)
            .replacingOccurrences(of: "{d2}", with: d2Word)
    }
}
