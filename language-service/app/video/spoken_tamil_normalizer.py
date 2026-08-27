"""
Spoken Tamil Optimization & Normalization Module for SkillForge AI Dubbing
Refines translated Tamil text into natural, modern, concise conversational spoken Tamil
suited for higher-education engineering and CS technical lectures.
"""

import re
from typing import Dict, List, Any, Optional


# Standard technical terms that modern professors keep in English or natural transliterated form
TECH_TERMS_MAP = {
    # Programming & CS fundamentals
    r"\bசெயலி\b": "App",
    r"\bசெயலிகள்\b": "Apps",
    r"\bசெயல்பாடு\b": "function",
    r"\bசெயல்பாடுகள்\b": "functions",
    r"\bஅளபுரு\b": "parameter",
    r"\bஅளபுருக்கள்\b": "parameters",
    r"\bமாறி\b": "variable",
    r"\bமாறிகள்\b": "variables",
    r"\bதரவுத்தளம்\b": "database",
    r"\bவலைத்தளம்\b": "website",
    r"\bவலைத்தளங்கள்\b": "websites",
    r"\bவலைத்தளங்களை\b": "websites-ஐ",
    r"\bநிரல்\b": "code",
    r"\bநிரலாக்கம்\b": "programming",
    r"\bவகுப்பு\b": "class",
    r"\bபொருள்கள்\b": "objects",
    r"\bபொருள்\b": "object",
    r"\bமுறைமை\b": "method",
    r"\bமுறைமைகள்\b": "methods",
    r"\bஅணி\b": "array",
    r"\bஅணிகள்\b": "arrays",
    r"\bசுழற்சி\b": "loop",
    r"\bசுற்றமைப்பு\b": "framework",
    r"\bகூறு\b": "component",
    r"\bகூறுகள்\b": "components",
    r"\bமரபுரிமை\b": "inheritance",
    r"\bபல்லுருவாக்கம்\b": "polymorphism",
    
    # Modern Web, UI/UX & Design Workflow Terms
    r"\bஅறிவுறுத்தல்\b": "prompt",
    r"\bஅறிவுறுத்தலை\b": "prompt-ஐ",
    r"\bஅறிவுறுத்தல்கள்\b": "prompts",
    r"\bதூண்டுதல்\b": "prompt",
    r"\bதூண்டுதலை\b": "prompt-ஐ",
    r"\bபணிப்பாய்வு\b": "workflow",
    r"\bபணிப்பாய்வை\b": "workflow-ஐ",
    r"\bதள வரைபடம்\b": "sitemap",
    r"\bதள வரைபடத்தை\b": "sitemap-ஐ",
    r"\bதள வரைபடத்தில்\b": "sitemap-ல்",
    r"\bவயர்ஃப்ரேம்\b": "wireframe",
    r"\bவயர்ஃப்ரேம்கள்\b": "wireframes",
    r"\bவயர்ஃப்ரேமாக\b": "wireframe-ஆக",
    r"\bவயர்ஃப்ரேமை\b": "wireframe-ஐ",
    r"\bவார்ப்புரு\b": "template",
    r"\bவார்ப்புருக்கள்\b": "templates",
    r"\bமாக்அப்\b": "mockup",
    r"\bவடிவமைப்பு\b": "design",
    r"\bவடிவமைப்பை\b": "design-ஐ",
    r"\bவடிவமைக்க\b": "design செய்ய",
    r"\bவழிகாட்டுதல்கள்\b": "guidelines",
    r"\bமனநிலை பலகை\b": "mood board",
    r"\bமாற்றங்கள்\b": "changes",
    r"\bதிருத்தங்கள்\b": "revisions",
    r"\bஅங்கீகரிக்க\b": "approve செய்ய",
    r"\bஅங்கீகரிக்கப்பட்ட\b": "approved",
    r"\bவாடிக்கையாளர்\b": "client",
    r"\bவாடிக்கையாளர்கள்\b": "clients",
    r"\bஅதிர்வுகள்\b": "vibes",
    r"\bமாறுபாடு\b": "variation",
    r"\bமாறுபாட்டை\b": "variation-ஐ",
}

# Conversational phrase simplifications (reduces verbosity without losing technical meaning)
SPOKEN_PHRASE_REPLACEMENTS = [
    # Complex formal verbs -> natural conversational lecture phrases
    (r"எவ்வாறு செயல்படுகிறது என்பதைப் பார்ப்போம்", "எப்படி வேலை செய்யுதுன்னு பார்ப்போம்"),
    (r"எவ்வாறு செயல்படுகிறது என்று பார்ப்போம்", "எப்படி வேலை செய்யுதுன்னு பார்ப்போம்"),
    (r"எவ்வாறு செயல்படுகின்றது என்பதை நாம் பார்ப்போம்", "எப்படி work ஆகுதுன்னு பார்ப்போம்"),
    (r"எவ்வாறு செயல்படுகின்றது என்பதை நாம் பார்த்தறிந்துகொள்ளலாம்", "எப்படி வேலை செய்யுதுன்னு பார்க்கலாம்"),
    (r"எவ்வாறு வேலை செய்கிறது என்பதை", "எப்படி work ஆகுதுன்னு"),
    (r"எவ்வாறு இயங்குகிறது என்பதை", "எப்படி run ஆகுதுன்னு"),
    (r"செயல்படுத்தலாம்", "implement பண்ணலாம்"),
    (r"இயக்கிப் பாருங்கள்", "run பண்ணிப் பாருங்க"),
    (r"இயக்கலாம்", "run பண்ணலாம்"),
    (r"அழைக்கிறோம்", "call பண்ணுகிறோம்"),
    (r"அனுப்புகிறோம்", "pass பண்ணுகிறோம்"),
    (r"உருவாக்குகிறோம்", "create பண்ணுகிறோம்"),
    (r"சேர்க்கிறோம்", "add பண்ணுகிறோம்"),
    (r"நீக்குகிறோம்", "delete பண்ணுகிறோம்"),
    (r"மாற்றுகிறோம்", "update பண்ணுகிறோம்"),
    (r"அமைக்கிறோம்", "set பண்ணுகிறோம்"),
    (r"பயன்படுத்தலாம்", "use பண்ணலாம்"),
    (r"பயன்படுத்துகிறோம்", "use பண்ணுகிறோம்"),
    (r"முயற்சிக்கவும்", "try பண்ணிப் பாருங்க"),
    (r"ஒட்டவும்", "paste பண்ணுங்க"),
    (r"செல்லுங்கள்", "போங்க"),
    (r"செம்மைப்படுத்துங்கள்", "refine பண்ணுங்க"),
    (r"இறுதி செய்யுங்கள்", "finalize பண்ணுங்க"),

    # Casual spoken connectors
    (r"\bஇப்பொழுது\b", "இப்போது"),
    (r"\bஇங்கு\b", "இங்கே"),
    (r"\bஅங்கு\b", "அங்கே"),
    (r"\bஎங்கு\b", "எங்கே"),
    (r"\bகாண்கிறோம்\b", "பார்க்கிறோம்"),
    (r"\bகாணலாம்\b", "பார்க்கலாம்"),
    (r"\bபுரிந்து கொள்ளுங்கள்\b", "புரிஞ்சுக்கோங்க"),
    (r"\bகவனித்துப் பாருங்கள்\b", "கவனிச்சுப் பாருங்க"),
    (r"\bமுதலாவதாக\b", "முதலில்"),
    (r"\bஅடுத்ததாக\b", "அடுத்து"),
    (r"\bஅதன் பிறகு\b", "அப்புறம்"),
    (r"\bfrom ஒரு ஒற்றை\b", "ஒரே ஒரு"),
    (r"\bfor வலைத்தளத்தை\b", "website-க்காக"),
    (r"\bfor நீங்கள்\b", "உங்களுக்காக"),
]


class SpokenTamilOptimizer:
    """
    Lightweight rule-based conversational Tamil optimizer.
    Transforms textbook-style translations into concise, modern lecture speech.
    """

    @staticmethod
    def optimize(text: str) -> str:
        if not text or not isinstance(text, str):
            return ""

        result = text.strip()

        # Step 1: Smooth conversational phrases
        for pattern, replacement in SPOKEN_PHRASE_REPLACEMENTS:
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

        # Step 2: Replace textbook CS terms with modern technical terminology
        for pattern, replacement in TECH_TERMS_MAP.items():
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

        # Step 3: Clean up punctuation and spacing artifacts
        result = re.sub(r"\s+", " ", result)
        result = result.replace(" - ஐ", "-ஐ").replace(" - க்கு", "-க்கு").replace(" - இல்", "-இல்").replace(" - ல்", "-ல்")
        result = result.replace(" -ஐ", "-ஐ").replace(" -க்கு", "-க்கு").replace(" -இல்", "-இல்").replace(" -ல்", "-ல்")

        return result.strip()

    @staticmethod
    def optimize_concise(text: str) -> str:
        """
        More aggressive conciseness optimization for segments that heavily exceed target duration.
        """
        optimized = SpokenTamilOptimizer.optimize(text)
        
        # Extra contractions
        optimized = optimized.replace("போவதில்லை", "மாட்டாங்க")
        optimized = optimized.replace("செல்ல வேண்டும்", "போகணும்")
        optimized = optimized.replace("செய்ய வேண்டும்", "பண்ணணும்")
        optimized = optimized.replace("நிறுத்த வேண்டும்", "நிறுத்தணும்")
        optimized = optimized.replace("பார்க்க வேண்டும்", "பார்க்கணும்")
        
        return optimized.strip()


def normalize_spoken_tamil(text: str) -> str:
    """Backward compatible top-level helper."""
    return SpokenTamilOptimizer.optimize(text)


def normalize_tamil_segments(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Normalizes a list of subtitle segments for TTS synthesis.
    Keeps timing and IDs identical while adding 'spoken_text'.
    """
    normalized_list = []
    for seg in segments:
        raw_text = seg.get("translated_text") or seg.get("spoken_text") or seg.get("text") or ""
        spoken = SpokenTamilOptimizer.optimize(raw_text)
        
        item = dict(seg)
        item["spoken_text"] = spoken
        normalized_list.append(item)

    return normalized_list
