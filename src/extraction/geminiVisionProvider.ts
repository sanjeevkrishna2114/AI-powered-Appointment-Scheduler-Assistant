import { GoogleGenAI } from "@google/genai";
import { OCRProvider, OCRResult } from "./tesseractProvider";
import * as dotenv from "dotenv";

dotenv.config();

export class GeminiVisionProvider implements OCRProvider {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async extractText(imageBuffer: Buffer): Promise<OCRResult> {
    const response = await this.ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType: "image/jpeg" // assume JPEG for now; buffer sniffing can be added later
          }
        },
        "Extract all the text visible in this image. Output ONLY the exact text found, with no other commentary."
      ]
    });

    const text = response.text ? response.text.trim() : "";
    
    // We return confidence 0 here because Gemini does not provide a native token-confidence.
    // The true confidence will be calculated via agreement score in ocrWithFallback.
    return {
      text,
      confidence: 0.0
    };
  }
}
