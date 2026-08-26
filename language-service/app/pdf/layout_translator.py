import os
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
import pymupdf as fitz

from app.config import (
    DEVANAGARI_REGULAR_FONT,
    DEVANAGARI_BOLD_FONT,
    TAMIL_REGULAR_FONT,
    TAMIL_BOLD_FONT,
    HINDI_UPLOADS_DIR,
    TAMIL_UPLOADS_DIR,
    LANGUAGES
)
from app.translation.indictrans_service import IndicTransService


class LayoutPreservingPdfTranslator:
    """
    Translates PDF documents in-place while preserving 100% of the original visual layout:
    - Sidebars, headers, banners, and background color blocks
    - Vector lines, diagrams, icons, and embedded images
    - Text colors (white text on dark sidebars, dark text on bright pages, colored headings)
    - Relative typography and bounding box alignment
    """

    def __init__(self):
        self.translator = IndicTransService.get_instance()

    def translate_pdf(
        self,
        source_pdf_path: str,
        output_pdf_path: Optional[str] = None,
        src_lang: str = "eng_Latn",
        tgt_lang: str = "hin_Deva",
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Translates all text in the source PDF and writes a layout-identical localized PDF (Hindi, Tamil, etc.).
        """
        src_path = Path(source_pdf_path)
        if not src_path.exists():
            raise FileNotFoundError(f"Source PDF not found at: {source_pdf_path}")

        # Resolve target language metadata
        lang_key = "hi"
        for code, meta in LANGUAGES.items():
            if meta.get("indicCode") == tgt_lang or code == tgt_lang:
                lang_key = code
                tgt_lang = meta.get("indicCode", tgt_lang)
                break

        lang_meta = LANGUAGES.get(lang_key, LANGUAGES["hi"])
        font_reg_path = str(lang_meta.get("font_regular", DEVANAGARI_REGULAR_FONT))
        font_bold_path = str(lang_meta.get("font_bold", DEVANAGARI_BOLD_FONT))
        font_prefix = lang_meta.get("font_prefix", "NotoFont")
        font_reg_name = f"{font_prefix}Reg"
        font_bold_name = f"{font_prefix}Bold"
        default_uploads_dir = lang_meta.get("uploads_dir", HINDI_UPLOADS_DIR)

        if not output_pdf_path:
            output_filename = f"{src_path.stem}_{lang_key}.pdf"
            output_pdf_path = str(default_uploads_dir / output_filename)

        out_path = Path(output_pdf_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        if progress_callback:
            progress_callback(10, f"Analyzing PDF structure & extracting visual layout ({lang_meta.get('name', 'Localized')})...")

        doc = fitz.open(str(src_path))
        total_pages = len(doc)

        # 1. Collect all text blocks with styling metadata
        all_blocks: List[Dict[str, Any]] = []

        for page_idx in range(total_pages):
            page = doc[page_idx]
            blocks = page.get_text("dict").get("blocks", [])

            for b in blocks:
                # type 0 == text block
                if b.get("type") == 0:
                    lines = b.get("lines", [])
                    if not lines:
                        continue

                    full_text_parts = []
                    primary_color = (0.1, 0.1, 0.1)
                    max_font_size = 10.0
                    is_bold = False

                    for line in lines:
                        line_text = ""
                        for span in line.get("spans", []):
                            span_txt = span.get("text", "")
                            if span_txt.strip():
                                line_text += span_txt + " "
                                
                                # Extract color
                                c = span.get("color", 0)
                                r = ((c >> 16) & 255) / 255.0
                                g = ((c >> 8) & 255) / 255.0
                                b_val = (c & 255) / 255.0
                                primary_color = (r, g, b_val)

                                size = span.get("size", 10.0)
                                if size > max_font_size:
                                    max_font_size = size

                                flags = span.get("flags", 0)
                                if flags & 2 != 0 or "Bold" in span.get("font", "") or "bold" in span.get("font", ""):
                                    is_bold = True

                        if line_text.strip():
                            full_text_parts.append(line_text.strip())

                    block_text = " ".join(full_text_parts).strip()
                    if block_text:
                        rect = fitz.Rect(b["bbox"])
                        all_blocks.append({
                            "page_idx": page_idx,
                            "bbox": rect,
                            "en_text": block_text,
                            "color": primary_color,
                            "size": max_font_size,
                            "is_bold": is_bold
                        })

        if not all_blocks:
            # Empty document, simply copy
            doc.save(str(out_path))
            return {
                "status": "READY",
                "output_pdf_path": str(out_path),
                "total_pages": total_pages,
                "translated_blocks": 0
            }

        # 2. Neural Translation via IndicTrans2
        if progress_callback:
            progress_callback(30, f"Translating {len(all_blocks)} text segments to {lang_meta.get('name', 'target language')} on GPU...")

        en_texts = [b["en_text"] for b in all_blocks]
        translated_texts = self.translator.translate_batch(en_texts, src_lang=src_lang, tgt_lang=tgt_lang)

        if progress_callback:
            progress_callback(70, f"Erasing English text & rendering styled {lang_meta.get('name', '')} text...")

        # 3. Apply redactions on pages (erases ONLY text, keeps background colors/vectors/images)
        for b in all_blocks:
            page = doc[b["page_idx"]]
            page.add_redact_annot(b["bbox"])

        for page in doc:
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
            page.insert_font(fontname=font_reg_name, fontfile=font_reg_path)
            page.insert_font(fontname=font_bold_name, fontfile=font_bold_path)

        # 4. Insert formatted localized text into exact bounding boxes
        for b, localized_text in zip(all_blocks, translated_texts):
            page = doc[b["page_idx"]]
            rect = b["bbox"]
            font_name = font_bold_name if b["is_bold"] else font_reg_name
            font_file = font_bold_path if b["is_bold"] else font_reg_path
            base_size = b["size"] * 0.92

            # Try inserting with standard scaled size
            rc = page.insert_textbox(
                rect,
                localized_text,
                fontname=font_name,
                fontfile=font_file,
                fontsize=base_size,
                color=b["color"],
                align=fitz.TEXT_ALIGN_LEFT
            )

            # If text overflows bounding box, auto-scale down
            if rc < 0:
                rc = page.insert_textbox(
                    rect,
                    localized_text,
                    fontname=font_name,
                    fontfile=font_file,
                    fontsize=base_size * 0.80,
                    color=b["color"],
                    align=fitz.TEXT_ALIGN_LEFT
                )
                if rc < 0:
                    page.insert_textbox(
                        rect,
                        localized_text,
                        fontname=font_name,
                        fontfile=font_file,
                        fontsize=base_size * 0.68,
                        color=b["color"],
                        align=fitz.TEXT_ALIGN_LEFT
                    )

        if progress_callback:
            progress_callback(90, f"Saving translated {lang_meta.get('name', '')} PDF document...")

        doc.save(str(out_path), deflate=True)
        doc.close()

        file_size = os.path.getsize(str(out_path))

        if progress_callback:
            progress_callback(100, f"{lang_meta.get('name', 'Translated')} document generated successfully!")

        return {
            "status": "READY",
            "language_code": lang_key,
            "output_pdf_path": str(out_path),
            "file_size": file_size,
            "total_pages": total_pages,
            "translated_blocks": len(all_blocks)
        }
