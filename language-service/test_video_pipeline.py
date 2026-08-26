import os
import sys

# Configure UTF-8 stdout
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from pathlib import Path

# Add language-service root to sys.path
sys.path.insert(0, str(Path(__file__).parent.resolve()))

from app.video.audio_extractor import extract_audio, cleanup_audio, check_ffmpeg_available
from app.video.transcriber import Transcriber
from app.video.subtitle_translator import SubtitleTranslator
from app.video.subtitle_processor import SubtitleProcessor

def run_test():
    print("=== 1. Check FFmpeg ===")
    has_ffmpeg = check_ffmpeg_available()
    print(f"FFmpeg available: {has_ffmpeg}")
    assert has_ffmpeg, "FFmpeg must be available"

    test_video = r"n:\NITHISH\projects\freelance tnwebz\SkillForge.com.1 _copy\backend\uploads\media\migrated-8-1787039647101.mp4"
    print(f"\n=== 2. Testing End-to-End SubtitleProcessor on: {test_video} ===")

    processor = SubtitleProcessor()
    
    # Process for Hindi
    print("\n--- Generating Hindi Subtitles ---")
    res_hi = processor.process_single_video(
        source_video_path=test_video,
        target_language="hi",
        document_title="Lecture Video Test",
        content_item_id=8,
        course_id=4
    )
    print(f"Hindi Result: {res_hi}")
    print(f"VTT exists: {Path(res_hi['vtt_absolute_path']).exists()}")
    print(f"VTT size: {Path(res_hi['vtt_absolute_path']).stat().st_size} bytes")
    
    # Print first few lines of Hindi VTT
    with open(res_hi['vtt_absolute_path'], 'r', encoding='utf-8') as f:
        print("VTT Preview:")
        for _ in range(15):
            line = f.readline()
            if not line: break
            print("  ", line.strip())

    # Process for Tamil
    print("\n--- Generating Tamil Subtitles ---")
    res_ta = processor.process_single_video(
        source_video_path=test_video,
        target_language="ta",
        document_title="Lecture Video Test",
        content_item_id=8,
        course_id=4
    )
    print(f"Tamil Result: {res_ta}")
    print(f"VTT exists: {Path(res_ta['vtt_absolute_path']).exists()}")
    
    with open(res_ta['vtt_absolute_path'], 'r', encoding='utf-8') as f:
        print("Tamil VTT Preview:")
        for _ in range(15):
            line = f.readline()
            if not line: break
            print("  ", line.strip())

    print("\n✅ ALL VIDEO SUBTITLE PIPELINE TESTS PASSED!")

if __name__ == "__main__":
    run_test()
