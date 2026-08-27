import os
import sys
import torch

print(f"Python: {sys.version}")
print(f"PyTorch: {torch.__version__}, CUDA available: {torch.cuda.is_available()}")
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

try:
    print("Testing AutoModel.from_pretrained('ai4bharat/IndicF5', trust_remote_code=True)...")
    from transformers import AutoModel
    model = AutoModel.from_pretrained("ai4bharat/IndicF5", trust_remote_code=True)
    print("Successfully loaded AutoModel('ai4bharat/IndicF5')!")
except Exception as e:
    print(f"AutoModel loading exception: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
