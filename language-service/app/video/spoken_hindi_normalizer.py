"""
Spoken Hindi Optimization & Normalization Module for SkillForge AI Dubbing
Refines translated Hindi subtitle text into natural, modern, conversational spoken Hindi
suited for higher-education engineering and CS technical lectures.
"""

import re
from typing import Dict, List, Any, Optional


# Standard technical terms that modern professors keep in English or natural transliterated form
TECH_TERMS_MAP = {
    # Programming & CS fundamentals
    r"\bकार्यप्रवाह\b": "workflow",
    r"\bकार्यप्रवाहों\b": "workflows",
    r"\bकार्यप्रवाह को\b": "workflow को",
    r"\bकार्यप्रवाह में\b": "workflow में",
    r"\bसंकेत\b": "prompt",
    r"\bसंकेतों\b": "prompts",
    r"\bसंकेत को\b": "prompt को",
    r"\bसंकेत में\b": "prompt में",
    r"\bअधिरोपण\b": "inheritance",
    r"\bउत्तराधिकार\b": "inheritance",
    r"\bबहुरूपता\b": "polymorphism",
    r"\bसमारोह\b": "function",
    r"\bसमारोहों\b": "functions",
    r"\bफंक्शन\b": "function",
    r"\bफ़ंक्शन\b": "function",
    r"\bमापदंड\b": "parameter",
    r"\bमापदंडों\b": "parameters",
    r"\bचर\b": "variable",
    r"\bचरों\b": "variables",
    r"\bडेटाबेस\b": "database",
    r"\bवेबसाइट\b": "website",
    r"\bवेबसाइटों\b": "websites",
    r"\bकोड\b": "code",
    r"\bप्रोग्रामिंग\b": "programming",
    r"\bवर्ग\b": "class",
    r"\bऑब्जेक्ट\b": "object",
    r"\bऑब्जेक्ट्स\b": "objects",
    r"\bविधि\b": "method",
    r"\bविधियों\b": "methods",
    r"\bसरणी\b": "array",
    r"\bलूप\b": "loop",
    r"\bफ्रेमवर्क\b": "framework",
    r"\bघटक\b": "component",
    r"\bघटकों\b": "components",
    
    # Modern Web, UI/UX & Design Workflow Terms
    r"\bसाइटमैप\b": "sitemap",
    r"\bसाइटमैप को\b": "sitemap को",
    r"\bवायरफ्रेम\b": "wireframe",
    r"\bवायरफ्रेम्स\b": "wireframes",
    r"\bटेम्पलेट\b": "template",
    r"\bटेम्पलेट्स\b": "templates",
    r"\bमॉकअप\b": "mockup",
    r"\bडिज़ाइन\b": "design",
    r"\bदिशानिर्देशों\b": "guidelines",
    r"\bदिशानिर्देश\b": "guidelines",
    r"\bमूड बोर्ड\b": "mood board",
    r"\bसंशोधन\b": "revisions",
    r"\bग्राहक\b": "clients",
    r"\bग्राहकों\b": "clients",
    r"\bभाव\b": "vibe",
    r"\bविविधता\b": "variation",
    r"\bभिन्नता\b": "variation",
}

# Conversational phrase simplifications (Indian college lecture style)
SPOKEN_PHRASE_REPLACEMENTS = [
    # Complex formal verbs -> natural conversational lecture phrases
    (r"अवलोकन करेंगे कि उत्तराधिकार किस प्रकार कार्य करता है", "देखते हैं कि inheritance कैसे काम करता है"),
    (r"किस प्रकार कार्य करता है यह देखते हैं", "कैसे काम करता है देखते हैं"),
    (r"किस प्रकार कार्य करता है", "कैसे काम करता है"),
    (r"किस प्रकार काम करता है", "कैसे काम करता है"),
    (r"किस बारे में है", "किस बारे में है"),
    (r"निष्पादित करते हैं", "execute करते हैं"),
    (r"लागू करते हैं", "apply करते हैं"),
    (r"चलाते हैं", "run करते हैं"),
    (r"बनाते हैं", "create करते हैं"),
    (r"जोड़ते हैं", "add करते हैं"),
    (r"हटाते हैं", "delete करते हैं"),
    (r"बदलते हैं", "update करते हैं"),
    (r"भेजते हैं", "pass करते हैं"),
    (r"उपयोग करते हैं", "use करते हैं"),
    (r"उपयोग कर सकते हैं", "use कर सकते हैं"),
    (r"कोशिश करें", "try करें"),
    (r"आज़माएँ", "try करें"),
    (r"चिपकाएँ", "paste करें"),
    (r"परिभाषित करें", "define करें"),
    (r"इकट्ठा करें", "collect करें"),
    (r"शामिल करते हैं", "include करते हैं"),
    (r"सत्यापित करें", "verify करें"),
    (r"जारी रखें", "continue करें"),
    
    # Casual spoken connectors & cleanup
    (r"\bfrom एक ही प्रॉम्प्ट\b", "एक single prompt से"),
    (r"\bfrom एक ही संकेत\b", "एक single prompt से"),
    (r"\bfrom एक\b", "एक"),
    (r"\bfor वेबसाइट\b", "website के लिए"),
    (r"\bfor आप\b", "आपके लिए"),
    (r"\bढिलाई वाले दिखते हैं\b", "unprofessional दिखते हैं"),
    (r"\bखरीदने वाले नहीं हैं\b", "नहीं खरीदेंगे"),
    (r"\bयहाँ पर\b", "यहाँ"),
    (r"\bवहाँ पर\b", "वहाँ"),
    (r"\bइस समय\b", "अब"),
]


class SpokenHindiOptimizer:
    """
    Lightweight rule-based conversational Hindi optimizer.
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

        # Step 3: Clean up whitespace and punctuation
        result = re.sub(r"\s+", " ", result)

        return result.strip()

    @staticmethod
    def optimize_concise(text: str) -> str:
        """
        More aggressive conciseness optimization for segments that heavily exceed target duration.
        """
        optimized = SpokenHindiOptimizer.optimize(text)
        
        # Extra contractions
        optimized = optimized.replace("करने वाले नहीं हैं", "नहीं करेंगे")
        optimized = optimized.replace("करना होगा", "करना पड़ेगा")
        optimized = optimized.replace("देखने का प्रयास करेंगे", "देखेंगे")
        optimized = optimized.replace("समझने का प्रयास करेंगे", "समझेंगे")
        
        return optimized.strip()


def normalize_spoken_hindi(text: str) -> str:
    """Top-level helper for single Hindi string."""
    return SpokenHindiOptimizer.optimize(text)


def normalize_hindi_segments(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Normalizes a list of subtitle segments for TTS synthesis.
    Keeps timing and IDs identical while adding 'spoken_text'.
    """
    normalized_list = []
    for seg in segments:
        raw_text = seg.get("translated_text") or seg.get("spoken_text") or seg.get("text") or ""
        spoken = SpokenHindiOptimizer.optimize(raw_text)
        
        item = dict(seg)
        item["spoken_text"] = spoken
        normalized_list.append(item)

    return normalized_list
