import Tesseract from "tesseract.js";

export interface OCRResult {
  text: string;
  confidence: number;
}

export interface OCRProvider {
  extractText(imageBuffer: Buffer): Promise<OCRResult>;
}

export class TesseractProvider implements OCRProvider {
  async extractText(imageBuffer: Buffer): Promise<OCRResult> {
    try {
      const result = await Tesseract.recognize(imageBuffer, 'eng', {
        logger: () => {} // suppress logs
      });

      // Tesseract confidence is 0-100, we map to 0-1
      const confidence = result.data.confidence / 100.0;
      return {
        text: result.data.text.trim(),
        confidence
      };
    } catch (e) {
      console.error("Tesseract Provider Error:", e);
      return { text: "", confidence: 0.0 };
    }
  }
}
