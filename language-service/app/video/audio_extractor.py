"""
Audio Extractor Module
Extracts audio from MP4 video files to WAV format using ffmpeg subprocess.
Produces 16kHz mono WAV files optimized for speech recognition.
"""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from app.config import BACKEND_UPLOADS_DIR


def _find_ffmpeg_binary() -> str:
    """
    Finds ffmpeg executable path on system (PATH or common Windows winget installation paths).
    """
    bin_path = shutil.which("ffmpeg")
    if bin_path:
        return bin_path

    # Check common winget install locations on Windows
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        winget_links = Path(local_app_data) / "Microsoft" / "WinGet" / "Links" / "ffmpeg.exe"
        if winget_links.exists():
            return str(winget_links)
        
        winget_packages = Path(local_app_data) / "Microsoft" / "WinGet" / "Packages"
        if winget_packages.exists():
            matches = list(winget_packages.glob("**/ffmpeg.exe"))
            if matches:
                return str(matches[0])

    program_files = Path("C:/Program Files")
    if program_files.exists():
        matches = list(program_files.glob("**/ffmpeg.exe"))
        if matches:
            return str(matches[0])

    return "ffmpeg"


def _resolve_video_path(source_path: str) -> Path:
    """
    Resolves a video path that may be relative (/uploads/media/xxx.mp4) or absolute.
    """
    p = Path(source_path)
    if p.exists():
        return p

    # Try resolving relative to backend uploads
    relative_clean = source_path.replace("/uploads/media/", "").replace("uploads/media/", "").lstrip("/\\")
    candidate = BACKEND_UPLOADS_DIR / relative_clean
    if candidate.exists():
        return candidate

    raise FileNotFoundError(f"Video file not found at {source_path}")


def check_ffmpeg_available() -> bool:
    """
    Returns True if ffmpeg is available in PATH or winget directory.
    """
    binary = _find_ffmpeg_binary()
    try:
        result = subprocess.run(
            [binary, "-version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        return False


def extract_audio(
    video_path: str,
    output_path: Optional[str] = None,
    sample_rate: int = 16000,
    channels: int = 1
) -> str:
    """
    Extracts audio from a video file and saves it as a WAV file.

    Args:
        video_path: Path to the source video file (absolute or /uploads/media/xxx.mp4)
        output_path: Optional output WAV path. If None, creates a temp file.
        sample_rate: Audio sample rate in Hz (default 16000 for ASR)
        channels: Number of audio channels (default 1 = mono)

    Returns:
        Absolute path to the extracted WAV file.
    """
    resolved_video = _resolve_video_path(video_path)
    ffmpeg_bin = _find_ffmpeg_binary()

    if not check_ffmpeg_available():
        raise RuntimeError(
            "ffmpeg is not installed or not found. "
            "Please ensure ffmpeg is available."
        )

    # Create output path
    if output_path is None:
        temp_dir = tempfile.gettempdir()
        stem = resolved_video.stem
        output_path = os.path.join(temp_dir, f"skillforge_audio_{stem}.wav")

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # Remove existing output to avoid ffmpeg prompt
    if output_file.exists():
        try:
            output_file.unlink()
        except Exception:
            pass

    print(f"[AudioExtractor] Extracting audio from: {resolved_video.name}")
    print(f"[AudioExtractor] Output: {output_path} (sr={sample_rate}, ch={channels})")

    cmd = [
        ffmpeg_bin,
        "-i", str(resolved_video),
        "-vn",                    # No video
        "-acodec", "pcm_s16le",   # PCM 16-bit little-endian WAV
        "-ar", str(sample_rate),  # Sample rate
        "-ac", str(channels),     # Mono
        "-y",                     # Overwrite output
        str(output_file)
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600
        )

        if result.returncode != 0:
            error_msg = result.stderr[-500:] if result.stderr else "Unknown error"
            raise RuntimeError(f"ffmpeg audio extraction failed: {error_msg}")

        if not output_file.exists() or output_file.stat().st_size == 0:
            raise RuntimeError("ffmpeg produced an empty or missing output file")

        file_size_mb = output_file.stat().st_size / (1024 * 1024)
        print(f"[AudioExtractor] [OK] Audio extracted successfully ({file_size_mb:.1f} MB)")

        return str(output_file)

    except subprocess.TimeoutExpired:
        raise RuntimeError("ffmpeg audio extraction timed out (>10 minutes)")


def cleanup_audio(audio_path: str) -> None:
    """
    Removes a temporary audio file after processing.
    """
    try:
        p = Path(audio_path)
        if p.exists() and "skillforge_audio_" in p.name:
            p.unlink()
            print(f"[AudioExtractor] Cleaned up temp audio: {p.name}")
    except Exception as e:
        print(f"[AudioExtractor] Warning: Could not clean up {audio_path}: {e}")
