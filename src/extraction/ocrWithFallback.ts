import { TesseractProvider } from "./tesseractProvider";
import { GeminiVisionProvider } from "./geminiVisionProvider";

export interface OCRFallbackResult {
  text: string;
  confidence: number;
  engineUsed: string;
  escalated: boolean;
}

const CRITICAL_TOKEN_PATTERN = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b|\b(\d{1,2}:\d{2})\b|\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/gi;

function extractCriticalTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  const matches = [...text.matchAll(CRITICAL_TOKEN_PATTERN)];
  for (const match of matches) {
    tokens.add(match[0].toLowerCase().trim());
  }
  return tokens;
}

export function criticalTokenAgreement(textA: string, textB: string): number {
  const tokensA = extractCriticalTokens(textA);
  const tokensB = extractCriticalTokens(textB);

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0; // Neither found time tokens, let Step 2 judge
  if (tokensA.size === 0 || tokensB.size === 0) return 0.5; // One found something, one found nothing — genuine uncertainty

  let intersectionCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionCount++;
    }
  }

  const unionCount = tokensA.size + tokensB.size - intersectionCount;
  return intersectionCount / unionCount;
}

export async function ocrWithFallback(imageBuffer: Buffer): Promise<OCRFallbackResult> {
  const tesseract = new TesseractProvider();
  const gemini = new GeminiVisionProvider();

  // 1. Run Tier 1 (Tesseract)
  const tessResult = await tesseract.extractText(imageBuffer);

  // 2. Evaluate Tier 1 Confidence
  if (tessResult.confidence >= 0.75) {
    return {
      text: tessResult.text,
      confidence: tessResult.confidence,
      engineUsed: "tesseract",
      escalated: false
    };
  }

  // 3. Escalate to Tier 2 (Gemini Vision)
  try {
    const geminiResult = await gemini.extractText(imageBuffer);
    
    // 4. Compute derived confidence via critical-token agreement
    const agreement = criticalTokenAgreement(tessResult.text, geminiResult.text);

    return {
      text: geminiResult.text,
      confidence: agreement,
      engineUsed: "gemini-vision",
      escalated: true
    };
  } catch (error) {
    console.error("Tier 2 (Gemini) failed during escalation. Falling back to Tier 1.", error);
    // Safe Fallback: if Gemini crashes or rate limits, we return Tesseract's weak result,
    // which will likely fail G2 downstream (since we know confidence < 0.75).
    return {
      text: tessResult.text,
      confidence: tessResult.confidence,
      engineUsed: "tesseract-fallback",
      escalated: false
    };
  }
}
