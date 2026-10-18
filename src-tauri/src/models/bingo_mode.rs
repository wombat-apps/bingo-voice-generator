use serde::{Deserialize, Serialize};

/// The Bingo 75 column letters as written to ElevenLabs and in file names. The letter itself
/// ("B", not "be"): a spelled-out name sounds like a word ("o" as "oh").
pub const COLUMN_LETTERS: [&str; 5] = ["B", "I", "N", "G", "O"];

/// The variant of the game (see GLOSSARY.md). Mirrored for the UI in `src/domain/bingo.ts`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum BingoMode {
    #[default]
    Bingo90,
    Bingo75,
}

impl BingoMode {
    #[cfg(test)]
    pub const ALL: [BingoMode; 2] = [BingoMode::Bingo90, BingoMode::Bingo75];

    pub fn max_number(self) -> u32 {
        match self {
            BingoMode::Bingo90 => 90,
            BingoMode::Bingo75 => 75,
        }
    }

    /// Whether `number` is one of the mode's numbers.
    pub fn contains(self, number: u32) -> bool {
        (1..=self.max_number()).contains(&number)
    }

    /// The Bingo 75 column of `number`, from 0 (B) to 4 (O). `None` in Bingo 90, which has
    /// no columns, and for numbers outside the mode.
    pub fn column(self, number: u32) -> Option<usize> {
        match self {
            BingoMode::Bingo75 if self.contains(number) => Some(((number - 1) / 15) as usize),
            _ => None,
        }
    }

    /// The letter of the column of `number` (`"N"` for 45 in Bingo 75).
    pub fn column_letter(self, number: u32) -> Option<&'static str> {
        self.column(number).map(|column| COLUMN_LETTERS[column])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bingo75_splits_its_numbers_into_five_columns_of_fifteen() {
        let letter = |n| BingoMode::Bingo75.column_letter(n);

        assert_eq!(letter(1), Some("B"));
        assert_eq!(letter(15), Some("B"));
        assert_eq!(letter(16), Some("I"));
        assert_eq!(letter(45), Some("N"));
        assert_eq!(letter(75), Some("O"));
        assert_eq!(letter(76), None);
        assert_eq!(letter(0), None);
    }

    #[test]
    fn bingo90_has_no_columns() {
        assert_eq!(BingoMode::Bingo90.column(45), None);
        assert!(BingoMode::Bingo90.contains(90));
        assert!(!BingoMode::Bingo75.contains(80));
    }
}
