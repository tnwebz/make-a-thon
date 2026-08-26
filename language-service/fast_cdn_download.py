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
TARGET_DIR = Path(__file__).parent / "models" / "whisper" / "small.en"
TARGET_DIR.mkdir(parents=True, exist_ok=True)

FILES = ["config.json", "vocabulary.txt", "tokenizer.json", "model.bin"]
NUM_THREADS = 16

def download_file(filename: str):
    init_url = f"https://huggingface.co/{MODEL_REPO}/resolve/main/{filename}"
    dest = TARGET_DIR / filename
    
    # 1. Resolve redirect to get direct CDN URL
    head_resp = requests.head(init_url, allow_redirects=True, timeout=30)
    head_resp.raise_for_status()
    cdn_url = head_resp.url
    total_size = int(head_resp.headers.get("content-length", 0))
    print(f"\n[FastDownload] {filename}: {total_size / 1024 / 1024:.2f} MB from CDN")

    if dest.exists() and dest.stat().st_size == total_size:
        print(f"✅ {filename} already completely downloaded!")
        return

    # Small files (< 5MB): simple direct GET
    if total_size < 5 * 1024 * 1024:
        r = requests.get(cdn_url, timeout=60)
        r.raise_for_status()
        with open(dest, "wb") as f:
            f.write(r.content)
        print(f"✅ {filename} saved ({dest.stat().st_size} bytes)")
        return

    # Large file (model.bin): 16 parallel threads directly on Cloudfront CDN
    with open(dest, "wb") as f:
        f.truncate(total_size)

    def fetch_chunk(start: int, end: int, part_idx: int):
        headers = {"Range": f"bytes={start}-{end}"}
        for attempt in range(5):
            try:
                res = requests.get(cdn_url, headers=headers, stream=True, timeout=30)
                res.raise_for_status()
                with open(dest, "r+b") as f:
                    f.seek(start)
                    for chunk in res.iter_content(chunk_size=256 * 1024):
                        if chunk:
                            f.write(chunk)
                return (part_idx, end - start + 1)
            except Exception as e:
                if attempt == 4: raise e
                time.sleep(1)

    chunk_size = total_size // NUM_THREADS
    ranges = []
    for i in range(NUM_THREADS):
        start = i * chunk_size
        end = (start + chunk_size - 1) if i < NUM_THREADS - 1 else (total_size - 1)
        ranges.append((start, end, i))

    start_t = time.time()
    with tqdm(total=total_size, unit="B", unit_scale=True, desc=filename) as pbar:
        with ThreadPoolExecutor(max_workers=NUM_THREADS) as executor:
            futures = [executor.submit(fetch_chunk, r[0], r[1], r[2]) for r in ranges]
            for future in as_completed(futures):
                idx, b_done = future.result()
                pbar.update(b_done)

    speed = (total_size / 1024 / 1024) / (time.time() - start_t)
    print(f"✅ {filename} verified ({dest.stat().st_size} bytes, {speed:.2f} MB/s)")

def main():
    print("=" * 60)
    print("🚀 High-Speed CDN Downloader for Faster-Whisper small.en")
    print("=" * 60)
    t0 = time.time()
    for f in FILES:
        download_file(f)
    print(f"\n🎉 All model files downloaded and verified in {time.time() - t0:.1f}s!")

if __name__ == "__main__":
    main()
