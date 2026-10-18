use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BingoMode {
    Bingo90,
    Bingo75,
}

impl Default for BingoMode {
    fn default() -> Self {
        BingoMode::Bingo90
    }
}

/// Returns the BINGO letter for a given number in Bingo 75 mode
pub fn bingo75_letter(number: u32) -> &'static str {
    match number {
        1..=15 => "B",
        16..=30 => "I",
        31..=45 => "N",
        46..=60 => "G",
        61..=75 => "O",
        _ => "",
    }
}
