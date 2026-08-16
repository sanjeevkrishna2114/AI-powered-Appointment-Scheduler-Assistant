const Tesseract = require("tesseract.js");
const { Jimp } = require("jimp"); // v1.x uses { Jimp }, v0.x uses Jimp

const imagePath = "C:\\Users\\sankr\\.gemini\\antigravity-ide\\brain\\52e1235b-b631-4a22-92b0-f61b39a82ed6\\.user_uploaded\\media_1786889712569.jpg";
const processedPath = "processed_handwriting.png";

async function runTest() {
    console.log("Loading image with Jimp...");
    
    try {
        let image;
        try {
            // Jimp 1.x syntax
            image = await Jimp.read(imagePath);
        } catch (e) {
            // Jimp 0.x syntax fallback
            const JimpLegacy = require("jimp");
            image = await JimpLegacy.read(imagePath);
        }

        console.log("Applying preprocessing (Grayscale + Contrast + Threshold)...");
        // 1. Convert to grayscale
        image.greyscale();
        
        // 2. Increase contrast (values are -1 to 1 for Jimp 0.x, or sometimes -100 to 100)
        // Let's use normalize() which automatically stretches the contrast
        image.normalize();

        // 3. Optional: apply a threshold to make it purely black and white (binarization)
        // This drops light gray pixels to white, and dark pixels to black.
        // Wait, Jimp doesn't have a built-in threshold method in all versions.
        // We'll use a basic contrast bump and greyscale which often helps Tesseract a lot.
        try {
           image.contrast(0.5); // Increase contrast by 50%
        } catch(e) {}

        await image.write(processedPath);
        console.log(`Saved preprocessed image to ${processedPath}`);

        console.log("\nRunning Tesseract on preprocessed image...");
        const result = await Tesseract.recognize(
            processedPath,
            'eng',
            { logger: m => {} }
        );
        
        console.log("--- PREPROCESSED OCR RESULT ---");
        console.log(`Raw Text: "${result.data.text.trim()}"`);
        console.log(`Confidence: ${result.data.confidence.toFixed(2)}%`);
        console.log("-------------------------------\n");

    } catch (e) {
        console.error("Error during preprocessing or OCR:", e);
    }
}

runTest();
