import { pipeline, env, VisionEncoderDecoderModel, AutoProcessor } from '@xenova/transformers';

// Suppress local model loading warnings if missing
env.allowLocalModels = false;

const imagePath = "C:\\Users\\sankr\\.gemini\\antigravity-ide\\brain\\52e1235b-b631-4a22-92b0-f61b39a82ed6\\.user_uploaded\\media_1786889712569.jpg";

async function testTrOCR() {
    console.log("Loading TrOCR model (this may take a minute to download the first time)...");
    
    try {
        const model_id = "Xenova/trocr-base-handwritten";
        
        // Load the pipeline for a quick sanity check
        const ocr = await pipeline("image-to-text", model_id);
        const result = await ocr(imagePath);
        console.log("\n--- High-level Pipeline Result ---");
        console.log("Raw Text:", result[0].generated_text);
        
        // Let's try the lower-level API to get token scores for confidence
        console.log("\nLoading low-level model to get token probabilities...");
        const processor = await AutoProcessor.from_pretrained(model_id);
        const model = await VisionEncoderDecoderModel.from_pretrained(model_id);
        
        // Prepare image
        // We'll use the raw URL approach, Transformers.js can read from local file path or URL
        const image = await processor(imagePath);
        
        // Generate with output_scores
        const output = await model.generate(image.pixel_values, {
            return_dict_in_generate: true,
            output_scores: true,
            max_new_tokens: 30
        });
        
        // Decode
        const decoded = processor.decode(output.sequences[0], { skip_special_tokens: true });
        
        console.log("--- Low-level Model Result ---");
        console.log("Raw Text:", decoded);
        
        // We can inspect output.scores here to compute confidence
        // output.scores is an array of tensors representing logits for each token step
        if (output.scores) {
            console.log(`Successfully retrieved scores for ${output.scores.length} tokens.`);
        }
        
    } catch (e) {
        console.error("TrOCR Test Error:", e);
    }
}

testTrOCR();
