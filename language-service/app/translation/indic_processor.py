import re
from typing import List
from sacremoses import MosesPunctNormalizer, MosesTokenizer, MosesDetokenizer
from indicnlp.tokenize import indic_tokenize, indic_detokenize
from indicnlp.normalize.indic_normalize import IndicNormalizerFactory

class IndicProcessor:
    """
    Pure-Python pre/post processor for AI4Bharat IndicTrans2 models.
    Handles punctuation normalization, tokenization, tag injection (<2hin_Deva>),
    and detokenization without requiring compiled C extensions.
    """

    def __init__(self, inference: bool = True):
        self.inference = inference
        self.en_normalizer = MosesPunctNormalizer(lang="en")
        self.en_tokenizer = MosesTokenizer(lang="en")
        self.en_detokenizer = MosesDetokenizer(lang="en")
        self.normalizer_factory = IndicNormalizerFactory()

    def preprocess_batch(self, batch: List[str], src_lang: str = "eng_Latn", tgt_lang: str = "hin_Deva") -> List[str]:
        """
        Preprocesses a batch of source strings:
        1. Normalizes punctuation
        2. Tokenizes
        3. Appends/prepends IndicTrans2 target language tag
        """
        processed_batch = []
        for text in batch:
            cleaned = text.strip()
            if not cleaned:
                processed_batch.append("")
                continue

            if src_lang == "eng_Latn":
                # English normalization and tokenization
                normalized = self.en_normalizer.normalize(cleaned)
                tokens = self.en_tokenizer.tokenize(normalized, return_str=True)
            else:
                # Indic normalization
                lang_code = src_lang.split("_")[0]
                try:
                    normalizer = self.normalizer_factory.get_normalizer(lang_code)
                    normalized = normalizer.normalize(cleaned)
                except Exception:
                    normalized = cleaned
                tokens = indic_tokenize.trivial_tokenize(normalized, lang=lang_code)
                tokens = " ".join(tokens)

            # Format for IndicTrans2: "<2{tgt_lang}> {tokens}" or standard IndicTrans2 format
            tag = f"<2{tgt_lang}>"
            formatted = f"{tag} {tokens}"
            processed_batch.append(formatted)

        return processed_batch

    def postprocess_batch(self, batch: List[str], lang: str = "hin_Deva") -> List[str]:
        """
        Postprocesses a batch of translated strings:
        1. Removes special tags
        2. Detokenizes to natural text
        """
        processed_batch = []
        lang_code = lang.split("_")[0]

        for text in batch:
            cleaned = text.strip()
            # Remove any special tags like <2hin_Deva>, <2eng_Latn>, </s>, <s>, __hin_Deva__, etc.
            cleaned = re.sub(r'<2[a-zA-Z\_]+>', '', cleaned)
            cleaned = re.sub(r'__[a-zA-Z\_]+__', '', cleaned)
            cleaned = cleaned.replace("</s>", "").replace("<s>", "").strip()

            if lang == "eng_Latn":
                detok = self.en_detokenizer.detokenize(cleaned.split())
            else:
                detok = indic_detokenize.trivial_detokenize(cleaned, lang=lang_code)

            processed_batch.append(detok)

        return processed_batch
