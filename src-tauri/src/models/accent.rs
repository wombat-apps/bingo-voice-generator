use serde::{Deserialize, Serialize};

use super::Language;

/// The regional way a Language is spoken, which the user picks to generate in. See GLOSSARY.md.
/// It serializes as its locale tag, which also names its folders.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
pub enum Accent {
    #[serde(rename = "es-ES")]
    #[default]
    PeninsularSpanish,
    #[serde(rename = "es-419")]
    LatinAmericanSpanish,
    #[serde(rename = "es-AR")]
    RioplatenseSpanish,
    #[serde(rename = "en-US")]
    AmericanEnglish,
    #[serde(rename = "en-GB")]
    BritishEnglish,
    #[serde(rename = "en-NZ")]
    NewZealandEnglish,
    #[serde(rename = "en-IN")]
    IndianEnglish,
    #[serde(rename = "fr-FR")]
    French,
    #[serde(rename = "fr-CA")]
    CanadianFrench,
    #[serde(rename = "pt-BR")]
    BrazilianPortuguese,
    #[serde(rename = "pt-PT")]
    EuropeanPortuguese,
    #[serde(rename = "it-IT")]
    Italian,
    #[serde(rename = "de-DE")]
    German,
    #[serde(rename = "ru-RU")]
    Russian,
    #[serde(rename = "tr-TR")]
    Turkish,
    #[serde(rename = "hi-IN")]
    Hindi,
    #[serde(rename = "ja-JP")]
    Japanese,
}

impl Accent {
    pub fn all() -> Vec<Accent> {
        vec![
            Accent::PeninsularSpanish,
            Accent::LatinAmericanSpanish,
            Accent::RioplatenseSpanish,
            Accent::AmericanEnglish,
            Accent::BritishEnglish,
            Accent::NewZealandEnglish,
            Accent::IndianEnglish,
            Accent::French,
            Accent::CanadianFrench,
            Accent::BrazilianPortuguese,
            Accent::EuropeanPortuguese,
            Accent::Italian,
            Accent::German,
            Accent::Russian,
            Accent::Turkish,
            Accent::Hindi,
            Accent::Japanese,
        ]
    }

    pub fn language(&self) -> Language {
        match self {
            Accent::PeninsularSpanish
            | Accent::LatinAmericanSpanish
            | Accent::RioplatenseSpanish => Language::Spanish,
            Accent::AmericanEnglish
            | Accent::BritishEnglish
            | Accent::NewZealandEnglish
            | Accent::IndianEnglish => Language::English,
            Accent::French | Accent::CanadianFrench => Language::French,
            Accent::BrazilianPortuguese | Accent::EuropeanPortuguese => Language::Portuguese,
            Accent::Italian => Language::Italian,
            Accent::German => Language::German,
            Accent::Russian => Language::Russian,
            Accent::Turkish => Language::Turkish,
            Accent::Hindi => Language::Hindi,
            Accent::Japanese => Language::Japanese,
        }
    }

    pub fn raw_value(&self) -> &'static str {
        match self {
            Accent::PeninsularSpanish => "es-ES",
            Accent::LatinAmericanSpanish => "es-419",
            Accent::RioplatenseSpanish => "es-AR",
            Accent::AmericanEnglish => "en-US",
            Accent::BritishEnglish => "en-GB",
            Accent::NewZealandEnglish => "en-NZ",
            Accent::IndianEnglish => "en-IN",
            Accent::French => "fr-FR",
            Accent::CanadianFrench => "fr-CA",
            Accent::BrazilianPortuguese => "pt-BR",
            Accent::EuropeanPortuguese => "pt-PT",
            Accent::Italian => "it-IT",
            Accent::German => "de-DE",
            Accent::Russian => "ru-RU",
            Accent::Turkish => "tr-TR",
            Accent::Hindi => "hi-IN",
            Accent::Japanese => "ja-JP",
        }
    }

    /// "Language (region)" in the language itself; just the language when it has one Accent.
    pub fn display_name(&self) -> &'static str {
        match self {
            Accent::PeninsularSpanish => "Espa\u{f1}ol (Espa\u{f1}a)",
            Accent::LatinAmericanSpanish => "Espa\u{f1}ol (Latinoam\u{e9}rica)",
            Accent::RioplatenseSpanish => "Espa\u{f1}ol (Rioplatense)",
            Accent::AmericanEnglish => "English (US)",
            Accent::BritishEnglish => "English (UK)",
            Accent::NewZealandEnglish => "English (New Zealand)",
            Accent::IndianEnglish => "English (India)",
            Accent::French => "Fran\u{e7}ais (France)",
            Accent::CanadianFrench => "Fran\u{e7}ais (Canada)",
            Accent::BrazilianPortuguese => "Portugu\u{ea}s (Brasil)",
            Accent::EuropeanPortuguese => "Portugu\u{ea}s (Portugal)",
            Accent::Italian => "Italiano",
            Accent::German => "Deutsch",
            Accent::Russian => "Русский",
            Accent::Turkish => "Türkçe",
            Accent::Hindi => "हिन्दी",
            Accent::Japanese => "日本語",
        }
    }

    pub fn flag(&self) -> &'static str {
        match self {
            Accent::PeninsularSpanish => "\u{1f1ea}\u{1f1f8}",
            // Neutral Latin American Spanish belongs to no single country
            Accent::LatinAmericanSpanish => "\u{1f30e}",
            Accent::RioplatenseSpanish => "\u{1f1e6}\u{1f1f7}",
            Accent::AmericanEnglish => "\u{1f1fa}\u{1f1f8}",
            Accent::BritishEnglish => "\u{1f1ec}\u{1f1e7}",
            Accent::NewZealandEnglish => "\u{1f1f3}\u{1f1ff}",
            Accent::IndianEnglish | Accent::Hindi => "\u{1f1ee}\u{1f1f3}",
            Accent::French => "\u{1f1eb}\u{1f1f7}",
            Accent::CanadianFrench => "\u{1f1e8}\u{1f1e6}",
            Accent::BrazilianPortuguese => "\u{1f1e7}\u{1f1f7}",
            Accent::EuropeanPortuguese => "\u{1f1f5}\u{1f1f9}",
            Accent::Italian => "\u{1f1ee}\u{1f1f9}",
            Accent::German => "\u{1f1e9}\u{1f1ea}",
            Accent::Russian => "\u{1f1f7}\u{1f1fa}",
            Accent::Turkish => "\u{1f1f9}\u{1f1f7}",
            Accent::Japanese => "\u{1f1ef}\u{1f1f5}",
        }
    }

    pub fn elevenlabs_code(&self) -> &'static str {
        self.language().elevenlabs_code()
    }

    /// The `accent` label of the Voice Library. Only `peninsular`, `american`, `british` and
    /// `brazilian` are confirmed; see docs/elevenlabs-plans.md. A label with no voices makes
    /// the search fall back to the whole Language.
    pub fn elevenlabs_accent(&self) -> &'static str {
        match self {
            Accent::PeninsularSpanish => "peninsular",
            Accent::LatinAmericanSpanish => "latin american",
            Accent::RioplatenseSpanish => "argentine",
            Accent::AmericanEnglish => "american",
            Accent::BritishEnglish => "british",
            Accent::NewZealandEnglish => "new zealand",
            Accent::IndianEnglish => "indian",
            Accent::CanadianFrench => "canadian",
            Accent::BrazilianPortuguese => "brazilian",
            Accent::EuropeanPortuguese => "european",
            Accent::French
            | Accent::Italian
            | Accent::German
            | Accent::Russian
            | Accent::Turkish
            | Accent::Hindi
            | Accent::Japanese => "standard",
        }
    }

    /// Describes the bingo call to ElevenLabs, naming the region so the voice keeps its
    /// Accent. It is sent as context, never spoken.
    pub fn scene(&self) -> &'static str {
        match self {
            Accent::PeninsularSpanish => "En una sala de bingo de Espa\u{f1}a, el cantor saca la siguiente bola del bombo y la anuncia con energ\u{ed}a, alto y claro:",
            Accent::LatinAmericanSpanish => "En una sala de bingo de Latinoam\u{e9}rica, el locutor saca la siguiente bola del bombo y la anuncia con energ\u{ed}a, fuerte y claro:",
            Accent::RioplatenseSpanish => "En una sala de bingo de Buenos Aires, el locutor saca la pr\u{f3}xima bolilla del bolillero y la canta con energ\u{ed}a, fuerte y claro:",
            Accent::AmericanEnglish => "In a bingo hall in the United States, the caller draws the next ball from the cage and announces it with energy, loud and clear:",
            Accent::BritishEnglish => "In a bingo hall in Britain, the caller draws the next ball from the machine and announces it with energy, loud and clear:",
            Accent::NewZealandEnglish => "In a bingo hall in New Zealand, the caller draws the next ball from the cage and announces it with energy, loud and clear:",
            Accent::IndianEnglish => "At a tambola game in India, the caller draws the next number and announces it with energy, loud and clear:",
            Accent::French => "Dans une salle de bingo en France, l'animateur tire la boule suivante du boulier et l'annonce avec \u{e9}nergie, haut et fort :",
            Accent::CanadianFrench => "Dans une salle de bingo au Qu\u{e9}bec, l'annonceur tire la boule suivante du boulier et l'annonce avec \u{e9}nergie, haut et fort :",
            Accent::BrazilianPortuguese => "Em um sal\u{e3}o de bingo no Brasil, o locutor sorteia a pr\u{f3}xima bola do globo e a anuncia com energia, alto e bom som:",
            Accent::EuropeanPortuguese => "Numa sala de bingo em Portugal, o locutor tira a pr\u{f3}xima bola da t\u{f4}mbola e anuncia-a com energia, alto e bom som:",
            Accent::Italian => "In una sala bingo in Italia, il banditore estrae la prossima pallina dall'urna e la annuncia con energia, forte e chiaro:",
            Accent::German => "In einer Bingohalle in Deutschland zieht der Ansager die nächste Kugel aus der Trommel und ruft sie mit Energie laut und deutlich aus:",
            Accent::Russian => "В зале бинго в России ведущий достаёт из мешка следующий бочонок и объявляет его энергично, громко и чётко:",
            Accent::Turkish => "Türkiye'de bir tombala salonunda sunucu torbadan sıradaki topu çekiyor ve enerjik bir şekilde, yüksek sesle ve net olarak okuyor:",
            Accent::Hindi => "भारत में तंबोला के खेल में, कॉलर अगला नंबर निकालता है और उसे जोश के साथ, ज़ोर से और साफ़-साफ़ बोलता है:",
            Accent::Japanese => "日本のビンゴ大会で、司会者が抽選機から次のボールを取り出し、元気よく、大きな声ではっきりと読み上げます：",
        }
    }

    /// Number words this Accent writes differently from the rest of its Language.
    pub fn number_word_overrides(&self) -> &'static [(u32, &'static str)] {
        match self {
            Accent::EuropeanPortuguese => &[(16, "dezasseis"), (17, "dezassete"), (19, "dezanove")],
            _ => &[],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_as_its_locale_tag() {
        for accent in Accent::all() {
            let json = serde_json::to_string(&accent).unwrap();
            assert_eq!(json, format!("\"{}\"", accent.raw_value()));
            assert_eq!(serde_json::from_str::<Accent>(&json).unwrap(), accent);
        }
    }

    #[test]
    fn every_accent_has_a_scene() {
        for accent in Accent::all() {
            assert!(!accent.scene().is_empty(), "{:?}", accent);
        }
    }
}
