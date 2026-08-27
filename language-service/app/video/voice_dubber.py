"""
End-to-End Voice Dubbing & Synchronization Module for SkillForge
Supports both Hindi ('hi') and Tamil ('ta') with Zero-Cut Audio Alignment,
intelligent segment planning, and lossless FFmpeg video stream copy.
"""

import os
import json
import logging
import asyncio
import tempfile
import subprocess
import pydub
import soundfile as sf
import numpy as np
import librosa
from typing import Dict, List, Optional, Callable, Any, Tuple

from app.video.spoken_tamil_normalizer import SpokenTamilOptimizer
from app.video.spoken_hindi_normalizer import SpokenHindiOptimizer
from app.video.tts_segment_planner import TTSSegmentPlanner, TTSUnit
from app.video.audio_alignment_engine import AudioAlignmentEngine
from app.video.indicf5_engine import get_voice_engine

logger = logging.getLogger("voice_dubber")

DEFAULT_VOICES = {
    "ta": "ta-IN-ValluvarNeural",
    "hi": "hi-IN-MadhurNeural"
}


def get_media_duration(file_path: str) -> float:
    """
    Returns media duration in seconds using ffprobe.
    """
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file_path
    ]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return float(res.stdout.strip())
    except Exception as e:
        logger.warning(f"Failed to get duration via ffprobe: {e}")
        return 0.0


def validate_audio_track(audio: np.ndarray, sample_rate: int, min_duration: float = 1.0) -> bool:
    """
    Validates the assembled master audio track before muxing.
    """
    if len(audio) == 0:
        logger.error("Audio validation failed: Audio array is empty.")
        return False
    
    dur = len(audio) / sample_rate
    if dur < min_duration:
        logger.error(f"Audio validation failed: Duration {dur:.2f}s is less than min {min_duration}s.")
        return False

    if np.any(np.isnan(audio)) or np.any(np.isinf(audio)):
        logger.error("Audio validation failed: Audio contains NaN or Inf values.")
        return False

    rms = np.sqrt(np.mean(np.square(audio)))
    if rms < 1e-4:
        logger.error("Audio validation failed: Audio track is completely silent.")
        return False

    return True


def synthesize_neural_speech(
    text: str,
    language: str = "ta",
    voice: Optional[str] = None,
    sample_rate: int = 24000
) -> Tuple[Optional[np.ndarray], int]:
    """
    Synthesizes authentic spoken Indian language speech (Hindi or Tamil) using Microsoft Natural Neural TTS.
    Returns: (audio_waveform_numpy, sample_rate)
    """
    active_voice = voice or DEFAULT_VOICES.get(language, "ta-IN-ValluvarNeural")
    try:
        import edge_tts
        
        async def _run_tts():
            communicate = edge_tts.Communicate(text, active_voice)
            audio_bytes = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_bytes += chunk["data"]
            return audio_bytes

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    audio_bytes = executor.submit(lambda: asyncio.run(_run_tts())).result()
            else:
                audio_bytes = loop.run_until_complete(_run_tts())
        except Exception:
            audio_bytes = asyncio.run(_run_tts())

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
            tf.write(audio_bytes)
            tmp_name = tf.name

        seg = pydub.AudioSegment.from_file(tmp_name, format="mp3")
        seg = seg.set_frame_rate(sample_rate).set_channels(1)
        samples = np.array(seg.get_array_of_samples(), dtype=np.float32) / 32768.0

        try:
            os.remove(tmp_name)
        except Exception:
            pass

        return samples, sample_rate
    except Exception as e:
        logger.warning(f"Edge-TTS synthesis failed for voice '{active_voice}' ({e}), falling back to IndicF5")
        return None, sample_rate


def dub_video_to_language(
    source_video_path: str,
    subtitle_segments: List[Dict[str, Any]],
    reference_voice_path: str,
    reference_transcript: str,
    output_dir: str,
    target_language: str = "ta",
    voice_name: Optional[str] = None,
    preview_mode: bool = False,
    preview_duration: float = 30.0,
    progress_callback: Optional[Callable[[int, int, float, str], None]] = None
) -> Dict[str, Any]:
    """
    Orchestrates end-to-end generation of the Hindi/Tamil dubbed video using Intelligent Audio Alignment:
    1. Groups subtitle segments into coherent multi-segment TTSUnits.
    2. Generates complete, non-chopped speech for each unit using Neural TTS / IndicF5.
    3. Aligns units using pitch-preserving micro-stretching and timeline redistribution.
    4. Assembles master audio track with smooth crossfades and peak normalization.
    5. Validates audio track and muxes into MP4 via lossless FFmpeg stream copy.
    """
    if not os.path.exists(source_video_path):
        raise FileNotFoundError(f"Source video not found: {source_video_path}")

    os.makedirs(output_dir, exist_ok=True)
    stem = os.path.splitext(os.path.basename(source_video_path))[0]
    
    suffix = f"_{target_language}_preview" if preview_mode else f"_{target_language}"
    dubbed_video_path = os.path.join(output_dir, f"{stem}{suffix}.mp4")
    voice_audio_path = os.path.join(output_dir, f"{stem}{suffix}_voice.wav")
    segments_json_path = os.path.join(output_dir, f"{stem}{suffix}_segments.json")

    # Step 1: Group subtitle segments into coherent multi-segment TTSUnits
    planner = TTSSegmentPlanner(max_unit_duration=7.5, max_merge_gap=0.8)
    tts_units = planner.plan_units(subtitle_segments, language=target_language)

    if preview_mode:
        tts_units = [u for u in tts_units if u.target_start <= preview_duration]

    total_units = len(tts_units)
    logger.info(f"Planned {total_units} TTS units for dubbing '{stem}' into '{target_language}'.")

    # Get total media duration
    total_duration = get_media_duration(source_video_path)
    if preview_mode and total_duration > preview_duration:
        total_duration = preview_duration
    elif total_duration <= 0 and tts_units:
        total_duration = float(tts_units[-1].target_end) + 2.0

    sample_rate = 24000
    alignment_engine = AudioAlignmentEngine(
        natural_fit_tolerance=0.05,
        max_safe_speed_ratio=1.15,
        edge_fade_ms=5.0
    )

    aligned_items: List[Tuple[np.ndarray, TTSUnit]] = []

    # Step 2: Synthesize and Align each TTS Unit
    for idx, unit in enumerate(tts_units):
        if progress_callback:
            percent = 10.0 + round(((idx) / max(1, total_units)) * 65.0, 1)
            progress_callback(idx + 1, total_units, percent, f"Synthesizing & Aligning {target_language.upper()} unit {idx + 1}/{total_units}")

        if not unit.spoken_text:
            continue

        try:
            # 1. Synthesize complete audio (Zero Cutting)
            raw_audio, sr = synthesize_neural_speech(
                text=unit.spoken_text,
                language=target_language,
                voice=voice_name,
                sample_rate=sample_rate
            )
            
            if raw_audio is None:
                # IndicF5 Fallback
                engine = get_voice_engine()
                engine.load()
                raw_audio, sr = engine.synthesize(
                    text=unit.spoken_text,
                    ref_audio_path=reference_voice_path,
                    ref_text=reference_transcript,
                    speed=1.0,
                    target_duration=unit.target_duration,
                    nfe_step=32
                )

            # 2. Intelligent Alignment (Never truncates words)
            aligned_audio, aligned_unit = alignment_engine.align_unit(raw_audio, sample_rate, unit)
            aligned_items.append((aligned_audio, aligned_unit))

        except Exception as e:
            logger.error(f"Error synthesizing unit {unit.unit_id}: {e}")
            continue

    if progress_callback:
        progress_callback(total_units, total_units, 80.0, "Assembling master lecture timeline...")

    # Step 3: Master Timeline Assembly & Global Drift Control
    master_audio, final_metadata, drift_report = alignment_engine.assemble_timeline(
        aligned_items=aligned_items,
        total_video_duration=total_duration,
        sample_rate=sample_rate
    )

    logger.info(f"Timeline assembly complete for {target_language}. Max drift: {drift_report['max_drift_seconds']}s")

    # Step 4: Audio Validation
    if progress_callback:
        progress_callback(total_units, total_units, 88.0, "Validating master audio track...")

    is_valid = validate_audio_track(master_audio, sample_rate)
    if not is_valid:
        raise RuntimeError(f"Master {target_language} audio track failed validation check.")

    # Save master audio track WAV
    sf.write(voice_audio_path, master_audio, sample_rate)
    logger.info(f"Master {target_language} audio saved to: {voice_audio_path}")

    # Save alignment metadata JSON
    with open(segments_json_path, "w", encoding="utf-8") as f:
        json.dump({
            "language": target_language,
            "drift_report": drift_report,
            "units": final_metadata
        }, f, indent=2, ensure_ascii=False)

    # Step 5: Lossless FFmpeg Video Stream Copy Muxing
    if progress_callback:
        progress_callback(total_units, total_units, 92.0, "Muxing dubbed video via FFmpeg...")

    cmd = [
        "ffmpeg", "-y",
        "-i", source_video_path,
        "-i", voice_audio_path,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        dubbed_video_path
    ]

    if preview_mode:
        cmd.insert(1, "-t")
        cmd.insert(2, f"{preview_duration:.2f}")

    logger.info(f"Executing FFmpeg mux: {' '.join(cmd)}")
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        logger.error(f"FFmpeg muxing failed: {res.stderr}")
        raise RuntimeError(f"FFmpeg muxing failed with code {res.returncode}: {res.stderr}")

    if not os.path.exists(dubbed_video_path) or os.path.getsize(dubbed_video_path) == 0:
        raise RuntimeError(f"Dubbed video file {dubbed_video_path} was not generated properly.")

    logger.info(f"Dubbed {target_language} video successfully created: {dubbed_video_path}")

    if progress_callback:
        progress_callback(total_units, total_units, 100.0, f"{target_language.upper()} Voice dubbing complete!")

    return {
        "status": "completed",
        "target_language": target_language,
        "dubbed_video_path": dubbed_video_path,
        "voice_audio_path": voice_audio_path,
        "segments_json_path": segments_json_path,
        "total_duration": round(total_duration, 2),
        "total_units": total_units,
        "drift_report": drift_report
    }


def dub_video_to_tamil(*args, **kwargs) -> Dict[str, Any]:
    """Backward compatible helper for Tamil."""
    kwargs["target_language"] = "ta"
    return dub_video_to_language(*args, **kwargs)


def dub_video_to_hindi(*args, **kwargs) -> Dict[str, Any]:
    """Helper for Hindi dubbing."""
    kwargs["target_language"] = "hi"
    return dub_video_to_language(*args, **kwargs)
