"""
Subtitle Processor Orchestrator Module
Orchestrates English video audio extraction, ASR transcription, neural machine translation,
and generation of synchronized WebVTT subtitles & JSON transcripts.
"""

import os
import sys
import time
import requests
from pathlib import Path
from typing import Dict, Any, List, Optional

# Windows terminal UTF-8 encoding configuration
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from app.config import (
    BACKEND_UPLOADS_DIR,
    HINDI_SUBTITLES_DIR,
    TAMIL_SUBTITLES_DIR,
    BACKEND_API_URL,
    LANGUAGES
)
from app.video.audio_extractor import extract_audio, cleanup_audio
from app.video.transcriber import Transcriber
from app.video.subtitle_translator import SubtitleTranslator


class SubtitleProcessor:
    """
    End-to-End Orchestrator for Multilingual Video Subtitle Generation.
    Stage 1: English Video -> Timestamped Hindi/Tamil Subtitles (WebVTT + JSON).
    """

    def __init__(self):
        self.transcriber = Transcriber.get_instance()
        self.subtitle_translator = SubtitleTranslator()

    def process_single_video(
        self,
        source_video_path: str,
        output_vtt_name: Optional[str] = None,
        target_language: str = "hi",
        document_title: Optional[str] = None,
        content_item_id: Optional[int] = None,
        course_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Processes a single English video into a localized subtitle (.vtt + .json) file.

        Args:
            source_video_path: Path or /uploads/media/ URL to MP4 file.
            output_vtt_name: Optional filename for the output VTT.
            target_language: "hi" (Hindi) or "ta" (Tamil).
            document_title: Optional title of the video lesson.
            content_item_id: Database content item ID.
            course_id: Course ID.

        Returns:
            Dict with success, relative web paths, segment count, duration.
        """
        lang_meta = LANGUAGES.get(target_language, LANGUAGES["hi"])
        target_subtitles_dir = lang_meta.get("subtitles_dir", HINDI_SUBTITLES_DIR)
        target_subtitles_dir.mkdir(parents=True, exist_ok=True)

        video_path = Path(source_video_path)
        if not video_path.exists():
            relative_clean = source_video_path.replace("/uploads/media/", "").replace("uploads/media/", "").lstrip("/\\")
            candidate = BACKEND_UPLOADS_DIR / relative_clean
            if candidate.exists():
                video_path = candidate
            else:
                raise FileNotFoundError(f"Source video not found at {source_video_path}")

        stem = video_path.stem
        if not output_vtt_name:
            output_vtt_name = f"{stem}_{target_language}.vtt"
        elif not output_vtt_name.endswith(".vtt"):
            output_vtt_name = f"{output_vtt_name}.vtt"

        json_name = output_vtt_name.replace(".vtt", ".json")
        out_vtt_path = target_subtitles_dir / output_vtt_name
        out_json_path = target_subtitles_dir / json_name

        print(f"[SubtitleProcessor] Processing video for {lang_meta['name']} subtitles: {video_path.name}")
        audio_wav_path = None

        try:
            # Step 1: Extract 16kHz mono audio
            audio_wav_path = extract_audio(str(video_path))

            # Step 2: Transcribe via Faster-Whisper
            raw_segments = self.transcriber.transcribe(audio_wav_path, beam_size=5, vad_filter=True)

            if not raw_segments:
                print(f"[SubtitleProcessor] [WARN] No speech detected in {video_path.name}. Creating empty VTT.")
                raw_segments = []

            # Step 3: Neural machine translation
            translated_segments = self.subtitle_translator.translate_segments(
                raw_segments,
                target_language=target_language,
                batch_size=16
            )

            # Step 4: Generate WebVTT & JSON transcript
            self.subtitle_translator.generate_vtt(
                translated_segments,
                str(out_vtt_path),
                title=document_title or video_path.stem
            )

            metadata = {
                "course_id": course_id,
                "content_item_id": content_item_id,
                "video_file": video_path.name,
                "language_code": target_language
            }
            self.subtitle_translator.generate_json_transcript(
                translated_segments,
                str(out_json_path),
                metadata=metadata
            )

            relative_vtt_url = f"/uploads/media/subtitles/{target_language}/{out_vtt_path.name}"
            relative_json_url = f"/uploads/media/subtitles/{target_language}/{out_json_path.name}"
            total_duration = max([s["end"] for s in translated_segments]) if translated_segments else 0.0

            print(f"[SubtitleProcessor] [OK] Successfully generated subtitles: {relative_vtt_url} ({len(translated_segments)} segments)")

            return {
                "success": True,
                "language_code": target_language,
                "content_item_id": content_item_id,
                "vtt_url": relative_vtt_url,
                "vtt_absolute_path": str(out_vtt_path),
                "transcript_url": relative_json_url,
                "transcript_absolute_path": str(out_json_path),
                "segment_count": len(translated_segments),
                "duration_seconds": round(total_duration, 2),
                "segments": translated_segments
            }

        finally:
            # Step 5: Clean up temporary WAV audio file
            if audio_wav_path:
                cleanup_audio(audio_wav_path)

    def process_course_video_assets(
        self,
        course_id: int,
        course_title: str,
        video_assets: List[Dict[str, Any]],
        target_language: str = "hi",
        callback_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sequentially generates subtitles for all video lessons in a course and sends live updates.

        Args:
            course_id: ID of the course.
            course_title: Title of the course.
            video_assets: List of dicts: [ { "content_item_id": 1, "title": "Intro", "source_url": "/uploads/media/xxx.mp4", "module_title": "M1" } ]
            target_language: Target language code ("hi", "ta").
            callback_url: Backend webhook URL for progress callbacks.
        """
        lang_meta = LANGUAGES.get(target_language, LANGUAGES["hi"])
        lang_name = lang_meta.get("name", "Hindi")
        total_videos = len(video_assets)

        print(f"[SubtitleProcessor] Starting {lang_name} video subtitle pipeline for Course {course_id} ('{course_title}') with {total_videos} video assets.")

        if total_videos == 0:
            payload = {
                "course_id": course_id,
                "language_code": target_language,
                "status": "READY",
                "progress": 100,
                "total_videos": 0,
                "completed_videos": 0,
                "results": []
            }
            self._notify_backend(callback_url, target_language, payload)
            return payload

        completed_videos = 0
        results = []
        failed_videos = []

        for idx, asset in enumerate(video_assets):
            item_id = asset.get("content_item_id")
            source_url = asset.get("source_url")
            asset_title = asset.get("title", "Video Lesson")
            module_title = asset.get("module_title", "Module")

            current_progress = int((completed_videos / total_videos) * 100)
            self._notify_backend(callback_url, target_language, {
                "course_id": course_id,
                "language_code": target_language,
                "status": "GENERATING",
                "progress": current_progress,
                "total_videos": total_videos,
                "completed_videos": completed_videos,
                "current_file": f"{module_title} / {asset_title} (Subtitles)"
            })

            try:
                res = self.process_single_video(
                    source_video_path=source_url,
                    target_language=target_language,
                    document_title=asset_title,
                    content_item_id=item_id,
                    course_id=course_id
                )

                item_result = {
                    "content_item_id": item_id,
                    "title": asset_title,
                    "vtt_path": res["vtt_url"],
                    "transcript_path": res["transcript_url"],
                    "segment_count": res["segment_count"],
                    "duration_seconds": res["duration_seconds"],
                    "status": "READY"
                }
                results.append(item_result)
                completed_videos += 1

                step_progress = int((completed_videos / total_videos) * 100)
                self._notify_backend(callback_url, target_language, {
                    "course_id": course_id,
                    "language_code": target_language,
                    "status": "GENERATING" if completed_videos < total_videos else "READY",
                    "progress": step_progress,
                    "total_videos": total_videos,
                    "completed_videos": completed_videos,
                    "current_file": f"{module_title} / {asset_title} (Subtitles)",
                    "results": results
                })

            except Exception as err:
                print(f"[SubtitleProcessor] [ERROR] Failed subtitle generation for asset {item_id} ({source_url}): {err}")
                failed_videos.append({
                    "content_item_id": item_id,
                    "error": str(err),
                    "status": "FAILED"
                })
                results.append({
                    "content_item_id": item_id,
                    "status": "FAILED",
                    "error": str(err)
                })

        final_status = "READY" if completed_videos > 0 and len(failed_videos) == 0 else ("FAILED" if completed_videos == 0 else "PARTIAL")

        final_payload = {
            "course_id": course_id,
            "language_code": target_language,
            "status": "READY" if final_status in ["READY", "PARTIAL"] else "FAILED",
            "progress": 100 if final_status == "READY" else int((completed_videos / total_videos) * 100),
            "total_videos": total_videos,
            "completed_videos": completed_videos,
            "failed_videos": len(failed_videos),
            "results": results
        }

        self._notify_backend(callback_url, target_language, final_payload)
        return final_payload

    def _notify_backend(self, callback_url: Optional[str], target_language: str, payload: Dict[str, Any]):
        """
        Sends progress notifications and result payloads back to Node.js backend.
        """
        url = callback_url or f"{BACKEND_API_URL}/courses/{payload.get('course_id')}/subtitles/{target_language}/progress"
        try:
            requests.post(url, json=payload, timeout=5)
        except Exception:
            pass
