import re
from typing import Dict, Tuple, List

# Standard Technical Glossary for CS / Engineering education
TECHNICAL_GLOSSARY: Dict[str, str] = {
    # Programming Languages & Technologies
    "Java": "Java",
    "Python": "Python",
    "JavaScript": "JavaScript",
    "TypeScript": "TypeScript",
    "C++": "C++",
    "C#": "C#",
    "Rust": "Rust",
    "Golang": "Golang",
    "HTML": "HTML",
    "CSS": "CSS",
    "SQL": "SQL",
    "API": "API",
    "REST": "REST",
    "HTTP": "HTTP",
    "HTTPS": "HTTPS",
    "URL": "URL",
    "JSON": "JSON",
    "DOM": "DOM",
    "SDK": "SDK",
    "LMS": "LMS",
    "AI": "AI",
    "ML": "ML",
    "GUI": "GUI",
    "CLI": "CLI",
    "Git": "Git",
    "GitHub": "GitHub",
    "Docker": "Docker",
    "Linux": "Linux",
    "Windows": "Windows",
    "Android": "Android",
    "Node.js": "Node.js",
    "React": "React",
    "Express": "Express",
    "PostgreSQL": "PostgreSQL",
    "MySQL": "MySQL",
    "MongoDB": "MongoDB",
    "SQLite": "SQLite",

    # Core Computer Science & OOP Concepts (Preserve standard spoken technical terms)
    "inheritance": "inheritance",
    "Inheritance": "Inheritance",
    "polymorphism": "polymorphism",
    "Polymorphism": "Polymorphism",
    "encapsulation": "encapsulation",
    "Encapsulation": "Encapsulation",
    "abstraction": "abstraction",
    "Abstraction": "Abstraction",
    "constructor": "constructor",
    "Constructor": "Constructor",
    "destructor": "destructor",
    "Destructor": "Destructor",
    "interface": "interface",
    "Interface": "Interface",
    "package": "package",
    "Package": "Package",
    "module": "module",
    "Module": "Module",
    "framework": "framework",
    "Framework": "Framework",
    "component": "component",
    "Component": "Component",
    "backend": "backend",
    "Backend": "Backend",
    "frontend": "frontend",
    "Frontend": "Frontend",
    "server": "server",
    "Server": "Server",
    "client": "client",
    "Client": "Client",
    "database": "database",
    "Database": "Database",
    "algorithm": "algorithm",
    "Algorithm": "Algorithm",
    "parameter": "parameter",
    "Parameter": "Parameter",
    "parameters": "parameters",
    "Parameters": "Parameters",
    "argument": "argument",
    "Argument": "Argument",
    "arguments": "arguments",
    "Arguments": "Arguments",
    "variable": "variable",
    "Variable": "Variable",
    "variables": "variables",
    "Variables": "Variables",
    "array": "array",
    "Array": "Array",
    "arrays": "arrays",
    "Arrays": "Arrays",
    "loop": "loop",
    "Loop": "Loop",
    "loops": "loops",
    "Loops": "Loops",
    "boolean": "boolean",
    "Boolean": "Boolean",
    "string": "string",
    "String": "String",
    "integer": "integer",
    "Integer": "Integer",
    "float": "float",
    "Float": "Float",
    "double": "double",
    "Double": "Double"
}

# Regex patterns for protecting sensitive non-prose tokens
URL_PATTERN = re.compile(r'https?://[^\s<>"\']+|www\.[^\s<>"\']+', re.IGNORECASE)
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b')
FILE_PATH_PATTERN = re.compile(r'(?:[a-zA-Z]:\\|/)?(?:[\w.-]+[/\\_])+[\w.-]+\.\w+')
CODE_IDENTIFIER_PATTERN = re.compile(r'\b(?:def|class|function|var|let|const|public|private|protected|static|void|int|float|double|boolean|String|import|export|from|return|if|else|for|while|try|catch|finally)\b')

# Pattern for multi-word and single-word glossary terms
GLOSSARY_TERMS_PATTERN = re.compile(
    r'\b(' + '|'.join(re.escape(k) for k in sorted(TECHNICAL_GLOSSARY.keys(), key=len, reverse=True)) + r')\b'
)

class GlossaryProtector:
    """
    Protects technical terms, code snippets, URLs, and identifiers from being
    corrupted during machine translation, and restores or adapts them post-translation.
    """
    
    def __init__(self, custom_glossary: Dict[str, str] = None):
        self.glossary = dict(TECHNICAL_GLOSSARY)
        if custom_glossary:
            self.glossary.update(custom_glossary)

    def protect_text(self, text: str) -> Tuple[str, Dict[str, str]]:
        """
        Replaces URLs, emails, technical terms, and code tokens with unique placeholders.
        Returns the protected string and a map of {placeholder: original_text}.
        """
        if not text or not text.strip():
            return text, {}

        placeholder_map = {}
        counter = 0

        def replace_with_placeholder(val: str) -> str:
            nonlocal counter
            key = f"__PH{counter}__"
            counter += 1
            placeholder_map[key] = val
            return f" {key} "

        processed = text

        # 1. Protect URLs
        processed = URL_PATTERN.sub(lambda m: replace_with_placeholder(m.group(0)), processed)

        # 2. Protect Emails
        processed = EMAIL_PATTERN.sub(lambda m: replace_with_placeholder(m.group(0)), processed)

        # 3. Protect File Paths
        processed = FILE_PATH_PATTERN.sub(lambda m: replace_with_placeholder(m.group(0)), processed)

        # 4. Protect exact code backticks e.g. `code`
        processed = re.sub(r'`([^`]+)`', lambda m: replace_with_placeholder(m.group(0)), processed)

        # 5. Protect code keyword identifiers
        processed = CODE_IDENTIFIER_PATTERN.sub(lambda m: replace_with_placeholder(m.group(0)), processed)

        # 6. Protect CS technical terms
        processed = GLOSSARY_TERMS_PATTERN.sub(lambda m: replace_with_placeholder(m.group(0)), processed)

        return processed, placeholder_map

    def restore_text(self, translated_text: str, placeholder_map: Dict[str, str]) -> str:
        """
        Restores protected placeholders and applies glossary mappings if needed.
        """
        if not translated_text or not placeholder_map:
            return translated_text

        result = translated_text
        for placeholder, original in placeholder_map.items():
            # Extract placeholder index e.g. __PH0__ -> 0
            m_idx = re.search(r'\d+', placeholder)
            if m_idx:
                idx = m_idx.group(0)
                # Matches __PH0__, _ _ PH0 _ _, _ _ PH _ 0 _ _, _ _ டோக்கன் _ PH _ 0 _ _, _ _ பிஎச் _ 0 _ _, etc.
                pattern = re.compile(
                    r'(?:[_\s]*(?:PH|ph|டோக்கன்\s*PH|பிஎச்|Token\s*PH)[\s_]*' + re.escape(idx) + r'[_\s]*)',
                    re.IGNORECASE
                )
                result = pattern.sub(f" {original} ", result)
            else:
                clean_key = placeholder.strip()
                pattern = re.compile(re.escape(clean_key).replace(r'\_', r'[\s\_]*'), re.IGNORECASE)
                result = pattern.sub(f" {original} ", result)

        # Remove stray underscores left over from NMT placeholder tokenization e.g. " _ " or "__"
        result = re.sub(r'(?<=\s)_(?=\s)|(?<=\s)__+(?=\s)', '', result)
        # Clean up any leftover double spaces
        result = re.sub(r'\s{2,}', ' ', result).strip()
        return result

