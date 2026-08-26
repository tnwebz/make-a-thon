import os
import sys
import urllib.request
from pathlib import Path

TARGET_DIR = Path(__file__).parent / "models" / "whisper" / "small.en"
TARGET_DIR.mkdir(parents=True, exist_ok=True)

URL = "https://huggingface.co/Systran/faster-whisper-small.en/resolve/main/model.bin"
DEST = TARGET_DIR / "model.bin"

def reporthook(count, block_size, total_size):
    if count % 1000 == 0:
        percent = int(count * block_size * 100 / total_size) if total_size > 0 else 0
        mb = (count * block_size) / (1024 * 1024)
        print(f"Downloading model.bin: {mb:.1f} MB ({percent}%)")

print(f"Downloading model.bin from {URL} to {DEST}...")
urllib.request.urlretrieve(URL, str(DEST), reporthook=reporthook)
print(f"✅ model.bin downloaded successfully! ({DEST.stat().st_size} bytes)")
