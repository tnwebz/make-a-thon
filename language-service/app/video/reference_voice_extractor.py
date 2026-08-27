"""
Reference Voice Extractor Module for SkillForge AI Dubbing
Extracts a clean 8-15s continuous speech segment of the instructor/professor
and pairs it with the exact English transcript for F5-TTS / IndicF5 voice cloning.
"""

import os
import json
import subprocess
import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger("reference_voice_extractor")


def extract_audio_slice(
    source_media_path: str,
    output_wav_path: str,
    start_time: float,
    duration: float,
    sample_rate: int = 24000
) -> bool:
    """
    Extracts an audio slice from video or audio file using FFmpeg,
    resampling to mono WAV at the specified sample rate.
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_wav_path)), exist_ok=True)
    
    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{start_time:.3f}",
        "-i", source_media_path,
        "-t", f"{duration:.3f}",
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", str(sample_rate),
        "-ac", "1",
        output_wav_path
    ]
    
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return os.path.exists(output_wav_path) and os.path.getsize(output_wav_path) > 0
    except Exception as e:
        logger.error(f"FFmpeg audio extraction error: {e}")
        return False


def get_transcript_for_window(
    segments: List[Dict[str, Any]],
    start_time: float,
    end_time: float
) -> str:
    """
    Finds and combines the English spoken text corresponding to a time window.
    """
    matched_texts = []
    for seg in segments:
        seg_start = float(seg.get("start", 0))
        seg_end = float(seg.get("end", 0))
        text = seg.get("text", "").strip()

        # Check for overlap
        if max(seg_start, start_time) < min(seg_end, end_time):
            if text:
                matched_texts.append(text)

    full_text = " ".join(matched_texts).strip()
    return full_text


def auto_detect_reference_voice(
    source_media_path: str,
    output_dir: str,
    english_segments: List[Dict[str, Any]],
    target_duration: float = 10.0,
    min_duration: float = 8.0,
    max_duration: float = 15.0
) -> Dict[str, Any]:
    """
    Automatically finds the optimal 8-15s clean speech window from the English transcript
    and extracts the reference WAV and matching English transcript.
    """
    if not english_segments:
        # Fallback: take first 10 seconds of media
        start_time = 0.0
        end_time = min(10.0, target_duration)
        ref_text = "Welcome to this lecture."
    else:
        # Find continuous block of segments that sums to target_duration
        best_window = None
        best_score = float("inf")

        for i in range(len(english_segments)):
            start_cand = float(english_segments[i]["start"])
            cand_texts = []
            
            for j in range(i, len(english_segments)):
                end_cand = float(english_segments[j]["end"])
                duration = end_cand - start_cand
                cand_texts.append(english_segments[j].get("text", "").strip())
                
                if min_duration <= duration <= max_duration:
                    # Preference: closest to target_duration and healthy word count
                    word_count = len(" ".join(cand_texts).split())
                    if word_count >= 12: # Avoid near-silent or single word slices
                        score = abs(duration - target_duration)
                        if score < best_score:
                            best_score = score
                            best_window = (start_cand, end_cand, " ".join(cand_texts))
                            
                elif duration > max_duration:
                    break

        if best_window:
            start_time, end_time, ref_text = best_window
        else:
            # Fallback to first segment(s)
            start_time = float(english_segments[0]["start"])
            end_time = min(start_time + target_duration, float(english_segments[-1]["end"]))
            ref_text = get_transcript_for_window(english_segments, start_time, end_time)

    duration = end_time - start_time
    stem = os.path.splitext(os.path.basename(source_media_path))[0]
    out_wav_path = os.path.join(output_dir, f"{stem}_ref.wav")
    out_json_path = os.path.join(output_dir, f"{stem}_ref.json")

    success = extract_audio_slice(source_media_path, out_wav_path, start_time, duration)
    if not success:
        raise RuntimeError(f"Failed to extract reference audio slice from {source_media_path}")

    meta = {
        "reference_audio_path": out_wav_path,
        "reference_transcript": ref_text,
        "start_time": round(start_time, 3),
        "end_time": round(end_time, 3),
        "duration": round(duration, 3),
        "mode": "auto"
    }

    with open(out_json_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    return meta


def manual_extract_reference_voice(
    source_media_path: str,
    output_dir: str,
    start_time: float,
    end_time: float,
    english_segments: Optional[List[Dict[str, Any]]] = None,
    custom_transcript: Optional[str] = None
) -> Dict[str, Any]:
    """
    Manually extracts the reference voice using instructor-defined timestamps.
    """
    duration = end_time - start_time
    if duration <= 0:
        raise ValueError(f"Invalid timestamp range: start={start_time}, end={end_time}")

    if custom_transcript and custom_transcript.strip():
        ref_text = custom_transcript.strip()
    elif english_segments:
        ref_text = get_transcript_for_window(english_segments, start_time, end_time)
    else:
        ref_text = "Instructor reference voice segment."

    stem = os.path.splitext(os.path.basename(source_media_path))[0]
    out_wav_path = os.path.join(output_dir, f"{stem}_ref.wav")
    out_json_path = os.path.join(output_dir, f"{stem}_ref.json")

    success = extract_audio_slice(source_media_path, out_wav_path, start_time, duration)
    if not success:
        raise RuntimeError(f"Failed to extract reference audio slice from {source_media_path}")

    meta = {
        "reference_audio_path": out_wav_path,
        "reference_transcript": ref_text,
        "start_time": round(start_time, 3),
        "end_time": round(end_time, 3),
        "duration": round(duration, 3),
        "mode": "manual"
    }

    with open(out_json_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    return meta
