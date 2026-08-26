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

from app.translation.indictrans_service import IndicTransService

def test_inference():
    print("=" * 60)
    print("Testing IndicTrans2 Neural Machine Translation (English -> Hindi)...")
    print("=" * 60)

    service = IndicTransService.get_instance()

    sentences = [
        "Java is a high-level, class-based, object-oriented programming language.",
        "A class is a blueprint from which individual objects are created.",
        "In Python, define a function using `def calculate_sum(a, b):`.",
        "Visit our portal at https://skillforge.com for offline course materials."
    ]

    print("\nTranslating batch of test sentences:")
    translations = service.translate_batch(sentences, src_lang="eng_Latn", tgt_lang="hin_Deva")

    for orig, trans in zip(sentences, translations):
        print(f"\n[EN]: {orig}")
        print(f"[HI]: {trans}")

    print("\n" + "=" * 60)
    print("✅ Model inference test completed successfully!")
    print("=" * 60)

if __name__ == "__main__":
    test_inference()
