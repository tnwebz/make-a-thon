import os
import sys
import time
import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

MODEL_REPO = "Systran/faster-whisper-small.en"
TARGET_DIR = Path(__file__).parent.parent / "models" / "whisper" / "small.en"
TARGET_DIR.mkdir(parents=True, exist_ok=True)

FILES = [
    "config.json",
    "vocabulary.txt",
    "tokenizer.json",
    "model.bin"
]

NUM_THREADS = 16

def download_file_range(url: str, start: int, end: int, part_index: int, dest_path: str):
    headers = {
        "Range": f"bytes={start}-{end}",
        "User-Agent": "SkillForge/1.0"
    }
    for attempt in range(5):
        try:
            r = requests.get(url, headers=headers, stream=True, timeout=30)
            r.raise_for_status()
            with open(dest_path, "r+b") as f:
                f.seek(start)
                for chunk in r.iter_content(chunk_size=512 * 1024):
                    if chunk:
                        f.write(chunk)
            return (part_index, end - start + 1)
        except Exception as e:
            if attempt == 4:
                raise e
            time.sleep(1)

def download_large_file(filename: str):
    url = f"https://huggingface.co/{MODEL_REPO}/resolve/main/{filename}"
    dest = TARGET_DIR / filename
    
    r = requests.head(url, allow_redirects=True, timeout=30)
    r.raise_for_status()
    total_size = int(r.headers.get("content-length", 0))
    print(f"Downloading {filename} ({total_size / 1024 / 1024:.2f} MB)...")

    if dest.exists() and dest.stat().st_size == total_size:
        print(f"✅ {filename} already downloaded!")
        return

    # Small files: download directly
    if total_size < 5 * 1024 * 1024:
        res = requests.get(url, timeout=60)
        res.raise_for_status()
        with open(dest, "wb") as f:
            f.write(res.content)
        print(f"✅ {filename} saved ({dest.stat().st_size} bytes)")
        return

    # Large files: multi-threaded parallel download
    with open(dest, "wb") as f:
        f.truncate(total_size)

    chunk_size = total_size // NUM_THREADS
    ranges = []
    for i in range(NUM_THREADS):
        start = i * chunk_size
        end = (start + chunk_size - 1) if i < NUM_THREADS - 1 else (total_size - 1)
        ranges.append((start, end, i))

    with tqdm(total=total_size, unit="B", unit_scale=True, desc=f"Downloading {filename}") as pbar:
        with ThreadPoolExecutor(max_workers=NUM_THREADS) as executor:
            futures = [
                executor.submit(download_file_range, url, r[0], r[1], r[2], str(dest))
                for r in ranges
            ]
            for future in as_completed(futures):
                idx, bytes_done = future.result()
                pbar.update(bytes_done)

    print(f"✅ {filename} complete ({dest.stat().st_size} bytes)")

def download_all():
    print("=" * 60)
    print("🚀 Downloading Faster-Whisper Small.en Model Weights")
    print(f"Target: {TARGET_DIR}")
    print("=" * 60)
    start_time = time.time()
    for f in FILES:
        download_large_file(f)
    print(f"🎉 Model weights ready in {time.time() - start_time:.1f}s!")

if __name__ == "__main__":
    download_all()
