import requests
import json

url = "http://127.0.0.1:8001/api/voice/preview"
payload = {
    "source_video_path": r"n:\NITHISH\projects\freelance tnwebz\SkillForge.com.1 _copy\backend\uploads\media\media-1787682159551-645974195.mp4",
    "reference_voice_path": r"n:\NITHISH\projects\freelance tnwebz\SkillForge.com.1 _copy\backend\uploads\media\ref_voices\media-1787682159551-645974195_ref.wav",
    "reference_transcript": "Computer science lecture presentation",
    "course_id": 7,
    "content_item_id": 39
}

print("Requesting voice preview...")
resp = requests.post(url, json=payload, timeout=60)
print("Status Code:", resp.status_code)
print("Response:", resp.json())
