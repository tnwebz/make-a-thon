import os
import sys
from pathlib import Path

# Enable UTF-8 encoding on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add parent directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.resolve()))

import torch
from app.config import (
    MODEL_NAME,
    DEVANAGARI_REGULAR_FONT,
    DEVANAGARI_BOLD_FONT,
    HINDI_UPLOADS_DIR
)
from app.translation.glossary import GlossaryProtector
from app.pdf.renderer import DevanagariPdfRenderer

def main():
    print("=" * 60)
    print("🚀 SkillForge Multilingual Language Pipeline Test")
    print("=" * 60)

    # 1. Check PyTorch & GPU Acceleration
    print(f"\n[1] PyTorch Version: {torch.__version__}")
    cuda_avail = torch.cuda.is_available()
    print(f"    CUDA Available: {cuda_avail}")
    if cuda_avail:
        print(f"    GPU Device: {torch.cuda.get_device_name(0)}")
        print(f"    VRAM Allocated: {torch.cuda.memory_allocated(0) / 1024**2:.1f} MB")
    else:
        print("    Running in CPU mode")

    # 2. Check Fonts
    print(f"\n[2] Checking Devanagari Fonts:")
    print(f"    Regular Font: {DEVANAGARI_REGULAR_FONT} (Exists: {DEVANAGARI_REGULAR_FONT.exists()})")
    print(f"    Bold Font:    {DEVANAGARI_BOLD_FONT} (Exists: {DEVANAGARI_BOLD_FONT.exists()})")

    # 3. Test Glossary & Code Protection
    print(f"\n[3] Testing Glossary & Code Protection:")
    sample_text = "Visit https://skillforge.com or email support@skillforge.com. In Java, write `public static void main(String[] args)`."
    protector = GlossaryProtector()
    protected, ph_map = protector.protect_text(sample_text)
    print(f"    Original:  {sample_text}")
    print(f"    Protected: {protected}")
    restored = protector.restore_text(protected, ph_map)
    print(f"    Restored:  {restored}")
    assert restored == sample_text, "Glossary protection restoration failed!"
    print("    ✅ Glossary protection working perfectly.")

    # 4. Test Devanagari PDF Rendering
    print(f"\n[4] Testing Devanagari PDF Generation:")
    sample_pages = [
        {
            "page_number": 1,
            "sections": [
                {
                    "type": "title",
                    "text": "अध्याय 1: जावा प्रोग्रामिंग का परिचय"
                },
                {
                    "type": "paragraph",
                    "text": "जावा एक शक्तिशाली, वर्ग-आधारित, वस्तु-उन्मुख प्रोग्रामिंग भाषा है जिसे अनुप्रयोग विकास के लिए डिज़ाइन किया गया है।"
                },
                {
                    "type": "heading",
                    "text": "मुख्य विशेषताएं:"
                },
                {
                    "type": "bullet",
                    "text": "प्लेटफ़ॉर्म स्वतंत्रता (एक बार लिखें, कहीं भी चलाएं)"
                },
                {
                    "type": "bullet",
                    "text": "मजबूत मेमोरी प्रबंधन और कचरा संग्रह"
                },
                {
                    "type": "code",
                    "text": "public class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println(\"नमस्ते SkillForge!\");\n    }\n}"
                }
            ]
        }
    ]

    test_pdf_path = HINDI_UPLOADS_DIR / "test_sample_hindi.pdf"
    renderer = DevanagariPdfRenderer()
    renderer.render_pdf(sample_pages, str(test_pdf_path), document_title="SkillForge Java Notes (हिन्दी)")

    print(f"    ✅ Test PDF generated at: {test_pdf_path}")
    print(f"    File Size: {test_pdf_path.stat().st_size} bytes")

    print("\n" + "=" * 60)
    print("🎉 ALL CORE COMPONENTS VERIFIED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    main()
