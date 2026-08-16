from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image
import torch
import math

print("Loading processor and model (this might take a bit if it's the first time downloading)...")
processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten")

image_path = r"C:\Users\sankr\.gemini\antigravity-ide\brain\52e1235b-b631-4a22-92b0-f61b39a82ed6\.user_uploaded\media_1786889712569.jpg"
image = Image.open(image_path).convert("RGB")

print("Processing image...")
pixel_values = processor(image, return_tensors="pt").pixel_values

print("Generating text with output_scores=True...")
outputs = model.generate(
    pixel_values,
    return_dict_in_generate=True,
    output_scores=True,
    max_new_tokens=40
)

# Decode text
generated_text = processor.batch_decode(outputs.sequences, skip_special_tokens=True)[0]

# Calculate confidence score
# output.scores is a tuple of tensors, one for each generated token
# Each tensor is shape (batch_size, vocab_size)
probabilities = []
for i, token_id in enumerate(outputs.sequences[0][1:]): # skip the first token (BOS)
    # Get logits for this step
    logits = outputs.scores[i][0]
    
    # Apply softmax to get probability distribution
    probs = torch.nn.functional.softmax(logits, dim=-1)
    
    # Get probability of the actually chosen token
    token_prob = probs[token_id].item()
    probabilities.append(token_prob)

confidence = sum(probabilities) / len(probabilities) if probabilities else 0

print("\n--- TrOCR PYTHON RESULT ---")
print(f"Raw Text:   {generated_text}")
print(f"Confidence: {confidence * 100:.2f}%")
print("---------------------------\n")
