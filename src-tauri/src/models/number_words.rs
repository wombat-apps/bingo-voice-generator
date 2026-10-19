use serde::Serialize;
use std::collections::HashMap;

use super::{Accent, AudioPart, BingoMode, FormatSlot, Language, SelectedFormats, COLUMN_LETTERS};

pub struct SpeechPatterns {
    /// The Default Word Formats (see `build_word_text_with_format`).
    pub word_90: &'static str,
    pub word_75: &'static str,
    /// The Default Digit Format (see `build_digit_text_with_format`), the same in every
    /// Bingo Mode.
    pub digit: &'static str,
}

pub struct LanguageConfig {
    pub numbers: HashMap<u32, &'static str>,
    /// The letters of the columns B, I, N, G and O, in the script of the Language.
    pub letters: [&'static str; 5],
    pub patterns: SpeechPatterns,
}

impl LanguageConfig {
    /// The words of the Accent's Language, with the ones the Accent writes differently.
    pub fn for_accent(accent: Accent) -> Self {
        let mut config = Self::for_language(accent.language());
        config
            .numbers
            .extend(accent.number_word_overrides().iter().copied());
        config
    }

    fn for_language(language: Language) -> Self {
        match language {
            Language::Spanish => Self::spanish(),
            Language::English => Self::english(),
            Language::French => Self::french(),
            Language::Portuguese => Self::portuguese(),
            Language::Italian => Self::italian(),
            Language::German => Self::german(),
            Language::Russian => Self::russian(),
            Language::Turkish => Self::turkish(),
            Language::Hindi => Self::hindi(),
            Language::Japanese => Self::japanese(),
        }
    }

    fn spanish() -> Self {
        let mut numbers = HashMap::new();
        let words = [
            (0, "cero"),
            (1, "uno"),
            (2, "dos"),
            (3, "tres"),
            (4, "cuatro"),
            (5, "cinco"),
            (6, "seis"),
            (7, "siete"),
            (8, "ocho"),
            (9, "nueve"),
            (10, "diez"),
            (11, "once"),
            (12, "doce"),
            (13, "trece"),
            (14, "catorce"),
            (15, "quince"),
            (16, "diecis\u{e9}is"),
            (17, "diecisiete"),
            (18, "dieciocho"),
            (19, "diecinueve"),
            (20, "veinte"),
            (21, "veintiuno"),
            (22, "veintid\u{f3}s"),
            (23, "veintitr\u{e9}s"),
            (24, "veinticuatro"),
            (25, "veinticinco"),
            (26, "veintis\u{e9}is"),
            (27, "veintisiete"),
            (28, "veintiocho"),
            (29, "veintinueve"),
            (30, "treinta"),
            (31, "treinta y uno"),
            (32, "treinta y dos"),
            (33, "treinta y tres"),
            (34, "treinta y cuatro"),
            (35, "treinta y cinco"),
            (36, "treinta y seis"),
            (37, "treinta y siete"),
            (38, "treinta y ocho"),
            (39, "treinta y nueve"),
            (40, "cuarenta"),
            (41, "cuarenta y uno"),
            (42, "cuarenta y dos"),
            (43, "cuarenta y tres"),
            (44, "cuarenta y cuatro"),
            (45, "cuarenta y cinco"),
            (46, "cuarenta y seis"),
            (47, "cuarenta y siete"),
            (48, "cuarenta y ocho"),
            (49, "cuarenta y nueve"),
            (50, "cincuenta"),
            (51, "cincuenta y uno"),
            (52, "cincuenta y dos"),
            (53, "cincuenta y tres"),
            (54, "cincuenta y cuatro"),
            (55, "cincuenta y cinco"),
            (56, "cincuenta y seis"),
            (57, "cincuenta y siete"),
            (58, "cincuenta y ocho"),
            (59, "cincuenta y nueve"),
            (60, "sesenta"),
            (61, "sesenta y uno"),
            (62, "sesenta y dos"),
            (63, "sesenta y tres"),
            (64, "sesenta y cuatro"),
            (65, "sesenta y cinco"),
            (66, "sesenta y seis"),
            (67, "sesenta y siete"),
            (68, "sesenta y ocho"),
            (69, "sesenta y nueve"),
            (70, "setenta"),
            (71, "setenta y uno"),
            (72, "setenta y dos"),
            (73, "setenta y tres"),
            (74, "setenta y cuatro"),
            (75, "setenta y cinco"),
            (76, "setenta y seis"),
            (77, "setenta y siete"),
            (78, "setenta y ocho"),
            (79, "setenta y nueve"),
            (80, "ochenta"),
            (81, "ochenta y uno"),
            (82, "ochenta y dos"),
            (83, "ochenta y tres"),
            (84, "ochenta y cuatro"),
            (85, "ochenta y cinco"),
            (86, "ochenta y seis"),
            (87, "ochenta y siete"),
            (88, "ochenta y ocho"),
            (89, "ochenta y nueve"),
            (90, "noventa"),
        ];
        for (n, w) in words {
            numbers.insert(n, w);
        }

        Self {
            numbers,
            letters: COLUMN_LETTERS,
            patterns: SpeechPatterns {
                word_90: "\u{a1}{Num}!",
                word_75: "{Letter} \u{a1}{num}!",
                digit: "{First} {second}",
            },
        }
    }

    fn english() -> Self {
        let mut numbers = HashMap::new();
        let words = [
            (0, "zero"),
            (1, "one"),
            (2, "two"),
            (3, "three"),
            (4, "four"),
            (5, "five"),
            (6, "six"),
            (7, "seven"),
            (8, "eight"),
            (9, "nine"),
            (10, "ten"),
            (11, "eleven"),
            (12, "twelve"),
            (13, "thirteen"),
            (14, "fourteen"),
            (15, "fifteen"),
            (16, "sixteen"),
            (17, "seventeen"),
            (18, "eighteen"),
            (19, "nineteen"),
            (20, "twenty"),
            (21, "twenty-one"),
            (22, "twenty-two"),
            (23, "twenty-three"),
            (24, "twenty-four"),
            (25, "twenty-five"),
            (26, "twenty-six"),
            (27, "twenty-seven"),
            (28, "twenty-eight"),
            (29, "twenty-nine"),
            (30, "thirty"),
            (31, "thirty-one"),
            (32, "thirty-two"),
            (33, "thirty-three"),
            (34, "thirty-four"),
            (35, "thirty-five"),
            (36, "thirty-six"),
            (37, "thirty-seven"),
            (38, "thirty-eight"),
            (39, "thirty-nine"),
            (40, "forty"),
            (41, "forty-one"),
            (42, "forty-two"),
            (43, "forty-three"),
            (44, "forty-four"),
            (45, "forty-five"),
            (46, "forty-six"),
            (47, "forty-seven"),
            (48, "forty-eight"),
            (49, "forty-nine"),
            (50, "fifty"),
            (51, "fifty-one"),
            (52, "fifty-two"),
            (53, "fifty-three"),
            (54, "fifty-four"),
            (55, "fifty-five"),
            (56, "fifty-six"),
            (57, "fifty-seven"),
            (58, "fifty-eight"),
            (59, "fifty-nine"),
            (60, "sixty"),
            (61, "sixty-one"),
            (62, "sixty-two"),
            (63, "sixty-three"),
            (64, "sixty-four"),
            (65, "sixty-five"),
            (66, "sixty-six"),
            (67, "sixty-seven"),
            (68, "sixty-eight"),
            (69, "sixty-nine"),
            (70, "seventy"),
            (71, "seventy-one"),
            (72, "seventy-two"),
            (73, "seventy-three"),
            (74, "seventy-four"),
            (75, "seventy-five"),
            (76, "seventy-six"),
            (77, "seventy-seven"),
            (78, "seventy-eight"),
            (79, "seventy-nine"),
            (80, "eighty"),
            (81, "eighty-one"),
            (82, "eighty-two"),
            (83, "eighty-three"),
            (84, "eighty-four"),
            (85, "eighty-five"),
            (86, "eighty-six"),
            (87, "eighty-seven"),
            (88, "eighty-eight"),
            (89, "eighty-nine"),
            (90, "ninety"),
        ];
        for (n, w) in words {
            numbers.insert(n, w);
        }

        Self {
            numbers,
            letters: COLUMN_LETTERS,
            patterns: SpeechPatterns {
                word_90: "{Num}!",
                word_75: "{Letter} {num}!",
                digit: "{First} {second}",
            },
        }
    }

    fn french() -> Self {
        let mut numbers = HashMap::new();
        let words = [
            (0, "z\u{e9}ro"),
            (1, "un"),
            (2, "deux"),
            (3, "trois"),
            (4, "quatre"),
            (5, "cinq"),
            (6, "six"),
            (7, "sept"),
            (8, "huit"),
            (9, "neuf"),
            (10, "dix"),
            (11, "onze"),
            (12, "douze"),
            (13, "treize"),
            (14, "quatorze"),
            (15, "quinze"),
            (16, "seize"),
            (17, "dix-sept"),
            (18, "dix-huit"),
            (19, "dix-neuf"),
            (20, "vingt"),
            (21, "vingt et un"),
            (22, "vingt-deux"),
            (23, "vingt-trois"),
            (24, "vingt-quatre"),
            (25, "vingt-cinq"),
            (26, "vingt-six"),
            (27, "vingt-sept"),
            (28, "vingt-huit"),
            (29, "vingt-neuf"),
            (30, "trente"),
            (31, "trente et un"),
            (32, "trente-deux"),
            (33, "trente-trois"),
            (34, "trente-quatre"),
            (35, "trente-cinq"),
            (36, "trente-six"),
            (37, "trente-sept"),
            (38, "trente-huit"),
            (39, "trente-neuf"),
            (40, "quarante"),
            (41, "quarante et un"),
            (42, "quarante-deux"),
            (43, "quarante-trois"),
            (44, "quarante-quatre"),
            (45, "quarante-cinq"),
            (46, "quarante-six"),
            (47, "quarante-sept"),
            (48, "quarante-huit"),
            (49, "quarante-neuf"),
            (50, "cinquante"),
            (51, "cinquante et un"),
            (52, "cinquante-deux"),
            (53, "cinquante-trois"),
            (54, "cinquante-quatre"),
            (55, "cinquante-cinq"),
            (56, "cinquante-six"),
            (57, "cinquante-sept"),
            (58, "cinquante-huit"),
            (59, "cinquante-neuf"),
            (60, "soixante"),
            (61, "soixante et un"),
            (62, "soixante-deux"),
            (63, "soixante-trois"),
            (64, "soixante-quatre"),
            (65, "soixante-cinq"),
            (66, "soixante-six"),
            (67, "soixante-sept"),
            (68, "soixante-huit"),
            (69, "soixante-neuf"),
            (70, "soixante-dix"),
            (71, "soixante et onze"),
            (72, "soixante-douze"),
            (73, "soixante-treize"),
            (74, "soixante-quatorze"),
            (75, "soixante-quinze"),
            (76, "soixante-seize"),
            (77, "soixante-dix-sept"),
            (78, "soixante-dix-huit"),
            (79, "soixante-dix-neuf"),
            (80, "quatre-vingts"),
            (81, "quatre-vingt-un"),
            (82, "quatre-vingt-deux"),
            (83, "quatre-vingt-trois"),
            (84, "quatre-vingt-quatre"),
            (85, "quatre-vingt-cinq"),
            (86, "quatre-vingt-six"),
            (87, "quatre-vingt-sept"),
            (88, "quatre-vingt-huit"),
            (89, "quatre-vingt-neuf"),
            (90, "quatre-vingt-dix"),
        ];
        for (n, w) in words {
            numbers.insert(n, w);
        }

        Self {
            numbers,
            letters: COLUMN_LETTERS,
            patterns: SpeechPatterns {
                word_90: "{Num}!",
                word_75: "{Letter} {num}!",
                digit: "{First} {second}",
            },
        }
    }

    fn portuguese() -> Self {
        let mut numbers = HashMap::new();
        let words = [
            (0, "zero"),
            (1, "um"),
            (2, "dois"),
            (3, "tr\u{ea}s"),
            (4, "quatro"),
            (5, "cinco"),
            (6, "seis"),
            (7, "sete"),
            (8, "oito"),
            (9, "nove"),
            (10, "dez"),
            (11, "onze"),
            (12, "doze"),
            (13, "treze"),
            (14, "catorze"),
            (15, "quinze"),
            (16, "dezesseis"),
            (17, "dezessete"),
            (18, "dezoito"),
            (19, "dezenove"),
            (20, "vinte"),
            (21, "vinte e um"),
            (22, "vinte e dois"),
            (23, "vinte e tr\u{ea}s"),
            (24, "vinte e quatro"),
            (25, "vinte e cinco"),
            (26, "vinte e seis"),
            (27, "vinte e sete"),
            (28, "vinte e oito"),
            (29, "vinte e nove"),
            (30, "trinta"),
            (31, "trinta e um"),
            (32, "trinta e dois"),
            (33, "trinta e tr\u{ea}s"),
            (34, "trinta e quatro"),
            (35, "trinta e cinco"),
            (36, "trinta e seis"),
            (37, "trinta e sete"),
            (38, "trinta e oito"),
            (39, "trinta e nove"),
            (40, "quarenta"),
            (41, "quarenta e um"),
            (42, "quarenta e dois"),
            (43, "quarenta e tr\u{ea}s"),
            (44, "quarenta e quatro"),
            (45, "quarenta e cinco"),
            (46, "quarenta e seis"),
            (47, "quarenta e sete"),
            (48, "quarenta e oito"),
            (49, "quarenta e nove"),
            (50, "cinquenta"),
            (51, "cinquenta e um"),
            (52, "cinquenta e dois"),
            (53, "cinquenta e tr\u{ea}s"),
            (54, "cinquenta e quatro"),
            (55, "cinquenta e cinco"),
            (56, "cinquenta e seis"),
            (57, "cinquenta e sete"),
            (58, "cinquenta e oito"),
            (59, "cinquenta e nove"),
            (60, "sessenta"),
            (61, "sessenta e um"),
            (62, "sessenta e dois"),
            (63, "sessenta e tr\u{ea}s"),
            (64, "sessenta e quatro"),
            (65, "sessenta e cinco"),
            (66, "sessenta e seis"),
            (67, "sessenta e sete"),
            (68, "sessenta e oito"),
            (69, "sessenta e nove"),
            (70, "setenta"),
            (71, "setenta e um"),
            (72, "setenta e dois"),
            (73, "setenta e tr\u{ea}s"),
            (74, "setenta e quatro"),
            (75, "setenta e cinco"),
            (76, "setenta e seis"),
            (77, "setenta e sete"),
            (78, "setenta e oito"),
            (79, "setenta e nove"),
            (80, "oitenta"),
            (81, "oitenta e um"),
            (82, "oitenta e dois"),
            (83, "oitenta e tr\u{ea}s"),
            (84, "oitenta e quatro"),
            (85, "oitenta e cinco"),
            (86, "oitenta e seis"),
            (87, "oitenta e sete"),
            (88, "oitenta e oito"),
            (89, "oitenta e nove"),
            (90, "noventa"),
        ];
        for (n, w) in words {
            numbers.insert(n, w);
        }

        Self {
            numbers,
            letters: COLUMN_LETTERS,
            patterns: SpeechPatterns {
                word_90: "{Num}!",
                word_75: "{Letter} {num}!",
                digit: "{First} {second}",
            },
        }
    }

    fn italian() -> Self {
        let mut numbers = HashMap::new();
        let words = [
            (0, "zero"),
            (1, "uno"),
            (2, "due"),
            (3, "tre"),
            (4, "quattro"),
            (5, "cinque"),
            (6, "sei"),
            (7, "sette"),
            (8, "otto"),
            (9, "nove"),
            (10, "dieci"),
            (11, "undici"),
            (12, "dodici"),
            (13, "tredici"),
            (14, "quattordici"),
            (15, "quindici"),
            (16, "sedici"),
            (17, "diciassette"),
            (18, "diciotto"),
            (19, "diciannove"),
            (20, "venti"),
            (21, "ventuno"),
            (22, "ventidue"),
            (23, "ventitr\u{e9}"),
            (24, "ventiquattro"),
            (25, "venticinque"),
            (26, "ventisei"),
            (27, "ventisette"),
            (28, "ventotto"),
            (29, "ventinove"),
            (30, "trenta"),
            (31, "trentuno"),
            (32, "trentadue"),
            (33, "trentatr\u{e9}"),
            (34, "trentaquattro"),
            (35, "trentacinque"),
            (36, "trentasei"),
            (37, "trentasette"),
            (38, "trentotto"),
            (39, "trentanove"),
            (40, "quaranta"),
            (41, "quarantuno"),
            (42, "quarantadue"),
            (43, "quarantatr\u{e9}"),
            (44, "quarantaquattro"),
            (45, "quarantacinque"),
            (46, "quarantasei"),
            (47, "quarantasette"),
            (48, "quarantotto"),
            (49, "quarantanove"),
            (50, "cinquanta"),
            (51, "cinquantuno"),
            (52, "cinquantadue"),
            (53, "cinquantatr\u{e9}"),
            (54, "cinquantaquattro"),
            (55, "cinquantacinque"),
            (56, "cinquantasei"),
            (57, "cinquantasette"),
            (58, "cinquantotto"),
            (59, "cinquantanove"),
            (60, "sessanta"),
            (61, "sessantuno"),
            (62, "sessantadue"),
            (63, "sessantatr\u{e9}"),
            (64, "sessantaquattro"),
            (65, "sessantacinque"),
            (66, "sessantasei"),
            (67, "sessantasette"),
            (68, "sessantotto"),
            (69, "sessantanove"),
            (70, "settanta"),
            (71, "settantuno"),
            (72, "settantadue"),
            (73, "settantatr\u{e9}"),
            (74, "settantaquattro"),
            (75, "settantacinque"),
            (76, "settantasei"),
            (77, "settantasette"),
            (78, "settantotto"),
            (79, "settantanove"),
            (80, "ottanta"),
            (81, "ottantuno"),
            (82, "ottantadue"),
            (83, "ottantatr\u{e9}"),
            (84, "ottantaquattro"),
            (85, "ottantacinque"),
            (86, "ottantasei"),
            (87, "ottantasette"),
            (88, "ottantotto"),
            (89, "ottantanove"),
            (90, "novanta"),
        ];
        for (n, w) in words {
            numbers.insert(n, w);
        }

        Self {
            numbers,
            letters: COLUMN_LETTERS,
            patterns: SpeechPatterns {
                word_90: "{Num}!",
                word_75: "{Letter} {num}!",
                digit: "{First} {second}",
            },
        }
    }

    fn german() -> Self {
        let mut numbers = HashMap::new();
        let words = [
            (0, "null"),
            (1, "eins"),
            (2, "zwei"),
            (3, "drei"),
            (4, "vier"),
            (5, "fünf"),
            (6, "sechs"),
            (7, "sieben"),
            (8, "acht"),
            (9, "neun"),
            (10, "zehn"),
            (11, "elf"),
            (12, "zwölf"),
            (13, "dreizehn"),
            (14, "vierzehn"),
            (15, "fünfzehn"),
            (16, "sechzehn"),
            (17, "siebzehn"),
            (18, "achtzehn"),
            (19, "neunzehn"),
            (20, "zwanzig"),
            (21, "einundzwanzig"),
            (22, "zweiundzwanzig"),
            (23, "dreiundzwanzig"),
            (24, "vierundzwanzig"),
            (25, "fünfundzwanzig"),
            (26, "sechsundzwanzig"),
            (27, "siebenundzwanzig"),
            (28, "achtundzwanzig"),
            (29, "neunundzwanzig"),
            (30, "dreißig"),
            (31, "einunddreißig"),
            (32, "zweiunddreißig"),
            (33, "dreiunddreißig"),
            (34, "vierunddreißig"),
            (35, "fünfunddreißig"),
            (36, "sechsunddreißig"),
            (37, "siebenunddreißig"),
            (38, "achtunddreißig"),
            (39, "neununddreißig"),
            (40, "vierzig"),
            (41, "einundvierzig"),
            (42, "zweiundvierzig"),
            (43, "dreiundvierzig"),
            (44, "vierundvierzig"),
            (45, "fünfundvierzig"),
            (46, "sechsundvierzig"),
            (47, "siebenundvierzig"),
            (48, "achtundvierzig"),
            (49, "neunundvierzig"),
            (50, "fünfzig"),
            (51, "einundfünfzig"),
            (52, "zweiundfünfzig"),
            (53, "dreiundfünfzig"),
            (54, "vierundfünfzig"),
            (55, "fünfundfünfzig"),
            (56, "sechsundfünfzig"),
            (57, "siebenundfünfzig"),
            (58, "achtundfünfzig"),
            (59, "neunundfünfzig"),
            (60, "sechzig"),
            (61, "einundsechzig"),
            (62, "zweiundsechzig"),
            (63, "dreiundsechzig"),
            (64, "vierundsechzig"),
            (65, "fünfundsechzig"),
            (66, "sechsundsechzig"),
            (67, "siebenundsechzig"),
            (68, "achtundsechzig"),
            (69, "neunundsechzig"),
            (70, "siebzig"),
            (71, "einundsiebzig"),
            (72, "zweiundsiebzig"),
            (73, "dreiundsiebzig"),
            (74, "vierundsiebzig"),
            (75, "fünfundsiebzig"),
            (76, "sechsundsiebzig"),
            (77, "siebenundsiebzig"),
            (78, "achtundsiebzig"),
            (79, "neunundsiebzig"),
            (80, "achtzig"),
            (81, "einundachtzig"),
            (82, "zweiundachtzig"),
            (83, "dreiundachtzig"),
            (84, "vierundachtzig"),
            (85, "fünfundachtzig"),
            (86, "sechsundachtzig"),
            (87, "siebenundachtzig"),
            (88, "achtundachtzig"),
            (89, "neunundachtzig"),
            (90, "neunzig"),
        ];
        for (n, w) in words {
            numbers.insert(n, w);
        }

        Self {
            numbers,
            letters: COLUMN_LETTERS,
            patterns: SpeechPatterns {
                word_90: "{Num}!",
                word_75: "{Letter} {num}!",
                digit: "{First} {second}",
            },
        }
    }

    fn russian() -> Self {
        let mut numbers = HashMap::new();
        let words = [
            (0, "ноль"),
            (1, "один"),
            (2, "два"),
            (3, "три"),
            (4, "четыре"),
            (5, "пять"),
            (6, "шесть"),
            (7, "семь"),
            (8, "восемь"),
            (9, "девять"),
            (10, "десять"),
            (11, "одиннадцать"),
            (12, "двенадцать"),
            (13, "тринадцать"),
            (14, "четырнадцать"),
            (15, "пятнадцать"),
            (16, "шестнадцать"),
            (17, "семнадцать"),
            (18, "восемнадцать"),
            (19, "девятнадцать"),
            (20, "двадцать"),
            (21, "двадцать один"),
            (22, "двадцать два"),
            (23, "двадцать три"),
            (24, "двадцать четыре"),
            (25, "двадцать пять"),
            (26, "двадцать шесть"),
            (27, "двадцать семь"),
            (28, "двадцать восемь"),
            (29, "двадцать девять"),
            (30, "тридцать"),
            (31, "тридцать один"),
            (32, "тридцать два"),
            (33, "тридцать три"),
            (34, "тридцать четыре"),
            (35, "тридцать пять"),
            (36, "тридцать шесть"),
            (37, "тридцать семь"),
            (38, "тридцать восемь"),
            (39, "тридцать девять"),
            (40, "сорок"),
            (41, "сорок один"),
            (42, "сорок два"),
            (43, "сорок три"),
            (44, "сорок четыре"),
            (45, "сорок пять"),
            (46, "сорок шесть"),
            (47, "сорок семь"),
            (48, "сорок восемь"),
            (49, "сорок девять"),
            (50, "пятьдесят"),
            (51, "пятьдесят один"),
            (52, "пятьдесят два"),
            (53, "пятьдесят три"),
            (54, "пятьдесят четыре"),
            (55, "пятьдесят пять"),
            (56, "пятьдесят шесть"),
            (57, "пятьдесят семь"),
            (58, "пятьдесят восемь"),
            (59, "пятьдесят девять"),
            (60, "шестьдесят"),
            (61, "шестьдесят один"),
            (62, "шестьдесят два"),
            (63, "шестьдесят три"),
            (64, "шестьдесят четыре"),
            (65, "шестьдесят пять"),
            (66, "шестьдесят шесть"),
            (67, "шестьдесят семь"),
            (68, "шестьдесят восемь"),
            (69, "шестьдесят девять"),
            (70, "семьдесят"),
            (71, "семьдесят один"),
            (72, "семьдесят два"),
            (73, "семьдесят три"),
            (74, "семьдесят четыре"),
            (75, "семьдесят пять"),
            (76, "семьдесят шесть"),
            (77, "семьдесят семь"),
            (78, "семьдесят восемь"),
            (79, "семьдесят девять"),
            (80, "восемьдесят"),
            (81, "восемьдесят один"),
            (82, "восемьдесят два"),
            (83, "восемьдесят три"),
            (84, "восемьдесят четыре"),
            (85, "восемьдесят пять"),
            (86, "восемьдесят шесть"),
            (87, "восемьдесят семь"),
            (88, "восемьдесят восемь"),
            (89, "восемьдесят девять"),
            (90, "девяносто"),
        ];
        for (n, w) in words {
            numbers.insert(n, w);
        }

        Self {
            numbers,
            letters: COLUMN_LETTERS,
            patterns: SpeechPatterns {
                word_90: "{Num}!",
                word_75: "{Letter} {num}!",
                digit: "{First} {second}",
            },
        }
    }

    fn turkish() -> Self {
        let mut numbers = HashMap::new();
        let words = [
            (0, "sıfır"),
            (1, "bir"),
            (2, "iki"),
            (3, "üç"),
            (4, "dört"),
            (5, "beş"),
            (6, "altı"),
            (7, "yedi"),
            (8, "sekiz"),
            (9, "dokuz"),
            (10, "on"),
            (11, "on bir"),
            (12, "on iki"),
            (13, "on üç"),
            (14, "on dört"),
            (15, "on beş"),
            (16, "on altı"),
            (17, "on yedi"),
            (18, "on sekiz"),
            (19, "on dokuz"),
            (20, "yirmi"),
            (21, "yirmi bir"),
            (22, "yirmi iki"),
            (23, "yirmi üç"),
            (24, "yirmi dört"),
            (25, "yirmi beş"),
            (26, "yirmi altı"),
            (27, "yirmi yedi"),
            (28, "yirmi sekiz"),
            (29, "yirmi dokuz"),
            (30, "otuz"),
            (31, "otuz bir"),
            (32, "otuz iki"),
            (33, "otuz üç"),
            (34, "otuz dört"),
            (35, "otuz beş"),
            (36, "otuz altı"),
            (37, "otuz yedi"),
            (38, "otuz sekiz"),
            (39, "otuz dokuz"),
            (40, "kırk"),
            (41, "kırk bir"),
            (42, "kırk iki"),
            (43, "kırk üç"),
            (44, "kırk dört"),
            (45, "kırk beş"),
            (46, "kırk altı"),
            (47, "kırk yedi"),
            (48, "kırk sekiz"),
            (49, "kırk dokuz"),
            (50, "elli"),
            (51, "elli bir"),
            (52, "elli iki"),
            (53, "elli üç"),
            (54, "elli dört"),
            (55, "elli beş"),
            (56, "elli altı"),
            (57, "elli yedi"),
            (58, "elli sekiz"),
            (59, "elli dokuz"),
            (60, "altmış"),
            (61, "altmış bir"),
            (62, "altmış iki"),
            (63, "altmış üç"),
            (64, "altmış dört"),
            (65, "altmış beş"),
            (66, "altmış altı"),
            (67, "altmış yedi"),
            (68, "altmış sekiz"),
            (69, "altmış dokuz"),
            (70, "yetmiş"),
            (71, "yetmiş bir"),
            (72, "yetmiş iki"),
            (73, "yetmiş üç"),
            (74, "yetmiş dört"),
            (75, "yetmiş beş"),
            (76, "yetmiş altı"),
            (77, "yetmiş yedi"),
            (78, "yetmiş sekiz"),
            (79, "yetmiş dokuz"),
            (80, "seksen"),
            (81, "seksen bir"),
            (82, "seksen iki"),
            (83, "seksen üç"),
            (84, "seksen dört"),
            (85, "seksen beş"),
            (86, "seksen altı"),
            (87, "seksen yedi"),
            (88, "seksen sekiz"),
            (89, "seksen dokuz"),
            (90, "doksan"),
        ];
        for (n, w) in words {
            numbers.insert(n, w);
        }

        Self {
            numbers,
            letters: COLUMN_LETTERS,
            patterns: SpeechPatterns {
                word_90: "{Num}!",
                word_75: "{Letter} {num}!",
                digit: "{First} {second}",
            },
        }
    }

    fn hindi() -> Self {
        let mut numbers = HashMap::new();
        let words = [
            (0, "शून्य"),
            (1, "एक"),
            (2, "दो"),
            (3, "तीन"),
            (4, "चार"),
            (5, "पाँच"),
            (6, "छह"),
            (7, "सात"),
            (8, "आठ"),
            (9, "नौ"),
            (10, "दस"),
            (11, "ग्यारह"),
            (12, "बारह"),
            (13, "तेरह"),
            (14, "चौदह"),
            (15, "पंद्रह"),
            (16, "सोलह"),
            (17, "सत्रह"),
            (18, "अठारह"),
            (19, "उन्नीस"),
            (20, "बीस"),
            (21, "इक्कीस"),
            (22, "बाईस"),
            (23, "तेईस"),
            (24, "चौबीस"),
            (25, "पच्चीस"),
            (26, "छब्बीस"),
            (27, "सत्ताईस"),
            (28, "अट्ठाईस"),
            (29, "उनतीस"),
            (30, "तीस"),
            (31, "इकतीस"),
            (32, "बत्तीस"),
            (33, "तैंतीस"),
            (34, "चौंतीस"),
            (35, "पैंतीस"),
            (36, "छत्तीस"),
            (37, "सैंतीस"),
            (38, "अड़तीस"),
            (39, "उनतालीस"),
            (40, "चालीस"),
            (41, "इकतालीस"),
            (42, "बयालीस"),
            (43, "तैंतालीस"),
            (44, "चवालीस"),
            (45, "पैंतालीस"),
            (46, "छियालीस"),
            (47, "सैंतालीस"),
            (48, "अड़तालीस"),
            (49, "उनचास"),
            (50, "पचास"),
            (51, "इक्यावन"),
            (52, "बावन"),
            (53, "तिरपन"),
            (54, "चौवन"),
            (55, "पचपन"),
            (56, "छप्पन"),
            (57, "सत्तावन"),
            (58, "अट्ठावन"),
            (59, "उनसठ"),
            (60, "साठ"),
            (61, "इकसठ"),
            (62, "बासठ"),
            (63, "तिरसठ"),
            (64, "चौंसठ"),
            (65, "पैंसठ"),
            (66, "छियासठ"),
            (67, "सड़सठ"),
            (68, "अड़सठ"),
            (69, "उनहत्तर"),
            (70, "सत्तर"),
            (71, "इकहत्तर"),
            (72, "बहत्तर"),
            (73, "तिहत्तर"),
            (74, "चौहत्तर"),
            (75, "पचहत्तर"),
            (76, "छिहत्तर"),
            (77, "सतहत्तर"),
            (78, "अठहत्तर"),
            (79, "उन्यासी"),
            (80, "अस्सी"),
            (81, "इक्यासी"),
            (82, "बयासी"),
            (83, "तिरासी"),
            (84, "चौरासी"),
            (85, "पचासी"),
            (86, "छियासी"),
            (87, "सत्तासी"),
            (88, "अट्ठासी"),
            (89, "नवासी"),
            (90, "नब्बे"),
        ];
        for (n, w) in words {
            numbers.insert(n, w);
        }

        Self {
            numbers,
            letters: COLUMN_LETTERS,
            patterns: SpeechPatterns {
                word_90: "{Num}!",
                word_75: "{Letter} {num}!",
                digit: "{First} {second}",
            },
        }
    }

    fn japanese() -> Self {
        let mut numbers = HashMap::new();
        let words = [
            (0, "ゼロ"),
            (1, "いち"),
            (2, "に"),
            (3, "さん"),
            (4, "よん"),
            (5, "ご"),
            (6, "ろく"),
            (7, "なな"),
            (8, "はち"),
            (9, "きゅう"),
            (10, "じゅう"),
            (11, "じゅういち"),
            (12, "じゅうに"),
            (13, "じゅうさん"),
            (14, "じゅうよん"),
            (15, "じゅうご"),
            (16, "じゅうろく"),
            (17, "じゅうなな"),
            (18, "じゅうはち"),
            (19, "じゅうきゅう"),
            (20, "にじゅう"),
            (21, "にじゅういち"),
            (22, "にじゅうに"),
            (23, "にじゅうさん"),
            (24, "にじゅうよん"),
            (25, "にじゅうご"),
            (26, "にじゅうろく"),
            (27, "にじゅうなな"),
            (28, "にじゅうはち"),
            (29, "にじゅうきゅう"),
            (30, "さんじゅう"),
            (31, "さんじゅういち"),
            (32, "さんじゅうに"),
            (33, "さんじゅうさん"),
            (34, "さんじゅうよん"),
            (35, "さんじゅうご"),
            (36, "さんじゅうろく"),
            (37, "さんじゅうなな"),
            (38, "さんじゅうはち"),
            (39, "さんじゅうきゅう"),
            (40, "よんじゅう"),
            (41, "よんじゅういち"),
            (42, "よんじゅうに"),
            (43, "よんじゅうさん"),
            (44, "よんじゅうよん"),
            (45, "よんじゅうご"),
            (46, "よんじゅうろく"),
            (47, "よんじゅうなな"),
            (48, "よんじゅうはち"),
            (49, "よんじゅうきゅう"),
            (50, "ごじゅう"),
            (51, "ごじゅういち"),
            (52, "ごじゅうに"),
            (53, "ごじゅうさん"),
            (54, "ごじゅうよん"),
            (55, "ごじゅうご"),
            (56, "ごじゅうろく"),
            (57, "ごじゅうなな"),
            (58, "ごじゅうはち"),
            (59, "ごじゅうきゅう"),
            (60, "ろくじゅう"),
            (61, "ろくじゅういち"),
            (62, "ろくじゅうに"),
            (63, "ろくじゅうさん"),
            (64, "ろくじゅうよん"),
            (65, "ろくじゅうご"),
            (66, "ろくじゅうろく"),
            (67, "ろくじゅうなな"),
            (68, "ろくじゅうはち"),
            (69, "ろくじゅうきゅう"),
            (70, "ななじゅう"),
            (71, "ななじゅういち"),
            (72, "ななじゅうに"),
            (73, "ななじゅうさん"),
            (74, "ななじゅうよん"),
            (75, "ななじゅうご"),
            (76, "ななじゅうろく"),
            (77, "ななじゅうなな"),
            (78, "ななじゅうはち"),
            (79, "ななじゅうきゅう"),
            (80, "はちじゅう"),
            (81, "はちじゅういち"),
            (82, "はちじゅうに"),
            (83, "はちじゅうさん"),
            (84, "はちじゅうよん"),
            (85, "はちじゅうご"),
            (86, "はちじゅうろく"),
            (87, "はちじゅうなな"),
            (88, "はちじゅうはち"),
            (89, "はちじゅうきゅう"),
            (90, "きゅうじゅう"),
        ];
        for (n, w) in words {
            numbers.insert(n, w);
        }

        Self {
            numbers,
            letters: ["ビー", "アイ", "エヌ", "ジー", "オー"],
            patterns: SpeechPatterns {
                word_90: "{Num}！",
                word_75: "{Letter}、{num}！",
                digit: "{first}、{second}",
            },
        }
    }
}

/// What is sent to ElevenLabs for one Audio Part: the text it speaks, and the context around it,
/// which it does not speak.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsText {
    pub text: String,
    pub previous_text: String,
    pub next_text: Option<String>,
}

/// Builds the text and its context, in the `formats` selected for the Accent's Language.
/// The Word knows the scene and that the Digit follows; the Digit knows the scene and that
/// the Word has just been said. The Digit serves every Bingo Mode, so its context is the
/// Bingo 90 Word, without the letter. Returns `None` for the Digit of a number below 10,
/// which has none.
pub fn build_tts_text(
    number: u32,
    accent: Accent,
    mode: BingoMode,
    part: AudioPart,
    formats: &SelectedFormats,
) -> Option<TtsText> {
    if !part.exists_for(number) {
        return None;
    }
    let scene = accent.scene();
    let word = |mode| word_text(number, accent, mode, formats.word(mode));
    let digit = || digit_text(number, accent, formats.digit());
    let tts = match part {
        AudioPart::Word => TtsText {
            text: word(mode),
            previous_text: scene.to_string(),
            next_text: AudioPart::Digit.exists_for(number).then(digit),
        },
        AudioPart::Digit => TtsText {
            text: digit(),
            previous_text: format!("{} {}", scene, word(BingoMode::Bingo90)),
            next_text: None,
        },
    };
    Some(tts)
}

fn word_text(number: u32, accent: Accent, mode: BingoMode, format: Option<&str>) -> String {
    let slot = FormatSlot::new(accent.language(), AudioPart::Word, mode);
    let format = format.map_or_else(|| default_format(slot), str::to_string);
    build_word_text_with_format(&format, number, accent, mode)
}

fn digit_text(number: u32, accent: Accent, format: Option<&str>) -> String {
    let slot = FormatSlot::new(accent.language(), AudioPart::Digit, BingoMode::Bingo90);
    let format = format.map_or_else(|| default_format(slot), str::to_string);
    build_digit_text_with_format(&format, number, accent)
}

/// The text of one Audio Part of `number` in `format`, or in the Default one when `None`.
pub fn build_part_text(
    number: u32,
    accent: Accent,
    mode: BingoMode,
    part: AudioPart,
    format: Option<&str>,
) -> String {
    match part {
        AudioPart::Word => word_text(number, accent, mode, format),
        AudioPart::Digit => digit_text(number, accent, format),
    }
}

/// The Default Word Format or Digit Format of `slot`, in the same syntax as the user's.
pub fn default_format(slot: FormatSlot) -> String {
    let patterns = LanguageConfig::for_language(slot.language).patterns;
    match (slot.part, slot.bingo_mode) {
        (AudioPart::Digit, _) => patterns.digit,
        (AudioPart::Word, Some(BingoMode::Bingo75)) => patterns.word_75,
        (AudioPart::Word, _) => patterns.word_90,
    }
    .to_string()
}

/// Upper-cases the first letter, skipping leading punctuation such as Spanish "¡".
/// Scripts without case (Devanagari, kana) stay as they are.
fn capitalize_first_letter(text: &str, language: Language) -> String {
    match text.char_indices().find(|(_, c)| c.is_alphabetic()) {
        Some((i, c)) => {
            let upper = match (language, c) {
                // Turkish keeps the dot: "iki" becomes "İki", not "Iki"
                (Language::Turkish, 'i') => "\u{130}".to_string(),
                _ => c.to_uppercase().to_string(),
            };
            format!("{}{}{}", &text[..i], upper, &text[i + c.len_utf8()..])
        }
        None => text.to_string(),
    }
}

fn number_word(config: &LanguageConfig, number: u32) -> String {
    config
        .numbers
        .get(&number)
        .map(|s| s.to_string())
        .unwrap_or_else(|| number.to_string())
}

/// Writes the Word of `number` in a Word Format, exactly as written: `{num}`, `{Num}` and
/// `{NUM}` give the number words in lower case, with a capital first letter or in upper case,
/// `{#}` the number in figures ("75"), and `{letter}`, `{Letter}` and `{LETTER}` the Bingo 75
/// column letter in the same three cases. Nothing else is capitalized.
pub fn build_word_text_with_format(
    format: &str,
    number: u32,
    accent: Accent,
    mode: BingoMode,
) -> String {
    let config = LanguageConfig::for_accent(accent);
    let language = accent.language();
    let num = lower_case(&number_word(&config, number), language);
    let letter = mode
        .column(number)
        .map(|column| lower_case(config.letters[column], language))
        .unwrap_or_default();
    format
        .replace("{num}", &num)
        .replace("{Num}", &capitalize_first_letter(&num, language))
        .replace("{NUM}", &upper_case(&num, language))
        .replace("{#}", &number.to_string())
        .replace("{letter}", &letter)
        .replace("{Letter}", &capitalize_first_letter(&letter, language))
        .replace("{LETTER}", &upper_case(&letter, language))
}

/// Turkish keeps the dot: "i" is the lower case of "İ", and "ı" that of "I".
fn lower_case(text: &str, language: Language) -> String {
    match language {
        Language::Turkish => text
            .replace('\u{130}', "i")
            .replace('I', "\u{131}")
            .to_lowercase(),
        _ => text.to_lowercase(),
    }
}

fn upper_case(text: &str, language: Language) -> String {
    match language {
        Language::Turkish => text.replace('i', "\u{130}").to_uppercase(),
        _ => text.to_uppercase(),
    }
}

/// Writes the Digit of `number` in a Digit Format, exactly as written: `{first}`, `{First}`
/// and `{FIRST}` give the first digit in words in lower case, with a capital first letter or
/// in upper case, and `{#1}` in figures ("7"); `{second}`, `{Second}`, `{SECOND}` and `{#2}`
/// the same for the second digit.
pub fn build_digit_text_with_format(format: &str, number: u32, accent: Accent) -> String {
    let config = LanguageConfig::for_accent(accent);
    let language = accent.language();
    let (first, second) = (number / 10, number % 10);
    let first_word = lower_case(&number_word(&config, first), language);
    let second_word = lower_case(&number_word(&config, second), language);
    format
        .replace("{first}", &first_word)
        .replace("{First}", &capitalize_first_letter(&first_word, language))
        .replace("{FIRST}", &upper_case(&first_word, language))
        .replace("{#1}", &first.to_string())
        .replace("{second}", &second_word)
        .replace("{Second}", &capitalize_first_letter(&second_word, language))
        .replace("{SECOND}", &upper_case(&second_word, language))
        .replace("{#2}", &second.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The text of one Audio Part of `number` in the Default formats.
    fn build_text(number: u32, accent: Accent, mode: BingoMode, part: AudioPart) -> String {
        build_part_text(number, accent, mode, part, None)
    }

    const SPANISH_SCENE: &str = "En una sala de bingo de Espa\u{f1}a, el cantor saca la siguiente bola del bombo y la anuncia con energ\u{ed}a, alto y claro:";

    #[test]
    fn word_knows_the_scene_and_that_the_digits_follow() {
        let tts = build_tts_text(
            45,
            Accent::PeninsularSpanish,
            BingoMode::Bingo90,
            AudioPart::Word,
            &SelectedFormats::default(),
        )
        .unwrap();

        assert_eq!(
            tts,
            TtsText {
                text: "\u{a1}Cuarenta y cinco!".to_string(),
                previous_text: SPANISH_SCENE.to_string(),
                next_text: Some("Cuatro cinco".to_string()),
            }
        );
    }

    #[test]
    fn digit_knows_the_scene_and_the_word_said_before() {
        let tts = build_tts_text(
            45,
            Accent::PeninsularSpanish,
            BingoMode::Bingo90,
            AudioPart::Digit,
            &SelectedFormats::default(),
        )
        .unwrap();

        assert_eq!(
            tts,
            TtsText {
                text: "Cuatro cinco".to_string(),
                previous_text: format!("{} \u{a1}Cuarenta y cinco!", SPANISH_SCENE),
                next_text: None,
            }
        );
    }

    #[test]
    fn digit_is_the_same_in_both_modes_and_its_context_has_no_letter() {
        let digit = |mode| {
            build_tts_text(
                45,
                Accent::PeninsularSpanish,
                mode,
                AudioPart::Digit,
                &SelectedFormats::default(),
            )
        };

        assert_eq!(digit(BingoMode::Bingo75), digit(BingoMode::Bingo90));
    }

    #[test]
    fn numbers_below_10_have_no_digit() {
        let word = build_tts_text(
            7,
            Accent::PeninsularSpanish,
            BingoMode::Bingo90,
            AudioPart::Word,
            &SelectedFormats::default(),
        );
        let digit = build_tts_text(
            7,
            Accent::PeninsularSpanish,
            BingoMode::Bingo90,
            AudioPart::Digit,
            &SelectedFormats::default(),
        );

        assert_eq!(word.unwrap().next_text, None);
        assert_eq!(digit, None);
    }

    #[test]
    fn spanish_number_words_carry_their_accents() {
        let text = |n| {
            build_text(
                n,
                Accent::PeninsularSpanish,
                BingoMode::Bingo90,
                AudioPart::Word,
            )
        };

        assert_eq!(text(16), "\u{a1}Diecis\u{e9}is!");
        assert_eq!(text(22), "\u{a1}Veintid\u{f3}s!");
        assert_eq!(text(23), "\u{a1}Veintitr\u{e9}s!");
        assert_eq!(text(26), "\u{a1}Veintis\u{e9}is!");
    }

    #[test]
    fn bingo_75_word_says_the_letter_itself_outside_the_exclamation() {
        let word = |n| {
            build_text(
                n,
                Accent::PeninsularSpanish,
                BingoMode::Bingo75,
                AudioPart::Word,
            )
        };

        assert_eq!(word(8), "B \u{a1}ocho!");
        assert_eq!(word(74), "O \u{a1}setenta y cuatro!");
    }

    #[test]
    fn a_word_format_writes_the_number_and_the_letter_in_the_case_asked() {
        let word = |format, number| {
            build_word_text_with_format(
                format,
                number,
                Accent::PeninsularSpanish,
                BingoMode::Bingo75,
            )
        };

        assert_eq!(word("¡{letter} {num}!", 75), "¡o setenta y cinco!");
        assert_eq!(word("¡{Letter} {Num}!", 75), "¡O Setenta y cinco!");
        assert_eq!(word("¡{LETTER} {NUM}!", 75), "¡O SETENTA Y CINCO!");
    }

    #[test]
    fn a_word_format_keeps_the_turkish_dotted_i() {
        let word = build_word_text_with_format("{NUM}", 2, Accent::Turkish, BingoMode::Bingo90);

        assert_eq!(word, "\u{130}K\u{130}");
    }

    #[test]
    fn the_selected_formats_write_the_parts_and_their_context() {
        let formats = SelectedFormats {
            word_90: Some("{NUM}...".into()),
            word_75: Some("{LETTER}, {#}".into()),
            digit: Some("{#1}... {SECOND}".into()),
        };
        let tts = |mode, part| {
            build_tts_text(75, Accent::PeninsularSpanish, mode, part, &formats).unwrap()
        };

        let word_90 = tts(BingoMode::Bingo90, AudioPart::Word);
        let word_75 = tts(BingoMode::Bingo75, AudioPart::Word);
        let digit = tts(BingoMode::Bingo75, AudioPart::Digit);

        assert_eq!(word_90.text, "SETENTA Y CINCO...");
        assert_eq!(word_90.next_text.as_deref(), Some("7... CINCO"));
        assert_eq!(word_75.text, "O, 75");
        assert_eq!(digit.text, "7... CINCO");
        assert!(digit.previous_text.ends_with(" SETENTA Y CINCO..."));
    }

    #[test]
    fn the_default_digit_format_capitalizes_the_first_digit() {
        assert_eq!(
            build_digit_text_with_format("{First} {second}", 45, Accent::PeninsularSpanish),
            "Cuatro cinco"
        );
    }

    #[test]
    fn bingo_75_digit_has_no_letter() {
        let digit = build_text(
            52,
            Accent::AmericanEnglish,
            BingoMode::Bingo75,
            AudioPart::Digit,
        );

        assert_eq!(digit, "Five two");
    }

    #[test]
    fn accents_of_a_language_say_the_same_text_with_their_own_scene() {
        let word = |accent| {
            build_tts_text(
                45,
                accent,
                BingoMode::Bingo75,
                AudioPart::Word,
                &SelectedFormats::default(),
            )
        };
        let peninsular = word(Accent::PeninsularSpanish).unwrap();
        let rioplatense = word(Accent::RioplatenseSpanish).unwrap();

        assert_eq!(rioplatense.text, peninsular.text);
        assert_ne!(rioplatense.previous_text, peninsular.previous_text);
    }

    #[test]
    fn european_portuguese_writes_its_own_teens() {
        let text = |accent, n| build_text(n, accent, BingoMode::Bingo90, AudioPart::Word);

        assert_eq!(text(Accent::EuropeanPortuguese, 16), "Dezasseis!");
        assert_eq!(text(Accent::EuropeanPortuguese, 17), "Dezassete!");
        assert_eq!(text(Accent::EuropeanPortuguese, 19), "Dezanove!");
        assert_eq!(text(Accent::BrazilianPortuguese, 16), "Dezesseis!");
        assert_eq!(text(Accent::EuropeanPortuguese, 18), "Dezoito!");
    }

    #[test]
    fn every_accent_says_every_number_in_words() {
        for accent in Accent::all() {
            for number in 1..=90 {
                for mode in [BingoMode::Bingo90, BingoMode::Bingo75] {
                    if mode == BingoMode::Bingo75 && number > 75 {
                        continue;
                    }
                    let tts = build_tts_text(
                        number,
                        accent,
                        mode,
                        AudioPart::Word,
                        &SelectedFormats::default(),
                    )
                    .unwrap();
                    assert!(
                        !tts.text.chars().any(|c| c.is_ascii_digit()),
                        "{:?} {} {:?}: {}",
                        accent,
                        number,
                        mode,
                        tts.text
                    );
                }
            }
        }
    }

    #[test]
    fn german_joins_units_before_tens() {
        let text = |n| build_text(n, Accent::German, BingoMode::Bingo90, AudioPart::Word);

        assert_eq!(text(1), "Eins!");
        assert_eq!(text(21), "Einundzwanzig!");
        assert_eq!(text(45), "F\u{fc}nfundvierzig!");
        assert_eq!(
            build_text(45, Accent::German, BingoMode::Bingo90, AudioPart::Digit),
            "Vier f\u{fc}nf"
        );
    }

    #[test]
    fn russian_numbers_are_in_cyrillic() {
        let text = |n| build_text(n, Accent::Russian, BingoMode::Bingo90, AudioPart::Word);

        assert_eq!(text(45), "Сорок пять!");
        assert_eq!(text(12), "Двенадцать!");
        assert_eq!(
            build_text(40, Accent::Russian, BingoMode::Bingo90, AudioPart::Digit),
            "Четыре ноль"
        );
    }

    #[test]
    fn turkish_capitalizes_dotted_i() {
        let text = |n| build_text(n, Accent::Turkish, BingoMode::Bingo90, AudioPart::Word);

        assert_eq!(text(2), "\u{130}ki!");
        assert_eq!(text(45), "K\u{131}rk be\u{15f}!");
        assert_eq!(
            build_text(25, Accent::Turkish, BingoMode::Bingo90, AudioPart::Digit),
            "\u{130}ki be\u{15f}"
        );
    }

    #[test]
    fn hindi_has_its_own_word_for_every_number() {
        let text = |n| build_text(n, Accent::Hindi, BingoMode::Bingo90, AudioPart::Word);

        assert_eq!(text(45), "पैंतालीस!");
        assert_eq!(text(89), "नवासी!");
        assert_eq!(
            build_text(45, Accent::Hindi, BingoMode::Bingo90, AudioPart::Digit),
            "चार पाँच"
        );
    }

    #[test]
    fn japanese_uses_kana_with_the_readings_callers_use() {
        let text = |n, mode| build_text(n, Accent::Japanese, mode, AudioPart::Word);

        assert_eq!(text(4, BingoMode::Bingo90), "よん！");
        assert_eq!(text(47, BingoMode::Bingo90), "よんじゅうなな！");
        assert_eq!(text(45, BingoMode::Bingo75), "エヌ、よんじゅうご！");
        assert_eq!(
            build_text(45, Accent::Japanese, BingoMode::Bingo90, AudioPart::Digit),
            "よん、ご"
        );
    }
}
