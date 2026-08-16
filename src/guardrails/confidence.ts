export function aggregateConfidence(
  ocrConfidence: number,
  entitiesConfidence: number,
  normalizationConfidence: number
): number {
  return Math.min(ocrConfidence, entitiesConfidence, normalizationConfidence);
}

export const THRESHOLDS = {
  OCR_MIN: 0.6,          // below this: stop at Step 1, don't even attempt extraction
  ENTITIES_MIN: 0.7,
  NORMALIZATION_MIN: 0.7,
  FINAL_MIN: 0.7,         // composite floor for final accept
};
