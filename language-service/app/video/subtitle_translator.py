"""
Subtitle Translator & Formatter Module
Translates English transcript segments into Indic languages (Hindi, Tamil)
using IndicTrans2 and formats them into standard WebVTT and structured JSON.
"""

import json
import math
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.config import LANGUAGES
from app.translation.indictrans_service import IndicTransService


def format_timestamp_vtt(seconds: float) -> str:
    """
    Converts seconds (float) into WebVTT timestamp format: HH:MM:SS.mmm
    Example: 83.456 -> 00:01:23.456
    """
    if seconds < 0:
        seconds = 0.0

    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        millis = 999

    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


class SubtitleTranslator:
    """
    Translates transcript segments and generates production-ready WebVTT and JSON transcripts.
    """

    def __init__(self):
        self.translation_service = IndicTransService.get_instance()

    def translate_segments(
        self,
        segments: List[Dict[str, Any]],
        target_language: str = "hi",
        batch_size: int = 16
    ) -> List[Dict[str, Any]]:
        """
        Translates a list of transcript segment texts to the target language.

        Args:
            segments: List of segment dicts with 'text', 'start', 'end', 'segment_id'.
            target_language: "hi" (Hindi) or "ta" (Tamil).
            batch_size: Translation chunk batch size.

        Returns:
            Enhanced list of segment dicts with 'translated_text'.
        """
        if not segments:
            return []

        lang_meta = LANGUAGES.get(target_language, LANGUAGES["hi"])
        tgt_indic_code = lang_meta.get("indicCode", "hin_Deva")

        source_texts = [seg["text"] for seg in segments]
        print(f"[SubtitleTranslator] Batch translating {len(source_texts)} segments to {lang_meta['name']} ({tgt_indic_code})...")

        translated_texts = self.translation_service.translate_batch(
            source_texts,
            src_lang="eng_Latn",
            tgt_lang=tgt_indic_code,
            batch_size=batch_size
        )

        translated_segments = []
        for idx, seg in enumerate(segments):
            translated_text = translated_texts[idx] if idx < len(translated_texts) else seg["text"]
            translated_segments.append({
                "segment_id": seg.get("segment_id", idx),
                "start": seg["start"],
                "end": seg["end"],
                "source_text": seg["text"],
                "translated_text": translated_text
            })

        print(f"[SubtitleTranslator] [OK] Successfully translated {len(translated_segments)} subtitle segments.")
        return translated_segments

    def generate_vtt(
        self,
        translated_segments: List[Dict[str, Any]],
        output_vtt_path: str,
        title: Optional[str] = None
    ) -> str:
        """
        Generates a standard WebVTT (.vtt) file from translated segments.

        Args:
            translated_segments: List of dicts with 'start', 'end', 'translated_text'.
            output_vtt_path: Path where .vtt file will be saved.
            title: Optional header title for the WebVTT file.

        Returns:
            Absolute path to the generated .vtt file.
        """
        out_p = Path(output_vtt_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)

        lines = ["WEBVTT", ""]
        if title:
            lines.append(f"NOTE SkillForge AI Generated Subtitles: {title}")
            lines.append("")

        for idx, seg in enumerate(translated_segments):
            cue_num = idx + 1
            start_str = format_timestamp_vtt(seg["start"])
            end_str = format_timestamp_vtt(seg["end"])
            text = seg.get("translated_text", seg.get("source_text", "")).strip()

            lines.append(str(cue_num))
            lines.append(f"{start_str} --> {end_str}")
            lines.append(text)
            lines.append("")  # Empty line between cues

        vtt_content = "\n".join(lines)
        with open(out_p, "w", encoding="utf-8") as f:
            f.write(vtt_content)

        print(f"[SubtitleTranslator] [OK] Generated WebVTT file: {out_p.name} ({len(translated_segments)} cues)")
        return str(out_p)

    def generate_json_transcript(
        self,
        translated_segments: List[Dict[str, Any]],
        output_json_path: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generates structured JSON transcript for future TTS alignment and player indexing.

        Args:
            translated_segments: List of translated segments.
            output_json_path: Path where .json file will be saved.
            metadata: Optional extra fields (course_id, content_item_id, etc.).

        Returns:
            Absolute path to the generated JSON file.
        """
        out_p = Path(output_json_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)

        total_duration = 0.0
        if translated_segments:
            total_duration = max(seg["end"] for seg in translated_segments)

        payload = {
            "version": "1.0",
            "metadata": metadata or {},
            "total_segments": len(translated_segments),
            "duration_seconds": round(total_duration, 3),
            "segments": translated_segments
        }

        with open(out_p, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

        print(f"[SubtitleTranslator] [OK] Saved JSON transcript: {out_p.name}")
        return str(out_p)
