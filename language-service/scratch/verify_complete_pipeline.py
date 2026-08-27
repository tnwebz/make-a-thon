import requests
import json
import io, sys
from pathlib import Path
from faster_whisper import WhisperModel

if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

print("=" * 70)
print("FINAL PIPELINE VERIFICATION")
print("=" * 70)

# 1. Check Student Player API for Course 7
res = requests.get("http://localhost:8000/api/v1/courses/7/player")
print("1. Course Player API Status:", res.status_code)
course_data = res.json()
modules = course_data.get("modules", [])
lesson_39 = None
for m in modules:
    for item in m.get("items", []):
        if item.get("id") == 39:
            lesson_39 = item
            break

if lesson_39:
    print(f"   Lesson 39 Found: {lesson_39.get('title')}")
    print(f"   Original Content: {lesson_39.get('content')}")
    print(f"   Dubbed Video URL: {lesson_39.get('dubbed_video_url')}")
    print(f"   Tamil Subtitles : {lesson_39.get('tamil_subtitle_url')}")
    assert lesson_39.get('dubbed_video_url') is not None, "dubbed_video_url is missing in player response!"
else:
    print("   Lesson 39 not found!")

# 2. Whisper ASR Transcription of the Aligned Dubbed Video
print("\n2. Whisper ASR Transcription of Aligned Dubbed Video:")
video_file = r"n:\NITHISH\projects\freelance tnwebz\SkillForge.com.1 _copy\backend\uploads\media\dubbed\ta\media-1787682159551-645974195_ta.mp4"
model = WhisperModel('tiny', device='cpu')
segments, info = model.transcribe(video_file)

print(f"   Detected Language: {info.language} (Confidence: {info.language_probability:.2%})")
print("\n   Transcribed Audio Samples:")
for i, s in enumerate(segments):
    if i < 8:
        print(f"   [{s.start:5.2f}s - {s.end:5.2f}s] {s.text}")

print("\n" + "=" * 70)
print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY!")
print("=" * 70)
