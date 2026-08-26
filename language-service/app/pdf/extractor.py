import re
from pathlib import Path
from typing import List, Dict, Any, Optional
import fitz  # PyMuPDF

class PdfExtractor:
    """
    Structured text & asset extractor for PDF course documents using PyMuPDF.
    Preserves page boundaries, headings, bullet lists, code blocks, images, and formatting.
    """

    def __init__(self):
        pass

    def extract_document(self, pdf_path: str) -> Dict[str, Any]:
        """
        Extracts structured content from a PDF file.
        Returns document metadata and list of structured pages.
        """
        path = Path(pdf_path)
        if not path.exists():
            raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

        doc = fitz.open(str(path))
        pages_data = []
        total_pages = len(doc)

        # Detect repeated headers and footers across pages
        repeated_headers = self._find_repeated_lines(doc)

        for page_idx in range(total_pages):
            page = doc[page_idx]
            page_info = self._extract_page_content(page, page_idx + 1, repeated_headers)
            pages_data.append(page_info)

        doc.close()

        return {
            "file_name": path.name,
            "total_pages": total_pages,
            "pages": pages_data
        }

    def _extract_page_content(self, page: fitz.Page, page_num: int, repeated_headers: set) -> Dict[str, Any]:
        """
        Extracts structured sections from a single PDF page.
        """
        rect = page.rect
        text_page = page.get_text("dict")
        blocks = text_page.get("blocks", [])

        sections = []
        raw_text_length = 0

        for block in blocks:
            # Type 0 = Text block, Type 1 = Image block
            if block.get("type") == 0:
                lines = block.get("lines", [])
                block_text_lines = []
                max_font_size = 0
                is_bold = False
                is_mono = False

                for line in lines:
                    line_spans = line.get("spans", [])
                    line_text = "".join([span.get("text", "") for span in line_spans]).strip()
                    
                    if not line_text:
                        continue

                    # Filter out exact repeated header/footer noise
                    if line_text in repeated_headers:
                        continue

                    block_text_lines.append(line_text)

                    for span in line_spans:
                        font_size = span.get("size", 10)
                        flags = span.get("flags", 0)
                        font_name = span.get("font", "").lower()

                        if font_size > max_font_size:
                            max_font_size = font_size

                        if (flags & 2 != 0) or "bold" in font_name:
                            is_bold = True

                        if "mono" in font_name or "courier" in font_name or "consolas" in font_name or "code" in font_name:
                            is_mono = True

                if not block_text_lines:
                    continue

                full_block_text = " ".join(block_text_lines).strip()
                raw_text_length += len(full_block_text)

                # Classify block type
                block_type = self._classify_block(full_block_text, max_font_size, is_bold, is_mono)

                sections.append({
                    "type": block_type,
                    "text": full_block_text,
                    "font_size": max_font_size,
                    "is_bold": is_bold,
                    "bbox": block.get("bbox", [0, 0, 0, 0])
                })

            elif block.get("type") == 1:
                # Image block
                bbox = block.get("bbox", [0, 0, 0, 0])
                sections.append({
                    "type": "image_placeholder",
                    "bbox": bbox,
                    "text": ""
                })

        # Scanned page detection: No extractable text but page exists
        requires_ocr = False
        if raw_text_length < 15 and len(blocks) > 0:
            requires_ocr = True

        return {
            "page_number": page_num,
            "width": rect.width,
            "height": rect.height,
            "requires_ocr": requires_ocr,
            "sections": sections
        }

    def _classify_block(self, text: str, font_size: float, is_bold: bool, is_mono: bool) -> str:
        """
        Classifies a block into: title, heading, subheading, bullet, code, or paragraph.
        """
        cleaned = text.strip()

        # 1. Code detection
        if is_mono or self._is_code_snippet(cleaned):
            return "code"

        # 2. Bullet list detection
        if re.match(r'^[\u2022\u2023\u25E6\u2043\u2219\-\*]\s+', cleaned) or re.match(r'^\(?\d+[\.\)]\s+', cleaned):
            return "bullet"

        # 3. Title / Heading detection based on font size and bold style
        if font_size >= 18 or (font_size >= 15 and is_bold and len(cleaned) < 80):
            return "title"
        elif font_size >= 14 or (font_size >= 12 and is_bold and len(cleaned) < 100):
            return "heading"
        elif font_size >= 11 and is_bold and len(cleaned) < 120:
            return "subheading"

        return "paragraph"

    def _is_code_snippet(self, text: str) -> bool:
        """
        Heuristic to detect code blocks (syntax keywords, brackets, semicolons).
        """
        code_indicators = [
            r'public\s+class\s+\w+',
            r'public\s+static\s+void\s+main',
            r'System\.out\.println',
            r'def\s+\w+\(.*\):',
            r'import\s+[\w\.\*]+;',
            r'function\s+\w+\(.*\)\s*\{',
            r'const\s+\w+\s*=',
            r'#include\s+<.*>',
            r'<\?php',
            r'SELECT\s+.*\s+FROM\s+',
            r'CREATE\s+TABLE\s+',
            r'\{[\s\S]*\}'
        ]
        for pattern in code_indicators:
            if re.search(pattern, text):
                return True
        return False

    def _find_repeated_lines(self, doc: fitz.Document) -> set:
        """
        Finds lines that repeat across multiple pages (e.g. headers/footers).
        """
        if len(doc) < 3:
            return set()

        line_counts: Dict[str, int] = {}
        for page in doc:
            lines = page.get_text("text").splitlines()
            # Check only top 2 and bottom 2 lines of each page
            top_bottom = lines[:2] + lines[-2:]
            for l in top_bottom:
                cleaned = l.strip()
                if len(cleaned) > 3 and not re.match(r'^\d+$', cleaned):
                    line_counts[cleaned] = line_counts.get(cleaned, 0) + 1

        threshold = len(doc) * 0.6
        return {line for line, count in line_counts.items() if count >= threshold}
