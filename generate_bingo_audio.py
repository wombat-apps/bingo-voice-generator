import os
import time
import json
import requests
import argparse
import shutil
from typing import Dict, List

# ===========================
# Configuration
# ===========================

API_KEY = "sk_8f5f6f8c478ecf105908c9bfc0a1d48ab49877377d69df84"          # <- REQUIRED
MODEL_ID = "eleven_v3"          # Prioritize quality for pre-generation
OUTPUT_FORMAT = "mp3_44100_128"              # mp3_44100_128 | wav_44100 | etc. (see ElevenLabs docs)
BASE_OUTDIR = "out_audio"                    # Root output folder
RATE_LIMIT_DELAY_SEC = 0.35                  # Small delay to be gentle with API limits
USE_SSML_BREAKS = False                      # If your model supports simple <break/> tags, set True

# ===========================
# Available Voices (by language)
# ===========================
# Each voice has a name and ElevenLabs voice_id
VOICES: Dict[str, List[Dict[str, str]]] = {
    "es-ES": [
        {"name": "lucia", "id": "gEPYSePlyPI0GZQOPyat"},
        {"name": "manuel", "id": "BXtvkfRgOYGPQKVRgufE"},
    ],
    "en-US": [
        {"name": "aria", "id": "9BWtsMINqrJLrRacOk9x"},
    ],
    "fr-FR": [
        {"name": "marie", "id": "Xgb3SR8idOHy8scGICeJ"},
    ],
}

# ===========================
# Language Configuration
# ===========================
# - code: language code (e.g., "es", "en", "fr")
# - patterns: customize punctuation/spacing and optional breaks per language
# - digits: words for 0..9 used for the second part (e.g., "cinco-cuatro")
# - numbers: words for 1..90 used for the full number (e.g., "cincuenta y cuatro")
LANGUAGES: Dict[str, Dict] = {
    "es-ES": {
        "digits": {
            "0": "cero", "1": "uno", "2": "dos", "3": "tres", "4": "cuatro",
            "5": "cinco", "6": "seis", "7": "siete", "8": "ocho", "9": "nueve"
        },
        "numbers": {
            "1": "uno", "2": "dos", "3": "tres", "4": "cuatro", "5": "cinco",
            "6": "seis", "7": "siete", "8": "ocho", "9": "nueve", "10": "diez",
            "11": "once", "12": "doce", "13": "trece", "14": "catorce", "15": "quince",
            "16": "dieciseis", "17": "diecisiete", "18": "dieciocho", "19": "diecinueve",
            "20": "veinte", "21": "veintiuno", "22": "veintidos", "23": "veintitres",
            "24": "veinticuatro", "25": "veinticinco", "26": "veintiseis",
            "27": "veintisiete", "28": "veintiocho", "29": "veintinueve",
            "30": "treinta", "31": "treinta y uno", "32": "treinta y dos",
            "33": "treinta y tres", "34": "treinta y cuatro", "35": "treinta y cinco",
            "36": "treinta y seis", "37": "treinta y siete", "38": "treinta y ocho",
            "39": "treinta y nueve", "40": "cuarenta", "41": "cuarenta y uno",
            "42": "cuarenta y dos", "43": "cuarenta y tres", "44": "cuarenta y cuatro",
            "45": "cuarenta y cinco", "46": "cuarenta y seis", "47": "cuarenta y siete",
            "48": "cuarenta y ocho", "49": "cuarenta y nueve", "50": "cincuenta",
            "51": "cincuenta y uno", "52": "cincuenta y dos", "53": "cincuenta y tres",
            "54": "cincuenta y cuatro", "55": "cincuenta y cinco", "56": "cincuenta y seis",
            "57": "cincuenta y siete", "58": "cincuenta y ocho", "59": "cincuenta y nueve",
            "60": "sesenta", "61": "sesenta y uno", "62": "sesenta y dos",
            "63": "sesenta y tres", "64": "sesenta y cuatro", "65": "sesenta y cinco",
            "66": "sesenta y seis", "67": "sesenta y siete", "68": "sesenta y ocho",
            "69": "sesenta y nueve", "70": "setenta", "71": "setenta y uno",
            "72": "setenta y dos", "73": "setenta y tres", "74": "setenta y cuatro",
            "75": "setenta y cinco", "76": "setenta y seis", "77": "setenta y siete",
            "78": "setenta y ocho", "79": "setenta y nueve", "80": "ochenta",
            "81": "ochenta y uno", "82": "ochenta y dos", "83": "ochenta y tres",
            "84": "ochenta y cuatro", "85": "ochenta y cinco", "86": "ochenta y seis",
            "87": "ochenta y siete", "88": "ochenta y ocho", "89": "ochenta y nueve",
            "90": "noventa"
        },
        "patterns": {
            # Bingo 90 — Spanish typographic exclamation and optional pause before digits
            "90_two_digits": "[excited] ¡{num_word}! ... {d1}-{d2}",
            "90_single_digit": "[excited] ¡{num_word}!",
            "75_two_digits": "[excited] ¡{letter} {num_word}! ... {letter} {d1}-{d2}",
            "75_single_digit": "[excited] ¡{letter} {num_word}!"
        }
    },
    "en-US": {
        "digits": {
            "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
            "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine"
        },
        "numbers": {
            "1": "one", "2": "two", "3": "three", "4": "four", "5": "five",
            "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten",
            "11": "eleven", "12": "twelve", "13": "thirteen", "14": "fourteen",
            "15": "fifteen", "16": "sixteen", "17": "seventeen", "18": "eighteen",
            "19": "nineteen", "20": "twenty", "21": "twenty-one", "22": "twenty-two",
            "23": "twenty-three", "24": "twenty-four", "25": "twenty-five",
            "26": "twenty-six", "27": "twenty-seven", "28": "twenty-eight",
            "29": "twenty-nine", "30": "thirty", "31": "thirty-one", "32": "thirty-two",
            "33": "thirty-three", "34": "thirty-four", "35": "thirty-five",
            "36": "thirty-six", "37": "thirty-seven", "38": "thirty-eight",
            "39": "thirty-nine", "40": "forty", "41": "forty-one", "42": "forty-two",
            "43": "forty-three", "44": "forty-four", "45": "forty-five",
            "46": "forty-six", "47": "forty-seven", "48": "forty-eight",
            "49": "forty-nine", "50": "fifty", "51": "fifty-one", "52": "fifty-two",
            "53": "fifty-three", "54": "fifty-four", "55": "fifty-five",
            "56": "fifty-six", "57": "fifty-seven", "58": "fifty-eight",
            "59": "fifty-nine", "60": "sixty", "61": "sixty-one", "62": "sixty-two",
            "63": "sixty-three", "64": "sixty-four", "65": "sixty-five",
            "66": "sixty-six", "67": "sixty-seven", "68": "sixty-eight",
            "69": "sixty-nine", "70": "seventy", "71": "seventy-one",
            "72": "seventy-two", "73": "seventy-three", "74": "seventy-four",
            "75": "seventy-five", "76": "seventy-six", "77": "seventy-seven",
            "78": "seventy-eight", "79": "seventy-nine", "80": "eighty",
            "81": "eighty-one", "82": "eighty-two", "83": "eighty-three",
            "84": "eighty-four", "85": "eighty-five", "86": "eighty-six",
            "87": "eighty-seven", "88": "eighty-eight", "89": "eighty-nine",
            "90": "ninety"
        },
        "patterns": {
            "90_two_digits": "[excited] {num_word}! ... {d1}-{d2}",
            "90_single_digit": "[excited] {num_word}!",
            "75_two_digits": "[excited] {letter} {num_word}! ... {letter} {d1}-{d2}",
            "75_single_digit": "[excited] {letter} {num_word}!"
        }
    },
    "fr-FR": {
        "digits": {
            "0": "zero", "1": "un", "2": "deux", "3": "trois", "4": "quatre",
            "5": "cinq", "6": "six", "7": "sept", "8": "huit", "9": "neuf"
        },
        "numbers": {
            "1": "un", "2": "deux", "3": "trois", "4": "quatre", "5": "cinq",
            "6": "six", "7": "sept", "8": "huit", "9": "neuf", "10": "dix",
            "11": "onze", "12": "douze", "13": "treize", "14": "quatorze",
            "15": "quinze", "16": "seize", "17": "dix-sept", "18": "dix-huit",
            "19": "dix-neuf", "20": "vingt", "21": "vingt et un", "22": "vingt-deux",
            "23": "vingt-trois", "24": "vingt-quatre", "25": "vingt-cinq",
            "26": "vingt-six", "27": "vingt-sept", "28": "vingt-huit",
            "29": "vingt-neuf", "30": "trente", "31": "trente et un", "32": "trente-deux",
            "33": "trente-trois", "34": "trente-quatre", "35": "trente-cinq",
            "36": "trente-six", "37": "trente-sept", "38": "trente-huit",
            "39": "trente-neuf", "40": "quarante", "41": "quarante et un",
            "42": "quarante-deux", "43": "quarante-trois", "44": "quarante-quatre",
            "45": "quarante-cinq", "46": "quarante-six", "47": "quarante-sept",
            "48": "quarante-huit", "49": "quarante-neuf", "50": "cinquante",
            "51": "cinquante et un", "52": "cinquante-deux", "53": "cinquante-trois",
            "54": "cinquante-quatre", "55": "cinquante-cinq", "56": "cinquante-six",
            "57": "cinquante-sept", "58": "cinquante-huit", "59": "cinquante-neuf",
            "60": "soixante", "61": "soixante et un", "62": "soixante-deux",
            "63": "soixante-trois", "64": "soixante-quatre", "65": "soixante-cinq",
            "66": "soixante-six", "67": "soixante-sept", "68": "soixante-huit",
            "69": "soixante-neuf", "70": "soixante-dix", "71": "soixante et onze",
            "72": "soixante-douze", "73": "soixante-treize", "74": "soixante-quatorze",
            "75": "soixante-quinze", "76": "soixante-seize", "77": "soixante-dix-sept",
            "78": "soixante-dix-huit", "79": "soixante-dix-neuf", "80": "quatre-vingts",
            "81": "quatre-vingt-un", "82": "quatre-vingt-deux", "83": "quatre-vingt-trois",
            "84": "quatre-vingt-quatre", "85": "quatre-vingt-cinq", "86": "quatre-vingt-six",
            "87": "quatre-vingt-sept", "88": "quatre-vingt-huit", "89": "quatre-vingt-neuf",
            "90": "quatre-vingt-dix"
        },
        "patterns": {
            "90_two_digits": "[excited] {num_word}! ... {d1}-{d2}",
            "90_single_digit": "[excited] {num_word}!",
            "75_two_digits": "[excited] {letter} {num_word}! ... {letter} {d1}-{d2}",
            "75_single_digit": "[excited] {letter} {num_word}!"
        }
    },
}

# Optional: Adjust the style/expressivity of the voice output here.
VOICE_SETTINGS = {
    "stability": 0.0,  # Must be 0.0, 0.5, or 1.0 (0.0=Creative, 0.5=Natural, 1.0=Robust)
    "similarity_boost": 0.85,
    "style": 0.75,
    "use_speaker_boost": True
}

# ===========================
# Helpers
# ===========================

def bingo75_letter(n: int) -> str:
    """Return the B/I/N/G/O bucket for 75-ball bingo."""
    if   1 <= n <= 15:  return "B"
    elif 16 <= n <= 30: return "I"
    elif 31 <= n <= 45: return "N"
    elif 46 <= n <= 60: return "G"
    elif 61 <= n <= 75: return "O"
    raise ValueError("Number out of 75-ball range")

def pause_token() -> str:
    """Return a language-agnostic pause. If USE_SSML_BREAKS is True, use a simple <break/> tag."""
    return " <break time=\"0.4s\"/> " if USE_SSML_BREAKS else " "

def build_text_90(n: int, lang_cfg: Dict) -> str:
    """
    Build the line for 90-ball bingo.
    Numbers are always spoken as full words: e.g., 'cincuenta y cuatro... cinco-cuatro'.
    """
    patterns = lang_cfg["patterns"]
    numbers_map = lang_cfg["numbers"]
    digits_map = lang_cfg["digits"]

    num_word = numbers_map[str(n)]

    if n < 10:
        return patterns["90_single_digit"].format(num_word=num_word)

    d1_char, d2_char = str(n)[0], str(n)[1]
    d1 = digits_map[d1_char]
    d2 = digits_map[d2_char]

    return patterns["90_two_digits"].format(
        num_word=num_word,
        d1=d1,
        d2=d2
    )

def build_text_75(n: int, lang_cfg: Dict) -> str:
    """
    Build the line for 75-ball bingo: 'B three', 'O seventy-four', etc.
    Numbers are always spoken as full words.
    """
    letter = bingo75_letter(n)
    patterns = lang_cfg["patterns"]
    numbers_map = lang_cfg["numbers"]
    digits_map = lang_cfg["digits"]

    num_word = numbers_map[str(n)]

    if n < 10:
        return patterns["75_single_digit"].format(letter=letter, num_word=num_word)

    # Two digits
    d1_char, d2_char = str(n)[0], str(n)[1]
    d1 = digits_map[d1_char]
    d2 = digits_map[d2_char]

    return patterns["75_two_digits"].format(
        letter=letter,
        num_word=num_word,
        d1=d1,
        d2=d2
    )

def tts_request(voice_id: str, text: str, language_code: str) -> bytes:
    """Call ElevenLabs TTS and return raw audio bytes."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    body = {
        "text": text,
        "model_id": MODEL_ID,
        "voice_settings": VOICE_SETTINGS,
        "output_format": OUTPUT_FORMAT,
        "language_code": language_code
        # NOTE: If your account/voice requires a specific flag for SSML,
        # check ElevenLabs docs and add it here. If unsupported, keep text without <break/>.
    }
    resp = requests.post(url, headers=headers, data=json.dumps(body), timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"TTS failed ({resp.status_code}): {resp.text[:500]}")
    return resp.content

def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)

def save_audio(path: str, audio_bytes: bytes) -> None:
    with open(path, "wb") as f:
        f.write(audio_bytes)

def clean_audio_files() -> None:
    """Remove all existing audio files in the output directory."""
    if os.path.exists(BASE_OUTDIR):
        print(f"🗑️  Removing all existing audio files from {BASE_OUTDIR}...")
        shutil.rmtree(BASE_OUTDIR)
        print(f"✅ Cleaned {BASE_OUTDIR}")
    else:
        print(f"ℹ️  No existing audio directory found at {BASE_OUTDIR}")

# ===========================
# Main generation
# ===========================

def get_file_extension() -> str:
    """Return the file extension based on OUTPUT_FORMAT."""
    if OUTPUT_FORMAT.startswith("mp3"):
        return "mp3"
    elif "wav" in OUTPUT_FORMAT:
        return "wav"
    return "audio"

def get_voices_for_language(lang_code: str) -> List[Dict[str, str]]:
    """Get all voices available for a language."""
    return VOICES.get(lang_code, [])

def get_voice_by_name(lang_code: str, voice_name: str) -> Dict[str, str] | None:
    """Get a specific voice by name for a language."""
    for voice in get_voices_for_language(lang_code):
        if voice["name"] == voice_name:
            return voice
    return None

def get_api_lang_code(locale: str) -> str:
    """Extract API language code from locale (e.g., 'es-ES' -> 'es')."""
    return locale.split("-")[0]

def generate_for_voice(locale: str, lang_cfg: Dict, voice_name: str, voice_id: str) -> None:
    """Generate audio files for a specific voice."""
    ext = get_file_extension()
    api_lang = get_api_lang_code(locale)

    # --- Bingo 90 ---
    # Path: out_audio/es-ES/manuel/es-ES_manuel_19.mp3
    outdir = os.path.join(BASE_OUTDIR, locale, voice_name)
    ensure_dir(outdir)

    print(f"🎙️  Generating Bingo 90 for {locale} with voice '{voice_name}'...")
    for n in range(1, 91):
        text = build_text_90(n, lang_cfg)
        filename = f"{locale}_{voice_name}_{n}.{ext}"
        outpath = os.path.join(outdir, filename)

        # Skip if already exists (idempotent runs)
        if os.path.exists(outpath):
            print(f"[{locale}/{voice_name} | 90] {n:>2}: SKIP (exists)")
            continue

        try:
            audio = tts_request(voice_id, text, api_lang)
            save_audio(outpath, audio)
            print(f"[{locale}/{voice_name} | 90] {n:>2}: {text}")
        except Exception as e:
            print(f"ERROR [{locale}/{voice_name} | 90] {n}: {e}")

        time.sleep(RATE_LIMIT_DELAY_SEC)

    # --- Bingo 75 ---
    # Path: out_audio/es-ES/manuel/es-ES_manuel_b12.mp3 (letter prefix)
    print(f"🎙️  Generating Bingo 75 for {locale} with voice '{voice_name}'...")
    for n in range(1, 76):
        text = build_text_75(n, lang_cfg)
        letter = bingo75_letter(n).lower()
        filename = f"{locale}_{voice_name}_{letter}{n}.{ext}"
        outpath = os.path.join(outdir, filename)

        if os.path.exists(outpath):
            print(f"[{locale}/{voice_name} | 75] {letter.upper()}{n:>2}: SKIP (exists)")
            continue

        try:
            audio = tts_request(voice_id, text, api_lang)
            save_audio(outpath, audio)
            print(f"[{locale}/{voice_name} | 75] {letter.upper()}{n:>2}: {text}")
        except Exception as e:
            print(f"ERROR [{locale}/{voice_name} | 75] {letter.upper()}{n}: {e}")

        time.sleep(RATE_LIMIT_DELAY_SEC)

def generate_bingo_audio(locale: str, voice_name: str = None) -> None:
    """Generate audio files for a language, optionally filtering by voice."""
    # Validate language
    if locale not in LANGUAGES:
        available = ", ".join(LANGUAGES.keys())
        print(f"❌ Language '{locale}' not found. Available: {available}")
        return

    # Get voices for this language
    lang_voices = get_voices_for_language(locale)
    if not lang_voices:
        print(f"❌ No voices configured for language '{locale}'")
        return

    # If voice specified, validate it belongs to this language
    if voice_name:
        voice = get_voice_by_name(locale, voice_name)
        if not voice:
            available = ", ".join([v["name"] for v in lang_voices])
            print(f"❌ Voice '{voice_name}' not found for language '{locale}'. Available: {available}")
            return
        voices_to_process = [voice]
    else:
        voices_to_process = lang_voices

    lang_cfg = LANGUAGES[locale]
    ensure_dir(BASE_OUTDIR)

    # Generate for each voice
    for voice in voices_to_process:
        generate_for_voice(locale, lang_cfg, voice["name"], voice["id"])

    print("✅ Done. All audio files generated.")

if __name__ == "__main__":
    available_langs = ", ".join(LANGUAGES.keys())
    # Build voice help string showing voices per language
    voice_help_parts = []
    for lang, voices in VOICES.items():
        names = ", ".join([v["name"] for v in voices])
        voice_help_parts.append(f"{lang}: {names}")
    available_voices = " | ".join(voice_help_parts)

    parser = argparse.ArgumentParser(
        description="Generate bingo audio files using ElevenLabs TTS API"
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove all existing audio files before generating new ones"
    )
    parser.add_argument(
        "--lang",
        type=str,
        required=True,
        help=f"Language code (required). Available: {available_langs}"
    )
    parser.add_argument(
        "--voice",
        type=str,
        default=None,
        help=f"Voice name (optional, uses all voices for language if not specified). Available: {available_voices}"
    )

    args = parser.parse_args()

    if args.clean:
        clean_audio_files()

    generate_bingo_audio(locale=args.lang, voice_name=args.voice)