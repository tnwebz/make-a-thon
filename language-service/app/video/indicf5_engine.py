"""
IndicF5 Voice Synthesis Engine for SkillForge
Manages model lifecycle, GPU caching, and cross-lingual reference-conditioned TTS inference.
"""

import os
import logging
import threading
import torch
import numpy as np
from typing import Tuple, Optional
from safetensors.torch import load_file
from huggingface_hub import hf_hub_download
from f5_tts.model import DiT
from f5_tts.infer.utils_infer import load_model, load_vocoder, infer_process, preprocess_ref_audio_text

logger = logging.getLogger("indicf5_engine")


class IndicF5Engine:
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = None
        self.vocoder = None
        self.sample_rate = 24000
        self.is_loaded = False
        self.model_repo = "dheeyantra/dhee-indic-f5"
        self.checkpoint_filename = "model.safetensors"

    @classmethod
    def get_instance(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def load(self, repo_id: Optional[str] = None):
        """Loads model and vocoder onto GPU if not already loaded."""
        if self.is_loaded and self.model is not None:
            return

        with self._lock:
            if self.is_loaded and self.model is not None:
                return

            target_repo = repo_id or self.model_repo
            logger.info(f"Loading IndicF5 model from {target_repo} on device: {self.device}...")

            # 1. Download/locate checkpoint
            ckpt_path = hf_hub_download(repo_id=target_repo, filename=self.checkpoint_filename)
            logger.info(f"Found checkpoint at: {ckpt_path}")

            # 2. Load Vocos vocoder
            self.vocoder = load_vocoder(vocoder_name="vocos", is_local=False)

            # 3. Locate vocab.txt
            vocab_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "models", "vocab.txt"))
            if not os.path.exists(vocab_path):
                # Fallback to downloading or standard path
                vocab_path = hf_hub_download(repo_id="SWivid/F5-TTS", filename="F5TTS_v1_Base/vocab.txt")

            # 4. Load DiT architecture
            model_cls = DiT
            model_cfg = dict(dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512, conv_layers=4)

            base_model = load_model(
                model_cls,
                model_cfg,
                mel_spec_type="vocos",
                vocab_file=vocab_path,
                ode_method="euler",
                use_ema=True,
                device=self.device
            )

            # 5. Load weights directly from safetensors with ema_model mapping
            ckpt = load_file(ckpt_path, device=self.device)
            ema_state = {k.replace("ema_model.", ""): v for k, v in ckpt.items() if k.startswith("ema_model.")}
            missing, unexpected = base_model.load_state_dict(ema_state, strict=False)
            logger.info(f"IndicF5 weights loaded! Missing: {len(missing)}, Unexpected: {len(unexpected)}")

            self.model = base_model
            self.is_loaded = True
            logger.info("IndicF5 model and vocoder successfully initialized on GPU.")

    def synthesize(
        self,
        text: str,
        ref_audio_path: str,
        ref_text: str,
        speed: float = 1.0,
        target_duration: Optional[float] = None,
        nfe_step: int = 32,
        cfg_strength: float = 2.0,
        target_rms: float = 0.1
    ) -> Tuple[np.ndarray, int]:
        """
        Synthesizes spoken Tamil audio matching the reference professor's voice.
        Returns: (audio_waveform_numpy, sample_rate)
        """
        if not self.is_loaded:
            self.load()

        if not text or not text.strip():
            # Return 0.1s silence
            return np.zeros(int(0.1 * self.sample_rate), dtype=np.float32), self.sample_rate

        # Preprocess reference audio and text
        ref_audio, clean_ref_text = preprocess_ref_audio_text(ref_audio_path, ref_text)

        # Get exact reference audio duration
        ref_dur = 5.0
        try:
            import soundfile as sf
            ref_info = sf.info(ref_audio)
            ref_dur = ref_info.duration
        except Exception:
            pass

        # Calculate exact fix_duration to prevent Tamil multi-byte character inflation
        # Tamil speech naturally proceeds at ~13-16 characters per second
        if target_duration is not None and target_duration > 0:
            fix_dur = float(ref_dur + max(0.5, target_duration))
        else:
            est_speech_dur = max(1.2, len(text.strip()) / 14.0)
            fix_dur = float(ref_dur + est_speech_dur)

        # Run diffusion inference
        audio, final_sr, _ = infer_process(
            ref_audio,
            clean_ref_text,
            text,
            self.model,
            self.vocoder,
            mel_spec_type="vocos",
            speed=speed,
            nfe_step=nfe_step,
            cfg_strength=cfg_strength,
            target_rms=target_rms,
            fix_duration=fix_dur,
            device=self.device
        )

        return audio, final_sr


# Global accessor
def get_voice_engine() -> IndicF5Engine:
    return IndicF5Engine.get_instance()
