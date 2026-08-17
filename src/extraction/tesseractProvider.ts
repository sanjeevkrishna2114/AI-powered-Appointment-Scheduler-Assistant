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
      // Fast check: Run 0-degree first
      const baselineResult = await Tesseract.recognize(imageBuffer, 'eng', { logger: () => {} });
      let bestConfidence = baselineResult.data.confidence / 100.0;
      let bestText = baselineResult.data.text.trim();

      // If confidence is solid, skip rotation to save time
      if (bestConfidence >= 0.75) {
        return { text: bestText, confidence: bestConfidence };
      }

      // If baseline is poor, brute-force the other 3 angles in parallel using sharp
      const sharp = (await import('sharp')).default;
      const angles = [90, 180, 270];
      
      const rotationPromises = angles.map(async (angle) => {
        const rotatedBuffer = await sharp(imageBuffer).rotate(angle).toBuffer();
        const res = await Tesseract.recognize(rotatedBuffer, 'eng', { logger: () => {} });
        return {
          text: res.data.text.trim(),
          confidence: res.data.confidence / 100.0
        };
      });

      const results = await Promise.all(rotationPromises);
      
      for (const res of results) {
        if (res.confidence > bestConfidence) {
          bestConfidence = res.confidence;
          bestText = res.text;
        }
      }

      return {
        text: bestText,
        confidence: bestConfidence
      };
    } catch (e) {
      console.error("Tesseract Provider Error:", e);
      return { text: "", confidence: 0.0 };
    }
  }
}
