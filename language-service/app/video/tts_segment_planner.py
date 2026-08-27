"""
TTS Segment Planner & Grouping Module for SkillForge AI Dubbing
Analyzes subtitle cues and groups adjacent short segments of the same sentence
into coherent TTS units to eliminate fragmented speech and unnatural sentence restarts.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from app.video.spoken_tamil_normalizer import SpokenTamilOptimizer
from app.video.spoken_hindi_normalizer import SpokenHindiOptimizer


@dataclass
class TTSUnit:
    unit_id: str
    segment_ids: List[int]
    source_texts: List[str]
    translated_texts: List[str]
    spoken_text: str
    target_start: float
    target_end: float
    target_duration: float
    pause_after: float = 0.0
    actual_duration: Optional[float] = None
    adjusted_start: Optional[float] = None
    adjusted_end: Optional[float] = None
    alignment_method: Optional[str] = None
    speed_factor: float = 1.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "unit_id": self.unit_id,
            "segment_ids": self.segment_ids,
            "source_texts": self.source_texts,
            "translated_texts": self.translated_texts,
            "spoken_text": self.spoken_text,
            "target_start": round(self.target_start, 3),
            "target_end": round(self.target_end, 3),
            "target_duration": round(self.target_duration, 3),
            "pause_after": round(self.pause_after, 3),
            "actual_duration": round(self.actual_duration, 3) if self.actual_duration is not None else None,
            "adjusted_start": round(self.adjusted_start, 3) if self.adjusted_start is not None else None,
            "adjusted_end": round(self.adjusted_end, 3) if self.adjusted_end is not None else None,
            "alignment_method": self.alignment_method,
            "speed_factor": round(self.speed_factor, 3)
        }


class TTSSegmentPlanner:
    """
    Intelligently groups subtitle segments into natural lecture speech units.
    """

    def __init__(self, max_unit_duration: float = 7.5, max_merge_gap: float = 0.8, max_segments_per_unit: int = 3):
        self.max_unit_duration = max_unit_duration
        self.max_merge_gap = max_merge_gap
        self.max_segments_per_unit = max_segments_per_unit

    def plan_units(self, segments: List[Dict[str, Any]], language: str = "ta") -> List[TTSUnit]:
        """
        Groups raw subtitle segments into coherent TTSUnit instances for target language (hi/ta).
        """
        if not segments:
            return []

        units: List[TTSUnit] = []
        current_group: List[Dict[str, Any]] = []

        def _flush_group(group: List[Dict[str, Any]], unit_index: int) -> TTSUnit:
            seg_ids = [g.get("segment_id", idx) for idx, g in enumerate(group)]
            src_texts = [g.get("source_text", g.get("text", "")).strip() for g in group]
            trans_texts = [g.get("translated_text", g.get("spoken_text", g.get("text", ""))).strip() for g in group]
            
            # Combine texts
            combined_text = " ".join([t for t in trans_texts if t])
            if language == "hi":
                spoken_text = SpokenHindiOptimizer.optimize(combined_text)
            else:
                spoken_text = SpokenTamilOptimizer.optimize(combined_text)
            
            t_start = float(group[0]["start"])
            t_end = float(group[-1]["end"])
            t_dur = max(0.4, t_end - t_start)
            
            return TTSUnit(
                unit_id=f"unit_{unit_index:03d}",
                segment_ids=seg_ids,
                source_texts=src_texts,
                translated_texts=trans_texts,
                spoken_text=spoken_text,
                target_start=t_start,
                target_end=t_end,
                target_duration=t_dur
            )

        for i, seg in enumerate(segments):
            if not current_group:
                current_group.append(seg)
                continue

            prev_seg = current_group[-1]
            prev_end = float(prev_seg["end"])
            curr_start = float(seg["start"])
            curr_end = float(seg["end"])
            gap = max(0.0, curr_start - prev_end)
            
            projected_dur = curr_end - float(current_group[0]["start"])
            
            # Check sentence boundary indicators
            prev_src = prev_seg.get("source_text", prev_seg.get("text", "")).strip()
            ends_sentence = bool(prev_src and prev_src[-1] in {".", "?", "!"})
            
            # Grouping condition:
            # 1. Close together (gap <= max_merge_gap)
            # 2. Total duration fits within max_unit_duration
            # 3. Not exceeding max_segments_per_unit
            # 4. If previous ended with period, only merge if gap is very small (< 0.3s) and duration is short
            can_merge = (
                gap <= self.max_merge_gap and
                projected_dur <= self.max_unit_duration and
                len(current_group) < self.max_segments_per_unit and
                (not ends_sentence or (gap <= 0.3 and projected_dur <= 4.5))
            )

            if can_merge:
                current_group.append(seg)
            else:
                unit = _flush_group(current_group, len(units))
                # Calculate pause to current segment
                unit.pause_after = gap
                units.append(unit)
                current_group = [seg]

        if current_group:
            unit = _flush_group(current_group, len(units))
            units.append(unit)

        # Set pause_after for all units
        for i in range(len(units) - 1):
            units[i].pause_after = max(0.0, units[i+1].target_start - units[i].target_end)

        return units
