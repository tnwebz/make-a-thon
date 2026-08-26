from pathlib import Path
from typing import List, Dict, Any, Optional
from fpdf import FPDF
from app.config import DEVANAGARI_REGULAR_FONT, DEVANAGARI_BOLD_FONT

class SkillForgePdfDoc(FPDF):
    """
    Custom FPDF2 subclass with header, footer, and Devanagari Unicode support.
    """
    def __init__(self, course_title: str = "SkillForge Notes (हिन्दी)"):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.course_title = course_title
        self.set_auto_page_break(auto=True, margin=20)
        
        # Load Devanagari Fonts
        if DEVANAGARI_REGULAR_FONT.exists():
            self.add_font("NotoDeva", style="", fname=str(DEVANAGARI_REGULAR_FONT))
        if DEVANAGARI_BOLD_FONT.exists():
            self.add_font("NotoDeva", style="B", fname=str(DEVANAGARI_BOLD_FONT))

        # Enable HarfBuzz text shaping for flawless Hindi ligatures & matras
        try:
            self.set_text_shaping(True)
        except Exception as e:
            print(f"[PDF Renderer] Warning: text shaping init notice: {e}")

    def header(self):
        if self.page_no() > 1:
            self.set_font("NotoDeva", style="", size=8)
            self.set_text_color(140, 140, 140)
            self.cell(0, 8, self.course_title, border=0, align="L")
            self.ln(2)
            self.set_draw_color(230, 230, 230)
            self.set_line_width(0.2)
            self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
            self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_draw_color(230, 230, 230)
        self.set_line_width(0.2)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(2)
        self.set_font("NotoDeva", style="", size=8)
        self.set_text_color(140, 140, 140)
        self.cell(0, 8, f"SkillForge LMS • पृष्ठ {self.page_no()}", border=0, align="C")


class DevanagariPdfRenderer:
    """
    Renders structured translated sections into a Devanagari PDF document.
    """

    def __init__(self):
        pass

    def render_pdf(
        self,
        pages_content: List[Dict[str, Any]],
        output_path: str,
        document_title: str = "SkillForge Course Notes (हिन्दी)"
    ) -> str:
        """
        Renders structured pages into a PDF file at output_path.
        """
        out_file = Path(output_path)
        out_file.parent.mkdir(parents=True, exist_ok=True)

        pdf = SkillForgePdfDoc(course_title=document_title)

        for page_data in pages_content:
            pdf.add_page()
            sections = page_data.get("sections", [])

            for section in sections:
                sec_type = section.get("type", "paragraph")
                text = section.get("translated_text") or section.get("text", "")

                if not text or not text.strip():
                    continue

                if sec_type == "title":
                    self._render_title(pdf, text)
                elif sec_type == "heading":
                    self._render_heading(pdf, text)
                elif sec_type == "subheading":
                    self._render_subheading(pdf, text)
                elif sec_type == "bullet":
                    self._render_bullet(pdf, text)
                elif sec_type == "code":
                    self._render_code(pdf, text)
                else:
                    self._render_paragraph(pdf, text)

        pdf.output(str(out_file))

        if not out_file.exists() or out_file.stat().st_size == 0:
            raise RuntimeError(f"Generated PDF at {output_path} is empty or missing.")

        return str(out_file)

    def _render_title(self, pdf: SkillForgePdfDoc, text: str):
        pdf.ln(4)
        pdf.set_font("NotoDeva", style="B", size=18)
        pdf.set_text_color(15, 23, 42)  # Zinc-900
        pdf.multi_cell(0, 9, text, align="L")
        pdf.ln(3)

    def _render_heading(self, pdf: SkillForgePdfDoc, text: str):
        pdf.ln(3)
        pdf.set_font("NotoDeva", style="B", size=14)
        pdf.set_text_color(30, 41, 59)  # Slate-800
        pdf.multi_cell(0, 7.5, text, align="L")
        pdf.ln(2)

    def _render_subheading(self, pdf: SkillForgePdfDoc, text: str):
        pdf.ln(2)
        pdf.set_font("NotoDeva", style="B", size=11.5)
        pdf.set_text_color(51, 65, 85)  # Slate-700
        pdf.multi_cell(0, 6.5, text, align="L")
        pdf.ln(1.5)

    def _render_paragraph(self, pdf: SkillForgePdfDoc, text: str):
        pdf.set_font("NotoDeva", style="", size=10)
        pdf.set_text_color(30, 41, 59)  # Slate-800
        pdf.multi_cell(0, 5.8, text, align="L")
        pdf.ln(2.5)

    def _render_bullet(self, pdf: SkillForgePdfDoc, text: str):
        pdf.set_font("NotoDeva", style="", size=10)
        pdf.set_text_color(30, 41, 59)
        # Indent bullet slightly
        indent = 5
        bullet_char = "• "
        clean_text = text.lstrip("•-* 0123456789.)").strip()
        
        pdf.set_x(pdf.l_margin + indent)
        pdf.multi_cell(pdf.w - pdf.l_margin - pdf.r_margin - indent, 5.6, f"{bullet_char} {clean_text}", align="L")
        pdf.ln(1.5)

    def _render_code(self, pdf: SkillForgePdfDoc, code_text: str):
        """
        Renders code block inside a styled background box.
        Uses Unicode font NotoDeva to safely render code comments/strings containing Hindi characters.
        """
        pdf.ln(2)
        pdf.set_font("NotoDeva", style="", size=8.5)
        pdf.set_text_color(15, 23, 42)
        pdf.set_fill_color(248, 250, 252)  # Slate-50
        pdf.set_draw_color(226, 232, 240)  # Slate-200
        pdf.set_line_width(0.2)

        # Draw background and multi-cell
        box_width = pdf.w - pdf.l_margin - pdf.r_margin
        lines = code_text.splitlines()
        
        for line in lines:
            pdf.cell(box_width, 4.8, f"  {line}", border=0, fill=True, ln=True)

        pdf.ln(3)
