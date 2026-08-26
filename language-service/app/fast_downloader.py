import os
import sys
import time
import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
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

URL = f"https://huggingface.co/{MODEL_REPO}/resolve/main/pytorch_model.bin"
DEST_FILE = TARGET_DIR / "pytorch_model.bin"
NUM_THREADS = 16

def download_range(start: int, end: int, part_index: int, dest_path: str):
    headers = {
        "Range": f"bytes={start}-{end}",
        "User-Agent": "SkillForge/1.0"
    }
    for attempt in range(5):
        try:
            r = requests.get(URL, headers=headers, stream=True, timeout=30)
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

def main():
    print("=" * 60)
    print(f"🚀 High-Speed Multi-Threaded IndicTrans2 Downloader ({NUM_THREADS} Threads)")
    print(f"Destination: {DEST_FILE}")
    print("=" * 60)

    # 1. Get file size
    r = requests.head(URL, allow_redirects=True, timeout=30)
    r.raise_for_status()
    total_size = int(r.headers.get("content-length", 0))
    print(f"Total Size: {total_size / 1024 / 1024:.2f} MB")

    if DEST_FILE.exists() and DEST_FILE.stat().st_size == total_size:
        print("✅ pytorch_model.bin already completely downloaded!")
        return

    # 2. Preallocate file
    print("Preallocating file on disk...")
    with open(DEST_FILE, "wb") as f:
        f.truncate(total_size)

    # 3. Create byte ranges
    chunk_size = total_size // NUM_THREADS
    ranges = []
    for i in range(NUM_THREADS):
        start = i * chunk_size
        end = (start + chunk_size - 1) if i < NUM_THREADS - 1 else (total_size - 1)
        ranges.append((start, end, i))

    print(f"Starting {NUM_THREADS} parallel download threads...")
    start_time = time.time()

    with tqdm(total=total_size, unit="B", unit_scale=True, desc="Downloading IndicTrans2") as pbar:
        with ThreadPoolExecutor(max_workers=NUM_THREADS) as executor:
            futures = [
                executor.submit(download_range, r[0], r[1], r[2], str(DEST_FILE))
                for r in ranges
            ]
            for future in as_completed(futures):
                idx, bytes_done = future.result()
                pbar.update(bytes_done)

    elapsed = time.time() - start_time
    speed_mb = (total_size / 1024 / 1024) / elapsed
    print(f"\n🎉 Download completed successfully in {elapsed:.1f}s ({speed_mb:.2f} MB/s)!")
    print(f"File verified: {DEST_FILE.stat().st_size} bytes")

if __name__ == "__main__":
    main()
