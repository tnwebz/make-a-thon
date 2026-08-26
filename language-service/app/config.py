import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Base directories
APP_DIR = Path(__file__).parent.resolve()
BASE_DIR = APP_DIR.parent.resolve()
ROOT_PROJECT_DIR = BASE_DIR.parent.resolve()

# Models & Fonts directories
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

FONTS_DIR = APP_DIR / "fonts"
FONTS_DIR.mkdir(parents=True, exist_ok=True)

DEVANAGARI_REGULAR_FONT = FONTS_DIR / "NotoSansDevanagari-Regular.ttf"
DEVANAGARI_BOLD_FONT = FONTS_DIR / "NotoSansDevanagari-Bold.ttf"

TAMIL_REGULAR_FONT = FONTS_DIR / "Tamil-Regular.ttf"
TAMIL_BOLD_FONT = FONTS_DIR / "Tamil-Bold.ttf"

# Backend uploads directory
BACKEND_UPLOADS_DIR = ROOT_PROJECT_DIR / "backend" / "uploads" / "media"
BACKEND_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

HINDI_UPLOADS_DIR = BACKEND_UPLOADS_DIR / "hi"
HINDI_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

TAMIL_UPLOADS_DIR = BACKEND_UPLOADS_DIR / "ta"
TAMIL_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Subtitles directories
SUBTITLES_DIR = BACKEND_UPLOADS_DIR / "subtitles"
SUBTITLES_DIR.mkdir(parents=True, exist_ok=True)

HINDI_SUBTITLES_DIR = SUBTITLES_DIR / "hi"
HINDI_SUBTITLES_DIR.mkdir(parents=True, exist_ok=True)

TAMIL_SUBTITLES_DIR = SUBTITLES_DIR / "ta"
TAMIL_SUBTITLES_DIR.mkdir(parents=True, exist_ok=True)

# Service Configuration
HOST = os.getenv("LANGUAGE_SERVICE_HOST", "0.0.0.0")
PORT = int(os.getenv("LANGUAGE_SERVICE_PORT", "8001"))
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:8000/api/v1")

# Model configuration (AI4Bharat IndicTrans2 English -> Indic 200M distilled)
MODEL_NAME = os.getenv("INDICTRANS_MODEL", "Raghavan/indictrans2-en-indic-dist-200M")
DEFAULT_SRC_LANG = "eng_Latn"
DEFAULT_TGT_LANG = "hin_Deva"

# Whisper ASR configuration
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small.en")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cuda")  # Fallback handled in code
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "float16")

# Languages metadata matrix
LANGUAGES = {
    "en": {
        "code": "en",
        "name": "English",
        "nativeName": "English",
        "flag": "🇬🇧",
        "indicCode": "eng_Latn",
        "direction": "ltr"
    },
    "hi": {
        "code": "hi",
        "name": "Hindi",
        "nativeName": "हिन्दी",
        "flag": "🇮🇳",
        "indicCode": "hin_Deva",
        "direction": "ltr",
        "font_regular": DEVANAGARI_REGULAR_FONT,
        "font_bold": DEVANAGARI_BOLD_FONT,
        "font_prefix": "NotoDeva",
        "uploads_dir": HINDI_UPLOADS_DIR,
        "subtitles_dir": HINDI_SUBTITLES_DIR
    },
    "ta": {
        "code": "ta",
        "name": "Tamil",
        "nativeName": "தமிழ்",
        "flag": "🇮🇳",
        "indicCode": "tam_Taml",
        "direction": "ltr",
        "font_regular": TAMIL_REGULAR_FONT,
        "font_bold": TAMIL_BOLD_FONT,
        "font_prefix": "NotoTamil",
        "uploads_dir": TAMIL_UPLOADS_DIR,
        "subtitles_dir": TAMIL_SUBTITLES_DIR
    }
}

