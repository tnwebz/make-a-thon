"""
Speech-to-Text Transcriber Module
Transcribes English audio into timestamped segments using faster-whisper.
Optimized for RTX 4050 GPU (float16 / int8 fallback) with local model caching.
"""

import os
import sys
import torch
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.config import (
    MODELS_DIR,
    WHISPER_MODEL_SIZE,
    WHISPER_DEVICE,
    WHISPER_COMPUTE_TYPE
)


class Transcriber:
    """
    Singleton Faster-Whisper ASR engine for English audio transcription.
    Preserves exact timing, segment boundaries, and transcript metadata.
    """
    _instance: Optional['Transcriber'] = None

    def __init__(self):
        self.model_size = WHISPER_MODEL_SIZE
        self.models_cache_dir = MODELS_DIR / "whisper"
        self.models_cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Determine device and compute type
        if torch.cuda.is_available() and WHISPER_DEVICE != "cpu":
            self.device = "cuda"
            self.compute_type = "float16"
        else:
            self.device = "cpu"
            self.compute_type = "int8"

        self.model = None
        self._load_model()

    @classmethod
    def get_instance(cls) -> 'Transcriber':
        if cls._instance is None:
            cls._instance = Transcriber()
        return cls._instance

    def _load_model(self):
        """
        Loads the faster-whisper model into GPU/CPU memory with singleton caching.
        """
        try:
            from faster_whisper import WhisperModel

            local_model_dir = self.models_cache_dir / "small.en"
            model_target = str(local_model_dir) if (local_model_dir / "model.bin").exists() else self.model_size

            print(f"[Transcriber] Initializing Faster-Whisper model from '{model_target}'...")
            print(f"[Transcriber] Device: {self.device.upper()}, Compute Type: {self.compute_type}")
            if self.device == "cuda":
                print(f"[Transcriber] GPU: {torch.cuda.get_device_name(0)}")

            self.model = WhisperModel(
                model_target,
                device=self.device,
                compute_type=self.compute_type,
                download_root=str(self.models_cache_dir)
            )
            print(f"[Transcriber] [OK] Faster-Whisper model loaded successfully.")

        except Exception as e:
            print(f"[Transcriber] [WARN] Failed loading on {self.device} ({e}). Retrying on CPU (int8)...")
            try:
                from faster_whisper import WhisperModel
                self.device = "cpu"
                self.compute_type = "int8"
                local_model_dir = self.models_cache_dir / "small.en"
                model_target = str(local_model_dir) if (local_model_dir / "model.bin").exists() else self.model_size
                self.model = WhisperModel(
                    model_target,
                    device="cpu",
                    compute_type="int8",
                    download_root=str(self.models_cache_dir)
                )
                print(f"[Transcriber] [OK] Faster-Whisper model loaded on CPU.")
            except Exception as cpu_e:
                print(f"[Transcriber] [ERROR] Failed to load Faster-Whisper model: {cpu_e}")
                raise cpu_e


    def transcribe(
        self,
        audio_path: str,
        beam_size: int = 5,
        vad_filter: bool = True,
        language: str = "en"
    ) -> List[Dict[str, Any]]:
        """
        Transcribes audio into timestamped segments.

        Args:
            audio_path: Path to WAV audio file.
            beam_size: Beam search width (default 5).
            vad_filter: Enable Voice Activity Detection to skip silence (default True).
            language: Speech language code (default "en").

        Returns:
            List of segment dicts:
            [
                {
                    "segment_id": 0,
                    "start": 0.0,
                    "end": 3.42,
                    "text": "Welcome to object oriented programming."
                }, ...
            ]
        """
        if not Path(audio_path).exists():
            raise FileNotFoundError(f"Audio file not found at: {audio_path}")

        if self.model is None:
            self._load_model()

        print(f"[Transcriber] Transcribing audio: {Path(audio_path).name}...")

        try:
            segments_gen, info = self.model.transcribe(
                audio_path,
                beam_size=beam_size,
                language=language,
                vad_filter=vad_filter,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    speech_pad_ms=200
                ),
                word_timestamps=False
            )

            print(f"[Transcriber] Audio duration: {info.duration:.2f}s, Language: {info.language} (prob: {info.language_probability:.2f})")

            results = []
            for idx, seg in enumerate(segments_gen):
                clean_text = seg.text.strip()
                if clean_text:
                    results.append({
                        "segment_id": idx,
                        "start": round(seg.start, 3),
                        "end": round(seg.end, 3),
                        "text": clean_text
                    })

            print(f"[Transcriber] [OK] Transcription complete: {len(results)} segments generated.")
            return results

        except Exception as e:
            print(f"[Transcriber] [ERROR] Transcription failed: {e}")
            raise e
