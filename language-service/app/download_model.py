import os
import sys
import requests
from pathlib import Path
from tqdm import tqdm

# Enable UTF-8 encoding on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

MODEL_REPO = "Raghavan/indictrans2-en-indic-dist-200M"
TARGET_DIR = Path(__file__).parent.parent / "models" / "indictrans2-en-indic-dist-200M"
TARGET_DIR.mkdir(parents=True, exist_ok=True)

FILES = [
    "config.json",
    "configuration_indictrans.py",
    "generation_config.json",
    "modeling_indictrans.py",
    "pytorch_model.bin"
]

def download_file(filename: str):
    url = f"https://huggingface.co/{MODEL_REPO}/resolve/main/{filename}"
    dest = TARGET_DIR / filename
    
    if dest.exists() and dest.stat().st_size > 0:
        if filename != "pytorch_model.bin" or dest.stat().st_size > 100_000_000:
            print(f"✅ {filename} already exists ({dest.stat().st_size / 1024 / 1024:.1f} MB).")
            return

    print(f"📥 Downloading {filename} from {url}...")
    headers = {"User-Agent": "SkillForge/1.0"}
    response = requests.get(url, headers=headers, stream=True, timeout=60)
    response.raise_for_status()

    total_size = int(response.headers.get('content-length', 0))
    chunk_size = 1024 * 1024  # 1MB chunks

    with open(dest, 'wb') as f, tqdm(
        desc=filename,
        total=total_size,
        unit='iB',
        unit_scale=True,
        unit_divisor=1024,
    ) as bar:
        for chunk in response.iter_content(chunk_size=chunk_size):
            if chunk:
                f.write(chunk)
                bar.update(len(chunk))

    print(f"✅ Downloaded {filename} ({dest.stat().st_size / 1024 / 1024:.1f} MB).")

def main():
    print("=" * 60)
    print("🚀 Downloading AI4Bharat IndicTrans2 (English -> Indic 200M)...")
    print(f"Target Directory: {TARGET_DIR}")
    print("=" * 60)

    for filename in FILES:
        download_file(filename)

    print("\n🎉 IndicTrans2 model files downloaded and verified successfully!")

if __name__ == "__main__":
    main()
