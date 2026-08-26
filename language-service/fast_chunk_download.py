import os
import sys
import time
import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

TARGET_DIR = Path(__file__).parent / "models" / "whisper" / "small.en"
TARGET_DIR.mkdir(parents=True, exist_ok=True)

MODEL_REPO = "Systran/faster-whisper-small.en"
FILES = ["config.json", "vocabulary.txt", "tokenizer.json", "model.bin"]
NUM_THREADS = 16

def download_part(url: str, start: int, end: int, part_path: Path):
    headers = {"Range": f"bytes={start}-{end}"}
    for attempt in range(5):
        try:
            r = requests.get(url, headers=headers, timeout=60)
            r.raise_for_status()
            with open(part_path, "wb") as f:
                f.write(r.content)
            return (part_path, end - start + 1)
        except Exception as e:
            if attempt == 4: raise e
            time.sleep(1)

def download_large_file(filename: str):
    dest = TARGET_DIR / filename
    init_url = f"https://huggingface.co/{MODEL_REPO}/resolve/main/{filename}"
    
    head_resp = requests.head(init_url, allow_redirects=True, timeout=30)
    head_resp.raise_for_status()
    cdn_url = head_resp.url
    total_size = int(head_resp.headers.get("content-length", 0))
    print(f"\n[FastChunk] {filename}: {total_size / 1024 / 1024:.2f} MB")

    if total_size < 5 * 1024 * 1024:
        r = requests.get(cdn_url, timeout=60)
        r.raise_for_status()
        with open(dest, "wb") as f:
            f.write(r.content)
        print(f"✅ {filename} saved ({dest.stat().st_size} bytes)")
        return

    # Multi-part parallel download to separate part files
    chunk_size = total_size // NUM_THREADS
    ranges = []
    part_files = []
    for i in range(NUM_THREADS):
        start = i * chunk_size
        end = (start + chunk_size - 1) if i < NUM_THREADS - 1 else (total_size - 1)
        part_p = TARGET_DIR / f"{filename}.part{i}"
        part_files.append(part_p)
        ranges.append((start, end, part_p))

    start_t = time.time()
    with tqdm(total=total_size, unit="B", unit_scale=True, desc=f"Downloading {filename}") as pbar:
        with ThreadPoolExecutor(max_workers=NUM_THREADS) as executor:
            futures = [executor.submit(download_part, cdn_url, r[0], r[1], r[2]) for r in ranges]
            for future in as_completed(futures):
                p, b_done = future.result()
                pbar.update(b_done)

    # Concatenate parts
    print(f"Concatenating {len(part_files)} chunks into {dest.name}...")
    with open(dest, "wb") as outfile:
        for part_p in part_files:
            with open(part_p, "rb") as infile:
                outfile.write(infile.read())
            part_p.unlink()

    speed = (total_size / 1024 / 1024) / (time.time() - start_t)
    print(f"✅ {filename} ready: {dest.stat().st_size} bytes ({speed:.2f} MB/s)")

def main():
    print("=" * 60)
    print("🚀 Parallel Part Downloader for Faster-Whisper")
    print("=" * 60)
    t0 = time.time()
    for f in FILES:
        download_large_file(f)
    print(f"\n🎉 Model ready in {time.time() - t0:.1f}s!")

if __name__ == "__main__":
    main()
