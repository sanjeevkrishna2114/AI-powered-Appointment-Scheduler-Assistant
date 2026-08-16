const fs = require('fs');

async function testTrOCR() {
    const imagePath = "C:\\Users\\sankr\\.gemini\\antigravity-ide\\brain\\52e1235b-b631-4a22-92b0-f61b39a82ed6\\.user_uploaded\\media_1786889712569.jpg";
    const imageBuffer = fs.readFileSync(imagePath);

    console.log("Sending handwritten image to HuggingFace TrOCR API...");
    
    try {
        const response = await fetch(
            "https://api-inference.huggingface.co/models/microsoft/trocr-base-handwritten",
            {
                headers: {
                    // No auth token; relying on public tier limit
                    "Content-Type": "application/octet-stream"
                },
                method: "POST",
                body: imageBuffer,
            }
        );
        
        const result = await response.json();
        
        if (response.ok) {
            console.log("\n--- TrOCR RESULT ---");
            console.log(result);
            console.log("--------------------");
        } else {
            console.error("API Error:", result);
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

testTrOCR();
