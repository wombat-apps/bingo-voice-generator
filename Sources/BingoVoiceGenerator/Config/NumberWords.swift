import Foundation

struct LanguageConfig: Sendable {
    let numbers: [Int: String]
    let letters: [String: String]
    let patterns: SpeechPatterns
}

struct SpeechPatterns: Sendable {
    // Word patterns (number spoken as words)
    let wordSingleDigit90: String
    let wordTwoDigit90: String
    let wordSingleDigit75: String
    let wordTwoDigit75: String

    // Digit patterns (digits spoken separately)
    let digitTwoDigit90: String
    let digitTwoDigit75: String
}

enum NumberWords {
    static func config(for language: Language) -> LanguageConfig {
        switch language {
        case .spanish: spanishConfig
        case .english: englishConfig
        case .englishGB: englishConfig
        case .french: frenchConfig
        case .portuguese: portugueseConfig
        case .italian: italianConfig
        }
    }

    // MARK: - Spanish

    private static let spanishConfig = LanguageConfig(
        numbers: [
            0: "cero", 1: "uno", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco",
            6: "seis", 7: "siete", 8: "ocho", 9: "nueve", 10: "diez",
            11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
            16: "dieciseis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve",
            20: "veinte", 21: "veintiuno", 22: "veintidos", 23: "veintitres",
            24: "veinticuatro", 25: "veinticinco", 26: "veintiseis", 27: "veintisiete",
            28: "veintiocho", 29: "veintinueve", 30: "treinta",
            31: "treinta y uno", 32: "treinta y dos", 33: "treinta y tres",
            34: "treinta y cuatro", 35: "treinta y cinco", 36: "treinta y seis",
            37: "treinta y siete", 38: "treinta y ocho", 39: "treinta y nueve",
            40: "cuarenta", 41: "cuarenta y uno", 42: "cuarenta y dos",
            43: "cuarenta y tres", 44: "cuarenta y cuatro", 45: "cuarenta y cinco",
            46: "cuarenta y seis", 47: "cuarenta y siete", 48: "cuarenta y ocho",
            49: "cuarenta y nueve", 50: "cincuenta", 51: "cincuenta y uno",
            52: "cincuenta y dos", 53: "cincuenta y tres", 54: "cincuenta y cuatro",
            55: "cincuenta y cinco", 56: "cincuenta y seis", 57: "cincuenta y siete",
            58: "cincuenta y ocho", 59: "cincuenta y nueve", 60: "sesenta",
            61: "sesenta y uno", 62: "sesenta y dos", 63: "sesenta y tres",
            64: "sesenta y cuatro", 65: "sesenta y cinco", 66: "sesenta y seis",
            67: "sesenta y siete", 68: "sesenta y ocho", 69: "sesenta y nueve",
            70: "setenta", 71: "setenta y uno", 72: "setenta y dos",
            73: "setenta y tres", 74: "setenta y cuatro", 75: "setenta y cinco",
            76: "setenta y seis", 77: "setenta y siete", 78: "setenta y ocho",
            79: "setenta y nueve", 80: "ochenta", 81: "ochenta y uno",
            82: "ochenta y dos", 83: "ochenta y tres", 84: "ochenta y cuatro",
            85: "ochenta y cinco", 86: "ochenta y seis", 87: "ochenta y siete",
            88: "ochenta y ocho", 89: "ochenta y nueve", 90: "noventa",
        ],
        letters: ["B": "be", "I": "i", "N": "ene", "G": "ge", "O": "o"],
        patterns: SpeechPatterns(
            wordSingleDigit90: "[excited] ¡{num_word}!",
            wordTwoDigit90: "[excited] ¡{num_word}!",
            wordSingleDigit75: "[excited] ¡{letter} ... {num_word}!",
            wordTwoDigit75: "[excited] ¡{letter} ... {num_word}!",
            digitTwoDigit90: "[excited] {d1}-{d2}",
            digitTwoDigit75: "[excited] {d1}-{d2}"
        )
    )

    // MARK: - English

    private static let englishConfig = LanguageConfig(
        numbers: [
            0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
            6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten",
            11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen", 15: "fifteen",
            16: "sixteen", 17: "seventeen", 18: "eighteen", 19: "nineteen",
            20: "twenty", 21: "twenty-one", 22: "twenty-two", 23: "twenty-three",
            24: "twenty-four", 25: "twenty-five", 26: "twenty-six", 27: "twenty-seven",
            28: "twenty-eight", 29: "twenty-nine", 30: "thirty",
            31: "thirty-one", 32: "thirty-two", 33: "thirty-three",
            34: "thirty-four", 35: "thirty-five", 36: "thirty-six",
            37: "thirty-seven", 38: "thirty-eight", 39: "thirty-nine",
            40: "forty", 41: "forty-one", 42: "forty-two",
            43: "forty-three", 44: "forty-four", 45: "forty-five",
            46: "forty-six", 47: "forty-seven", 48: "forty-eight",
            49: "forty-nine", 50: "fifty", 51: "fifty-one",
            52: "fifty-two", 53: "fifty-three", 54: "fifty-four",
            55: "fifty-five", 56: "fifty-six", 57: "fifty-seven",
            58: "fifty-eight", 59: "fifty-nine", 60: "sixty",
            61: "sixty-one", 62: "sixty-two", 63: "sixty-three",
            64: "sixty-four", 65: "sixty-five", 66: "sixty-six",
            67: "sixty-seven", 68: "sixty-eight", 69: "sixty-nine",
            70: "seventy", 71: "seventy-one", 72: "seventy-two",
            73: "seventy-three", 74: "seventy-four", 75: "seventy-five",
            76: "seventy-six", 77: "seventy-seven", 78: "seventy-eight",
            79: "seventy-nine", 80: "eighty", 81: "eighty-one",
            82: "eighty-two", 83: "eighty-three", 84: "eighty-four",
            85: "eighty-five", 86: "eighty-six", 87: "eighty-seven",
            88: "eighty-eight", 89: "eighty-nine", 90: "ninety",
        ],
        letters: ["B": "bee", "I": "eye", "N": "en", "G": "gee", "O": "oh"],
        patterns: SpeechPatterns(
            wordSingleDigit90: "[excited] {num_word}!",
            wordTwoDigit90: "[excited] {num_word}!",
            wordSingleDigit75: "[excited] {letter} {num_word}!",
            wordTwoDigit75: "[excited] {letter} {num_word}!",
            digitTwoDigit90: "[excited] {d1}-{d2}",
            digitTwoDigit75: "[excited] {d1}-{d2}"
        )
    )

    // MARK: - French

    private static let frenchConfig = LanguageConfig(
        numbers: [
            0: "zéro", 1: "un", 2: "deux", 3: "trois", 4: "quatre", 5: "cinq",
            6: "six", 7: "sept", 8: "huit", 9: "neuf", 10: "dix",
            11: "onze", 12: "douze", 13: "treize", 14: "quatorze", 15: "quinze",
            16: "seize", 17: "dix-sept", 18: "dix-huit", 19: "dix-neuf",
            20: "vingt", 21: "vingt et un", 22: "vingt-deux", 23: "vingt-trois",
            24: "vingt-quatre", 25: "vingt-cinq", 26: "vingt-six", 27: "vingt-sept",
            28: "vingt-huit", 29: "vingt-neuf", 30: "trente",
            31: "trente et un", 32: "trente-deux", 33: "trente-trois",
            34: "trente-quatre", 35: "trente-cinq", 36: "trente-six",
            37: "trente-sept", 38: "trente-huit", 39: "trente-neuf",
            40: "quarante", 41: "quarante et un", 42: "quarante-deux",
            43: "quarante-trois", 44: "quarante-quatre", 45: "quarante-cinq",
            46: "quarante-six", 47: "quarante-sept", 48: "quarante-huit",
            49: "quarante-neuf", 50: "cinquante", 51: "cinquante et un",
            52: "cinquante-deux", 53: "cinquante-trois", 54: "cinquante-quatre",
            55: "cinquante-cinq", 56: "cinquante-six", 57: "cinquante-sept",
            58: "cinquante-huit", 59: "cinquante-neuf", 60: "soixante",
            61: "soixante et un", 62: "soixante-deux", 63: "soixante-trois",
            64: "soixante-quatre", 65: "soixante-cinq", 66: "soixante-six",
            67: "soixante-sept", 68: "soixante-huit", 69: "soixante-neuf",
            70: "soixante-dix", 71: "soixante et onze", 72: "soixante-douze",
            73: "soixante-treize", 74: "soixante-quatorze", 75: "soixante-quinze",
            76: "soixante-seize", 77: "soixante-dix-sept", 78: "soixante-dix-huit",
            79: "soixante-dix-neuf", 80: "quatre-vingts", 81: "quatre-vingt-un",
            82: "quatre-vingt-deux", 83: "quatre-vingt-trois", 84: "quatre-vingt-quatre",
            85: "quatre-vingt-cinq", 86: "quatre-vingt-six", 87: "quatre-vingt-sept",
            88: "quatre-vingt-huit", 89: "quatre-vingt-neuf", 90: "quatre-vingt-dix",
        ],
        letters: ["B": "bé", "I": "i", "N": "ène", "G": "gé", "O": "o"],
        patterns: SpeechPatterns(
            wordSingleDigit90: "[excited] {num_word}!",
            wordTwoDigit90: "[excited] {num_word}!",
            wordSingleDigit75: "[excited] {letter} {num_word}!",
            wordTwoDigit75: "[excited] {letter} {num_word}!",
            digitTwoDigit90: "[excited] {d1}-{d2}",
            digitTwoDigit75: "[excited] {d1}-{d2}"
        )
    )

    // MARK: - Portuguese

    private static let portugueseConfig = LanguageConfig(
        numbers: [
            0: "zero", 1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco",
            6: "seis", 7: "sete", 8: "oito", 9: "nove", 10: "dez",
            11: "onze", 12: "doze", 13: "treze", 14: "catorze", 15: "quinze",
            16: "dezesseis", 17: "dezessete", 18: "dezoito", 19: "dezenove",
            20: "vinte", 21: "vinte e um", 22: "vinte e dois", 23: "vinte e três",
            24: "vinte e quatro", 25: "vinte e cinco", 26: "vinte e seis", 27: "vinte e sete",
            28: "vinte e oito", 29: "vinte e nove", 30: "trinta",
            31: "trinta e um", 32: "trinta e dois", 33: "trinta e três",
            34: "trinta e quatro", 35: "trinta e cinco", 36: "trinta e seis",
            37: "trinta e sete", 38: "trinta e oito", 39: "trinta e nove",
            40: "quarenta", 41: "quarenta e um", 42: "quarenta e dois",
            43: "quarenta e três", 44: "quarenta e quatro", 45: "quarenta e cinco",
            46: "quarenta e seis", 47: "quarenta e sete", 48: "quarenta e oito",
            49: "quarenta e nove", 50: "cinquenta", 51: "cinquenta e um",
            52: "cinquenta e dois", 53: "cinquenta e três", 54: "cinquenta e quatro",
            55: "cinquenta e cinco", 56: "cinquenta e seis", 57: "cinquenta e sete",
            58: "cinquenta e oito", 59: "cinquenta e nove", 60: "sessenta",
            61: "sessenta e um", 62: "sessenta e dois", 63: "sessenta e três",
            64: "sessenta e quatro", 65: "sessenta e cinco", 66: "sessenta e seis",
            67: "sessenta e sete", 68: "sessenta e oito", 69: "sessenta e nove",
            70: "setenta", 71: "setenta e um", 72: "setenta e dois",
            73: "setenta e três", 74: "setenta e quatro", 75: "setenta e cinco",
            76: "setenta e seis", 77: "setenta e sete", 78: "setenta e oito",
            79: "setenta e nove", 80: "oitenta", 81: "oitenta e um",
            82: "oitenta e dois", 83: "oitenta e três", 84: "oitenta e quatro",
            85: "oitenta e cinco", 86: "oitenta e seis", 87: "oitenta e sete",
            88: "oitenta e oito", 89: "oitenta e nove", 90: "noventa",
        ],
        letters: ["B": "bê", "I": "i", "N": "ene", "G": "gê", "O": "ó"],
        patterns: SpeechPatterns(
            wordSingleDigit90: "[excited] {num_word}!",
            wordTwoDigit90: "[excited] {num_word}!",
            wordSingleDigit75: "[excited] {letter} {num_word}!",
            wordTwoDigit75: "[excited] {letter} {num_word}!",
            digitTwoDigit90: "[excited] {d1}-{d2}",
            digitTwoDigit75: "[excited] {d1}-{d2}"
        )
    )

    // MARK: - Italian

    private static let italianConfig = LanguageConfig(
        numbers: [
            0: "zero", 1: "uno", 2: "due", 3: "tre", 4: "quattro", 5: "cinque",
            6: "sei", 7: "sette", 8: "otto", 9: "nove", 10: "dieci",
            11: "undici", 12: "dodici", 13: "tredici", 14: "quattordici", 15: "quindici",
            16: "sedici", 17: "diciassette", 18: "diciotto", 19: "diciannove",
            20: "venti", 21: "ventuno", 22: "ventidue", 23: "ventitré",
            24: "ventiquattro", 25: "venticinque", 26: "ventisei", 27: "ventisette",
            28: "ventotto", 29: "ventinove", 30: "trenta",
            31: "trentuno", 32: "trentadue", 33: "trentatré",
            34: "trentaquattro", 35: "trentacinque", 36: "trentasei",
            37: "trentasette", 38: "trentotto", 39: "trentanove",
            40: "quaranta", 41: "quarantuno", 42: "quarantadue",
            43: "quarantatré", 44: "quarantaquattro", 45: "quarantacinque",
            46: "quarantasei", 47: "quarantasette", 48: "quarantotto",
            49: "quarantanove", 50: "cinquanta", 51: "cinquantuno",
            52: "cinquantadue", 53: "cinquantatré", 54: "cinquantaquattro",
            55: "cinquantacinque", 56: "cinquantasei", 57: "cinquantasette",
            58: "cinquantotto", 59: "cinquantanove", 60: "sessanta",
            61: "sessantuno", 62: "sessantadue", 63: "sessantatré",
            64: "sessantaquattro", 65: "sessantacinque", 66: "sessantasei",
            67: "sessantasette", 68: "sessantotto", 69: "sessantanove",
            70: "settanta", 71: "settantuno", 72: "settantadue",
            73: "settantatré", 74: "settantaquattro", 75: "settantacinque",
            76: "settantasei", 77: "settantasette", 78: "settantotto",
            79: "settantanove", 80: "ottanta", 81: "ottantuno",
            82: "ottantadue", 83: "ottantatré", 84: "ottantaquattro",
            85: "ottantacinque", 86: "ottantasei", 87: "ottantasette",
            88: "ottantotto", 89: "ottantanove", 90: "novanta",
        ],
        letters: ["B": "bi", "I": "i", "N": "enne", "G": "gi", "O": "o"],
        patterns: SpeechPatterns(
            wordSingleDigit90: "[excited] {num_word}!",
            wordTwoDigit90: "[excited] {num_word}!",
            wordSingleDigit75: "[excited] {letter} {num_word}!",
            wordTwoDigit75: "[excited] {letter} {num_word}!",
            digitTwoDigit90: "[excited] {d1}-{d2}",
            digitTwoDigit75: "[excited] {d1}-{d2}"
        )
    )
}
