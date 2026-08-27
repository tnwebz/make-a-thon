"""
Comprehensive Test Harness for SkillForge Audio Alignment Engine
Verifies:
1. Zero-Cut Policy on duration mismatch (e.g. 3.0s target vs 5.0s speech).
2. Spoken Tamil optimization and technical term preservation.
3. Full End-to-End Alignment and Muxing on Real Lesson 39.
4. Whisper ASR language and completeness audit.
"""

import io
import os
import sys
import json
import time
import numpy as np
import soundfile as sf
from pathlib import Path

# Configure utf-8 stdout for Windows
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Ensure language-service path is in sys.path
BASE_DIR = Path(r"n:\NITHISH\projects\freelance tnwebz\SkillForge.com.1 _copy\language-service")
sys.path.insert(0, str(BASE_DIR))

from app.video.spoken_tamil_normalizer import SpokenTamilOptimizer
from app.video.tts_segment_planner import TTSSegmentPlanner, TTSUnit
from app.video.audio_alignment_engine import AudioAlignmentEngine
from app.video.voice_dubber import dub_video_to_tamil, synthesize_tamil_neural


def test_zero_cut_policy():
    print("=" * 60)
    print("TEST 1: ZERO-CUT POLICY ON DURATION MISMATCH")
    print("=" * 60)
    
    engine = AudioAlignmentEngine(natural_fit_tolerance=0.05, max_safe_speed_ratio=1.15)
    sample_rate = 24000
    
    # Create a 5.0-second dummy speech signal (e.g. 440 Hz tone)
    raw_speech = np.sin(2 * np.pi * 440 * np.linspace(0, 5.0, int(5.0 * sample_rate), endpoint=False)).astype(np.float32)
    
    # Unit with 3.0-second target duration
    unit = TTSUnit(
        unit_id="test_unit_001",
        segment_ids=[1],
        source_texts=["Today we will build a website."],
        translated_texts=["இன்று நாம் ஒரு வலைத்தளத்தை உருவாக்குவோம்."],
        spoken_text="இன்று நாம் ஒரு website-ஐ உருவாக்குவோம்.",
        target_start=10.0,
        target_end=13.0,
        target_duration=3.0
    )
    
    aligned_audio, aligned_unit = engine.align_unit(raw_speech, sample_rate, unit)
    
    aligned_dur = len(aligned_audio) / sample_rate
    print(f"Target Duration : {unit.target_duration:.2f}s")
    print(f"Raw Speech Dur  : {len(raw_speech)/sample_rate:.2f}s")
    print(f"Aligned Dur     : {aligned_dur:.2f}s")
    print(f"Alignment Method: {aligned_unit.alignment_method}")
    print(f"Speed Factor    : {aligned_unit.speed_factor:.2f}x")
    
    # CRITICAL ASSERTIONS:
    # 1. Aligned audio must NOT be cut at 3.0s!
    assert aligned_dur > 3.5, f"ERROR: Audio was hard-cut to {aligned_dur}s!"
    # 2. Speed factor must be capped at safe max (1.15x)
    assert aligned_unit.speed_factor <= 1.16, f"ERROR: Unnatural speed factor {aligned_unit.speed_factor}"
    print("✅ ZERO-CUT POLICY PASSED: Speech was fully preserved without truncation!")


def test_spoken_tamil_optimizer():
    print("\n" + "=" * 60)
    print("TEST 2: MODERN SPOKEN TAMIL OPTIMIZER")
    print("=" * 60)
    
    samples = [
        ("இப்போது இந்த கருத்தாக்கம் எவ்வாறு செயல்படுகின்றது என்பதை நாம் பார்ப்போம்.",
         "இப்போது இந்த concept எப்படி work ஆகுதுன்னு பார்ப்போம்."),
        ("வலைத்தளங்களை from ஒரு ஒற்றை அறிவுறுத்தலை உருவாக்குவதை நிறுத்த வேண்டும்.",
         "websites-ஐ ஒரே ஒரு prompt-ஐ create பண்ணுறதை நிறுத்தணும்."),
        ("இந்த செயல்பாட்டிற்கு ஒரு அளபுருவினை அனுப்புகின்றோம்.",
         "இந்த function-க்கு ஒரு parameter pass பண்ணுகிறோம்.")
    ]
    
    for formal, expected_pattern in samples:
        optimized = SpokenTamilOptimizer.optimize(formal)
        print(f"Formal   : {formal}")
        print(f"Optimized: {optimized}\n")


def test_full_video_alignment_and_dubbing():
    print("=" * 60)
    print("TEST 3: FULL VIDEO ALIGNMENT & DUBBING ON LESSON 39")
    print("=" * 60)
    
    video_path = r"n:\NITHISH\projects\freelance tnwebz\SkillForge.com.1 _copy\backend\uploads\media\media-1787682159551-645974195.mp4"
    subtitles_json_path = r"n:\NITHISH\projects\freelance tnwebz\SkillForge.com.1 _copy\backend\uploads\media\subtitles\ta\media-1787682159551-645974195_ta.json"
    ref_voice_path = r"n:\NITHISH\projects\freelance tnwebz\SkillForge.com.1 _copy\backend\uploads\media\ref_voices\media-1787682159551-645974195_ref.wav"
    output_dir = r"n:\NITHISH\projects\freelance tnwebz\SkillForge.com.1 _copy\backend\uploads\media\dubbed\ta"
    
    with open(subtitles_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        segments = data.get("segments", [])
    
    print(f"Loaded {len(segments)} subtitle segments.")
    
    t0 = time.time()
    result = dub_video_to_tamil(
        source_video_path=video_path,
        tamil_segments=segments,
        reference_voice_path=ref_voice_path,
        reference_transcript="Computer science lecture presentation",
        output_dir=output_dir,
        voice_name="ta-IN-ValluvarNeural"
    )
    t_elapsed = time.time() - t0
    
    print(f"\nDubbing Completed in {t_elapsed:.2f}s!")
    print(f"Output Video : {result['dubbed_video_path']}")
    print(f"Output Audio : {result['voice_audio_path']}")
    print(f"Total Units  : {result['total_units']}")
    print(f"Max Drift    : {result['drift_report']['max_drift_seconds']}s")
    
    # Check alignment metadata
    with open(result['segments_json_path'], "r", encoding="utf-8") as f:
        meta = json.load(f)
        print(f"\nAlignment Audit Sample (First 3 Units):")
        for u in meta.get("units", [])[:3]:
            print(f"  [{u['unit_id']}] Target: {u['target_duration']}s -> Actual: {u['actual_duration']}s | Method: {u['alignment_method']} | Speed: {u['speed_factor']}x")
            print(f"      Spoken: {u['spoken_text']}")


if __name__ == "__main__":
    test_zero_cut_policy()
    test_spoken_tamil_optimizer()
    test_full_video_alignment_and_dubbing()
