import os
import sys
import torch
import soundfile as sf
import numpy as np
from safetensors.torch import load_file
from huggingface_hub import hf_hub_download
from f5_tts.model import DiT
from f5_tts.infer.utils_infer import load_model, load_vocoder, infer_process, preprocess_ref_audio_text

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Device: {device}", flush=True)

print("Downloading/locating model.safetensors from dheeyantra/dhee-indic-f5...", flush=True)
ckpt_path = hf_hub_download(repo_id="dheeyantra/dhee-indic-f5", filename="model.safetensors")
print(f"Checkpoint path: {ckpt_path}", flush=True)

# Load Vocoder (Vocos)
print("Loading vocoder...", flush=True)
vocoder = load_vocoder(vocoder_name="vocos", is_local=False)

# DiT model configuration for IndicF5 (dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512, conv_layers=4)
print("Loading DiT model architecture & checkpoint...", flush=True)
model_cls = DiT
model_cfg = dict(dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512, conv_layers=4)

vocab_path = os.path.abspath("language-service/models/vocab.txt")
model = load_model(
    model_cls,
    model_cfg,
    mel_spec_type="vocos",
    vocab_file=vocab_path,
    ode_method="euler",
    use_ema=True,
    device=device
)

# Load state dict directly from safetensors
ckpt = load_file(ckpt_path, device=device)
ema_state = {k.replace("ema_model.", ""): v for k, v in ckpt.items() if k.startswith("ema_model.")}
missing, unexpected = model.load_state_dict(ema_state, strict=False)
print(f"Model loaded! Missing keys: {len(missing)}, Unexpected keys: {len(unexpected)}", flush=True)
print("IndicF5 model successfully loaded onto GPU!", flush=True)

# Create dummy reference audio 24kHz mono (3 seconds of speech/tone)
test_ref_path = "test_ref.wav"
sr = 24000
t = np.linspace(0, 3, 3 * sr, False)
tone = 0.1 * np.sin(2 * np.pi * 440 * t).astype(np.float32)
sf.write(test_ref_path, tone, sr)

ref_text = "This is an introductory lecture about computer science."
gen_text = "வணக்கம், நாம் இப்போது ஜாவா நிரலாக்கத்தைப் பற்றிப் பார்ப்போம்."

print("Running test inference with cross-lingual English reference audio & Tamil text...", flush=True)
ref_audio, clean_ref_text = preprocess_ref_audio_text(test_ref_path, ref_text)

audio, final_sr, spect = infer_process(
    ref_audio,
    clean_ref_text,
    gen_text,
    model,
    vocoder,
    mel_spec_type="vocos",
    speed=1.0,
    nfe_step=16,
    cfg_strength=2.0,
    target_rms=0.1,
    device=device
)

out_test_wav = "test_indicf5_out.wav"
sf.write(out_test_wav, audio, final_sr)
print(f"Inference succeeded! Generated audio written to {out_test_wav}, length: {len(audio)/final_sr:.2f}s, sample rate: {final_sr}Hz", flush=True)
