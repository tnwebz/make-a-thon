import os
import sys
from pathlib import Path

# Configure UTF-8 encoding for Windows terminals
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

import torch
from typing import List, Dict, Optional
from transformers import AutoModelForSeq2SeqLM

# Add tokenizer path
TOKENIZER_DIR = Path(__file__).parent.parent.parent / "models" / "tokenizer"
if str(TOKENIZER_DIR) not in sys.path:
    sys.path.insert(0, str(TOKENIZER_DIR))

from IndicTransTokenizer.tokenizer import IndicTransTokenizer
from IndicTransTokenizer.utils import preprocess_batch, postprocess_batch
from app.config import MODEL_NAME, DEFAULT_SRC_LANG, DEFAULT_TGT_LANG, MODELS_DIR
from app.translation.glossary import GlossaryProtector

class IndicTransService:
    """
    AI4Bharat IndicTrans2 Neural Machine Translation Service.
    Supports GPU CUDA acceleration with CPU fallback, batch inference,
    singleton model caching, and technical term / code protection.
    """
    _instance: Optional['IndicTransService'] = None

    def __init__(self):
        self.model_name = MODEL_NAME
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.glossary = GlossaryProtector()
        
        print(f"[LanguageService] Initializing IndicTransService on device: {self.device.upper()}...")
        if self.device == "cuda":
            print(f"[LanguageService] GPU Device: {torch.cuda.get_device_name(0)}")
        
        self.tokenizer = None
        self.model = None
        self._load_model()

    @classmethod
    def get_instance(cls) -> 'IndicTransService':
        if cls._instance is None:
            cls._instance = IndicTransService()
        return cls._instance

    def _load_model(self):
        """
        Loads IndicTrans2 tokenizer and model.
        Model is loaded once and cached in local memory.
        """
        try:
            print(f"[LanguageService] Loading IndicTransTokenizer for direction en-indic...")
            self.tokenizer = IndicTransTokenizer(direction="en-indic")
            print("[LanguageService] IndicTransTokenizer loaded successfully.")

            local_dir = Path(__file__).parent.parent.parent / "models" / "indictrans2-en-indic-dist-200M"
            model_target = str(local_dir) if (local_dir / "pytorch_model.bin").exists() else self.model_name

            print(f"[LanguageService] Loading model from {model_target}...")
            self.model = AutoModelForSeq2SeqLM.from_pretrained(
                model_target,
                trust_remote_code=True,
                torch_dtype=torch.float32,
                cache_dir=str(MODELS_DIR)
            ).to(self.device)

            self.model.eval()
            print(f"[LanguageService] [OK] IndicTrans2 model loaded successfully on {self.device.upper()}.")

        except Exception as e:
            print(f"[LanguageService] [ERROR] Failed to load IndicTrans2 model: {e}")
            raise e

    def translate(self, text: str, src_lang: str = DEFAULT_SRC_LANG, tgt_lang: str = DEFAULT_TGT_LANG) -> str:
        """
        Translates a single string from source to target language.
        """
        if not text or not text.strip():
            return text
        results = self.translate_batch([text], src_lang=src_lang, tgt_lang=tgt_lang)
        return results[0] if results else text

    def translate_batch(
        self,
        texts: List[str],
        src_lang: str = DEFAULT_SRC_LANG,
        tgt_lang: str = DEFAULT_TGT_LANG,
        batch_size: int = 16
    ) -> List[str]:
        """
        Translates a batch of texts with glossary protection and model chunking.
        """
        if not texts:
            return []

        # 1. Protect code, URLs, and technical terms
        protected_texts = []
        placeholder_maps = []
        for t in texts:
            if not t.strip():
                protected_texts.append("")
                placeholder_maps.append({})
            else:
                prot_t, ph_map = self.glossary.protect_text(t)
                protected_texts.append(prot_t)
                placeholder_maps.append(ph_map)

        # 2. Batch Inference
        translated_raw = []
        for i in range(0, len(protected_texts), batch_size):
            chunk = protected_texts[i:i + batch_size]
            chunk_results = self._infer_chunk(chunk, src_lang, tgt_lang)
            translated_raw.extend(chunk_results)
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        # 3. Restore protected tokens
        final_translations = []
        for i, raw_trans in enumerate(translated_raw):
            restored = self.glossary.restore_text(raw_trans, placeholder_maps[i])
            final_translations.append(restored)

        return final_translations

    def _infer_chunk(self, chunk: List[str], src_lang: str, tgt_lang: str) -> List[str]:
        """
        Runs model inference on a chunk of sentences.
        """
        valid_indices = [idx for idx, t in enumerate(chunk) if t.strip()]
        if not valid_indices:
            return chunk

        valid_texts = [chunk[idx] for idx in valid_indices]

        try:
            # Official IndicTrans2 preprocessing
            tagged_texts, entity_map = preprocess_batch(valid_texts, src_lang=src_lang, tgt_lang=tgt_lang)

            inputs = self.tokenizer(
                tagged_texts,
                src=True,
                padding="longest",
                truncation=True,
                max_length=512,
                return_tensors="pt"
            ).to(self.device)

            with torch.inference_mode():
                generated_tokens = self.model.generate(
                    **inputs,
                    num_beams=2,
                    max_new_tokens=256,
                    use_cache=True,
                    early_stopping=True
                )

            decoded = self.tokenizer.batch_decode(generated_tokens.tolist(), src=False)
            postprocessed = postprocess_batch(decoded, lang=tgt_lang, placeholder_entity_map=entity_map)

            # Recombine with original positions
            results = list(chunk)
            for idx, post_text in zip(valid_indices, postprocessed):
                results[idx] = post_text.strip()

            return results

        except Exception as e:
            print(f"[LanguageService] Error during batch translation inference: {e}")
            return chunk
