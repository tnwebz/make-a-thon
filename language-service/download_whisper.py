import os
import sys
import shutil
import requests
from pathlib import Path
from tqdm import tqdm

TARGET_DIR = Path(__file__).parent.parent / "models" / "whisper" / "small.en"
shutil.rmtree(TARGET_DIR.parent, ignore_errors=True)
TARGET_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://huggingface.co/Systran/faster-whisper-small.en/resolve/main"
FILES = ["config.json", "vocabulary.txt", "tokenizer.json", "model.bin"]

print(f"Downloading faster-whisper small.en to: {TARGET_DIR}")
for filename in FILES:
    url = f"{BASE_URL}/{filename}"
    dest = TARGET_DIR / filename
    print(f"Fetching {filename}...")
    r = requests.get(url, stream=True, allow_redirects=True, timeout=60)
    r.raise_for_status()
    total_size = int(r.headers.get("content-length", 0))
    with open(dest, "wb") as f, tqdm(total=total_size, unit="B", unit_scale=True, desc=filename) as pbar:
        for chunk in r.iter_content(chunk_size=1024 * 1024):
            if chunk:
                f.write(chunk)
                pbar.update(len(chunk))
    print(f" Saved {filename} ({dest.stat().st_size} bytes)")

print(" All Faster-Whisper files ready!")
