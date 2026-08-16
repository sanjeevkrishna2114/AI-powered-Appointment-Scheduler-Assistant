require('dotenv').config();
const { GoogleGenAI } = require("@google/genai");
const fs = require('fs');

async function testGeminiVision() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const imagePath = "C:\\Users\\sankr\\.gemini\\antigravity-ide\\brain\\52e1235b-b631-4a22-92b0-f61b39a82ed6\\.user_uploaded\\media_1786889712569.jpg";
    
    console.log("Loading image...");
    const imageBuffer = fs.readFileSync(imagePath);
    
    console.log("Calling Gemini Vision API...");
    try {
        const response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: [
                {
                    inlineData: {
                        data: imageBuffer.toString("base64"),
                        mimeType: "image/jpeg"
                    }
                },
                "Extract all the text visible in this image. Output ONLY the exact text found, with no other commentary."
            ]
        });

        console.log("\n--- GEMINI VISION RESULT ---");
        console.log(`Raw Text: "${response.text.trim()}"`);
        console.log("----------------------------\n");
    } catch (e) {
        console.error("API Error:", e);
    }
}

testGeminiVision();
