import requests
import json

def test_hindi_preview():
    url = "http://localhost:8001/api/voice/preview"
    payload = {
        "source_video_path": "n:/NITHISH/projects/freelance tnwebz/SkillForge.com.1 _copy/backend/uploads/media/media-1787682159551-645974195.mp4",
        "target_language": "hi",
        "reference_voice_path": "n:/NITHISH/projects/freelance tnwebz/SkillForge.com.1 _copy/backend/uploads/media/ref_voices/media-1787682159551-645974195_ref.wav",
        "reference_transcript": "Computer science lecture presentation",
        "course_id": 7,
        "content_item_id": 39
    }
    print("Testing POST /api/voice/preview (target_language=hi)...")
    res = requests.post(url, json=payload, timeout=60)
    print("Status:", res.status_code)
    print("Response:", json.dumps(res.json(), indent=2))
    assert res.status_code == 200
    assert "preview_video_url" in res.json()
    print(">> HINDI PREVIEW API TEST PASSED!")

if __name__ == "__main__":
    test_hindi_preview()
